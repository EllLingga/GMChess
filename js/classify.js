import { Chess } from "./chesslib.js";
import { lineToCp, winPct } from "./engine.js";
import { detectOpening } from "./openings.js";

// Semua ambang dapat diubah. Satuan: poin win% yang hilang dari sudut pandang pemain yang melangkah.
export const DEFAULT_RULES = {
  excellentMax: 2, goodMax: 5, inaccuracyMax: 10, mistakeMax: 20,
  greatGap: 15, brilliantMaxLoss: 2, brilliantMinSacValue: 3, brilliantNotWinningAbove: 90, brilliantNotLostBelow: 25,
  missedWinBefore: 85, missedWinAfter: 65,
};
export const META = {
  brilliant: { label: "Brilliant", icon: "!!", color: "#1baca6" },
  great: { label: "Great", icon: "!", color: "#5c8bb0" },
  best: { label: "Best", icon: "★", color: "#10b981" },
  excellent: { label: "Excellent", icon: "✓", color: "#34d399" },
  good: { label: "Good", icon: "✓", color: "#86a873" },
  book: { label: "Book", icon: "📖", color: "#a88865" },
  inaccuracy: { label: "Inaccuracy", icon: "?!", color: "#f0c15c" },
  mistake: { label: "Mistake", icon: "?", color: "#e58f2a" },
  blunder: { label: "Blunder", icon: "??", color: "#ca3431" },
  missedwin: { label: "Missed Win", icon: "✗", color: "#dbac16" },
  forced: { label: "Forced", icon: "→", color: "#9ca3af" },
};
export const CATS = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "blunder", "missedwin", "forced"];
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const mvObj = (u) => (u.length === 5 ? { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] } : { from: u.slice(0, 2), to: u.slice(2, 4) });

/** before = analisis sebelum langkah (MultiPV≥2), after = analisis sesudah langkah. */
export function classify(fenBefore, uci, before, after, rules = DEFAULT_RULES) {
  const game = new Chess(fenBefore);
  const side = game.turn() === "w" ? 1 : -1, legalCount = game.moves().length;
  const bestCp = lineToCp(before.lines[0]) * side, afterCp = lineToCp(after.lines[0]) * side;
  const cpLoss = Math.max(0, bestCp - afterCp), wBefore = winPct(bestCp), wAfter = winPct(afterCp);
  const winLoss = Math.max(0, wBefore - wAfter), bestUci = before.best, isBest = uci === bestUci;
  const mk = (category, reason) => ({ category, cpLoss, winLoss, bestUci, reason });

  if (legalCount === 1) return mk("forced", "Satu-satunya langkah legal.");
  if (wBefore >= rules.missedWinBefore && wAfter < rules.missedWinAfter && !isBest)
    return mk("missedwin", `Posisi menang (${wBefore.toFixed(0)}%) turun menjadi ${wAfter.toFixed(0)}%.`);

  const mv = game.move(mvObj(uci));
  const sacValue = VAL[mv.piece] ?? 0;
  const attacked = typeof game.isAttacked === "function" ? game.isAttacked(mv.to, game.turn()) : false;
  const capturedVal = mv.captured ? VAL[mv.captured] : 0;
  const isSac = attacked && sacValue >= rules.brilliantMinSacValue && sacValue > capturedVal;
  if (isSac && winLoss <= rules.brilliantMaxLoss && wBefore < rules.brilliantNotWinningAbove && wAfter > rules.brilliantNotLostBelow)
    return mk("brilliant", `Mengorbankan ${mv.piece.toUpperCase()} namun evaluasi tetap terjaga (kehilangan ${winLoss.toFixed(1)}% win).`);

  if (isBest) {
    const second = before.lines[1];
    if (second) {
      const gap = winPct(bestCp) - winPct(lineToCp(second) * side);
      if (gap >= rules.greatGap) return mk("great", `Satu-satunya langkah kuat; alternatif terbaik berikutnya ${gap.toFixed(0)}% lebih buruk.`);
    }
    return mk("best", "Sama dengan langkah terbaik Stockfish.");
  }
  if (winLoss <= rules.excellentMax) return mk("excellent", `Hanya kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.goodMax) return mk("good", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.inaccuracyMax) return mk("inaccuracy", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.mistakeMax) return mk("mistake", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  return mk("blunder", `Kehilangan ${winLoss.toFixed(1)}% win (${(cpLoss / 100).toFixed(2)} pion).`);
}

export function replay(sans) {
  const g = new Chess(), fens = [g.fen()], ucis = [];
  for (const s of sans) { const m = g.move(s); ucis.push(m.from + m.to + (m.promotion || "")); fens.push(g.fen()); }
  return { fens, ucis };
}

/** Analisis seluruh game: tiap posisi dianalisis sekali (MultiPV 2). */
export async function reviewGame(engine, sans, onProgress, depth = 10, isCancelled) {
  const { fens, ucis } = replay(sans), A = [];
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled && isCancelled()) return null;
    A.push(await engine.analyzeFen(fens[i], depth, 2));
    onProgress && onProgress(i + 1, fens.length);
  }
  const book = (detectOpening(sans) || { plies: 0 }).plies;
  const counts = { w: {}, b: {} }, accSum = { w: 0, b: 0 }, cpSum = { w: 0, b: 0 }, n = { w: 0, b: 0 }, classes = [];
  for (let i = 0; i < ucis.length; i++) {
    const side = i % 2 === 0 ? "w" : "b", c = classify(fens[i], ucis[i], A[i], A[i + 1]);
    const category = i < book ? "book" : c.category;
    let bestSan = "";
    if (A[i].best && A[i].best !== "(none)") { try { bestSan = new Chess(fens[i]).move(mvObj(A[i].best)).san; } catch {} }
    classes.push({ category, cpLoss: Math.round(c.cpLoss), winLoss: Math.round(c.winLoss * 10) / 10, bestUci: c.bestUci, bestSan, reason: i < book ? "Langkah teori pembukaan." : c.reason });
    counts[side][category] = (counts[side][category] || 0) + 1;
    accSum[side] += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * c.winLoss) - 3.1669));
    cpSum[side] += Math.min(1000, c.cpLoss); n[side]++;
  }
  const avg = (a, k) => (k ? Math.round((a / k) * 10) / 10 : 0);
  return {
    depth, classes, counts,
    evals: A.map((a) => Math.max(-10000, Math.min(10000, Math.round(lineToCp(a.lines[0]))))),
    acc: { w: avg(accSum.w, n.w), b: avg(accSum.b, n.b) },
    acpl: { w: Math.round(avg(cpSum.w, n.w)), b: Math.round(avg(cpSum.b, n.b)) },
  };
}
