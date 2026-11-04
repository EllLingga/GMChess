import { Chess } from "./chesslib.js";

// Stockfish berjalan di Web Worker (browser). Urutan sumber:
// 1) ./stockfish/stockfish.js (opsional: taruh build WASM milikmu sendiri di folder ini → lebih kuat)
// 2) CDN: stockfish.js 10.0.2 (build JavaScript murni, tanpa file .wasm eksternal)
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js",
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js",
];

export class Engine {
  constructor(worker, name) {
    this.w = worker; this.name = name; this.cache = new Map(); this.chain = Promise.resolve(); this.listener = null;
    worker.onmessage = (e) => this.listener && this.listener(typeof e.data === "string" ? e.data : String(e.data));
  }
  send(c) { this.w.postMessage(c); }
  waitFor(prefix, ms) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.listener = null; rej(new Error("Stockfish tidak merespons")); }, ms);
      this.listener = (l) => { if (l.startsWith(prefix)) { clearTimeout(t); this.listener = null; res(l); } };
    });
  }
  async handshake() {
    let p = this.waitFor("uciok", 60000); this.send("uci"); await p;
    p = this.waitFor("readyok", 30000); this.send("isready"); await p;
  }

  analyze(fen, depth = 12, multipv = 2, stale) {
    const key = `${fen}|${depth}|${multipv}`;
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    const run = () => this._run(fen, depth, multipv, stale, key);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }
  _run(fen, depth, multipv, stale, key) {
    if (stale && stale()) return Promise.resolve(null);
    const sign = fen.split(" ")[1] === "w" ? 1 : -1, lines = new Map();
    return new Promise((resolve) => {
      let done = false;
      const finish = (best) => {
        if (done) return; done = true; clearTimeout(wd); this.listener = null;
        const res = { fen, best, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
        if (this.cache.size > 3000) this.cache.clear();
        this.cache.set(key, res); resolve(res);
      };
      const wd = setTimeout(() => { this.send("stop"); setTimeout(() => finish("(none)"), 1500); }, 90000);
      this.listener = (s) => {
        if (s.startsWith("info") && s.includes(" pv ") && s.includes(" score ")) {
          const gx = (re) => { const m = s.match(re); return m ? m[1] : undefined; };
          const mpv = Number(gx(/multipv (\d+)/) ?? 1);
          const line = { multipv: mpv, depth: Number(gx(/depth (\d+)/) ?? 0), pv: s.split(" pv ")[1].trim().split(/\s+/) };
          const cp = gx(/score cp (-?\d+)/), mate = gx(/score mate (-?\d+)/);
          if (cp !== undefined) line.cp = Number(cp) * sign;
          if (mate !== undefined) line.mate = Number(mate) * sign;
          lines.set(mpv, line);
        } else if (s.startsWith("bestmove")) finish(s.split(" ")[1]);
      };
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /** Menangani posisi terminal (skakmat/remis) tanpa memanggil engine. */
  async analyzeFen(fen, depth = 12, multipv = 2, stale) {
    const g = new Chess(fen);
    if (g.isCheckmate()) return { fen, best: "(none)", lines: [{ multipv: 1, cp: g.turn() === "w" ? -10000 : 10000, pv: [], depth: 0 }] };
    if (g.isDraw() || g.isStalemate()) return { fen, best: "(none)", lines: [{ multipv: 1, cp: 0, pv: [], depth: 0 }] };
    return this.analyze(fen, depth, multipv, stale);
  }
}

let enginePromise = null;
export function getEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const errors = [];
    try {
      const head = await fetch("stockfish/stockfish.js", { method: "HEAD" });
      if (head.ok && !/html/.test(head.headers.get("content-type") || "")) {
        const e = new Engine(new Worker("stockfish/stockfish.js"), "Stockfish (lokal)");
        await e.handshake(); return e;
      }
    } catch (e) { errors.push("lokal: " + e.message); }
    for (const url of CDN) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status);
        const blob = new Blob([await r.text()], { type: "text/javascript" });
        const e = new Engine(new Worker(URL.createObjectURL(blob)), "Stockfish 10 (JS)");
        await e.handshake(); return e;
      } catch (e) { errors.push(`${new URL(url).host}: ${e.message}`); }
    }
    throw new Error("Stockfish gagal dimuat (" + errors.join("; ") + "). Periksa koneksi internet.");
  })();
  enginePromise.catch(() => { enginePromise = null; });
  return enginePromise;
}

export const lineToCp = (l) => {
  if (!l) return 0;
  if (l.mate !== undefined) return (l.mate > 0 ? 1 : -1) * (10000 - Math.min(Math.abs(l.mate), 100) * 10);
  return l.cp ?? 0;
};
export function formatCp(cp) {
  if (cp == null) return "…";
  if (Math.abs(cp) >= 10000) return cp > 0 ? "1-0" : "0-1";
  if (Math.abs(cp) >= 9000) return `${cp < 0 ? "-" : ""}M${Math.round((10000 - Math.abs(cp)) / 10)}`;
  const v = cp / 100; return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}
export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
