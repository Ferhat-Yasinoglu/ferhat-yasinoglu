/**
 * The panel, as one self-contained page.
 *
 * No build step, no CDN, no framework: the page is a string this file returns,
 * so it ships inside the same container as the bot and works on a machine with
 * no outbound network. That also means there is exactly one thing to audit for
 * a page that handles access tokens.
 *
 * Everything the page renders from the API goes through `text()` — the journal
 * shows comments written by strangers, and a bot whose panel executes them
 * would be a strange way to lose an account.
 */

const STYLE = `
:root {
  --ground: #FBF7F7; --surface: #FFFFFF; --line: #E4DAE0; --line-soft: #EFE7EC;
  --ink: #191426; --ink-2: #4A4157; --muted: #7C7288; --accent: #C9453F;
  --ok: #2E7D5B; --warn: #B4722A; --fail: #C9453F;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #141019; --surface: #1C1724; --line: #362D42; --line-soft: #2A2334;
    --ink: #F0EAF3; --ink-2: #C6BCD0; --muted: #9A8FA8; --accent: #FF8078;
    --ok: #6FCF97; --warn: #E0A458; --fail: #FF8078;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 54rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 0.25rem; }
h2 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin: 0 0 0.75rem; }
.sub { color: var(--muted); margin: 0 0 2rem; font-size: 0.9rem; }
section { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
label { display: block; font-size: 0.82rem; color: var(--ink-2); margin: 0 0 0.3rem; font-weight: 600; }
input, textarea, select {
  width: 100%; padding: 0.55rem 0.7rem; font: inherit; color: var(--ink);
  background: var(--ground); border: 1px solid var(--line); border-radius: 8px;
}
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; min-height: 20rem; resize: vertical; }
button {
  font: inherit; font-weight: 600; padding: 0.55rem 1rem; border-radius: 8px;
  border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer;
}
button.ghost { background: transparent; color: var(--accent); }
button:disabled { opacity: 0.5; cursor: default; }
.row { display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
.field { margin-bottom: 0.9rem; }
.hint { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
.src { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.1rem 0.4rem; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); margin-left: 0.4rem; }
.checks { list-style: none; margin: 0; padding: 0; }
.checks li { display: flex; gap: 0.6rem; padding: 0.4rem 0; border-top: 1px solid var(--line-soft); align-items: baseline; }
.checks li:first-child { border-top: none; }
.mark { font-weight: 700; width: 1rem; flex: none; }
.ok { color: var(--ok); } .warn { color: var(--warn); } .fail { color: var(--fail); }
.cname { font-weight: 600; min-width: 9rem; flex: none; }
.cdetail { color: var(--ink-2); word-break: break-word; }
pre { background: var(--ground); border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem; overflow-x: auto; font-size: 12.5px; margin: 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding: 0 0.5rem 0.5rem 0; font-weight: 600; }
td { padding: 0.5rem 0.5rem 0.5rem 0; border-top: 1px solid var(--line-soft); vertical-align: top; }
.tag { font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 999px; border: 1px solid var(--line); white-space: nowrap; }
.note { padding: 0.7rem 0.9rem; border-radius: 8px; font-size: 0.88rem; margin-bottom: 1rem; }
.note.bad { background: color-mix(in srgb, var(--fail) 12%, transparent); border: 1px solid var(--fail); }
.note.good { background: color-mix(in srgb, var(--ok) 12%, transparent); border: 1px solid var(--ok); }
.note.info { background: var(--ground); border: 1px solid var(--line); color: var(--ink-2); }
.bar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 1rem; }
.grow { flex: 1 1 12rem; }
#login { max-width: 22rem; margin: 6rem auto; }
.hidden { display: none !important; }
.muted { color: var(--muted); }

/* These four were style="" attributes. A nonce cannot cover a style attribute,
   so under the page's own Content-Security-Policy they were simply dropped —
   which is the policy doing its job, and a good reason for them to live here. */
#state-note { margin: 1rem 0 0; }
.inline { display: flex; gap: 0.4rem; align-items: center; font-weight: 600; margin: 0; }
.auto { width: auto; }
`;

