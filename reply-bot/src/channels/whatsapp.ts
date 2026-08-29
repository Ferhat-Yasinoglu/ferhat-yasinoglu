/**
 * WhatsApp messages, through the Cloud API.
 *
 * Same webhook envelope as Instagram, different room: this is a one-to-one
 * chat, so there is nothing to hide and no separate DM — the reply *is* the
 * DM. Two things have no counterpart on the comment side:
 *
 *   - The 24-hour window. Free-form text may only be sent within 24 hours of
 *     the person's last message; outside it WhatsApp accepts nothing but
 *     pre-approved templates. The bot would rather stay silent than send a
 *     message that bounces, so a stale delivery is refused here.
 *   - Delivery receipts. Every message the bot sends comes back as a `statuses`
 *     entry. Parsing ignores them; treating one as an incoming message would
 *     have the bot answering its own receipts forever.
 */

import { callGraph, type Fetcher } from "../meta.js";
import type { Channel, Incoming } from "./types.js";

export type WhatsAppOptions = {
  accessToken: string;
  /** The phone number id that sends — not the phone number itself. */
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
  path?: string;
  baseUrl?: string;
  /** How long after a message WhatsApp still accepts free-form text. */
  windowHours?: number;
  fetcher?: Fetcher;
};

type WaMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

type WaValue = {
  messages?: WaMessage[];
  statuses?: unknown[];
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
};

/** The text of a message, whichever shape the person's client sent it in. */
function textOf(message: WaMessage): string {
  const candidates = [
    message.text?.body,
    message.button?.text,
    message.interactive?.button_reply?.title,
    message.interactive?.list_reply?.title,
  ];
  return (candidates.find((value) => typeof value === "string" && value.trim()) ?? "").trim();
}

export function parseMessages(body: unknown): Incoming[] {
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return [];

  const messages: Incoming[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes as { field?: string; value?: WaValue }[]) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      if (!Array.isArray(value?.messages)) continue; // delivery receipts only

      const names = new Map(
        (value.contacts ?? []).map((contact) => [contact.wa_id ?? "", contact.profile?.name ?? ""]),
      );

      for (const message of value.messages) {
        const id = message?.id;
        const from = message?.from;
        const text = textOf(message ?? {});
        if (!id || !from || !text) continue; // photos, stickers, voice notes

        const seconds = Number(message.timestamp);
        messages.push({
          channel: "whatsapp",
          id,
          text,
          authorId: from,
          username: names.get(from) ?? "",
          at: new Date((Number.isFinite(seconds) ? seconds : Date.now() / 1000) * 1000),
          context: from,
        });
      }
    }
  }
  return messages;
}

export function whatsappChannel(options: WhatsAppOptions): Channel {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? "https://graph.facebook.com/v21.0";
  const windowMs = (options.windowHours ?? 24) * 60 * 60 * 1000;

  return {
    name: "whatsapp",
    path: options.path ?? "/webhook/whatsapp",
    verifyToken: options.verifyToken,
    appSecret: options.appSecret,
    can: { reply: true, privateReply: false, hide: false },
    ownIds: [],

    parse: parseMessages,

    refuse(message, now) {
      const age = now.getTime() - message.at.getTime();
      if (age > windowMs) {
        const hours = Math.round(age / 3600000);
        return `24 saat penceresi kapandı (mesaj ${hours} saatlik)`;
      }
      return undefined;
    },

    /** Reply in the chat, quoting the message it answers. */
    async send(message, text) {
      await callGraph({
        baseUrl,
        path: `/${options.phoneNumberId}/messages`,
        accessToken: options.accessToken,
        fetcher,
        json: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.authorId,
          context: { message_id: message.id },
          type: "text",
          text: { preview_url: false, body: text },
        },
      });
    },
  };
}
