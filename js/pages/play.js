import { Chess } from "../chesslib.js";
import { Board } from "../board.js";
import { getAiMove } from "../providers.js";
import { profiles, games } from "../store.js";
import { play as sfx, soundForMove } from "../sound.js";
import { $, esc, toast, aiCardHTML, moveListHTML } from "../ui.js";

const START = new Chess().fen();
const LEVELS = ["beginner", "intermediate", "advanced", "expert", "grandmaster"];

export function mount(root) {
  const list = profiles.list();
  if (!list.length) {
    root.innerHTML = `<div class="card center stack" style="max-width:520px;margin:48px auto"><h1 style="font-size:20px;font-weight:700">Belum ada AI yang dikonfigurasi</h1>
      <p class="sm mut">Tambahkan API key AI dan beri nama di Settings.</p><a class="btn-primary" href="#/settings">Buka Settings</a></div>`;
    return;
  }
  root.innerHTML = `
  <div class="grid-play">
    <div class="stack">
      <section class="card stack"><h2 class="h-sec" style="margin:0">GAME SETUP</h2>
        <div><label class="label">Lawan (AI)</label><select class="input" id="p">${list.map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.model)}</option>`).join("")}</select></div>
        <div><label class="label">Tingkat kesulitan</label><select class="input" id="lv">${LEVELS.map((l) => `<option value="${l}" ${l === "intermediate" ? "selected" : ""}>${l[0].toUpperCase() + l.slice(1)}</option>`).join("")}</select></div>
        <div><label class="label">Warna kamu</label><select class="input" id="col"><option value="w">White</option><option value="b">Black</option><option value="r">Random</option></select></div>
        <button class="btn-primary full" id="start">Mulai Main</button></section>
      <div id="card"></div>
    </div>
    <div class="min0"><div id="board"></div>
      <div class="row mt"><button class="btn-danger" id="resign" disabled>Resign</button><span id="info" class="sm mut"></span><b id="res" class="acc"></b></div>
      <div id="err" class="alert bad mt hidden"></div><div id="rev" class="mt"></div></div>
    <section class="card tight scroll tall"><h2 class="h-sec" style="padding:4px 8px;margin:0">MOVES</h2><div id="mlist"></div></section>
  </div>`;

  let game = new Chess(), human = "w", started = false, busy = false, over = false, recs = [], startedAt = 0, abort = null, prof = null, level = "intermediate";
  let ai = { status: "Waiting for turn", ms: 0, inTok: 0, outTok: 0, http: null, moves: 0, comment: "" };
  const board = new Board($("#board", root), { onMove: (f, t, p) => onMove(f, t, p) });

  function render(last) {
    board.set({ fen: game.fen(), lastMove: last ?? null, orientation: human === "w" ? "white" : "black", interactive: started && !busy && !over && game.turn() === human });
    $("#mlist", root).innerHTML = moveListHTML(game.history(), null, game.history().length);
    $("#card", root).innerHTML = started && prof ? aiCardHTML({ color: human === "w" ? "Black" : "White", name: prof.name, provider: prof.provider, model: prof.model, status: ai.status, moves: ai.moves, ms: ai.ms, inTok: ai.inTok, outTok: ai.outTok, http: ai.http, comment: ai.comment, active: busy }) : "";
    $("#resign", root).disabled = !started || over;
    $("#info", root).textContent = started && !over ? (busy ? "AI sedang berpikir…" : game.turn() === human ? "Giliran kamu" : "") : "";
  }
  function end(res, term) {
    over = true; $("#res", root).textContent = `${res} · ${term}`; sfx(term === "checkmate" ? "mate" : "end");
    const hn = "You", w = human === "w" ? hn : prof.name, b = human === "b" ? hn : prof.name;
    try { game.setHeader("Event", "GRANDMASTER Play"); game.setHeader("White", w); game.setHeader("Black", b); game.setHeader("Result", res); } catch {}
    try {
      const g = games.add({ mode: "play", whiteName: w, blackName: b, whiteModel: human === "w" ? null : prof.model, blackModel: human === "b" ? null : prof.model, result: res, termination: term,
        pgn: game.pgn(), moves: recs, numMoves: Math.ceil(recs.length / 2), durationMs: Date.now() - startedAt });
      $("#rev", root).innerHTML = `<a class="btn-primary" href="#/review/${g.id}">Game Review →</a>`;
    } catch (e) { toast(e.message, "bad"); }
    render();
  }
  function checkEnd() {
    if (!game.isGameOver()) return false;
    if (game.isCheckmate()) end(game.turn() === "w" ? "0-1" : "1-0", "checkmate");
    else end("1/2-1/2", game.isStalemate() ? "stalemate" : game.isThreefoldRepetition() ? "threefold repetition" : game.isInsufficientMaterial() ? "insufficient material" : "50-move rule");
    return true;
  }
  async function aiMove() {
    if (over) return;
    abort = new AbortController(); busy = true; ai = { ...ai, status: "Thinking…", http: null }; $("#err", root).classList.add("hidden"); render(recs.at(-1)?.uci);
    try {
      const r = await getAiMove({ profile: prof, game, difficulty: level, signal: abort.signal, onStatus: (s) => { ai = { ...ai, status: s.message, http: s.http }; $("#card", root).innerHTML = aiCardHTML({ color: human === "w" ? "Black" : "White", name: prof.name, provider: prof.provider, model: prof.model, status: ai.status, moves: ai.moves, ms: ai.ms, inTok: ai.inTok, outTok: ai.outTok, http: ai.http, comment: ai.comment, active: true }); } });
      const m = game.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
      recs.push({ san: m.san, uci: r.uci, ms: r.ms, comment: r.comment, confidence: r.confidence });
      ai = { status: "Waiting for turn", ms: r.ms, inTok: ai.inTok + r.inTokens, outTok: ai.outTok + r.outTokens, http: r.http, moves: ai.moves + 1, comment: r.comment };
      sfx(soundForMove(game, m)); busy = false; render(r.uci); checkEnd();
    } catch (e) {
      busy = false; if (e.name === "AbortError") return;
      ai = { ...ai, status: "AI error" }; const el = $("#err", root); el.classList.remove("hidden");
      el.innerHTML = `${esc(e.message)}<div class="mt"><button class="btn" id="retry">Coba lagi</button></div>`; $("#retry", root).onclick = aiMove; render(recs.at(-1)?.uci);
    }
  }
  function onMove(from, to, promotion) {
    if (busy || over || game.turn() !== human) return;
    const m = game.move({ from, to, promotion }), uci = from + to + (m.promotion || "");
    recs.push({ san: m.san, uci }); sfx(soundForMove(game, m)); render(uci);
    if (!checkEnd()) aiMove();
  }
  $("#start", root).onclick = () => {
    prof = list.find((p) => p.id === $("#p", root).value); level = $("#lv", root).value;
    const c = $("#col", root).value; human = c === "r" ? (Math.random() < 0.5 ? "w" : "b") : c;
    abort && abort.abort(); game = new Chess(); recs = []; over = false; busy = false; started = true; startedAt = Date.now();
    ai = { status: "Waiting for turn", ms: 0, inTok: 0, outTok: 0, http: null, moves: 0, comment: "" };
    $("#res", root).textContent = ""; $("#rev", root).innerHTML = ""; $("#err", root).classList.add("hidden");
    sfx("start"); render(null); if (human === "b") aiMove();
  };
  $("#resign", root).onclick = () => { if (over) return; abort && abort.abort(); busy = false; end(human === "w" ? "0-1" : "1-0", "resignation"); };
  render(null);
  return () => { abort && abort.abort(); };
}