const SCRIPT = String.raw`
const $ = (id) => document.getElementById(id);
const H = { "content-type": "application/json", "x-reply-bot-panel": "1" };

/** Everything from the API is inserted as text, never as markup. */
function text(value) { return document.createTextNode(value == null ? "" : String(value)); }
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.appendChild(text(content));
  return node;
}
function say(where, message, kind) {
  const box = $(where);
  box.className = "note " + (kind || "info");
  box.textContent = message;
  box.classList.toggle("hidden", !message);
}

async function api(path, options) {
  const response = await fetch("api" + path, { credentials: "same-origin", ...options });
  if (response.status === 401) { showLogin(); throw new Error("Oturum bitti, tekrar gir."); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || ("Sunucu " + response.status));
  return body;
}

function showLogin() { $("login").classList.remove("hidden"); $("panel").classList.add("hidden"); }
function showPanel() { $("login").classList.add("hidden"); $("panel").classList.remove("hidden"); }

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("login-note", "");
  try {
    const response = await fetch("login", {
      method: "POST", headers: H, credentials: "same-origin",
      body: JSON.stringify({ password: $("password").value }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Giriş başarısız.");
    $("password").value = "";
    showPanel();
    await Promise.all([refresh(), loadRules()]);
  } catch (error) { say("login-note", error.message, "bad"); }
});

$("logout").addEventListener("click", async () => {
  await fetch("logout", { method: "POST", headers: H, credentials: "same-origin" });
  showLogin();
});

// [key, label, hint, placeholder]. The placeholder carries the default the bot
// uses when the box is empty, so "boş" never means "unknown".
const FIELDS = [
  ["Instagram", [
    ["IG_USER_ID", "Hesap kimliği", "Meta panelinde Instagram hesabının sayısal kimliği."],
    ["IG_ACCESS_TOKEN", "Erişim anahtarı", "Uzun ömürlü olanı kullan; kısa olan bir saatte ölür."],
    ["IG_VERIFY_TOKEN", "Doğrulama sözcüğü", "Kendin uyduruyorsun; Meta paneline aynısını yazacaksın."],
    ["IG_APP_SECRET", "Uygulama sırrı", "Boşsa imza doğrulanmaz — adresi bulan herkes bota yorum yazdırabilir."],
  ]],
  ["WhatsApp", [
    ["WA_PHONE_NUMBER_ID", "Numara kimliği", "Telefon numarası değil, panelde yazan kimlik."],
    ["WA_ACCESS_TOKEN", "Erişim anahtarı", ""],
    ["WA_VERIFY_TOKEN", "Doğrulama sözcüğü", ""],
    ["WA_APP_SECRET", "Uygulama sırrı", ""],
    ["WA_WINDOW_HOURS", "Cevap penceresi (saat)", "Meta'nın kuralı 24 saat. Dışına düşen mesaja cevap denenmez.", "24"],
  ]],
  ["Model katmanı", [
    ["ANTHROPIC_API_KEY", "Claude anahtarı", "Boş bırakırsan bot yalnızca kurallarla çalışır — ücretsiz."],
    ["BOT_PERSONA", "Üslup", "Botun kim olduğu ve nasıl konuştuğu. Anahtar varsa bu da dolu olmalı."],
    ["BOT_MODEL", "Model", "", "claude-opus-5"],
    ["BOT_MAX_REPLY_CHARS", "En fazla karakter", "", "280"],
  ]],
];

let known = {};

function renderFields(fields) {
  known = {};
  for (const field of fields) known[field.key] = field;
  const host = $("settings-fields");
  host.textContent = "";

  for (const [title, keys] of FIELDS) {
    const group = el("div");
    group.appendChild(el("h2", null, title));
    const row = el("div", "row");
    for (const [key, label, hint, fallback] of keys) {
      const state = known[key] || { set: false, source: "yok" };
      const wrap = el("div", "field");

      const labelNode = el("label", null, label);
      labelNode.htmlFor = "f-" + key;
      if (state.set) {
        labelNode.appendChild(el("span", "src", state.source));
      }
      wrap.appendChild(labelNode);

      const input = document.createElement("input");
      input.id = "f-" + key;
      input.dataset.key = key;
      input.autocomplete = "off";
      if (state.hint !== undefined || state.value === undefined) {
        // A secret: never filled in, only described.
        input.type = "password";
        input.placeholder = state.set ? "kayıtlı " + (state.hint || "") : "boş";
      } else {
        input.type = "text";
        input.value = state.value || "";
        if (fallback) input.placeholder = fallback + " (varsayılan)";
      }
      wrap.appendChild(input);
      if (hint) wrap.appendChild(el("div", "hint", hint));
      row.appendChild(wrap);
    }
    group.appendChild(row);
    host.appendChild(group);
  }
}

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = {};
  for (const input of $("settings-fields").querySelectorAll("input")) {
    const key = input.dataset.key;
    const state = known[key] || {};
    const isSecret = state.hint !== undefined || state.value === undefined;
    // A blank secret box means "leave it alone"; clearing one is a separate,
    // deliberate act, so a stray click cannot silently unplug a channel.
    if (isSecret) { if (input.value) settings[key] = input.value; }
    else if (input.value !== (state.value || "")) settings[key] = input.value;
  }
  if (!Object.keys(settings).length) { say("settings-note", "Değişen bir şey yok.", "info"); return; }

  say("settings-note", "Kaydediliyor…", "info");
  try {
    await api("/settings", { method: "POST", headers: H, body: JSON.stringify({ settings }) });
    say("settings-note", "Kaydedildi ve devreye alındı.", "good");
    await refresh();
  } catch (error) { say("settings-note", error.message, "bad"); }
});

$("clear-secret").addEventListener("click", async () => {
  const key = $("clear-key").value;
  if (!key) return;
  if (!confirm(key + " silinecek. Ortam değişkeninde bir değer varsa ona geri dönülür. Emin misin?")) return;
  try {
    await api("/settings", { method: "POST", headers: H, body: JSON.stringify({ settings: { [key]: "" } }) });
    say("settings-note", key + " silindi.", "good");
    await refresh();
  } catch (error) { say("settings-note", error.message, "bad"); }
});

$("dry-run").addEventListener("change", async (event) => {
  const on = event.target.checked;
  try {
    await api("/settings", { method: "POST", headers: H, body: JSON.stringify({ settings: { BOT_DRY_RUN: on ? "1" : "" } }) });
    say("settings-note", on ? "Prova açıldı: hiçbir şey gönderilmeyecek." : "Canlı: cevaplar gerçekten gidecek.", "good");
    await refresh();
  } catch (error) { say("settings-note", error.message, "bad"); event.target.checked = !on; }
});

function renderChecks(state) {
  const list = $("checks");
  list.textContent = "";
  const MARK = { ok: "✓", warn: "!", fail: "✗" };
  for (const check of state.checks) {
    const li = el("li");
    li.appendChild(el("span", "mark " + check.status, MARK[check.status]));
    li.appendChild(el("span", "cname", check.name));
    li.appendChild(el("span", "cdetail", check.detail));
    list.appendChild(li);
  }
  const worst = state.worst;
  say("state-note",
    worst === "fail" ? "Eksik var — bot bu hâliyle çalışmaz." :
    worst === "warn" ? "Çalışır, ama yukarıdaki uyarılara bak." : "Hazır.",
    worst === "fail" ? "bad" : worst === "warn" ? "info" : "good");

  $("webhooks").textContent = state.webhooks.length ? state.webhooks.join("\n") : "(kanal yok)";
  $("dry-run").checked = state.dryRun;
  $("store-file").textContent = state.storeFile;
  say("store-note", state.storeError || "", state.storeError ? "bad" : "info");
}

function renderJournal(state) {
  const body = $("journal-body");
  body.textContent = "";
  if (!state.journal.length) {
    const row = el("tr");
    const cell = el("td", "muted", "Henüz mesaj gelmedi.");
    cell.colSpan = 4;
    row.appendChild(cell);
    body.appendChild(row);
  }
  for (const entry of state.journal) {
    const row = el("tr");
    row.appendChild(el("td", "muted", new Date(entry.at).toLocaleTimeString("tr-TR")));
    row.appendChild(el("td", null, entry.channel === "whatsapp" ? "WhatsApp" : "Instagram"));
    const who = el("td");
    who.appendChild(el("div", null, entry.from));
    who.appendChild(el("div", "muted", entry.text));
    row.appendChild(who);
    const what = el("td");
    what.appendChild(el("span", "tag", entry.kind + (entry.sent ? " · gönderildi" : "")));
    what.appendChild(el("div", "muted", entry.reason));
    if (entry.reply) what.appendChild(el("div", null, entry.reply));
    if (entry.error) what.appendChild(el("div", "fail", entry.error));
    row.appendChild(what);
    body.appendChild(row);
  }
  const s = state.summary;
  $("journal-summary").textContent =
    s.total + " mesaj · " + s.sent + " gönderildi · " + s.skipped + " geçildi · " + s.failed + " hata";
}

$("try-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("try-note", "");
  $("try-result").textContent = "";
  try {
    const body = await api("/try", {
      method: "POST", headers: H,
      body: JSON.stringify({ text: $("try-text").value, channel: $("try-channel").value }),
    });
    const action = body.action;
    const lines = ["karar   " + action.kind + " (" + action.reason + ")"];
    if (action.text) lines.push("cevap   " + action.text);
    if (action.privateReply) lines.push("dm      " + action.privateReply);
    $("try-result").textContent = lines.join("\n");
  } catch (error) { say("try-note", error.message, "bad"); }
});

$("rules-load").addEventListener("click", loadRules);
async function loadRules() {
  say("rules-note", "");
  try {
    const body = await api("/rules");
    $("rules-text").value = JSON.stringify(body.rules, null, 2);
    $("rules-file").textContent = body.file;
  } catch (error) { say("rules-note", error.message, "bad"); }
}

$("rules-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("rules-note", "Kaydediliyor…", "info");
  try {
    const body = await api("/rules", { method: "PUT", headers: H, body: JSON.stringify({ text: $("rules-text").value }) });
    say("rules-note", body.count + " kural kaydedildi ve devreye alındı.", "good");
    await refresh();
  } catch (error) { say("rules-note", error.message, "bad"); }
});

$("recheck").addEventListener("click", () => refresh(true));

async function refresh(live) {
  try {
    const state = await api("/state" + (live ? "?live=1" : ""));
    renderChecks(state);
    renderFields(state.fields);
    renderJournal(state);
    // Only panel-written values can be deleted; an environment value is the
    // host's, and clearing it here would just look broken after a restart.
    const options = $("clear-key");
    const chosen = options.value;
    options.textContent = "";
    for (const field of state.fields) {
      if (field.source !== "panel") continue;
      const option = document.createElement("option");
      option.value = field.key;
      option.appendChild(text(field.key));
      options.appendChild(option);
    }
    if (!options.options.length) {
      const option = document.createElement("option");
      option.value = "";
      option.appendChild(text("panelden kaydedilmiş ayar yok"));
      options.appendChild(option);
    }
    // Keep the previous choice if it survived the refresh; otherwise fall to
    // the first entry, so the box is never mysteriously blank.
    options.value = [...options.options].some((option) => option.value === chosen) ? chosen : options.options[0].value;
    $("clear-secret").disabled = !options.value;
  } catch (error) {
    if (error.message) say("state-note", error.message, "bad");
  }
}

// The journal is the only thing that changes on its own, so a slow poll is
// enough; the doctor's live token checks stay behind the button.
setInterval(() => { if (!$("panel").classList.contains("hidden")) refresh(); }, 20000);

// One probe decides which half of the page you get: a valid session cookie
// means straight into the panel, anything else means the login form.
api("/state")
  .then(() => { showPanel(); return Promise.all([refresh(), loadRules()]); })
  .catch(() => showLogin());
`;

