import { prefs } from "./store.js";
let ctx = null;
export const soundEnabled = () => prefs.get("sound", true);
export const setSoundEnabled = (on) => prefs.set("sound", on);

function tone(f, dur, type = "sine", vol = 0.12, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
export function play(s) {
  if (!soundEnabled()) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    if (s === "move") tone(520, 0.07, "triangle", 0.15);
    else if (s === "capture") { tone(220, 0.1, "square", 0.1); tone(160, 0.12, "triangle", 0.15, 0.03); }
    else if (s === "check") { tone(880, 0.1, "square", 0.08); tone(660, 0.14, "square", 0.08, 0.09); }
    else if (s === "mate") [440, 330, 247, 165].forEach((f, i) => tone(f, 0.25, "sawtooth", 0.09, i * 0.14));
    else if (s === "start") [392, 523, 659].forEach((f, i) => tone(f, 0.14, "sine", 0.12, i * 0.09));
    else [523, 392, 330].forEach((f, i) => tone(f, 0.2, "sine", 0.12, i * 0.12));
  } catch {}
}
export function soundForMove(g, m) {
  if (g.isCheckmate()) return "mate";
  if (g.inCheck()) return "check";
  return m && m.captured ? "capture" : "move";
}
