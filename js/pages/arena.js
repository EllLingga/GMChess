import { Chess } from "../chesslib.js";
import { Board, EvalBar } from "../board.js";
import { getEngine, formatCp, lineToCp } from "../engine.js";
import { getAiMove } from "../providers.js";
import { profiles, games } from "../store.js";
import { play as sfx, soundForMove } from "../sound.js";
import { $, esc, toast, aiCardHTML, moveListHTML, onMoveClick } from "../ui.js";

const START = new Chess().fen();
const blank = () => ({ status: "Waiting for turn", since: null, ms: 0, inTok: 0, outTok: 0, http: null, moves: 0, comment: "" });

export function mount(root) {
  const list = profiles.list();
  if (!list.length) {
    root.innerHTML = `<div class="card center stack" style="max-width:520px;margin:48px auto"><h1 style="font-size:20px;font-weight:700">Belum ada AI yang dikonfigurasi</h1>
      <p class="sm mut">Tempel API key AI (Gemini, Claude, OpenAI, DeepSeek, atau Custom), beri nama sendiri, lalu simpan di Settings.</p><a class="btn-primary" href="#/settings">Buka Settings</a></div>`;
    return;
  }
  const opts = list.map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.model)}</option>`).join("");
  root.innerHTML = `
  <div class="grid-arena">
    <div class="stack">
      <section class="card stack"><h2 class="h-sec" style="margin:0">MATCH SETUP</h2>
        <div><label class="label">WHITE (AI 1)</label><select class="input" id="sw">${opts}</select></div>
        <button class="btn full" id="swap">⇅ Tukar warna</button>
        <div><label class="label">BLACK (AI 2)</label><select class="input" id="sb">${opts}</select></div></section>
      <div id="card-b"></div><div id="card-w"></div>
    </div>
    <div class="min0">
      <div class="boardrow"><div id="eb"></div><div class="min0"><div id="board"></div></div></div>
      <div class="row mt">
        <button class="btn-primary" id="bStart">START BATTLE</button><button class="btn" id="bPause">PAUSE</button><button class="btn-primary hidden" id="bResume">RESUME</button>
        <button class="btn" id="bNext">NEXT MOVE</button><button class="btn-danger" id="bStop">STOP MATCH</button><button class="btn" id="bRestart">RESTART</button><button class="btn" id="bFlip">Flip</button>
      </div>
      <p class="sm mut mt">Status: <b id="stat" style="color:#fff">IDLE</b> <span id="res" class="acc" style="font-weight:600"></span> <span id="engnote" class="sm"></span></p>
      <div id="err" class="alert bad mt hidden"></div><div id="rev" class="mt"></div>
    </div>
    <div class="stack">
      <section class="card tight scroll tall"><div class="row between" style="padding:4px 8px"><h2 class="h-sec" style="margin:0">MOVE HISTORY</h2><button class="btn hidden" id="live" style="padding:2px 8px">● Live</button></div><div id="mlist"></div></section>
      <section class="card sm mut">Setiap langkah divalidasi chess.js. Langkah ilegal → AI diberi feedback lalu diminta ulang (sesuai “Maximum retries” profilnya). Jika tetap gagal, match berhenti dengan status AI error. <b>Biarkan tab ini tetap terbuka</b> selama match.</section>
    </div>
  </div>`;
  const sw = $("#sw", root), sbl = $("#sb", root);
  sw.value = list[0].id; sbl.value = (list[1] || list[0]).id;
  const board = new Board($("#board", root)), eb = new EvalBar($("#eb", root));

  let status = "idle", game = new Chess(), moves = [], view = null, busy = false, flipped = false, result = null, savedId = null;
  let sides = { w: blank(), b: blank() }, pair = null, runId = 0, loopFor = 0, paused = false, step = false, abort = null, startedAt = 0, liveCp = null;
  const active = () => status === "running" || status === "paused";
  const upd = (s, p) => { sides[s] = { ...sides[s], ...p }; renderCards(); };

  function renderCards() {
    const pw = pair ? pair.w : list.find((p) => p.id === sw.value), pb = pair ? pair.b : list.find((p) => p.id === sbl.value), turn = game.turn();
    const one = (c, p) => aiCardHTML({ color: c === "w" ? "White" : "Black", name: p.name, provider: p.provider, model: p.model, status: sides[c].status, moves: sides[c].moves, ms: sides[c].ms,
      inTok: sides[c].inTok, outTok: sides[c].outTok, http: sides[c].http, comment: sides[c].comment, active: status === "running" && busy && turn === c,
      elapsed: sides[c].since ? (Date.now() - sides[c].since) / 1000 : null });
    $("#card-w", root).innerHTML = one("w", pw); $("#card-b", root).innerHTML = one("b", pb);
  }
  function renderMeta() {
    $("#stat", root).textContent = status.toUpperCase();
    $("#res", root).textContent = result ? (result.res === "*" ? `· Dihentikan — ${result.term === "ai_error" ? "AI error" : result.term}` : `· ${result.res} · ${result.term}`) : "";
    const act = active();
    $("#bStart", root).classList.toggle("hidden", act); $("#bPause", root).classList.toggle("hidden", !act || status === "paused"); $("#bResume", root).classList.toggle("hidden", status !== "paused");
    $("#bNext", root).disabled = status !== "paused" || busy; $("#bStop", root).disabled = !act; $("#bRestart", root).disabled = status === "idle";
    sw.disabled = sbl.disabled = $("#swap", root).disabled = act;
    $("#live", root).classList.toggle("hidden", view === null);
  }
  function renderMoves() {
    const m = $("#mlist", root); m.innerHTML = moveListHTML(moves.map((x) => x.san), null, view ?? moves.length);
  }
  function renderBoard() {
    const fen = view === null ? game.fen() : view === 0 ? START : moves[view - 1].fen;
    const uci = view === null ? (moves.at(-1)?.uci ?? null) : view > 0 ? moves[view - 1].uci : null;
    board.set({ fen, lastMove: uci, orientation: flipped ? "black" : "white" });
    eb.set(liveCp, flipped, liveCp == null ? "…" : formatCp(liveCp));
  }
  const renderAll = () => { renderCards(); renderMeta(); renderMoves(); renderBoard(); };

  function evalLive(fen) {
    getEngine().then((e) => e.analyzeFen(fen, 9, 1, () => game.fen() !== fen)).then((a) => { if (a && game.fen() === fen) { liveCp = lineToCp(a.lines[0]); renderBoard(); } })
      .catch((e) => { $("#engnote", root).textContent = "· Engine eval tidak tersedia: " + e.message.slice(0, 80); });
  }

  function save(term, res) {
    if (!pair || !moves.length) return;
    try {
      game.setHeader("Event", "GRANDMASTER AI Arena"); game.setHeader("White", pair.w.name); game.setHeader("Black", pair.b.name); game.setHeader("Result", res);
      game.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
    } catch {}
    try {
      const g = games.add({ mode: "ai_vs_ai", whiteName: pair.w.name, blackName: pair.b.name, whiteModel: pair.w.model, blackModel: pair.b.model, result: res, termination: term,
        pgn: game.pgn(), moves: moves.map(({ fen, ...m }) => m), numMoves: Math.ceil(moves.length / 2), durationMs: Date.now() - startedAt });
      savedId = g.id; $("#rev", root).innerHTML = `<a class="btn-primary" href="#/review/${g.id}">Buka Game Review →</a>`;
    } catch (e) { toast(e.message, "bad"); }
  }
  function finish(id) {
    if (runId !== id) return;
    let res = "1/2-1/2", term = "50-move rule";
    if (game.isCheckmate()) { res = game.turn() === "w" ? "0-1" : "1-0"; term = "checkmate"; }
    else if (game.isStalemate()) term = "stalemate"; else if (game.isThreefoldRepetition()) term = "threefold repetition"; else if (game.isInsufficientMaterial()) term = "insufficient material";
    result = { res, term }; status = "finished"; sides.w = { ...sides.w, status: "Game over", since: null }; sides.b = { ...sides.b, status: "Game over", since: null };
    sfx(game.isCheckmate() ? "mate" : "end"); save(term, res); renderAll();
  }

  async function playOne(id) {
    const side = game.turn(), other = side === "w" ? "b" : "w", prof = pair[side];
    abort = new AbortController(); busy = true;
    sides[side] = { ...sides[side], status: "Thinking…", since: Date.now(), http: null }; sides[other] = { ...sides[other], status: "Waiting for turn", since: null };
    renderCards(); renderMeta();
    try {
      const r = await getAiMove({ profile: prof, game, signal: abort.signal, onStatus: (s) => { if (runId === id) upd(side, { status: s.message, http: s.http }); } });
      if (runId !== id) return false;
      const m = game.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
      moves.push({ san: m.san, uci: r.uci, ms: r.ms, comment: r.comment, confidence: r.confidence, tokens: r.inTokens + r.outTokens, fen: game.fen() });
      sfx(soundForMove(game, m));
      sides[side] = { ...sides[side], status: "Move played", since: null, ms: r.ms, inTok: sides[side].inTok + r.inTokens, outTok: sides[side].outTok + r.outTokens, http: r.http, moves: sides[side].moves + 1, comment: r.comment };
      busy = false; liveCp = null; renderAll(); evalLive(game.fen());
      return true;
    } catch (e) {
      if (runId !== id || e.name === "AbortError") return false;
      busy = false; sides[side] = { ...sides[side], status: "AI error", since: null }; status = "error"; result = { res: "*", term: "ai_error" };
      const el = $("#err", root); el.classList.remove("hidden"); el.textContent = `${prof.name} (${side === "w" ? "White" : "Black"}): ${e.message}`;
      sfx("end"); save("ai_error", "*"); renderAll(); return false;
    } finally { if (runId === id) busy = false; }
  }

  async function loop(id) {
    if (loopFor === id) return; loopFor = id;
    try {
      while (runId === id) {
        if (game.isGameOver()) { finish(id); return; }
        if (paused && !step) return;
        const single = step; step = false;
        if (!(await playOne(id))) return;
        if (single) { if (game.isGameOver()) finish(id); renderMeta(); return; }
      }
    } finally { if (loopFor === id) loopFor = 0; }
  }

  function start() {
    const w = list.find((p) => p.id === sw.value), b = list.find((p) => p.id === sbl.value); if (!w || !b) return;
    abort && abort.abort(); const id = ++runId; pair = { w, b }; game = new Chess(); moves = []; paused = false; step = false; startedAt = Date.now();
    view = null; result = null; savedId = null; liveCp = null; busy = false; sides = { w: blank(), b: blank() }; status = "running";
    $("#err", root).classList.add("hidden"); $("#rev", root).innerHTML = ""; $("#engnote", root).textContent = "";
    sfx("start"); renderAll(); evalLive(game.fen()); loop(id);
  }
  $("#bStart", root).onclick = start; $("#bRestart", root).onclick = start;
  $("#bPause", root).onclick = () => { paused = true; status = "paused"; renderMeta(); };
  $("#bResume", root).onclick = () => { paused = false; status = "running"; renderMeta(); loop(runId); };
  $("#bNext", root).onclick = () => { step = true; loop(runId); };
  $("#bStop", root).onclick = () => {
    runId++; abort && abort.abort(); paused = false; busy = false; status = "stopped"; result = { res: "*", term: "stopped" };
    sides.w = { ...sides.w, status: "Stopped", since: null }; sides.b = { ...sides.b, status: "Stopped", since: null }; save("stopped", "*"); renderAll();
  };
  $("#bFlip", root).onclick = () => { flipped = !flipped; renderBoard(); };
  $("#swap", root).onclick = () => { const a = sw.value; sw.value = sbl.value; sbl.value = a; renderCards(); };
  sw.onchange = sbl.onchange = renderCards;
  $("#live", root).onclick = () => { view = null; renderAll(); };
  onMoveClick($("#mlist", root), (n) => { view = n === moves.length ? null : n; renderAll(); });

  const timer = setInterval(() => { if (status === "running" && busy) renderCards(); }, 250);
  renderAll();
  return () => { runId++; abort && abort.abort(); clearInterval(timer); };
}
