import { Chess } from "../chesslib.js";
import { Board } from "../board.js";
import { OPENINGS, POPULAR, detectOpening } from "../openings.js";
import { replay } from "../classify.js";
import { games } from "../store.js";
import { play as sfx, soundForMove } from "../sound.js";
import { $, esc, moveListHTML, onMoveClick } from "../ui.js";

const norm = (s) => s.replace(/[+#]/g, "");

export function mount(root) {
  root.innerHTML = `<div class="grid-main"><div class="min0"><div id="board"></div>
    <div class="row mt"><button class="btn" id="undo">◀ Undo</button><button class="btn" id="reset">Reset</button></div>
    <section class="card mt"><h2 class="h-sec">PEMBUKAAN POPULER</h2><div class="row" id="pop"></div></section></div>
    <aside class="stack"><section class="card"><h2 class="h-sec">OPENING</h2><p id="opn" style="font-weight:600"></p><p id="eco" class="sm mut"></p><div class="scroll" style="max-height:110px;margin-top:8px" id="mlist"></div></section>
    <section class="card"><h2 class="h-sec">STATISTIK DARI GAME TERSIMPAN</h2><div id="stats"></div></section>
    <section class="card hidden" id="nxtc"><h2 class="h-sec">LANJUTAN DALAM TABEL ECO</h2><ul id="nxt" class="sm" style="list-style:none;padding:0;margin:0"></ul></section></aside></div>`;
  let moves = [];
  const board = new Board($("#board", root), { interactive: true, onMove });
  $("#pop", root).innerHTML = POPULAR.map((o, i) => `<button class="btn" data-i="${i}">${esc(o.name.split(":")[0])}</button>`).join("");

  function stats() {
    let t = { total: 0, white: 0, draws: 0, black: 0 }; const next = {};
    const add = (o, r) => { o.total++; if (r === "1-0") o.white++; else if (r === "0-1") o.black++; else if (r === "1/2-1/2") o.draws++; };
    for (const g of games.list()) {
      const s = g.moves.map((m) => norm(m.san)); if (s.length < moves.length || !moves.every((m, i) => norm(m) === s[i])) continue;
      add(t, g.result); const n = s[moves.length]; if (n) add((next[n] ||= { san: n, total: 0, white: 0, draws: 0, black: 0 }), g.result);
    }
    return { ...t, next: Object.values(next).sort((a, b) => b.total - a.total).slice(0, 12) };
  }
  const pct = (a, t) => (t ? Math.round((a / t) * 100) : 0);
  function render() {
    const fen = replay(moves).fens.at(-1), op = detectOpening(moves);
    board.set({ fen, lastMove: null });
    $("#opn", root).textContent = op ? op.name : moves.length ? "Tidak dikenali" : "Posisi awal"; $("#eco", root).textContent = op ? "ECO " + op.eco : "—";
    $("#mlist", root).innerHTML = moveListHTML(moves, null, moves.length);
    const st = stats();
    $("#stats", root).innerHTML = st.total === 0 ? '<p class="sm mut">Belum ada game tersimpan yang melewati posisi ini. Statistik dihitung dari pertandingan yang kamu mainkan di aplikasi ini.</p>'
      : `<p class="sm" style="margin-bottom:8px">${st.total} game · W ${pct(st.white, st.total)}% · D ${pct(st.draws, st.total)}% · B ${pct(st.black, st.total)}%</p><table class="st"><tbody>${st.next.map((r) =>
        `<tr data-san="${esc(r.san)}"><td class="mono">${esc(r.san)}</td><td class="mut">${r.total}</td><td style="width:100%"><div class="stbar"><div style="width:${pct(r.white, r.total)}%;background:#f5f5f5"></div><div style="width:${pct(r.draws, r.total)}%;background:#737373"></div><div style="width:${pct(r.black, r.total)}%;background:#262626;border:1px solid #525252"></div></div></td></tr>`).join("")}</tbody></table>`;
    const nx = OPENINGS.filter((o) => { const l = o.moves.split(" "); return l.length > moves.length && moves.every((m, i) => l[i] === norm(m)); }).slice(0, 8);
    $("#nxtc", root).classList.toggle("hidden", !nx.length);
    $("#nxt", root).innerHTML = nx.map((o, i) => `<li><button class="btn" style="background:none;padding:3px 0" data-eco="${i}"><span class="acc">${o.eco}</span> ${esc(o.name)}</button></li>`).join("");
    $("#nxt", root).onclick = (e) => { const b = e.target.closest("[data-eco]"); if (b) { moves = nx[b.dataset.eco].moves.split(" "); render(); } };
  }
  function onMove(from, to, promotion) {
    const g = new Chess(board.fen), m = g.move({ from, to, promotion }); moves.push(m.san); sfx(soundForMove(g, m)); render();
  }
  $("#undo", root).onclick = () => { moves.pop(); render(); };
  $("#reset", root).onclick = () => { moves = []; render(); };
  $("#pop", root).onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) { moves = POPULAR[b.dataset.i].moves.split(" "); render(); } };
  $("#stats", root).onclick = (e) => { const r = e.target.closest("[data-san]"); if (r) { try { new Chess(board.fen).move(r.dataset.san); moves.push(r.dataset.san); render(); } catch {} } };
  onMoveClick($("#mlist", root), (n) => { moves = moves.slice(0, n); render(); });
  render();
}
