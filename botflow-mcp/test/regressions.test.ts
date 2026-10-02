import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { validate } from "../src/jsonschema.js";
import type { Step } from "../src/engine/steps.js";
import { Worker } from "../src/worker.js";
import { FakeTelegram, VALID_TOKEN } from "./fake-telegram.js";

/**
 * One test per bug found in review. Each drives the real dispatcher, runner or
 * store — the same path the bug was reproduced on — so a regression fails here
 * rather than in someone's live funnel.
 */

let app: App;
let telegram: FakeTelegram;
let botId: string;

/** A published flow with a trigger, ready to run. */
function publish(name: string, steps: Step[], trigger: { event: string; keywords?: string[] }): string {
  const flow = app.store.createFlow(botId, name, steps);
  app.store.publishFlow(flow.id);
  app.store.createTrigger(botId, flow.id, trigger.event, trigger.keywords ?? []);
  return flow.id;
}

beforeEach(() => {
  telegram = new FakeTelegram();
  app = new App({
    dbPath: ":memory:",
    fetcher: telegram.fetcher,
    telegramBaseUrl: "https://fake.telegram",
    sendIntervalMs: 0,
  });
  botId = app.store.createBot(VALID_TOKEN, "test_bot", "Test").id;
});

afterEach(async () => {
  await app.shutdown();
});

describe("stale inline keyboards", () => {
  /**
   * Telegram leaves old inline keyboards tappable forever. The callback payload
   * used to carry only the run id and choice index, resolved against whatever
   * step the run was parked on *now* — so tapping an old button answered a
   * later, unrelated question.
   */
  it("ignores a button from a question the run has already moved past", async () => {
    publish(
      "TwoQuestions",
      [
        { type: "buttons", text: "Language?", save_as: "lang", choices: [{ label: "TR" }, { label: "EN" }] },
        { type: "buttons", text: "Plan?", save_as: "plan", choices: [{ label: "Free" }, { label: "Paid" }] },
        { type: "message", text: "lang={{lang}} plan={{plan}}" },
      ],
      { event: "start" },
    );

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("500", "/start");
    await worker.pollOnce(botId);

    const firstQuestionButton = telegram.lastInlineButtonData(0); // "TR"
    telegram.pressButton("500", firstQuestionButton);
    await worker.pollOnce(botId);

    // Now parked on "Plan?". Tapping the old "TR" button again must do nothing.
    telegram.pressButton("500", firstQuestionButton);
    await worker.pollOnce(botId);

    expect(telegram.sentTo("500")).toEqual(["Language?", "Plan?"]);

    // Answering the current question still works and keeps both answers right.
    telegram.pressButton("500", telegram.lastInlineButtonData(1)); // "Paid"
    await worker.pollOnce(botId);

    expect(telegram.sentTo("500")).toContain("lang=TR plan=Paid");
  });
});

describe("typed answers that match no choice", () => {
  /**
   * Unmatched text used to be stored as if it were a choice and the run walked
   * past the question the person never answered.
   */
  it("re-asks instead of advancing on nonsense", async () => {
    publish(
      "Pick",
      [
        { type: "buttons", text: "Plan?", save_as: "plan", choices: [{ label: "Free" }, { label: "Paid" }] },
        { type: "message", text: "You picked {{plan}}" },
      ],
      { event: "start" },
    );

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("501", "/start");
    await worker.pollOnce(botId);

    telegram.receiveText("501", "wat is dis");
    await worker.pollOnce(botId);

    // The question is repeated; the flow has not advanced.
    expect(telegram.sentTo("501")).toEqual(["Plan?", "Plan?"]);

    // A real answer still lands.
    telegram.receiveText("501", "Paid");
    await worker.pollOnce(botId);
    expect(telegram.sentTo("501")).toContain("You picked Paid");
  });

  it("still accepts a typed label in any case or accenting", async () => {
    publish(
      "Pick",
      [
        { type: "buttons", text: "Dil?", save_as: "d", choices: [{ label: "Türkçe" }, { label: "English" }] },
        { type: "message", text: "ok {{d}}" },
      ],
      { event: "start" },
    );

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("502", "/start");
    await worker.pollOnce(botId);

    telegram.receiveText("502", "turkce");
    await worker.pollOnce(botId);

    expect(telegram.sentTo("502")).toContain("ok Türkçe");
  });
});

