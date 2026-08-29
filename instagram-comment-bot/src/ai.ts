/**
 * The model half of the bot: comments no keyword rule covers.
 *
 * The system prompt is the whole product here — it carries the brand voice and,
 * more importantly, the boundaries. A comment is public, so the bot answers
 * short, never invents prices or stock, and says nothing at all when it isn't
 * sure. `<skip>` is how the model exercises that last option.
 */

import Anthropic from "@anthropic-ai/sdk";
import { clamp } from "./text.js";

export type ReplyContext = {
  text: string;
  username: string;
};

export type Replier = {
  generate(context: ReplyContext): Promise<string | undefined>;
};

export type ClaudeOptions = {
  /** Business facts and tone the replies must stay inside. */
  persona: string;
  apiKey?: string;
  model?: string;
  maxChars?: number;
  client?: Anthropic;
};

const SKIP = "<skip>";

const GUARDRAILS = [
  "You write public replies to Instagram comments on behalf of the account below.",
  "",
  "Rules:",
  "- Reply in the same language the comment is written in.",
  "- One or two sentences, under 280 characters, warm but not gushing. At most one emoji.",
  "- Only state facts given in the account brief. Never invent prices, stock, delivery times or discounts.",
  "- For anything personal — an order, a complaint, an address, a payment — invite them to DM instead of answering publicly.",
  `- If the comment is spam, abuse, a question you cannot answer from the brief, or needs a human, reply with exactly ${SKIP} and nothing else.`,
  "- Output only the reply text. No quotes, no preamble, no hashtags unless the brief asks for them.",
].join("\n");

/** Ask Claude for a reply, or `undefined` when it should stay silent. */
export function claudeReplier(options: ClaudeOptions): Replier {
  const client = options.client ?? new Anthropic({ ...(options.apiKey ? { apiKey: options.apiKey } : {}) });
  const model = options.model ?? "claude-opus-5";
  const maxChars = options.maxChars ?? 280;
  const system = `${GUARDRAILS}\n\nAccount brief:\n${options.persona.trim()}`;

  return {
    async generate(context) {
      // The beta namespace is where `output_config` is typed in this SDK line;
      // the request is otherwise an ordinary Messages call.
      const response = await client.beta.messages.create({
        model,
        max_tokens: 2000,
        // Short public replies: low effort keeps latency and cost down, and the
        // guardrails above do more for quality here than extra reasoning would.
        output_config: { effort: "low" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Comment from @${context.username || "someone"}:\n"""\n${context.text}\n"""`,
          },
        ],
      });

      if (response.stop_reason === "refusal") return undefined;

      const reply = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join(" ")
        .trim();

      if (!reply || reply.includes(SKIP)) return undefined;
      return clamp(reply, maxChars);
    },
  };
}