/**
 * @param nonce Random per request, and repeated in the Content-Security-Policy
 * header. Only the two tags carrying it may run, so a script smuggled into the
 * page some other way — through a journal entry, say — is inert even if some
 * future edit forgets to escape it.
 */
export function page(nonce: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>reply-bot paneli</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>">
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>

<main>
  <section id="login" class="hidden">
    <h1>reply-bot</h1>
    <p class="sub">Panele girmek için şifre.</p>
    <div id="login-note" class="note hidden"></div>
    <form id="login-form">
      <div class="field">
        <label for="password">Şifre</label>
        <input id="password" type="password" autocomplete="current-password" required>
      </div>
      <button type="submit">Gir</button>
    </form>
  </section>

  <div id="panel" class="hidden">
    <h1>reply-bot paneli</h1>
    <p class="sub">Instagram yorumlarına ve WhatsApp mesajlarına cevap veren botun ayarları.</p>

    <section>
      <h2>Durum</h2>
      <ul id="checks" class="checks"></ul>
      <div id="state-note" class="note hidden"></div>
      <div class="bar">
        <button id="recheck" class="ghost" type="button">Anahtarları da sına</button>
        <button id="logout" class="ghost" type="button">Çıkış</button>
      </div>
    </section>

    <section>
      <h2>Meta paneline yapıştırılacak</h2>
      <pre id="webhooks"></pre>
    </section>

    <section>
      <h2>Ayarlar</h2>
      <div id="settings-note" class="note hidden"></div>
      <form id="settings-form">
        <div id="settings-fields"></div>
        <div class="bar">
          <button type="submit">Kaydet</button>
          <label class="inline">
            <input id="dry-run" type="checkbox" class="auto">
            Prova modu (hiçbir şey gönderilmez)
          </label>
        </div>
      </form>
      <div class="bar">
        <select id="clear-key" class="grow" aria-label="Silinecek ayar"></select>
        <button id="clear-secret" class="ghost" type="button">Seçili ayarı sil</button>
      </div>
      <p class="hint">Dolu bir anahtar kutusu boş görünür — kayıtlı değer tarayıcıya hiç gönderilmiyor.
      Değiştirmek için yenisini yaz, silmek için yukarıdaki listeden seç.
      Kayıt yeri: <span id="store-file" class="muted"></span></p>
      <div id="store-note" class="note hidden"></div>
    </section>

    <section>
      <h2>Bir mesaj dene</h2>
      <form id="try-form">
        <div class="bar">
          <input id="try-text" class="grow" placeholder="fiyat ne kadar?" required>
          <select id="try-channel" class="auto">
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button type="submit">Dene</button>
        </div>
      </form>
      <div id="try-note" class="note hidden"></div>
      <pre id="try-result"></pre>
      <p class="hint">Hiçbir şey gönderilmez; yalnızca botun ne yapacağını gösterir.</p>
    </section>

    <section>
      <h2>Kurallar</h2>
      <div id="rules-note" class="note hidden"></div>
      <form id="rules-form">
        <textarea id="rules-text" spellcheck="false" aria-label="Kurallar"></textarea>
        <div class="bar">
          <button type="submit">Kaydet</button>
          <button id="rules-load" class="ghost" type="button">Yeniden yükle</button>
          <span class="hint">Dosya: <span id="rules-file" class="muted"></span></span>
        </div>
      </form>
    </section>

    <section>
      <h2>Son mesajlar</h2>
      <p class="hint" id="journal-summary"></p>
      <table>
        <thead><tr><th>Saat</th><th>Kanal</th><th>Kim, ne dedi</th><th>Ne yapıldı</th></tr></thead>
        <tbody id="journal-body"></tbody>
      </table>
      <p class="hint">Yeniden başlatınca sıfırlanır — kalıcı kayıt tutulmuyor.</p>
    </section>
  </div>
</main>

<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>
`;
}
