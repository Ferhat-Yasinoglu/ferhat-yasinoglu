import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./schema.js";

/**
 * All persistence for the server, over `node:sqlite` (built into Node 22, so no
 * native build step). Every method is synchronous, which SQLite is happy with
 * and which keeps the tool handlers free of transaction plumbing.
 */

export type Bot = { id: string; token: string; username: string; label: string; created_at: string };
export type Subscriber = {
  id: string;
  bot_id: string;
  chat_id: string;
  name: string;
  username: string | null;
  blocked: number;
  created_at: string;
};
export type Flow = {
  id: string;
  bot_id: string;
  name: string;
  steps: string;
  status: string;
  created_at: string;
  published_at: string | null;
};
export type Trigger = {
  id: string;
  bot_id: string;
  flow_id: string;
  event: string;
  keywords: string;
  created_at: string;
};
export type Broadcast = {
  id: string;
  bot_id: string;
  text: string;
  tags: string;
  recipients: number;
  sent: number;
  failed: number;
  cursor: number;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
};

export type Run = {
  id: string;
  flow_id: string;
  subscriber_id: string;
  steps: string;
  step_index: number;
  status: string;
  waiting_for: string | null;
  save_as: string | null;
  vars: string;
  resume_at: string | null;
  created_at: string;
  updated_at: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function now(): string {
  return new Date().toISOString();
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    // Cascades are declared in the schema but SQLite ignores them unless this
    // pragma is set, per connection.
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  /**
   * Apply whichever migrations this database has not seen, using SQLite's own
   * `user_version` as the marker. Each runs in a transaction so a failure
   * halfway through leaves the version untouched rather than half-applied.
   */
  private migrate(): void {
    const current = Number(
      (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
    );

    for (let version = current; version < MIGRATIONS.length; version += 1) {
      this.db.exec("BEGIN");
      try {
        this.db.exec(MIGRATIONS[version]!);
        // user_version does not accept a bound parameter.
        this.db.exec(`PRAGMA user_version = ${version + 1}`);
        this.db.exec("COMMIT");
      } catch (cause) {
        this.db.exec("ROLLBACK");
        throw new Error(`Migration to schema version ${version + 1} failed.`, { cause });
      }
    }
  }

  /** The schema version this database is on. */
  get schemaVersion(): number {
    return Number((this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  }

  close(): void {
    this.db.close();
  }

  // --- bots -----------------------------------------------------------------

  createBot(token: string, username: string, label: string): Bot {
    const bot: Bot = { id: newId("bot"), token, username, label, created_at: now() };
    this.db
      .prepare("INSERT INTO bots (id, token, username, label, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(bot.id, bot.token, bot.username, bot.label, bot.created_at);
    return bot;
  }

  getBot(id: string): Bot | undefined {
    return this.db.prepare("SELECT * FROM bots WHERE id = ?").get(id) as Bot | undefined;
  }

  getBotByUsername(username: string): Bot | undefined {
    return this.db.prepare("SELECT * FROM bots WHERE username = ?").get(username) as Bot | undefined;
  }

  listBots(): (Bot & { subscribers: number })[] {
    return this.db
      .prepare(
        `SELECT b.*, (SELECT COUNT(*) FROM subscribers s WHERE s.bot_id = b.id) AS subscribers
         FROM bots b ORDER BY b.created_at`,
      )
      .all() as (Bot & { subscribers: number })[];
  }

  deleteBot(id: string): boolean {
    return this.db.prepare("DELETE FROM bots WHERE id = ?").run(id).changes > 0;
  }

  // --- subscribers ----------------------------------------------------------

  /** Find the subscriber for an incoming chat, creating them on first contact. */
  upsertSubscriber(botId: string, chatId: string, name: string, username: string | null): Subscriber {
    const existing = this.db
      .prepare("SELECT * FROM subscribers WHERE bot_id = ? AND chat_id = ?")
      .get(botId, chatId) as Subscriber | undefined;

    if (existing) {
      if (existing.name !== name || existing.username !== username) {
        this.db
          .prepare("UPDATE subscribers SET name = ?, username = ? WHERE id = ?")
          .run(name, username, existing.id);
        return { ...existing, name, username };
      }
      return existing;
    }

    const sub: Subscriber = {
      id: newId("sub"),
      bot_id: botId,
      chat_id: chatId,
      name,
      username,
      blocked: 0,
      created_at: now(),
    };
    this.db
      .prepare(
        "INSERT INTO subscribers (id, bot_id, chat_id, name, username, blocked, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      )
      .run(sub.id, sub.bot_id, sub.chat_id, sub.name, sub.username, sub.created_at);
    return sub;
  }

  getSubscriber(id: string): Subscriber | undefined {
    return this.db.prepare("SELECT * FROM subscribers WHERE id = ?").get(id) as Subscriber | undefined;
  }

  setSubscriberBlocked(id: string, blocked: boolean): void {
    this.db.prepare("UPDATE subscribers SET blocked = ? WHERE id = ?").run(blocked ? 1 : 0, id);
  }

  listSubscribers(botId: string, tag: string | undefined, limit: number, offset: number): Subscriber[] {
    if (tag) {
      return this.db
        .prepare(
          `SELECT s.* FROM subscribers s
           JOIN subscriber_tags t ON t.subscriber_id = s.id AND t.tag = ?
           WHERE s.bot_id = ? ORDER BY s.created_at LIMIT ? OFFSET ?`,
        )
        .all(tag, botId, limit, offset) as Subscriber[];
    }
    return this.db
      .prepare("SELECT * FROM subscribers WHERE bot_id = ? ORDER BY created_at LIMIT ? OFFSET ?")
      .all(botId, limit, offset) as Subscriber[];
  }

  countSubscribers(botId: string, tag?: string): number {
    const row = tag
      ? this.db
          .prepare(
            `SELECT COUNT(*) AS n FROM subscribers s
             JOIN subscriber_tags t ON t.subscriber_id = s.id AND t.tag = ?
             WHERE s.bot_id = ?`,
          )
          .get(tag, botId)
      : this.db.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE bot_id = ?").get(botId);
    return Number((row as { n: number }).n);
  }

  /** Subscribers carrying *all* of `tags` — an AND segment, not an OR one. */
  segment(botId: string, tags: string[]): Subscriber[] {
    if (tags.length === 0) {
      return this.db
        .prepare("SELECT * FROM subscribers WHERE bot_id = ? ORDER BY created_at")
        .all(botId) as Subscriber[];
    }
    const placeholders = tags.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT s.* FROM subscribers s
         JOIN subscriber_tags t ON t.subscriber_id = s.id
         WHERE s.bot_id = ? AND t.tag IN (${placeholders})
         GROUP BY s.id HAVING COUNT(DISTINCT t.tag) = ?
         ORDER BY s.created_at`,
      )
      .all(botId, ...tags, tags.length) as Subscriber[];
  }

  addTags(subscriberId: string, tags: string[]): void {
    const stmt = this.db.prepare("INSERT OR IGNORE INTO subscriber_tags (subscriber_id, tag) VALUES (?, ?)");
    for (const tag of tags) stmt.run(subscriberId, tag);
  }

  removeTags(subscriberId: string, tags: string[]): void {
    const stmt = this.db.prepare("DELETE FROM subscriber_tags WHERE subscriber_id = ? AND tag = ?");
    for (const tag of tags) stmt.run(subscriberId, tag);
  }

  getTags(subscriberId: string): string[] {
    return (
      this.db
        .prepare("SELECT tag FROM subscriber_tags WHERE subscriber_id = ? ORDER BY tag")
        .all(subscriberId) as { tag: string }[]
    ).map((r) => r.tag);
  }

  // --- flows ----------------------------------------------------------------

  createFlow(botId: string, name: string, steps: unknown): Flow {
    const flow: Flow = {
      id: newId("flow"),
      bot_id: botId,
      name,
      steps: JSON.stringify(steps),
      status: "draft",
      created_at: now(),
      published_at: null,
    };
    this.db
      .prepare("INSERT INTO flows (id, bot_id, name, steps, status, created_at) VALUES (?, ?, ?, ?, 'draft', ?)")
      .run(flow.id, flow.bot_id, flow.name, flow.steps, flow.created_at);
    return flow;
  }

  getFlow(id: string): Flow | undefined {
    return this.db.prepare("SELECT * FROM flows WHERE id = ?").get(id) as Flow | undefined;
  }

  listFlows(botId: string, status?: string): (Flow & { active_runs: number })[] {
    const sql = `SELECT f.*, (SELECT COUNT(*) FROM runs r WHERE r.flow_id = f.id AND r.status = 'waiting') AS active_runs
                 FROM flows f WHERE f.bot_id = ?${status ? " AND f.status = ?" : ""} ORDER BY f.created_at`;
    const args = status ? [botId, status] : [botId];
    return this.db.prepare(sql).all(...args) as (Flow & { active_runs: number })[];
  }

  /** Editing returns a flow to draft: a published flow must be re-published. */
  updateFlow(id: string, patch: { name?: string; steps?: unknown }): Flow | undefined {
    const flow = this.getFlow(id);
    if (!flow) return undefined;

    const name = patch.name ?? flow.name;
    const steps = patch.steps === undefined ? flow.steps : JSON.stringify(patch.steps);
    this.db
      .prepare("UPDATE flows SET name = ?, steps = ?, status = 'draft', published_at = NULL WHERE id = ?")
      .run(name, steps, id);
    return this.getFlow(id);
  }

  publishFlow(id: string): Flow | undefined {
    this.db.prepare("UPDATE flows SET status = 'published', published_at = ? WHERE id = ?").run(now(), id);
    return this.getFlow(id);
  }

  deleteFlow(id: string): boolean {
    return this.db.prepare("DELETE FROM flows WHERE id = ?").run(id).changes > 0;
  }

  // --- triggers -------------------------------------------------------------

  createTrigger(botId: string, flowId: string, event: string, keywords: string[]): Trigger {
    const trigger: Trigger = {
      id: newId("trg"),
      bot_id: botId,
      flow_id: flowId,
      event,
      keywords: JSON.stringify(keywords),
      created_at: now(),
    };
    this.db
      .prepare("INSERT INTO triggers (id, bot_id, flow_id, event, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(trigger.id, trigger.bot_id, trigger.flow_id, trigger.event, trigger.keywords, trigger.created_at);
    return trigger;
  }

  listTriggers(botId: string): (Trigger & { flow_name: string; flow_status: string })[] {
    return this.db
      .prepare(
        `SELECT t.*, f.name AS flow_name, f.status AS flow_status
         FROM triggers t JOIN flows f ON f.id = t.flow_id
         WHERE t.bot_id = ? ORDER BY t.created_at`,
      )
      .all(botId) as (Trigger & { flow_name: string; flow_status: string })[];
  }

  deleteTrigger(id: string): boolean {
    return this.db.prepare("DELETE FROM triggers WHERE id = ?").run(id).changes > 0;
  }

  // --- runs -----------------------------------------------------------------

  createRun(flowId: string, subscriberId: string, steps: unknown): Run {
    const stamp = now();
    const run: Run = {
      id: newId("run"),
      flow_id: flowId,
      subscriber_id: subscriberId,
      steps: JSON.stringify(steps),
      step_index: 0,
      status: "waiting",
      waiting_for: null,
      save_as: null,
      vars: "{}",
      resume_at: null,
      created_at: stamp,
      updated_at: stamp,
    };
    this.db
      .prepare(
        `INSERT INTO runs (id, flow_id, subscriber_id, steps, step_index, status, vars, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 'waiting', '{}', ?, ?)`,
      )
      .run(run.id, run.flow_id, run.subscriber_id, run.steps, stamp, stamp);
    return run;
  }

  getRun(id: string): Run | undefined {
    return this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
  }

  /** The one run currently holding this subscriber's conversation, if any. */
  activeRunFor(subscriberId: string): Run | undefined {
    return this.db
      .prepare("SELECT * FROM runs WHERE subscriber_id = ? AND status = 'waiting' ORDER BY created_at DESC LIMIT 1")
      .get(subscriberId) as Run | undefined;
  }

  saveRun(run: Run): void {
    this.db
      .prepare(
        `UPDATE runs SET step_index = ?, status = ?, waiting_for = ?, save_as = ?, vars = ?, resume_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        run.step_index,
        run.status,
        run.waiting_for,
        run.save_as,
        run.vars,
        run.resume_at,
        now(),
        run.id,
      );
  }

  /** Runs parked on a `delay` step whose timer has expired. */
  dueRuns(at: string = now()): Run[] {
    return this.db
      .prepare("SELECT * FROM runs WHERE status = 'waiting' AND waiting_for = 'delay' AND resume_at <= ?")
      .all(at) as Run[];
  }

  countRuns(botId: string, since: string, status?: string): number {
    const sql = `SELECT COUNT(*) AS n FROM runs r JOIN flows f ON f.id = r.flow_id
                 WHERE f.bot_id = ? AND r.created_at >= ?${status ? " AND r.status = ?" : ""}`;
    const args = status ? [botId, since, status] : [botId, since];
    return Number((this.db.prepare(sql).get(...args) as { n: number }).n);
  }

  runStatsByFlow(botId: string, since: string): { flow_id: string; name: string; started: number; completed: number }[] {
    return this.db
      .prepare(
        `SELECT f.id AS flow_id, f.name AS name,
                COUNT(r.id) AS started,
                SUM(CASE WHEN r.status = 'finished' THEN 1 ELSE 0 END) AS completed
         FROM flows f LEFT JOIN runs r ON r.flow_id = f.id AND r.created_at >= ?
         WHERE f.bot_id = ? GROUP BY f.id ORDER BY f.created_at`,
      )
      .all(since, botId)
      .map((r) => {
        const row = r as { flow_id: string; name: string; started: number; completed: number | null };
        return { ...row, started: Number(row.started), completed: Number(row.completed ?? 0) };
      });
  }

  // --- messages and broadcasts ---------------------------------------------

  logMessage(botId: string, subscriberId: string | null, direction: "in" | "out", text: string): void {
    this.db
      .prepare("INSERT INTO messages (id, bot_id, subscriber_id, direction, text, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId("msg"), botId, subscriberId, direction, text, now());
  }

  countMessages(botId: string, direction: "in" | "out", since: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM messages WHERE bot_id = ? AND direction = ? AND created_at >= ?")
      .get(botId, direction, since);
    return Number((row as { n: number }).n);
  }

  countNewSubscribers(botId: string, since: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM subscribers WHERE bot_id = ? AND created_at >= ?")
      .get(botId, since);
    return Number((row as { n: number }).n);
  }

  createBroadcast(botId: string, text: string, tags: string[], recipients: number): Broadcast {
    const id = newId("bc");
    const stamp = now();
    this.db
      .prepare(
        `INSERT INTO broadcasts (id, bot_id, text, tags, recipients, sent, failed, cursor, status, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'queued', ?)`,
      )
      .run(id, botId, text, JSON.stringify(tags), recipients, stamp);
    return this.getBroadcast(id)!;
  }

  getBroadcast(id: string): Broadcast | undefined {
    return this.db.prepare("SELECT * FROM broadcasts WHERE id = ?").get(id) as Broadcast | undefined;
  }

  listBroadcasts(botId: string, limit = 20): Broadcast[] {
    return this.db
      .prepare("SELECT * FROM broadcasts WHERE bot_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(botId, limit) as Broadcast[];
  }

  /** Broadcasts left mid-flight by a restart, so they can be picked back up. */
  unfinishedBroadcasts(): Broadcast[] {
    return this.db
      .prepare("SELECT * FROM broadcasts WHERE status IN ('queued', 'sending') ORDER BY created_at")
      .all() as Broadcast[];
  }

  updateBroadcast(id: string, patch: Partial<Broadcast>): void {
    const fields = Object.keys(patch).filter((k) => k !== "id");
    if (fields.length === 0) return;
    const assignments = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => (patch as Record<string, unknown>)[f]);
    this.db.prepare(`UPDATE broadcasts SET ${assignments} WHERE id = ?`).run(...(values as never[]), id);
  }

  // --- update cursor --------------------------------------------------------

  getOffset(botId: string): number {
    const row = this.db.prepare("SELECT update_id FROM update_offsets WHERE bot_id = ?").get(botId);
    return row ? Number((row as { update_id: number }).update_id) : 0;
  }

  setOffset(botId: string, updateId: number): void {
    this.db
      .prepare(
        `INSERT INTO update_offsets (bot_id, update_id) VALUES (?, ?)
         ON CONFLICT(bot_id) DO UPDATE SET update_id = excluded.update_id`,
      )
      .run(botId, updateId);
  }
}
