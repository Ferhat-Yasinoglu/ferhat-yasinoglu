/**
 * The seam between "what should we say" and "where do we say it".
 *
 * Instagram and WhatsApp both deliver through Meta's webhook and both take the
 * same rules, but they are not the same room: a comment is public and can be
 * hidden, a WhatsApp message is a one-to-one chat that can only be answered,
 * and only inside the window WhatsApp allows. A channel therefore declares
 * what it can do, and the bot never asks it for anything else.
 */

export type ChannelName = "instagram" | "whatsapp";

/** One thing a person said, flattened out of whatever the platform sent. */
export type Incoming = {
  channel: ChannelName;
  /** Platform id of the message or comment — the dedupe key. */
  id: string;
  text: string;
  /** Who said it, in platform terms. Compared against the account's own id. */
  authorId: string;
  /** Display name where the platform gives one; "" when it does not. */
  username: string;
  /** When they said it. Used for windows that expire. */
  at: Date;
  /** Where it lives: the media for a comment, the chat for a message. */
  context?: string;
};

export type Capabilities = {
  /** A public reply under the original. Both channels have this. */
  reply: boolean;
  /** A private message answering it. Instagram only, once per comment. */
  privateReply: boolean;
  /** Hiding. Meaningless in a one-to-one chat. */
  hide: boolean;
};

export type Channel = {
  name: ChannelName;
  /** Path this channel's webhook is mounted at. */
  path: string;
  /** The token Meta echoes back when the webhook is first verified. */
  verifyToken: string;
  /** App secret for `X-Hub-Signature-256`. Empty disables the check. */
  appSecret: string;
  can: Capabilities;
  /** Ids whose own messages are never answered — the account itself. */
  ownIds: string[];

  /** Pull the answerable messages out of a delivery, or [] if there are none. */
  parse(body: unknown): Incoming[];

  /**
   * A reason this message cannot be answered right now, or undefined when it
   * can. WhatsApp uses it for the 24-hour window; Instagram has no such limit.
   */
  refuse?(message: Incoming, now: Date): string | undefined;

  send(message: Incoming, text: string): Promise<void>;
  sendPrivate?(message: Incoming, text: string): Promise<void>;
  hide?(message: Incoming): Promise<void>;
};
