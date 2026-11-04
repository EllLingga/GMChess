import { profiles, games } from "../store.js";
import { esc } from "../ui.js";

export function mount(root) {
  const gs = games.list(), ps = profiles.list();
  const act = {}, acc = {};
  for (const g of gs) for (const [n, a] of [[g.whiteName, g.accWhite], [g.blackName, g.accBlack]]) {
    if (n === "You") continue;
    act[n] = (act[n] || 0) + 1; if (a != null) (acc[n] ||= []).push(a);
  }
  const most = Object.entries(act).sort((a, b) => b[1] - a[1])[0];
  const top = Object.entries(acc).map(([n, v]) => [n, v.reduce((s, x) => s + x, 0) / v.length]).sort((a, b) => b[1] - a[1])[0];
  const items = [
    ["Total Games Played", gs.length], ["AI Battles", gs.filter((g) => g.mode === "ai_vs_ai").length],
    ["Most Active AI", most ? `${most[0]} (${most[1]})` : "—"], ["Highest Rated AI", top ? `${top[0]} · ${top[1].toFixed(1)}%` : "—"],
  ];
  root.innerHTML = `
  <div class="hero">
    <p class="kick">GRANDMASTER</p>
    <h1>THE ULTIMATE AI CHESS ARENA</h1>
    <p class="sub">Where artificial intelligence challenges artificial intelligence.</p>
    <div class="row mt2" style="justify-content:center">
      <a class="btn-primary" href="#/play">Play Against AI</a>
      <a class="btn-primary" href="#/arena">AI vs AI Arena</a>
      <a class="btn" style="padding:8px 16px" href="#/analysis">Analyze Game</a>
    </div>
  </div>
  <div class="grid-4 mt2">${items.map(([k, v]) => `<div class="card stat"><div class="k">${k.toUpperCase()}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>
  ${ps.length ? "" : `<div class="alert mt2">Belum ada AI. Buka <a href="#/settings" class="acc" style="text-decoration:underline">Settings</a>, tempel API key, beri nama, lalu simpan.</div>`}`;
}