describe("a failed advance", () => {
  /**
   * Runs are created in the `waiting` state. A throw partway through used to
   * leave that row forever, and an active run suppresses `any_message`
   * triggers — so one 403 made a subscriber permanently deaf.
   */
  it("does not leave a phantom active run behind", async () => {
    publish("Greet", [{ type: "message", text: "hi" }], { event: "any_message" });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.blockChat("503");
    telegram.receiveText("503", "hello");
    await worker.pollOnce(botId);

    const subscriber = app.store.upsertSubscriber(botId, "503", "Tester", null);
    expect(app.store.activeRunFor(subscriber.id)).toBeUndefined();

    // The subscriber is reachable again and the trigger still fires.
    telegram.unblockChat("503");
    telegram.receiveText("503", "hello again");
    await worker.pollOnce(botId);

    expect(telegram.sentTo("503")).toEqual(["hi"]);
  });
});

describe("waking a delayed run", () => {
  /**
   * The worker used to clear the parking marker in the database *before*
   * advancing, so a transient failure stranded the run where `dueRuns` could
   * never find it again.
   */
  it("re-parks the run when the wake-up fails, instead of stranding it", async () => {
    publish(
      "Drip",
      [
        { type: "message", text: "First" },
        { type: "delay", seconds: 3600 },
        { type: "message", text: "Second" },
      ],
      { event: "start" },
    );

    const worker = new Worker(app, {
      tickMs: 60_000,
      retryDelayMs: 0,
      onError: () => undefined,
    });
    telegram.receiveText("504", "/start");
    await worker.pollOnce(botId);

    const parked = app.store.dueRuns(new Date(Date.now() + 7200_000).toISOString())[0]!;
    app.store.saveRun({ ...parked, resume_at: new Date(Date.now() - 1000).toISOString() });

    // The wake-up hits a transient failure.
    telegram.failNext(500, "Internal Server Error");
    expect(await worker.wakeDueRuns()).toBe(0);
    expect(telegram.sentTo("504")).toEqual(["First"]);

    // Crucially, the run is still due — not lost.
    const stillDue = app.store.dueRuns();
    expect(stillDue.map((r) => r.id)).toEqual([parked.id]);

    // And the retry delivers it.
    expect(await worker.wakeDueRuns()).toBe(1);
    expect(telegram.sentTo("504")).toEqual(["First", "Second"]);
  });
});

describe("a trigger firing during a conversation", () => {
  /**
   * Only `any_message` used to respect an active run, so a keyword typed during
   * a delay started a second run. The two then competed for the next reply and
   * the older flow's question was left permanently unanswered.
   */
  it("supersedes the running flow rather than running two at once", async () => {
    publish(
      "Slow",
      [
        { type: "message", text: "Slow start" },
        { type: "delay", seconds: 3600 },
        { type: "question", text: "Slow question", save_as: "a" },
      ],
      { event: "start" },
    );
    publish("Promo", [{ type: "question", text: "Promo question", save_as: "b" },
      { type: "message", text: "promo got {{b}}" }], { event: "keyword", keywords: ["indirim"] });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("505", "/start");
    await worker.pollOnce(botId);

    telegram.receiveText("505", "indirim var mı?");
    await worker.pollOnce(botId);

    const subscriber = app.store.upsertSubscriber(botId, "505", "Tester", null);
    const active = app.store.activeRunFor(subscriber.id)!;

    // Exactly one live run, and it is the promo.
    expect(JSON.parse(active.steps)[0].text).toBe("Promo question");

    // The reply goes to the promo, not to the abandoned flow.
    telegram.receiveText("505", "evet");
    await worker.pollOnce(botId);
    expect(telegram.sentTo("505")).toContain("promo got evet");
  });
});

describe("segments with a repeated tag", () => {
  /**
   * The segment query counts distinct tags, so a duplicate used to demand a
   * count no subscriber could reach and returned nobody.
   */
  it("treats a repeated tag as one tag", () => {
    const sub = app.store.upsertSubscriber(botId, "506", "Tester", null);
    app.store.addTags(sub.id, ["vip"]);

    expect(app.store.segment(botId, ["vip", "vip"]).map((s) => s.id)).toEqual([sub.id]);
    expect(app.store.segment(botId, ["vip", "vip", "vip"])).toHaveLength(1);
  });
});

describe("a schema with an uncompilable pattern", () => {
  /**
   * An imported spec can carry a regex this engine cannot compile. That used to
   * throw out of the validator, turning a bad argument into an opaque protocol
   * error.
   */
  it("reports the bad pattern as a validation error instead of throwing", () => {
    const schema = { type: "string", pattern: "([unclosed" };
    expect(() => validate("anything", schema)).not.toThrow();
    expect(validate("anything", schema)[0]?.message).toMatch(/invalid pattern/);
  });
});
