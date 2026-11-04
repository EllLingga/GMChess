import { games } from "../store.js";
import { $, esc, download } from "../ui.js";

export function mount(root) {
  root.innerHTML = `<div class="stack" style="max-width:900px;margin:0 auto">
    <div class="row between"><h1 style="font-size:24px;font-weight:700">Game History</h1><input class="input" id="q" style="max-width:300px" placeholder="Cari pemain, pembukaan, hasil…"></div><div id="list" class="stack"></div></div>`;
  const render = () => {
    const s = $("#q", root).value.trim().toLowerCase(), all = games.list();
    const l = all.filter((g) => !s || [g.whiteName, g.blackName, g.whiteModel, g.blackModel, g.result].some((x) => String(x ?? "").toLowerCase().includes(s)) || String(g.pgn).toLowerCase().includes(s));
    $("#list", root).innerHTML = l.length ? l.map((g) => `<div class="card" data-id="${g.id}">
      <div class="row between"><b>${esc(g.whiteName)} <span class="mut">vs</span> ${esc(g.blackName)}</b><b class="acc">${esc(g.result)}</b></div>
      <p class="sm mut" style="margin-top:4px">${new Date(g.createdAt).toLocaleString()} · ${g.numMoves} langkah · ${esc(g.termination || "")}${g.accWhite != null ? ` · Accuracy ${g.accWhite.toFixed(1)}% / ${g.accBlack.toFixed(1)}%` : ""}</p>
      <div class="row mt"><a class="btn" href="#/review/${g.id}">Replay</a><a class="btn" href="#/review/${g.id}">${g.accWhite != null ? "Game Review" : "Analyze"}</a><button class="btn" data-a="pgn">Export PGN</button><button class="btn-danger" data-a="del">Delete</button></div></div>`).join("")
      : `<p class="sm mut">${all.length ? "Tidak ada hasil." : "Belum ada game tersimpan. Mainkan pertandingan di AI Arena atau Play."}</p>`;
  };
  $("#q", root).oninput = render;
  $("#list", root).onclick = (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const g = games.get(b.closest("[data-id]").dataset.id); if (!g) return;
    if (b.dataset.a === "pgn") download(`${g.whiteName}-vs-${g.blackName}.pgn`, g.pgn, "application/x-chess-pgn");
    else if (confirm(`Hapus game ${g.whiteName} vs ${g.blackName}?`)) { games.remove(g.id); render(); }
  };
  render();
}
