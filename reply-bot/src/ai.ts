/**
 * The model half of the bot: what no keyword rule covers.
 *
 * The system prompt is the whole product here — it carries the brand voice
 * and, more importantly, the boundaries. The two channels are different rooms,
 * so the prompt says which one it is writing into: a comment is read by
 * everyone scrolling past, a WhatsApp message is a conversation with one
 * person. Either way the bot answers short, never invents facts, and says
 * nothing at all when it isn't sure. `<skip>` is how the model takes that
 * last option.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ChannelName } from "./channels/types.js";
import { clamp } from "./text.js";

export type ReplyContext = {
  text: string;
  username: string;
  channel: ChannelName;
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

const ROOM: Record<ChannelName, string> = {
  instagram:
    "You are writing a public reply under an Instagram comment. Everyone scrolling the post will read it.",
  whatsapp:
    "You are writing a WhatsApp message back to one person in a private chat. Only they will read it.",
};

const GUARDRAILS = [
  "You answer on behalf of the account below.",
  "",
  "Rules:",
  "- Reply in the same language the message is written in.",
  "- One or two sentences, under 280 characters, warm but not gushing. At most one emoji.",
  "- Only state facts given in the account brief. Never invent prices, dates, availability or technical detail.",
  "- For anything that needs a person — an order, a complaint, a payment, a commitment — say you will get back to them rather than answering for them.",
  `- If the message is spam, abuse, a question you cannot answer from the brief, or needs a human, reply with exactly ${SKIP} and nothing else.`,
  "- Output only the reply text. No quotes, no preamble, no hashtags unless the brief asks for them.",
].join("\n");

/** Ask Claude for a reply, or `undefined` when it should stay silent. */
export function claudeReplier(options: ClaudeOptions): Replier {
  const client = options.client ?? new Anthropic({ ...(options.apiKey ? { apiKey: options.apiKey } : {}) });
  const model = options.model ?? "claude-opus-5";
  const maxChars = options.maxChars ?? 280;
  const brief = options.persona.trim();

  return {
    async generate(context) {
      // The stable half of the prompt is cached; the line naming the room is
      // part of it, so both channels keep their own warm prefix.
      const system = `${GUARDRAILS}\n\n${ROOM[context.channel]}\n\nAccount brief:\n${brief}`;

      // The beta namespace is where `output_config` is typed in this SDK line;
      // the request is otherwise an ordinary Messages call.
      const response = await client.beta.messages.create({
        model,
        max_tokens: 2000,
        // Short replies: low effort keeps latency and cost down, and the
        // guardrails above do more for quality here than extra reasoning would.
        output_config: { effort: "low" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Message from ${context.username ? `@${context.username}` : "someone"}:\n"""\n${context.text}\n"""`,
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
