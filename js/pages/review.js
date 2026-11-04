import { Board, EvalBar } from "../board.js";
import { getEngine, formatCp } from "../engine.js";
import { META, CATS, replay, reviewGame } from "../classify.js";
import { detectOpening } from "../openings.js";
import { games } from "../store.js";
import { $, esc, fmtDur, moveListHTML, onMoveClick, download } from "../ui.js";

function graphSVG(evals, view) {
  const W = 600, H = 150, n = evals.length, mid = H / 2, cl = (c) => Math.max(-800, Math.min(800, c)) / 800;
  const x = (i) => (n > 1 ? (i / (n - 1)) * W : 0), y = (c) => mid - cl(c) * (mid - 6);
  const pts = evals.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" L");
  return `<svg class="graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-n="${n}">
    <path d="M${x(0)},${mid} L${pts} L${x(n - 1)},${mid} Z" fill="rgba(16,185,129,.22)"/>
    <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="#525252" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <path d="M${pts}" fill="none" stroke="#10b981" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <line x1="${x(view)}" x2="${x(view)}" y1="0" y2="${H}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

export function mount(root, params) {
  const game = games.get(params[0]);
  if (!game) { root.innerHTML = '<div class="alert bad">Game tidak ditemukan (mungkin data browser dihapus).</div><p class="mt"><a class="btn" href="#/history">← Game History</a></p>'; return; }
  const sans = game.moves.map((m) => m.san), rp = replay(sans), opening = detectOpening(sans);
  let an = game.analysis || null, view = 0, flipped = false, dead = false, running = false;

  root.innerHTML = `<div class="stack">
    <section class="card"><p class="sm mut" style="letter-spacing:.14em">GAME REVIEW</p><h1 style="font-size:22px;font-weight:700;margin-top:4px">${esc(game.whiteName)} vs ${esc(game.blackName)}</h1>
      <p class="sm mut" style="margin-top:4px">Result: <b style="color:#fff">${esc(game.result)}</b>${game.termination ? ` (${esc(game.termination)})` : ""} · ${opening ? esc(opening.eco + " " + opening.name) : "Opening tidak dikenali"} · ${game.numMoves} langkah · ${fmtDur(game.durationMs)}</p>
      <div class="row mt"><label class="sm mut">Kedalaman analisis</label><select class="input" id="depth" style="width:auto"><option>8</option><option selected>10</option><option>12</option><option>14</option></select><button class="btn" id="rerun">Analisis ulang</button><button class="btn" id="pgn">Export PGN</button><a class="btn" href="#/history">← History</a></div>
      <div id="prog" class="mt hidden"><p class="sm mut" id="progt"></p><div class="bar"><div id="progb" style="width:0"></div></div></div><p id="engerr" class="sm err mt"></p></section>
    <div id="sum"></div>
    <div class="grid-main">
      <div class="min0"><div class="boardrow"><div id="eb"></div><div class="min0"><div id="board"></div></div></div>
        <div class="row mt"><button class="btn" id="first">⏮</button><button class="btn" id="prev">◀</button><button class="btn" id="next">▶</button><button class="btn" id="last">⏭</button><button class="btn" id="flip">Flip</button></div></div>
      <aside class="stack"><section class="card"><h2 class="h-sec">DETAIL LANGKAH</h2><div id="det" class="sm"></div></section><section class="card tight scroll"><div id="mlist"></div></section></aside>
    </div>
    <section class="card"><h2 class="h-sec">EVALUATION GRAPH</h2><div id="graph"></div></section>
    <div id="hl" class="grid-3" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"></div></div>`;

  const board = new Board($("#board", root)), eb = new EvalBar($("#eb", root));
  const name = (s) => (s === "w" ? game.whiteName : game.blackName);

  function renderSum() {
    const el = $("#sum", root); if (!an) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="grid-3">${["w", "b"].map((s) => `<div class="card center"><p class="sm mut" style="letter-spacing:.14em">${s === "w" ? "WHITE" : "BLACK"} · ${esc(name(s))}</p>
      <p class="acc" style="font-size:40px;font-weight:800;margin-top:8px">${an.acc[s].toFixed(1)}%</p><p class="sm mut">Accuracy · ACPL ${an.acpl[s]}</p></div>`).join("")}
      <div class="card"><h2 class="h-sec">MOVE CLASSIFICATION</h2><table class="cls"><tbody><tr class="sm mut"><td></td><td class="r">W</td><td class="r">B</td></tr>
      ${CATS.map((c) => `<tr><td style="color:${META[c].color}">${META[c].icon} ${META[c].label}</td><td class="r">${an.counts.w[c] || 0}</td><td class="r">${an.counts.b[c] || 0}</td></tr>`).join("")}</tbody></table></div></div>`;
    $("#graph", root).innerHTML = graphSVG(an.evals, view);
    const rows = an.classes.map((c, i) => ({ ...c, i }));
    const li = (m) => `<li><button class="btn" style="background:none;padding:2px 0;text-align:left" data-mv="${m.i + 1}"><span style="color:${META[m.category].color}">${META[m.category].icon}</span> ${Math.floor(m.i / 2) + 1}${m.i % 2 ? "…" : "."} ${esc(sans[m.i])} <span class="mut">(${esc(name(m.i % 2 ? "b" : "w"))}${m.winLoss ? `, −${m.winLoss}%` : ""})</span></button></li>`;
    const box = (t, l, empty) => `<div class="card"><h2 class="h-sec">${t}</h2>${l.length ? `<ul class="sm" style="list-style:none;padding:0;margin:0">${l.map(li).join("")}</ul>` : `<p class="sm mut">${empty}</p>`}</div>`;
    $("#hl", root).innerHTML = box("CRITICAL MOMENTS", [...rows].sort((a, b) => b.winLoss - a.winLoss).filter((m) => m.winLoss >= 10).slice(0, 3), "Tidak ada momen kritis besar.") +
      box("BIGGEST MISTAKES", rows.filter((m) => ["blunder", "mistake"].includes(m.category)).sort((a, b) => b.winLoss - a.winLoss).slice(0, 3), "Tidak ada kesalahan besar.") +
      box("BEST MOVES", rows.filter((m) => m.category === "brilliant" || m.category === "great").slice(0, 5), "Belum ada Brilliant/Great.");
  }
  function renderView() {
    board.set({ fen: rp.fens[view], lastMove: view > 0 ? rp.ucis[view - 1] : null, orientation: flipped ? "black" : "white" });
    $("#mlist", root).innerHTML = moveListHTML(sans, an && an.classes.map((c) => c.category), view, META);
    eb.set(an ? an.evals[view] : null, flipped, an ? formatCp(an.evals[view]) : "…");
    const el = $("#det", root);
    if (view === 0) el.innerHTML = '<span class="mut">Pilih langkah dari daftar, grafik, atau ringkasan.</span>';
    else if (!an) el.innerHTML = '<span class="mut">Menunggu analisis…</span>';
    else {
      const c = an.classes[view - 1], mt = META[c.category];
      el.innerHTML = `<p style="color:${mt.color};font-weight:600">${mt.icon} ${mt.label} — ${esc(sans[view - 1])}</p><p style="margin:4px 0 8px">${esc(c.reason)}</p>
        <dl class="kv"><dt>Engine best</dt><dd class="mono">${esc(c.bestSan || "—")}</dd><dt>Actual move</dt><dd class="mono">${esc(sans[view - 1])}</dd>
        <dt>Eval before</dt><dd class="mono">${formatCp(an.evals[view - 1])}</dd><dt>Eval after</dt><dd class="mono">${formatCp(an.evals[view])}</dd>
        <dt>Centipawn loss</dt><dd class="mono">${c.cpLoss}</dd><dt>Win% loss</dt><dd class="mono">${c.winLoss}</dd></dl>`;
    }
    if (an) $("#graph", root).innerHTML = graphSVG(an.evals, view);
  }
  const go = (n) => { view = Math.max(0, Math.min(sans.length, n)); renderView(); };

  async function run() {
    if (running) return; running = true; $("#engerr", root).textContent = ""; $("#prog", root).classList.remove("hidden");
    const depth = Number($("#depth", root).value);
    try {
      const e = await getEngine();
      const res = await reviewGame(e, sans, (d, t) => { if (dead) return; $("#progt", root).textContent = `Stockfish menganalisis posisi ${d}/${t}…`; $("#progb", root).style.width = (d / t) * 100 + "%"; }, depth, () => dead);
      if (!res || dead) return;
      an = res; games.update(game.id, { analysis: res, accWhite: res.acc.w, accBlack: res.acc.b }); renderSum(); renderView();
    } catch (e) { $("#engerr", root).textContent = e.message; }
    running = false; $("#prog", root).classList.add("hidden");
  }

  $("#first", root).onclick = () => go(0); $("#prev", root).onclick = () => go(view - 1); $("#next", root).onclick = () => go(view + 1); $("#last", root).onclick = () => go(sans.length);
  $("#flip", root).onclick = () => { flipped = !flipped; renderView(); };
  $("#rerun", root).onclick = () => { an = null; renderSum(); renderView(); run(); };
  $("#pgn", root).onclick = () => download(`${game.whiteName}-vs-${game.blackName}.pgn`, game.pgn, "application/x-chess-pgn");
  onMoveClick(root, (n) => go(n));
  $("#graph", root).addEventListener("click", (e) => {
    const svg = e.target.closest("svg"); if (!svg || !an) return;
    const r = svg.getBoundingClientRect(); go(Math.round(((e.clientX - r.left) / r.width) * (an.evals.length - 1)));
  });
  if (game.analysis) $("#depth", root).value = String(game.analysis.depth);
  renderSum(); renderView(); if (!an) run();
  return () => { dead = true; };
}
