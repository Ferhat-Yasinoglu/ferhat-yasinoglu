/**
 * The preflight: everything that can go wrong before the first real message,
 * checked in one pass.
 *
 * Half the setup lives in a Meta dashboard where a typo is invisible until a
 * comment goes unanswered at midnight. This walks the same ground the bot walks
 * on startup — which channels are on, what each one is missing, whether the
 * rules load, whether the tokens are actually alive — and prints the two URLs
 * that have to be pasted back into the dashboard.
 *
 * Only read calls are made. A doctor that posted a test comment would be worse
 * than no doctor.
 */

import type { Config } from "./config.js";
import type { Fetcher } from "./meta.js";
import type { Rule } from "./rules.js";

export type Status = "ok" | "warn" | "fail";

export type Check = {
  name: string;
  status: Status;
  detail: string;
};

export type DoctorOptions = {
  config: Config;
  /** Loaded rules, or the error that stopped them loading. */
  rules?: Rule[];
  rulesError?: string;
  /** Left out, the live token checks are skipped. */
  fetcher?: Fetcher;
  /** Public base URL, if known, to print the webhook addresses in full. */
  publicUrl?: string;
};

/** A read-only Graph call: "who am I", nothing more. */
async function whoIs(
  fetcher: Fetcher,
  url: string,
  bearer?: string,
): Promise<{ ok: true; label: string } | { ok: false; detail: string }> {
  try {
    const response = await fetcher(url, bearer ? { headers: { authorization: `Bearer ${bearer}` } } : {});
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, detail: `Graph API ${response.status}, JSON değil` };
    }

    const error = payload.error as { message?: string; code?: number } | undefined;
    if (error) {
      const expired = error.code === 190 || error.code === 102;
      return {
        ok: false,
        detail: expired ? `token geçersiz ya da süresi dolmuş (${error.message})` : (error.message ?? "bilinmeyen hata"),
      };
    }
    if (!response.ok) return { ok: false, detail: `Graph API ${response.status}` };

    const label = [payload.username, payload.display_phone_number, payload.name, payload.id]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
    return { ok: true, label: label || "yanıt geldi" };
  } catch (error) {
    return { ok: false, detail: `ağ hatası: ${(error as Error).message}` };
  }
}

