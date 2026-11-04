export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function toast(msg, kind = "info", ms = 4500) {
  const t = document.createElement("div");
  t.className = "toast " + kind; t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), ms);
}
export function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const fmtDur = (ms) => (ms ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : "—");

export const PROVIDERS = ["gemini", "anthropic", "openai", "deepseek", "custom"];
export const PROVIDER_LABEL = { gemini: "Google Gemini", anthropic: "Anthropic Claude", openai: "OpenAI", deepseek: "DeepSeek", custom: "Custom (OpenAI-compatible)" };
export const PROVIDER_COLOR = { gemini: "#4285f4", anthropic: "#d97757", openai: "#10a37f", deepseek: "#4d6bfe", custom: "#a3a3a3" };

export function aiCardHTML(o) {
  const c = PROVIDER_COLOR[o.provider] || "#a3a3a3";
  const t = o.elapsed != null ? o.elapsed.toFixed(1) + "s" : o.ms ? (o.ms / 1000).toFixed(1) + "s" : "—";
  return `<div class="aic ${o.active ? "active" : ""}">
    <div class="hd"><div class="avatar" style="background:${c}">${esc((o.name || "?")[0].toUpperCase())}</div>
      <div style="min-width:0"><div class="cl">${o.color.toUpperCase()}</div><div class="nm">${esc(o.name || "—")}</div>
      <div class="sm mut" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(PROVIDER_LABEL[o.provider] || "—")} · ${esc(o.model || "—")}</div></div>
      ${o.active ? '<span class="dot"></span>' : ""}</div>
    <dl class="kv"><dt>Status</dt><dd>${esc(o.status)}</dd><dt>Moves</dt><dd>${o.moves}</dd><dt>Time</dt><dd class="mono">${t}</dd>
      <dt>Tokens</dt><dd class="mono">${o.inTok || o.outTok ? `${o.inTok} in / ${o.outTok} out` : "—"}</dd>
      <dt>API</dt><dd class="mono">${o.http ? "HTTP " + o.http : "—"}</dd></dl>
    ${o.comment ? `<div class="cm">“${esc(o.comment)}”</div>` : ""}</div>`;
}

/** cats: kategori per langkah (opsional). view: 0..N (langkah terpilih). */
export function moveListHTML(sans, cats, view, META) {
  if (!sans.length) return '<p class="mut sm" style="padding:8px">Belum ada langkah.</p>';
  let h = '<table class="mv"><tbody>';
  const cell = (i) => {
    if (i >= sans.length) return "<td></td>";
    const m = cats && cats[i] && META ? META[cats[i]] : null;
    return `<td><button data-mv="${i + 1}" class="${view === i + 1 ? "on" : ""}"><span>${esc(sans[i])}</span>${m ? `<b class="sm" style="color:${m.color}" title="${m.label}">${m.icon}</b>` : ""}</button></td>`;
  };
  for (let i = 0; i < sans.length; i += 2) h += `<tr><td class="n">${i / 2 + 1}.</td>${cell(i)}${cell(i + 1)}</tr>`;
  return h + "</tbody></table>";
}
export function onMoveClick(container, fn) {
  container.addEventListener("click", (e) => { const b = e.target.closest("[data-mv]"); if (b) fn(Number(b.dataset.mv)); });
}
