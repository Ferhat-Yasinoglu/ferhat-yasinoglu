/**
 * The settings the panel is allowed to write, and where they live.
 *
 * The bot has always read its configuration from the environment, and that
 * stays true: this store writes a small JSON file and lays it *over* the
 * environment before `loadConfig` sees it. So nothing in `config.ts` had to
 * learn about the panel, and a deployment that never opens the panel behaves
 * exactly as before.
 *
 * The panel wins over the environment when both have a value. The alternative —
 * environment wins — makes the panel look broken: you type a token, press save,
 * and nothing changes because a Fly secret is quietly outranking you. Instead
 * every field reports where its value came from, and clearing a field in the
 * panel falls back to the environment.
 *
 * The file holds Meta access tokens, so it is written 0600 and lives in a
 * directory of its own. On Fly that directory has to be a volume — a container
 * filesystem is thrown away on every restart.
 */

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The environment variables the panel may set. Everything else — PORT, HOST,
 * the Graph URLs, BOT_RULES_FILE, the panel's own password — stays with the
 * host, because a panel that can move its own door is a panel that can lock
 * you out of it.
 */
export const WRITABLE = [
  "IG_ACCESS_TOKEN",
  "IG_USER_ID",
  "IG_VERIFY_TOKEN",
  "IG_APP_SECRET",
  "WA_ACCESS_TOKEN",
  "WA_PHONE_NUMBER_ID",
  "WA_VERIFY_TOKEN",
  "WA_APP_SECRET",
  "WA_WINDOW_HOURS",
  "ANTHROPIC_API_KEY",
  "BOT_PERSONA",
  "BOT_MODEL",
  "BOT_MAX_REPLY_CHARS",
  "BOT_DRY_RUN",
] as const;

export type WritableKey = (typeof WRITABLE)[number];

/** Values that are credentials: never sent to the browser, only ever masked. */
export const SECRET_KEYS: ReadonlySet<string> = new Set([
  "IG_ACCESS_TOKEN",
  "IG_APP_SECRET",
  "WA_ACCESS_TOKEN",
  "WA_APP_SECRET",
  "ANTHROPIC_API_KEY",
]);

export type Source = "panel" | "ortam" | "yok";

export type FieldState = {
  key: WritableKey;
  /** Whether anything at all is set, from either place. */
  set: boolean;
  source: Source;
  /** Present only for non-secret keys; secrets carry `hint` instead. */
  value?: string;
  /** Last four characters of a secret, so you can tell two tokens apart. */
  hint?: string;
};

export type StoreOptions = {
  /** Directory for settings.json. Defaults to BOT_DATA_DIR, else "data". */
  dir?: string;
  env?: NodeJS.ProcessEnv;
  /** Injectable for tests; defaults to the real filesystem. */
  io?: FileIO;
};

export type FileIO = {
  read: (file: string) => string;
  write: (file: string, content: string) => void;
};

const realIO: FileIO = {
  read: (file) => readFileSync(file, "utf8"),
  write: (file, content) => {
    mkdirSync(dirname(file), { recursive: true });
    // Written aside and renamed: a crash halfway through a save would otherwise
    // leave a truncated file, and the bot would come back up with no channels.
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, content, { mode: 0o600 });
    renameSync(temporary, file);
    try {
      chmodSync(file, 0o600);
    } catch {
      // Some filesystems (a Windows checkout, a mounted share) refuse this.
      // The content is already written; permissions are best effort.
    }
  },
};

export class SettingsStore {
  readonly file: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly io: FileIO;
  private stored: Partial<Record<WritableKey, string>> = {};
  /** Set when the file exists but could not be read, so the panel can say so. */
  private loadError?: string;

  constructor(options: StoreOptions = {}) {
    this.env = options.env ?? process.env;
    this.io = options.io ?? realIO;
    const dir = options.dir ?? this.env.BOT_DATA_DIR ?? "data";
    this.file = join(dir, "settings.json");
    this.load();
  }

  private load(): void {
    let source: string;
    try {
      source = this.io.read(this.file);
    } catch (error) {
      // No file yet is the normal first run, not a problem worth reporting.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.loadError = `${this.file}: ${(error as Error).message}`;
      }
      return;
    }

    try {
      const parsed: unknown = JSON.parse(source);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("bir JSON nesnesi değil");
      }
      this.stored = pickWritable(parsed as Record<string, unknown>);
    } catch (error) {
      // A corrupt file must not take the bot down: the environment still has
      // whatever it had, and the panel shows the error so it can be fixed.
      this.loadError = `${this.file}: ${(error as Error).message}`;
    }
  }

  get error(): string | undefined {
    return this.loadError;
  }

  /** The environment as the rest of the program should see it. */
  environment(): NodeJS.ProcessEnv {
    return { ...this.env, ...this.stored };
  }

  /**
   * Just this store's own overrides — not the environment underneath them.
   * Taken before a risky save and handed back to `restore` if it goes wrong.
   */
  snapshot(): Partial<Record<WritableKey, string>> {
    return { ...this.stored };
  }

  /**
   * Put the store back exactly as a snapshot found it. Reverting through
   * `save` would not do: `environment()` cannot tell a panel value from an
   * environment one, so undoing an edit to an environment-backed field would
   * copy that field's value into the file and quietly pin it there — and the
   * next change to the Fly secret would appear to do nothing.
   */
  restore(snapshot: Partial<Record<WritableKey, string>>): void {
    this.stored = { ...snapshot };
    this.io.write(this.file, `${JSON.stringify(this.stored, null, 2)}\n`);
  }

  /**
   * Apply a patch. A key present with an empty string is *cleared* from the
   * store — which is how you fall back to an environment value — while a key
   * simply absent from the patch is left alone.
   */
  save(patch: Partial<Record<WritableKey, string>>): void {
    const next = { ...this.stored };
    for (const [key, value] of Object.entries(patch)) {
      if (!isWritable(key)) continue;
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed) next[key] = trimmed;
      else delete next[key];
    }
    this.stored = next;
    this.io.write(this.file, `${JSON.stringify(next, null, 2)}\n`);
  }

  /** What the panel may show: values for plain fields, hints for secrets. */
  state(): FieldState[] {
    return WRITABLE.map((key) => {
      const panelValue = this.stored[key];
      const envValue = this.env[key];
      const value = panelValue ?? envValue ?? "";
      const source: Source = panelValue ? "panel" : envValue ? "ortam" : "yok";

      const field: FieldState = { key, set: Boolean(value), source };
      if (SECRET_KEYS.has(key)) {
        if (value) field.hint = `…${value.slice(-4)}`;
      } else {
        field.value = value;
      }
      return field;
    });
  }
}

function isWritable(key: string): key is WritableKey {
  return (WRITABLE as readonly string[]).includes(key);
}

function pickWritable(raw: Record<string, unknown>): Partial<Record<WritableKey, string>> {
  const out: Partial<Record<WritableKey, string>> = {};
  for (const key of WRITABLE) {
    const value = raw[key];
    // Anything that is not a non-empty string is dropped rather than coerced:
    // `BOT_DRY_RUN: false` would otherwise become the string "false", which
    // config.ts reads as… not "1", so off — right by luck, wrong in principle.
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