export async function runDoctor(options: DoctorOptions): Promise<Check[]> {
  const { config, rules, rulesError, fetcher } = options;
  const checks: Check[] = [];

  // --- Kurallar ---
  if (rulesError) {
    checks.push({ name: "kurallar", status: "fail", detail: rulesError });
  } else if (!rules?.length) {
    checks.push({ name: "kurallar", status: "fail", detail: `${config.rulesFile} boş — hiçbir mesaj eşleşmez` });
  } else {
    const channelScoped = rules.filter((rule) => rule.channels?.length).length;
    checks.push({
      name: "kurallar",
      status: "ok",
      detail: `${config.rulesFile}: ${rules.length} kural, ${channelScoped} tanesi kanala özel`,
    });
  }

  // --- Model katmanı ---
  if (config.anthropicApiKey && config.persona) {
    checks.push({ name: "model", status: "ok", detail: `${config.model} — kural dışı mesajlar cevaplanacak` });
  } else if (!config.anthropicApiKey && !config.persona) {
    checks.push({
      name: "model",
      status: "warn",
      detail: "kapalı: bot yalnızca kurallarla çalışır, gerisine susar (ücretsiz)",
    });
  } else {
    checks.push({
      name: "model",
      status: "warn",
      detail: `yarım: ${config.anthropicApiKey ? "BOT_PERSONA" : "ANTHROPIC_API_KEY"} eksik, model devreye girmez`,
    });
  }

  // --- Prova ---
  checks.push(
    config.dryRun
      ? { name: "mod", status: "warn", detail: "PROVA — kararlar loglanır, hiçbir şey gönderilmez" }
      : { name: "mod", status: "ok", detail: "canlı — cevaplar gerçekten gönderilir" },
  );

  if (!config.instagram && !config.whatsapp) {
    checks.push({ name: "kanallar", status: "fail", detail: "hiçbiri açık değil: IG_* ya da WA_* değerlerini doldur" });
    return checks;
  }

  // --- Instagram ---
  if (config.instagram) {
    const ig = config.instagram;
    const missing = [
      !ig.accessToken && "IG_ACCESS_TOKEN",
      !ig.igUserId && "IG_USER_ID",
      !ig.verifyToken && "IG_VERIFY_TOKEN",
    ].filter(Boolean);

    if (missing.length) {
      checks.push({ name: "instagram", status: "fail", detail: `eksik: ${missing.join(", ")}` });
    } else {
      checks.push({ name: "instagram", status: "ok", detail: `hesap ${ig.igUserId}, yol ${ig.path}` });
    }

    checks.push(
      ig.appSecret
        ? { name: "instagram imza", status: "ok", detail: "gelen teslimatlar doğrulanacak" }
        : {
            name: "instagram imza",
            status: "fail",
            detail: "IG_APP_SECRET boş — URL'yi bulan herkes bota yorum yazdırabilir",
          },
    );

    if (fetcher && ig.accessToken && ig.igUserId) {
      const result = await whoIs(fetcher, `${ig.graphUrl}/${ig.igUserId}?fields=id,username&access_token=${ig.accessToken}`);
      checks.push(
        result.ok
          ? { name: "instagram token", status: "ok", detail: result.label }
          : { name: "instagram token", status: "fail", detail: result.detail },
      );
    }
  }

  // --- WhatsApp ---
  if (config.whatsapp) {
    const wa = config.whatsapp;
    const missing = [
      !wa.accessToken && "WA_ACCESS_TOKEN",
      !wa.phoneNumberId && "WA_PHONE_NUMBER_ID",
      !wa.verifyToken && "WA_VERIFY_TOKEN",
    ].filter(Boolean);

    if (missing.length) {
      checks.push({ name: "whatsapp", status: "fail", detail: `eksik: ${missing.join(", ")}` });
    } else {
      checks.push({
        name: "whatsapp",
        status: "ok",
        detail: `numara ${wa.phoneNumberId}, yol ${wa.path}, pencere ${wa.windowHours} saat`,
      });
    }

    checks.push(
      wa.appSecret
        ? { name: "whatsapp imza", status: "ok", detail: "gelen teslimatlar doğrulanacak" }
        : {
            name: "whatsapp imza",
            status: "fail",
            detail: "WA_APP_SECRET boş — URL'yi bulan herkes bota mesaj yazdırabilir",
          },
    );

    if (fetcher && wa.accessToken && wa.phoneNumberId) {
      const result = await whoIs(
        fetcher,
        `${wa.graphUrl}/${wa.phoneNumberId}?fields=id,display_phone_number`,
        wa.accessToken,
      );
      checks.push(
        result.ok
          ? { name: "whatsapp token", status: "ok", detail: result.label }
          : { name: "whatsapp token", status: "fail", detail: result.detail },
      );
    }
  }

  return checks;
}

/** The two lines that have to be pasted into the Meta dashboard. */
export function webhookLines(config: Config, publicUrl?: string): string[] {
  const base = (publicUrl ?? `http://localhost:${config.port}`).replace(/\/+$/, "");
  const lines: string[] = [];
  if (config.instagram) {
    lines.push(`instagram  ${base}${config.instagram.path}   alan: comments   verify: ${config.instagram.verifyToken || "(boş!)"}`);
  }
  if (config.whatsapp) {
    lines.push(`whatsapp   ${base}${config.whatsapp.path}    alan: messages   verify: ${config.whatsapp.verifyToken || "(boş!)"}`);
  }
  return lines;
}

export function worstStatus(checks: readonly Check[]): Status {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "ok";
}
