/**
 * A terminal front end for the same tools the MCP server exposes.
 *
 * Setting up an MCP client is worth it once you are building flows by talking
 * to a model. It is a lot of ceremony for the first five minutes, when all you
 * want is to see your bot answer a message. These commands skip it:
 *
 *   npm run connect -- 123456:AA…   register a bot token
 *   npm run demo                    create and publish a small welcome flow
 *   npm run status                  what is connected and running
 *
 * Everything writes to the same database the server reads, so `npm run dev`
 * afterwards picks it all up.
 */
import { App } from "../src/app.js";
import { handlers } from "../src/handlers/index.js";
import { registerTools } from "../src/handlers/tools.js";
import type { Step } from "../src/engine/steps.js";

async function call(app: App, tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const handler = handlers.get(tool);
  if (!handler) throw new Error(`No handler for "${tool}".`);

  const result = await handler(args, { apiKey: null, tool: { name: tool, inputSchema: {} }, live: true });
  const text = result.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  if (result.isError) throw new Error(text);

  console.log(text);
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

const DEMO_STEPS: Step[] = [
  { type: "message", text: "Merhaba! Ben senin ilk botunsun." },
  { type: "question", text: "Sana nasıl hitap edeyim?", save_as: "ad" },
  { type: "message", text: "Memnun oldum, {{ad}}." },
  {
    type: "buttons",
    text: "Ne yapmak istersin, {{ad}}?",
    save_as: "amac",
    choices: [
      { label: "Öğrenmek", goto: 5 },
      { label: "Satış yapmak", goto: 7 },
    ],
  },
  { type: "end" },
  { type: "tag", add_tags: ["ogrenci"] },
  { type: "message", text: "Harika — sana örnekler göndereceğim." },
  { type: "end" },
  { type: "tag", add_tags: ["satis"] },
  { type: "message", text: "Süper — sana satış akışları göstereceğim." },
];

async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  const app = new App({ dbPath: process.env.BOTFLOW_DB ?? "botflow.db" });
  registerTools(app);

  try {
    switch (command) {
      case "connect": {
        const token = argv[1];
        if (!token) {
          throw new Error('Bir token gerekiyor:  npm run connect -- 123456789:AA...');
        }
        await call(app, "connect_bot", { token });
        console.log("\nSıradaki:  npm run demo");
        break;
      }

      case "demo": {
        const { bots } = (await call(app, "list_bots", {})) as { bots: { bot_id: string; username: string }[] };
        if (bots.length === 0) {
          throw new Error("Önce bir bot bağla:  npm run connect -- <TOKEN>");
        }
        const bot = bots[0]!;

        const flow = (await call(app, "create_flow", {
          bot_id: bot.bot_id,
          name: "Karşılama",
          steps: DEMO_STEPS,
        })) as { flow_id: string };

        await call(app, "publish_flow", { flow_id: flow.flow_id });
        await call(app, "set_trigger", { flow_id: flow.flow_id, event: "start" });

        console.log(`\nHazır. Şimdi:`);
        console.log(`  1. npm run dev          (bu pencereyi açık bırak)`);
        console.log(`  2. Telegram'da @${bot.username} botunu aç ve /start yaz`);
        break;
      }

      case "status": {
        const { bots } = (await call(app, "list_bots", {})) as { bots: { bot_id: string }[] };
        for (const bot of bots) {
          console.log("");
          await call(app, "list_flows", { bot_id: bot.bot_id });
          await call(app, "list_triggers", { bot_id: bot.bot_id });
        }
        break;
      }

      default:
        console.log(
          [
            "Komutlar:",
            "  npm run connect -- <TOKEN>   botu bağla",
            "  npm run demo                 örnek karşılama akışı kur",
            "  npm run status               ne bağlı, ne çalışıyor",
          ].join("\n"),
        );
    }
  } finally {
    await app.shutdown();
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
