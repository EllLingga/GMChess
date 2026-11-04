import { Chess } from "./chesslib.js";
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";
const g = (t) => GLYPH[t] + "\uFE0E";

export class Board {
  constructor(root, opts = {}) {
    this.root = root;
    this.orientation = opts.orientation || "white";
    this.interactive = !!opts.interactive;
    this.onMove = opts.onMove || (() => {});
    this.fen = new Chess().fen();
    this.last = null; this.sel = null; this.game = new Chess();
    root.classList.add("board-wrap");
    root.innerHTML = '<div class="board"></div><div class="promo hidden"></div>';
    this.el = root.querySelector(".board");
    this.promoEl = root.querySelector(".promo");
    this.el.addEventListener("pointerdown", (e) => this.down(e));
    this.render(false);
  }

  set(o) {
    let animate = false;
    if (o.orientation && o.orientation !== this.orientation) this.orientation = o.orientation;
    else if (o.fen !== undefined && o.fen !== this.fen && o.lastMove) animate = true;
    if (o.fen !== undefined) { this.fen = o.fen; this.sel = null; }
    if ("lastMove" in o) this.last = o.lastMove ? { from: o.lastMove.slice(0, 2), to: o.lastMove.slice(2, 4) } : null;
    if (o.interactive !== undefined) this.interactive = o.interactive;
    this.promoEl.classList.add("hidden");
    this.render(animate);
  }

  rects() {
    const r = {};
    this.el.querySelectorAll(".sq").forEach((s) => (r[s.dataset.sq] = s.getBoundingClientRect()));
    return r;
  }

  render(animate) {
    const old = animate && this.last ? this.rects() : null;
    this.game = new Chess(this.fen);
    const bd = this.game.board(), flip = this.orientation === "black";
    let checkSq = null;
    if (this.game.inCheck()) for (const row of bd) for (const p of row) if (p && p.type === "k" && p.color === this.game.turn()) checkSq = p.square;
    const legal = new Map();
    if (this.sel) for (const m of this.game.moves({ square: this.sel, verbose: true })) legal.set(m.to, m);
    this.el.classList.toggle("interactive", this.interactive);
    this.el.style.touchAction = this.interactive ? "none" : "";
    let html = "";
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const rr = flip ? 7 - r : r, ff = flip ? 7 - f : f, sq = FILES[ff] + (8 - rr), p = bd[rr][ff];
      let cls = "sq " + ((rr + ff) % 2 ? "d" : "l");
      if (this.last && (sq === this.last.from || sq === this.last.to)) cls += " last";
      if (sq === this.sel) cls += " sel";
      if (sq === checkSq) cls += " check";
      if (legal.has(sq)) cls += legal.get(sq).captured || legal.get(sq).flags.includes("e") ? " cap" : " mv";
      html += `<div class="${cls}" data-sq="${sq}">${f === 0 ? `<span class="co r">${8 - rr}</span>` : ""}${r === 7 ? `<span class="co f">${FILES[ff]}</span>` : ""}${p ? `<span class="pc ${p.color}">${g(p.type)}</span>` : ""}</div>`;
    }
    this.el.innerHTML = html;
    if (old) {
      const to = this.el.querySelector(`.sq[data-sq="${this.last.to}"] .pc`), o = old[this.last.from], n = this.el.querySelector(`.sq[data-sq="${this.last.to}"]`);
      if (to && o) {
        const nr = n.getBoundingClientRect(), dx = o.left - nr.left, dy = o.top - nr.top;
        if (dx || dy) {
          to.style.transition = "none"; to.style.transform = `translate(${dx}px,${dy}px)`; to.getBoundingClientRect();
          to.style.transition = "transform .18s ease-out"; to.style.transform = "";
        }
      }
    }
  }

  legalTo(from, to) { return this.game.moves({ square: from, verbose: true }).some((m) => m.to === to); }

  down(e) {
    if (!this.interactive || e.button > 0) return;
    const sqEl = e.target.closest(".sq"); if (!sqEl) return;
    const sq = sqEl.dataset.sq;
    if (this.sel && this.sel !== sq && this.legalTo(this.sel, sq)) { this.tryMove(this.sel, sq); return; }
    try { e.target.releasePointerCapture(e.pointerId); } catch {}
    const p = this.game.get(sq);
    if (p && p.color === this.game.turn()) {
      this.sel = sq; this.render(false); this.startDrag(e, sq);
    } else { this.sel = null; this.render(false); }
  }

  startDrag(e, sq) {
    const src = this.el.querySelector(`.sq[data-sq="${sq}"] .pc`); if (!src) return;
    const fs = getComputedStyle(src).fontSize, ghost = src.cloneNode(true);
    ghost.classList.add("ghost"); ghost.style.fontSize = fs; ghost.style.cursor = "grabbing";
    let moved = false; const sx = e.clientX, sy = e.clientY;
    const pos = (ev) => { ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; };
    const mv = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { moved = true; document.body.appendChild(ghost); src.classList.add("drag-src"); }
      if (moved) pos(ev);
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      ghost.remove(); src.classList.remove("drag-src");
      if (!moved) return;
      const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".sq");
      if (t && t.dataset.sq !== sq && this.legalTo(sq, t.dataset.sq)) this.tryMove(sq, t.dataset.sq);
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    pos(e);
  }

  tryMove(from, to) {
    const p = this.game.get(from);
    const promo = p && p.type === "p" && ((p.color === "w" && to[1] === "8") || (p.color === "b" && to[1] === "1"));
    if (promo) {
      const w = p.color === "w";
      this.promoEl.innerHTML = `<div class="box">${["q", "r", "b", "n"].map((t) => `<button data-p="${t}" style="color:${w ? "#fff" : "#222"}">${g(t)}</button>`).join("")}</div>`;
      this.promoEl.classList.remove("hidden");
      this.promoEl.onclick = (ev) => {
        const b = ev.target.closest("[data-p]"); if (!b) return;
        this.promoEl.classList.add("hidden"); this.fire(from, to, b.dataset.p);
      };
      return;
    }
    this.fire(from, to);
  }
  fire(from, to, promotion) {
    const before = this.fen; this.sel = null;
    this.onMove(from, to, promotion);
    if (this.fen === before) this.render(false);
  }
}

export class EvalBar {
  constructor(root) {
    this.root = root; root.classList.add("evalbar");
    root.innerHTML = '<div class="ev-fill"></div><span class="ev-lbl" style="top:4px"></span><span class="ev-lbl" style="bottom:4px"></span>';
    this.set(null, false);
  }
  /** cp dari sudut pandang putih; null = belum ada */
  set(cp, flipped, label) {
    const fill = this.root.querySelector(".ev-fill"), [top, bot] = this.root.querySelectorAll(".ev-lbl");
    const pct = cp == null ? 50 : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
    fill.style.height = pct + "%"; fill.style.top = flipped ? "0" : ""; fill.style.bottom = flipped ? "" : "0";
    const t = label ?? "…";
    const whiteAhead = pct >= 50;
    // label di sisi yang lebih besar bagian putih → bawah (normal), warna kontras
    const whiteSideBottom = !flipped;
    const showAtBottom = whiteAhead === whiteSideBottom;
    bot.textContent = showAtBottom ? t : ""; top.textContent = showAtBottom ? "" : t;
    const dark = whiteAhead ? "#111" : "#ddd"; bot.style.color = top.style.color = dark;
  }
}
