import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { runDoctor, webhookLines, worstStatus, type Check } from "../src/doctor.js";
import { parseRules } from "../src/rules.js";

const rules = parseRules([
  { name: "price", keywords: ["fiyat"], reply: "DM" },
  { name: "selam", keywords: ["merhaba"], reply: "Merhaba", channels: ["whatsapp"] },
]);

const full = {
  IG_ACCESS_TOKEN: "t",
  IG_USER_ID: "ig1",
  IG_VERIFY_TOKEN: "v",
  IG_APP_SECRET: "s",
  WA_ACCESS_TOKEN: "t",
  WA_PHONE_NUMBER_ID: "p1",
  WA_VERIFY_TOKEN: "v",
  WA_APP_SECRET: "s",
};

function find(checks: Check[], name: string): Check {
  const check = checks.find((candidate) => candidate.name === name);
  if (!check) throw new Error(`check "${name}" yok: ${checks.map((c) => c.name).join(", ")}`);
  return check;
}

/** A fake Graph that answers the read-only "who am I" call. */
function fakeWhoIs(payload: Record<string, unknown>, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

describe("runDoctor", () => {
  it("says what is wrong when nothing is configured", async () => {
    const checks = await runDoctor({ config: loadConfig({}), rules });

    expect(find(checks, "kanallar").status).toBe("fail");
    expect(find(checks, "kanallar").detail).toMatch(/IG_\* ya da WA_\*/);
  });

  it("passes a complete setup", async () => {
    const checks = await runDoctor({ config: loadConfig(full), rules });

    expect(find(checks, "instagram").status).toBe("ok");
    expect(find(checks, "whatsapp").status).toBe("ok");
    expect(find(checks, "instagram imza").status).toBe("ok");
    expect(find(checks, "kurallar").detail).toMatch(/2 kural, 1 tanesi kanala özel/);
  });

  it("names each missing value per channel", async () => {
    const checks = await runDoctor({ config: loadConfig({ IG_VERIFY_TOKEN: "v", WA_ACCESS_TOKEN: "t" }), rules });

    expect(find(checks, "instagram").detail).toMatch(/IG_ACCESS_TOKEN, IG_USER_ID/);
    expect(find(checks, "whatsapp").detail).toMatch(/WA_PHONE_NUMBER_ID, WA_VERIFY_TOKEN/);
  });

  it("treats an empty app secret as a failure, not a nit", async () => {
    const { IG_APP_SECRET, WA_APP_SECRET, ...noSecrets } = full;
    const checks = await runDoctor({ config: loadConfig(noSecrets), rules });

    expect(find(checks, "instagram imza").status).toBe("fail");
    expect(find(checks, "whatsapp imza").detail).toMatch(/herkes/);
  });

  it("reports a broken rules file instead of throwing", async () => {
    const checks = await runDoctor({ config: loadConfig(full), rulesError: "rules.json: bozuk" });
    expect(find(checks, "kurallar")).toMatchObject({ status: "fail", detail: "rules.json: bozuk" });
  });

  it("calls the model layer off rather than broken when both values are absent", async () => {
    const checks = await runDoctor({ config: loadConfig(full), rules });
    expect(find(checks, "model")).toMatchObject({ status: "warn" });
    expect(find(checks, "model").detail).toMatch(/ücretsiz/);
  });

  it("warns when only half the model layer is set", async () => {
    const checks = await runDoctor({ config: loadConfig({ ...full, ANTHROPIC_API_KEY: "k" }), rules });
    expect(find(checks, "model").detail).toMatch(/BOT_PERSONA eksik/);
  });

  it("distinguishes dry run from live", async () => {
    const dry = await runDoctor({ config: loadConfig({ ...full, BOT_DRY_RUN: "1" }), rules });
    expect(find(dry, "mod").detail).toMatch(/PROVA/);

    const live = await runDoctor({ config: loadConfig(full), rules });
    expect(find(live, "mod").detail).toMatch(/canlı/);
  });

  it("skips the live token checks when no fetcher is given", async () => {
    const checks = await runDoctor({ config: loadConfig(full), rules });
    expect(checks.find((check) => check.name === "instagram token")).toBeUndefined();
  });

  it("confirms a live token and shows who it belongs to", async () => {
    const checks = await runDoctor({
      config: loadConfig(full),
      rules,
      fetcher: fakeWhoIs({ id: "ig1", username: "farhad" }),
    });

    expect(find(checks, "instagram token")).toMatchObject({ status: "ok" });
    expect(find(checks, "instagram token").detail).toContain("farhad");
  });

  it("calls an expired token what it is", async () => {
    const checks = await runDoctor({
      config: loadConfig(full),
      rules,
      fetcher: fakeWhoIs({ error: { message: "Session expired", code: 190 } }, 400),
    });

    expect(find(checks, "whatsapp token")).toMatchObject({ status: "fail" });
    expect(find(checks, "whatsapp token").detail).toMatch(/süresi dolmuş/);
  });

  it("survives a network failure without throwing", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    const checks = await runDoctor({ config: loadConfig(full), rules, fetcher });
    expect(find(checks, "instagram token").detail).toMatch(/ağ hatası/);
  });
});

describe("webhookLines", () => {
  it("prints one line per channel with its field and token", () => {
    const lines = webhookLines(loadConfig(full), "https://bot.example.com");

    expect(lines[0]).toContain("https://bot.example.com/webhook/instagram");
    expect(lines[0]).toContain("comments");
    expect(lines[1]).toContain("/webhook/whatsapp");
    expect(lines[1]).toContain("messages");
  });

  it("marks an empty verify token instead of printing nothing", () => {
    const lines = webhookLines(loadConfig({ IG_ACCESS_TOKEN: "t" }));
    expect(lines[0]).toContain("(boş!)");
  });
});

describe("worstStatus", () => {
  it("takes the worst of the lot", () => {
    expect(worstStatus([{ name: "a", status: "ok", detail: "" }])).toBe("ok");
    expect(worstStatus([
      { name: "a", status: "ok", detail: "" },
      { name: "b", status: "warn", detail: "" },
    ])).toBe("warn");
    expect(worstStatus([
      { name: "a", status: "warn", detail: "" },
      { name: "b", status: "fail", detail: "" },
    ])).toBe("fail");
  });
});
