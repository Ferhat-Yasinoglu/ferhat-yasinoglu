import type { Run, Store, Subscriber } from "../store/index.js";
import { TelegramClient, TelegramError } from "../telegram.js";
import { looseEquals } from "../text.js";
import { interpolate, type Choice, type Step } from "./steps.js";

/**
 * Executes flows.
 *
 * A run advances through steps until one of three things happens: it needs an
 * answer, it needs to wait out a delay, or it reaches the end. That is the whole
 * contract — everything else (triggers, incoming updates, the worker loop) is
 * built on `advance` and `resume`.
 */

export type StepBudget = {
  /** Guards against a goto cycle spinning forever inside one advance(). */
  maxSteps: number;
};

const DEFAULT_BUDGET: StepBudget = { maxSteps: 100 };

export type AdvanceResult = {
  run: Run;
  stepsExecuted: number;
  status: "waiting" | "finished";
};

export class FlowRunner {
  constructor(
    private readonly store: Store,
    private readonly clientFor: (botId: string) => TelegramClient,
    private readonly budget: StepBudget = DEFAULT_BUDGET,
  ) {}

  /** Run from the current step until the flow blocks or ends. */
  async advance(run: Run): Promise<AdvanceResult> {
    const steps = JSON.parse(run.steps) as Step[];
    const vars = JSON.parse(run.vars) as Record<string, string>;
    const subscriber = this.store.getSubscriber(run.subscriber_id);
    if (!subscriber) throw new Error(`Subscriber ${run.subscriber_id} no longer exists.`);

    let executed = 0;

    while (executed < this.budget.maxSteps) {
      if (run.step_index >= steps.length) return this.finish(run, vars, executed);

      const step = steps[run.step_index]!;
      executed += 1;

      switch (step.type) {
        case "message":
          await this.send(subscriber, interpolate(step.text, vars));
          run.step_index += 1;
          break;

        case "question":
          await this.send(subscriber, interpolate(step.text, vars));
          return this.park(run, vars, "reply", step.save_as ?? null, null, executed);

        case "buttons": {
          const labels = step.choices.map((c, i) => ({
            label: interpolate(c.label, vars),
            // Index the choice rather than its label: labels are user text and
            // callback_data is capped at 64 bytes.
            data: `c:${run.id}:${i}`,
          }));
          await this.send(subscriber, interpolate(step.text, vars), { inlineButtons: labels });
          return this.park(run, vars, "choice", step.save_as ?? null, null, executed);
        }

        case "delay": {
          if (step.seconds === 0) {
            run.step_index += 1;
            break;
          }
          const resumeAt = new Date(Date.now() + step.seconds * 1000).toISOString();
          run.step_index += 1;
          return this.park(run, vars, "delay", null, resumeAt, executed);
        }

        case "tag":
          if (step.add_tags?.length) this.store.addTags(subscriber.id, step.add_tags);
          if (step.remove_tags?.length) this.store.removeTags(subscriber.id, step.remove_tags);
          run.step_index += 1;
          break;

        case "goto":
          run.step_index = step.goto;
          break;

        case "end":
          return this.finish(run, vars, executed);
      }
    }

    // The budget ran out, which in practice means a goto loop with no waiting
    // step in it. Stop rather than hammer the subscriber.
    return this.finish(run, vars, executed, "step budget exhausted (likely a goto loop)");
  }

  /**
   * Feed an answer into a parked run and keep going.
   * Returns null when the run was not waiting for this kind of input.
   */
  async resume(run: Run, input: { kind: "reply" | "choice"; text: string }): Promise<AdvanceResult | null> {
    if (run.status !== "waiting" || run.waiting_for !== input.kind) return null;

    const steps = JSON.parse(run.steps) as Step[];
    const vars = JSON.parse(run.vars) as Record<string, string>;

    if (run.save_as) vars[run.save_as] = input.text;

    // A chosen button may redirect; a typed reply always falls through.
    let next = run.step_index + 1;
    if (input.kind === "choice") {
      const step = steps[run.step_index];
      if (step?.type === "buttons") {
        const choice = matchChoice(step.choices, input.text);
        if (choice?.goto !== undefined) next = choice.goto;
        if (run.save_as && choice) vars[run.save_as] = choice.value ?? choice.label;
      }
    }

    run.step_index = next;
    run.waiting_for = null;
    run.save_as = null;
    run.vars = JSON.stringify(vars);
    return this.advance(run);
  }

  /** Resolve which choice a callback payload refers to. */
  choiceIndexFromCallback(data: string): { runId: string; index: number } | null {
    const match = /^c:([^:]+):(\d+)$/.exec(data);
    return match ? { runId: match[1]!, index: Number(match[2]) } : null;
  }

  labelForChoice(run: Run, index: number): string | null {
    const steps = JSON.parse(run.steps) as Step[];
    const step = steps[run.step_index];
    if (step?.type !== "buttons") return null;
    return step.choices[index]?.label ?? null;
  }

  private async send(subscriber: Subscriber, text: string, options?: { inlineButtons?: { label: string; data: string }[] }) {
    const client = this.clientFor(subscriber.bot_id);
    try {
      await client.sendMessage(subscriber.chat_id, text, options ?? {});
      this.store.logMessage(subscriber.bot_id, subscriber.id, "out", text);
    } catch (error) {
      if (error instanceof TelegramError && error.isBlocked) {
        // The subscriber blocked the bot. Record it and let the run end quietly
        // rather than retrying into a wall.
        this.store.setSubscriberBlocked(subscriber.id, true);
      }
      throw error;
    }
  }

  private park(
    run: Run,
    vars: Record<string, string>,
    waitingFor: "reply" | "choice" | "delay",
    saveAs: string | null,
    resumeAt: string | null,
    executed: number,
  ): AdvanceResult {
    run.status = "waiting";
    run.waiting_for = waitingFor;
    run.save_as = saveAs;
    run.resume_at = resumeAt;
    run.vars = JSON.stringify(vars);
    this.store.saveRun(run);
    return { run, stepsExecuted: executed, status: "waiting" };
  }

  private finish(run: Run, vars: Record<string, string>, executed: number, note?: string): AdvanceResult {
    run.status = "finished";
    run.waiting_for = null;
    run.save_as = null;
    run.resume_at = null;
    if (note) vars.__note = note;
    run.vars = JSON.stringify(vars);
    this.store.saveRun(run);
    return { run, stepsExecuted: executed, status: "finished" };
  }
}

/**
 * Match a pressed button by its label or value.
 *
 * An exact match wins; otherwise fall back to a case- and diacritic-insensitive
 * one, so someone who types "learning" instead of tapping "Learning" — or
 * "gunaydin" for "Günaydın" — still lands on the right branch.
 */
function matchChoice(choices: Choice[], text: string): Choice | undefined {
  return (
    choices.find((c) => c.label === text) ??
    choices.find((c) => (c.value ?? c.label) === text) ??
    choices.find((c) => looseEquals(c.label, text)) ??
    choices.find((c) => looseEquals(c.value ?? c.label, text))
  );
}
