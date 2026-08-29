/**
 * Instagram comments.
 *
 * A comment is public, so the channel can do all three things: answer under it,
 * answer privately in a DM, or hide it. The webhook nests three levels deep
 * (entry → changes → value) and one POST can carry several comments across
 * several posts, so parsing flattens it and drops anything unanswerable —
 * unknown fields, empty text, a missing author. Meta retries a non-200 for
 * hours, so nothing here throws on a malformed delivery.
 */

import { callGraph, type Fetcher } from "../meta.js";
import type { Channel, Incoming } from "./types.js";

export type InstagramOptions = {
  accessToken: string;
  /** The Instagram professional account id that owns the media. */
  igUserId: string;
  verifyToken: string;
  appSecret: string;
  path?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
};

type Change = {
  field?: string;
  value?: {
    id?: string;
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string };
    parent_id?: string;
  };
};

export function parseComments(body: unknown): Incoming[] {
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return [];

  const messages: Incoming[] = [];
  for (const entry of entries) {
    const time = (entry as { time?: number })?.time;
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes as Change[]) {
      if (change?.field !== "comments") continue;
      const value = change.value;
      const id = value?.id;
      const text = value?.text;
      const authorId = value?.from?.id;
      if (!id || typeof text !== "string" || !text.trim() || !authorId) continue;

      messages.push({
        channel: "instagram",
        id,
        text: text.trim(),
        authorId,
        username: value?.from?.username ?? "",
        at: new Date((typeof time === "number" ? time : Date.now() / 1000) * 1000),
        ...(value?.media?.id ? { context: value.media.id } : {}),
      });
    }
  }
  return messages;
}

export function instagramChannel(options: InstagramOptions): Channel {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? "https://graph.facebook.com/v21.0";
  const call = (path: string, form: Record<string, string>) =>
    callGraph({ baseUrl, path, accessToken: options.accessToken, fetcher, form });

  return {
    name: "instagram",
    path: options.path ?? "/webhook/instagram",
    verifyToken: options.verifyToken,
    appSecret: options.appSecret,
    can: { reply: true, privateReply: true, hide: true },
    ownIds: [options.igUserId].filter(Boolean),

    parse: parseComments,

    /** Public reply, threaded under the comment. */
    async send(message, text) {
      await call(`/${message.id}/replies`, { message: text });
    },

    /**
     * Private reply: a DM answering a comment. Instagram allows exactly one per
     * comment and only within 7 days of it, so a failure here is not retryable.
     */
    async sendPrivate(message, text) {
      await call(`/${options.igUserId}/messages`, {
        recipient: JSON.stringify({ comment_id: message.id }),
        message: JSON.stringify({ text }),
      });
    },

    /** Hide a comment instead of answering it — spam, abuse, competitor links. */
    async hide(message) {
      await call(`/${message.id}`, { hide: "true" });
    },
  };
}
