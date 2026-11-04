import { profiles, uid, exportAll, importAll, wipeAll } from "../store.js";
import { generate } from "../providers.js";
import { soundEnabled, setSoundEnabled, play } from "../sound.js";
import { getEngine } from "../engine.js";
import { $, $$, esc, toast, download, PROVIDERS, PROVIDER_LABEL } from "../ui.js";

const MODELS = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-5", "gpt-4.1", "o4-mini"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  custom: [],
};

export function mount(root) {
  let editId = null;
  root.innerHTML = `
  <div class="stack" style="max-width:860px;margin:0 auto">
    <h1 style="font-size:24px;font-weight:700">Settings</h1>
    <div class="alert">API key disimpan di <b>localStorage browser ini</b> (tidak dikirim ke server mana pun selain provider AI yang kamu pilih). Jangan gunakan di komputer bersama, dan jangan deploy dengan key milik orang lain. Siapa pun yang membuka browser/profil ini dapat membaca key tersimpan.</div>
    <section class="card stack">
      <h2 class="h-sec" id="ftitle" style="margin:0">TAMBAH PROFIL AI</h2>
      <div class="grid-2 keep">
        <div><label class="label">Nama profil (bebas, tampil di Arena)</label><input class="input" id="f-name" maxlength="40" placeholder="mis. Claude Utama"></div>
        <div><label class="label">Provider</label><select class="input" id="f-provider">${PROVIDERS.map((p) => `<option value="${p}">${PROVIDER_LABEL[p]}</option>`).join("")}</select></div>
        <div><label class="label">Model</label><input class="input" id="f-model" list="models" placeholder="ketik atau pilih"><datalist id="models"></datalist></div>
        <div><label class="label">API key <span id="keyhint" class="mut"></span></label><input class="input" id="f-key" type="password" autocomplete="off" placeholder="tempel API key"></div>
        <div id="f-base-wrap" class="hidden" style="grid-column:1/-1"><label class="label">Base URL (OpenAI-compatible, mis. https://openrouter.ai/api/v1)</label><input class="input" id="f-base"></div>
        <div><label class="label">Temperature (kosong = default)</label><input class="input" id="f-temp" type="number" step="0.1" min="0" max="2"></div>
        <div><label class="label">Maximum tokens</label><input class="input" id="f-max" type="number" value="1024"></div>
        <div><label class="label">Thinking budget (kosong = nonaktif; Claude ≥1024)</label><input class="input" id="f-think" type="number"></div>
        <div class="grid-2"><div><label class="label">Move timeout (detik)</label><input class="input" id="f-to" type="number" value="60"></div><div><label class="label">Maximum retries</label><input class="input" id="f-retry" type="number" value="3"></div></div>
        <div style="grid-column:1/-1"><label class="label">Custom system prompt (opsional)</label><textarea class="input" id="f-sys"></textarea></div>
      </div>
      <p id="fmsg" class="sm"></p>
      <div class="row"><button class="btn-primary" id="f-save">Simpan profil</button><button class="btn hidden" id="f-cancel">Batal</button></div>
    </section>
    <section class="stack"><h2 class="h-sec" style="margin:0">PROFIL TERSIMPAN</h2><div id="plist" class="stack"></div></section>
    <section class="card row between"><div><b>Efek suara</b><div class="sm mut">Langkah, tangkapan, skak, skakmat.</div></div><button class="btn" id="snd"></button></section>
    <section class="card stack">
      <h2 class="h-sec" style="margin:0">STOCKFISH</h2>
      <p class="sm mut" id="eng">Belum dimuat.</p><div><button class="btn" id="eng-test">Tes engine</button></div>
    </section>
    <section class="card stack">
      <h2 class="h-sec" style="margin:0">BACKUP DATA</h2>
      <p class="sm mut">Data hanya ada di browser ini. Export secara berkala agar tidak hilang saat cache dibersihkan.</p>
      <div class="row">
        <button class="btn" id="exp">Export (tanpa API key)</button><button class="btn" id="exp-k">Export (dengan API key)</button>
        <label class="btn" style="cursor:pointer">Import<input type="file" id="imp" accept=".json" hidden></label>
        <button class="btn-danger" id="wipe">Hapus semua data</button>
      </div>
    </section>
  </div>`;

  const f = (id) => $("#f-" + id, root);
  const setModels = () => { $("#models", root).innerHTML = MODELS[f("provider").value].map((m) => `<option value="${m}">`).join(""); f("base-wrap").classList.toggle("hidden", f("provider").value !== "custom"); };
  f("provider").onchange = setModels; setModels();

  function reset() {
    editId = null; $("#ftitle", root).textContent = "TAMBAH PROFIL AI"; $("#f-cancel", root).classList.add("hidden"); $("#keyhint", root).textContent = "";
    for (const id of ["name", "model", "key", "base", "temp", "think", "sys"]) f(id).value = "";
    f("max").value = 1024; f("to").value = 60; f("retry").value = 3; f("provider").value = "anthropic"; setModels();
  }
  function renderList() {
    const l = profiles.list();
    $("#plist", root).innerHTML = l.length ? l.map((p) => `<div class="card row" data-id="${p.id}">
      <div style="flex:1;min-width:160px"><b>${esc(p.name)}</b><div class="sm mut">${PROVIDER_LABEL[p.provider]} · ${esc(p.model)} · key …${esc((p.apiKey || "").slice(-4))}</div><div class="sm t-res"></div></div>
      <button class="btn" data-a="test">Test</button><button class="btn" data-a="edit">Edit</button><button class="btn-danger" data-a="del">Hapus</button></div>`).join("")
      : '<p class="sm mut">Belum ada profil. Tambahkan minimal satu AI di atas.</p>';
  }
  renderList();

  $("#plist", root).onclick = async (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const card = b.closest("[data-id]"), p = profiles.get(card.dataset.id), res = $(".t-res", card);
    if (b.dataset.a === "del") { if (confirm(`Hapus profil "${p.name}"?`)) { profiles.remove(p.id); if (editId === p.id) reset(); renderList(); } }
    else if (b.dataset.a === "edit") {
      editId = p.id; $("#ftitle", root).textContent = "EDIT PROFIL AI"; $("#f-cancel", root).classList.remove("hidden");
      f("name").value = p.name; f("provider").value = p.provider; setModels(); f("model").value = p.model; f("key").value = ""; $("#keyhint", root).textContent = `(kosongkan = tetap …${(p.apiKey || "").slice(-4)})`;
      f("base").value = p.baseUrl || ""; f("temp").value = p.temperature ?? ""; f("max").value = p.maxTokens; f("think").value = p.thinkingBudget ?? "";
      f("to").value = p.timeoutS; f("retry").value = p.maxRetries; f("sys").value = p.systemPrompt || ""; window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      res.className = "sm t-res mut"; res.textContent = "Menguji…";
      try {
        const r = await generate(p, { system: "You are a connectivity test.", user: 'Reply with exactly this JSON: {"ok":true}', maxTokens: Math.max(p.maxTokens, 256) });
        res.className = "sm t-res acc"; res.textContent = `✓ Terhubung (HTTP ${r.status}, ${(r.ms / 1000).toFixed(1)}s)`;
      } catch (err) { res.className = "sm t-res err"; res.textContent = `✗ ${err.status ? "HTTP " + err.status + ": " : ""}${err.message}`; }
    }
  };

  $("#f-cancel", root).onclick = reset;
  $("#f-save", root).onclick = () => {
    const msg = $("#fmsg", root); msg.className = "sm err"; msg.textContent = "";
    try {
      const old = editId ? profiles.get(editId) : null;
      const num = (v) => (v === "" ? null : Number(v));
      const name = f("name").value.trim(), model = f("model").value.trim(), key = f("key").value.trim() || (old ? old.apiKey : "");
      if (!name || name.length > 40) throw new Error("Nama harus 1–40 karakter");
      if (!model) throw new Error("Model wajib diisi");
      if (key.length < 8) throw new Error("API key wajib diisi");
      const base = f("base").value.trim().replace(/\/+$/, "");
      if (f("provider").value === "custom") { try { if (!/^https?:$/.test(new URL(base).protocol)) throw 0; } catch { throw new Error("Base URL wajib & harus diawali http(s)://"); } }
      const t = num(f("temp").value); if (t != null && (t < 0 || t > 2)) throw new Error("Temperature 0–2");
      profiles.save({
        id: editId || uid(), name, provider: f("provider").value, model, apiKey: key, baseUrl: base || null, temperature: t,
        maxTokens: Math.max(16, Number(f("max").value) || 1024), thinkingBudget: num(f("think").value),
        systemPrompt: f("sys").value.trim() || null, timeoutS: Math.min(300, Math.max(5, Number(f("to").value) || 60)), maxRetries: Math.min(10, Math.max(0, Number(f("retry").value) || 0)),
      });
      toast(editId ? "Profil diperbarui" : "Profil tersimpan", "ok"); reset(); renderList();
    } catch (e) { msg.textContent = e.message; }
  };

  const snd = $("#snd", root), paintSnd = () => { snd.textContent = soundEnabled() ? "Aktif" : "Nonaktif"; snd.className = soundEnabled() ? "btn-primary" : "btn"; };
  paintSnd(); snd.onclick = () => { setSoundEnabled(!soundEnabled()); paintSnd(); play("move"); };

  $("#eng-test", root).onclick = async () => {
    const el = $("#eng", root); el.textContent = "Memuat Stockfish… (bisa beberapa detik)"; el.className = "sm mut";
    try { const e = await getEngine(); const a = await e.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 8, 1); el.className = "sm acc"; el.textContent = `✓ ${e.name} berjalan. Langkah terbaik posisi awal: ${a.best}`; }
    catch (e) { el.className = "sm err"; el.textContent = e.message; }
  };
  $("#exp", root).onclick = () => download("grandmaster-backup.json", exportAll(false), "application/json");
  $("#exp-k", root).onclick = () => { if (confirm("File backup akan berisi API key dalam teks biasa. Simpan dengan aman. Lanjut?")) download("grandmaster-backup-with-keys.json", exportAll(true), "application/json"); };
  $("#imp", root).onchange = async (e) => {
    try { const r = importAll(await e.target.files[0].text()); toast(`Import: ${r.profiles} profil, ${r.games} game`, "ok"); renderList(); } catch (err) { toast(err.message, "bad"); }
    e.target.value = "";
  };
  $("#wipe", root).onclick = () => { if (confirm("Hapus SEMUA profil, API key, dan riwayat game di browser ini?")) { wipeAll(); renderList(); toast("Semua data dihapus", "ok"); } };
}
