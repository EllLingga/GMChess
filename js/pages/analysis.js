import { Chess } from "../chesslib.js";
import { Board, EvalBar } from "../board.js";
import { getEngine, formatCp, lineToCp } from "../engine.js";
import { classify, META } from "../classify.js";
import { detectOpening } from "../openings.js";
import { play as sfx, soundForMove } from "../sound.js";
import { $, esc, toast, download, moveListHTML, onMoveClick } from "../ui.js";

const START = new Chess().fen();

export function mount(root) {
  root.innerHTML = `
  <div class="grid-main">
    <div class="min0">
      <div class="boardrow"><div id="eb"></div><div class="min0"><div id="board"></div></div></div>
      <div class="row mt">
        <button class="btn" id="first">⏮</button><button class="btn" id="prev">◀</button><button class="btn" id="next">▶</button><button class="btn" id="last">⏭</button>
        <button class="btn" id="flip">Flip</button><button class="btn" id="reset">Reset</button><button class="btn" id="imp">Import PGN</button><button class="btn" id="exp">Export PGN</button>
      </div>
      <div id="impbox" class="hidden mt stack"><textarea class="input mono" id="pgn" style="min-height:100px" placeholder="Tempel PGN di sini"></textarea><p id="imperr" class="sm err"></p><button class="btn-primary" id="load">Muat &amp; Analisis</button></div>
      <p id="status" class="acc mt" style="font-weight:600"></p>
    </div>
    <aside class="stack">
      <section class="card"><h2 class="h-sec">STOCKFISH <span id="busy" class="mut"></span></h2><div id="eng"></div><ul id="lines" class="sm mono mut" style="padding-left:0;list-style:none;margin:12px 0 0"></ul></section>
      <section class="card"><h2 class="h-sec">KLASIFIKASI LANGKAH</h2><div id="cls" class="sm"></div></section>
      <section class="card tight scroll"><div id="mlist"></div></section>
    </aside>
  </div>`;

  let moves = [], view = 0, flipped = false, token = 0, engErr = "", live = null, dead = false;
  const board = new Board($("#board", root), { onMove: onUserMove }), eb = new EvalBar($("#eb", root));
  const fenAt = () => (view === 0 ? START : moves[view - 1].after);

  function renderEng() {
    const top = live && live.lines[0];
    let best = "";
    if (live && live.best && live.best !== "(none)") { try { best = new Chess(live.fen).move({ from: live.best.slice(0, 2), to: live.best.slice(2, 4), promotion: live.best[4] }).san; } catch {} }
    const op = detectOpening(moves.slice(0, view).map((m) => m.san));
    $("#eng", root).innerHTML = engErr ? `<p class="err sm">${esc(engErr)}</p>` :
      `<dl class="kv"><dt>Evaluasi</dt><dd class="mono">${top ? formatCp(lineToCp(top)) : "…"}</dd><dt>Langkah terbaik</dt><dd class="mono">${esc(best || "—")}</dd>
       <dt>Depth</dt><dd class="mono">${top ? top.depth || "—" : "—"}</dd><dt>Pembukaan</dt><dd>${op ? esc(op.eco + " " + op.name) : "—"}</dd></dl>`;
    $("#lines", root).innerHTML = live && live.lines.length > 1 ? live.lines.map((l) => `<li>${formatCp(lineToCp(l))} · ${esc(l.pv.slice(0, 5).join(" "))}</li>`).join("") : "";
    eb.set(top ? lineToCp(top) : null, flipped, top ? formatCp(lineToCp(top)) : "…");
  }
  function renderCls() {
    const m = view > 0 ? moves[view - 1] : null, el = $("#cls", root);
    if (!m) { el.innerHTML = '<span class="mut">Mainkan atau pilih sebuah langkah.</span>'; return; }
    if (!m.cls) { el.innerHTML = '<span class="mut">Menghitung…</span>'; return; }
    const mt = META[m.cls.category];
    el.innerHTML = `<p style="color:${mt.color};font-weight:600">${mt.icon} ${mt.label} — ${esc(m.san)}</p><p style="margin-top:4px">${esc(m.cls.reason)}</p>
      <p class="mut" style="margin-top:4px">Centipawn loss: <span class="mono">${Math.round(m.cls.cpLoss)}</span><br>Engine best: <span class="mono">${esc(m.cls.bestUci)}</span></p>`;
  }
  function render() {
    const fen = fenAt(), g = new Chess(fen);
    board.set({ fen, lastMove: view > 0 ? moves[view - 1].uci : null, orientation: flipped ? "black" : "white", interactive: view === moves.length });
    $("#mlist", root).innerHTML = moveListHTML(moves.map((m) => m.san), moves.map((m) => m.cls && m.cls.category), view, META);
    $("#status", root).textContent = g.isCheckmate() ? `Skakmat — ${g.turn() === "w" ? "Hitam" : "Putih"} menang` : g.isStalemate() ? "Remis (stalemate)" : g.isDraw() ? "Remis" : g.inCheck() ? "Skak" : "";
    renderEng(); renderCls(); evalView();
  }
  function evalView() {
    const t = ++token, fen = fenAt(); $("#busy", root).textContent = "· menganalisis…";
    getEngine().then((e) => e.analyzeFen(fen, 12, 3, () => dead || t !== token)).then((a) => { if (a && t === token) { live = a; engErr = ""; $("#busy", root).textContent = ""; renderEng(); } })
      .catch((e) => { engErr = e.message; $("#busy", root).textContent = ""; renderEng(); });
  }
  async function classifyAt(idx, mv) {
    try {
      const e = await getEngine();
      const [b, a] = [await e.analyzeFen(mv.before, 12, 2), await e.analyzeFen(mv.after, 12, 1)];
      mv.cls = classify(mv.before, mv.uci, b, a); if (!dead) { renderCls(); $("#mlist", root).innerHTML = moveListHTML(moves.map((m) => m.san), moves.map((m) => m.cls && m.cls.category), view, META); }
    } catch (err) { engErr = err.message; renderEng(); }
  }
  function onUserMove(from, to, promotion) {
    if (view !== moves.length) return;
    const g = new Chess(fenAt()), before = g.fen(), m = g.move({ from, to, promotion });
    const mv = { san: m.san, uci: from + to + (m.promotion || ""), before, after: g.fen() };
    moves.push(mv); view = moves.length; sfx(soundForMove(g, m)); render(); classifyAt(moves.length - 1, mv);
  }

  $("#first", root).onclick = () => { view = 0; render(); };
  $("#prev", root).onclick = () => { view = Math.max(0, view - 1); render(); };
  $("#next", root).onclick = () => { view = Math.min(moves.length, view + 1); render(); };
  $("#last", root).onclick = () => { view = moves.length; render(); };
  $("#flip", root).onclick = () => { flipped = !flipped; render(); };
  $("#reset", root).onclick = () => { moves = []; view = 0; render(); };
  $("#imp", root).onclick = () => $("#impbox", root).classList.toggle("hidden");
  $("#exp", root).onclick = () => { if (!moves.length) return toast("Belum ada langkah", "bad"); const g = new Chess(); moves.forEach((m) => g.move(m.san)); download("grandmaster-game.pgn", g.pgn(), "application/x-chess-pgn"); };
  $("#load", root).onclick = async () => {
    $("#imperr", root).textContent = "";
    try {
      const g = new Chess(); g.loadPgn($("#pgn", root).value.trim());
      const h = g.history({ verbose: true }); if (!h.length) throw new Error("PGN tidak berisi langkah");
      moves = h.map((m) => ({ san: m.san, uci: m.from + m.to + (m.promotion || ""), before: m.before, after: m.after })); view = moves.length; $("#impbox", root).classList.add("hidden"); render();
      for (let i = 0; i < moves.length && !dead; i++) await classifyAt(i, moves[i]);
    } catch (e) { $("#imperr", root).textContent = "PGN tidak valid: " + e.message; }
  };
  onMoveClick($("#mlist", root), (n) => { view = n; render(); });
  render();
  return () => { dead = true; token++; };
}
