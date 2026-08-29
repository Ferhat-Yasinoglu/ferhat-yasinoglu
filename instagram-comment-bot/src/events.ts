/**
 * Turning a Meta webhook body into the handful of fields the bot acts on.
 *
 * The payload nests three levels deep (entry → changes → value) and a single
 * POST can carry several comments across several media, so parsing flattens it
 * and drops anything that isn't a comment we can answer.
 */

export type CommentEvent = {
  /** The comment to reply under. */
  commentId: string;
  /** The post, reel or story the comment sits on. */
  mediaId: string;
  text: string;
  /** Instagram-scoped id of the commenter — compare with your own to spot self-comments. */
  fromId: string;
  username: string;
  /** Set when the comment is itself a reply in a thread. */
  parentId?: string;
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

/**
 * Extract the answerable comments from a webhook body. Unknown fields
 * (mentions, live_comments, story insights) and malformed entries are skipped
 * rather than thrown on: Meta retries a non-200 for hours.
 */
export function parseComments(body: unknown): CommentEvent[] {
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return [];

  const events: CommentEvent[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes as Change[]) {
      if (change?.field !== "comments") continue;
      const value = change.value;
      const commentId = value?.id;
      const text = value?.text;
      const fromId = value?.from?.id;
      if (!commentId || typeof text !== "string" || !text.trim() || !fromId) continue;

      events.push({
        commentId,
        mediaId: value?.media?.id ?? "",
        text: text.trim(),
        fromId,
        username: value?.from?.username ?? "",
        ...(value?.parent_id ? { parentId: value.parent_id } : {}),
      });
    }
  }
  return events;
}
