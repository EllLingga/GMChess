// Tabel ECO ringkas (nama + urutan langkah SAN). Dipakai untuk deteksi pembukaan & Opening Explorer.
export const OPENINGS = [
  { eco: "B00", name: "King's Pawn Game", moves: "e4" },
  { eco: "C20", name: "King's Pawn Game", moves: "e4 e5" },
  { eco: "C40", name: "King's Knight Opening", moves: "e4 e5 Nf3" },
  { eco: "C44", name: "Scotch Game", moves: "e4 e5 Nf3 Nc6 d4" },
  { eco: "C45", name: "Scotch Game", moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4" },
  { eco: "C46", name: "Three Knights Game", moves: "e4 e5 Nf3 Nc6 Nc3" },
  { eco: "C50", name: "Italian Game", moves: "e4 e5 Nf3 Nc6 Bc4" },
  { eco: "C53", name: "Italian Game: Giuoco Piano", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5" },
  { eco: "C54", name: "Italian Game: Giuoco Piano, Main Line", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3" },
  { eco: "C55", name: "Italian Game: Two Knights Defense", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6" },
  { eco: "C57", name: "Italian Game: Two Knights, Knight Attack", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5" },
  { eco: "C60", name: "Ruy Lopez", moves: "e4 e5 Nf3 Nc6 Bb5" },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6" },
  { eco: "C68", name: "Ruy Lopez: Exchange Variation", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6" },
  { eco: "C77", name: "Ruy Lopez: Morphy Defense", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6" },
  { eco: "C41", name: "Philidor Defense", moves: "e4 e5 Nf3 d6" },
  { eco: "C42", name: "Petrov's Defense", moves: "e4 e5 Nf3 Nf6" },
  { eco: "C30", name: "King's Gambit", moves: "e4 e5 f4" },
  { eco: "C25", name: "Vienna Game", moves: "e4 e5 Nc3" },
  { eco: "C23", name: "Bishop's Opening", moves: "e4 e5 Bc4" },
  { eco: "C21", name: "Center Game", moves: "e4 e5 d4 exd4" },
  { eco: "B20", name: "Sicilian Defense", moves: "e4 c5" },
  { eco: "B21", name: "Sicilian Defense: Smith-Morra Gambit", moves: "e4 c5 d4 cxd4 c3" },
  { eco: "B23", name: "Sicilian Defense: Closed", moves: "e4 c5 Nc3" },
  { eco: "B27", name: "Sicilian Defense: Modern Variations", moves: "e4 c5 Nf3" },
  { eco: "B30", name: "Sicilian Defense: Old Sicilian", moves: "e4 c5 Nf3 Nc6" },
  { eco: "B33", name: "Sicilian Defense: Sveshnikov Variation", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5" },
  { eco: "B40", name: "Sicilian Defense: French Variation", moves: "e4 c5 Nf3 e6" },
  { eco: "B50", name: "Sicilian Defense: Modern Variations", moves: "e4 c5 Nf3 d6" },
  { eco: "B70", name: "Sicilian Defense: Dragon Variation", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6" },
  { eco: "B90", name: "Sicilian Defense: Najdorf Variation", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6" },
  { eco: "B10", name: "Caro-Kann Defense", moves: "e4 c6" },
  { eco: "B12", name: "Caro-Kann Defense: Advance Variation", moves: "e4 c6 d4 d5 e5" },
  { eco: "B13", name: "Caro-Kann Defense: Exchange Variation", moves: "e4 c6 d4 d5 exd5 cxd5" },
  { eco: "B15", name: "Caro-Kann Defense: Main Line", moves: "e4 c6 d4 d5 Nc3" },
  { eco: "C00", name: "French Defense", moves: "e4 e6" },
  { eco: "C01", name: "French Defense: Exchange Variation", moves: "e4 e6 d4 d5 exd5" },
  { eco: "C02", name: "French Defense: Advance Variation", moves: "e4 e6 d4 d5 e5" },
  { eco: "C03", name: "French Defense: Tarrasch Variation", moves: "e4 e6 d4 d5 Nd2" },
  { eco: "C11", name: "French Defense: Classical Variation", moves: "e4 e6 d4 d5 Nc3 Nf6" },
  { eco: "B01", name: "Scandinavian Defense", moves: "e4 d5" },
  { eco: "B02", name: "Alekhine's Defense", moves: "e4 Nf6" },
  { eco: "B06", name: "Modern Defense", moves: "e4 g6" },
  { eco: "B07", name: "Pirc Defense", moves: "e4 d6 d4 Nf6 Nc3" },
  { eco: "A40", name: "Queen's Pawn Game", moves: "d4" },
  { eco: "D00", name: "Queen's Pawn Game", moves: "d4 d5" },
  { eco: "D02", name: "London System", moves: "d4 d5 Nf3 Nf6 Bf4" },
  { eco: "D06", name: "Queen's Gambit", moves: "d4 d5 c4" },
  { eco: "D10", name: "Slav Defense", moves: "d4 d5 c4 c6" },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: "d4 d5 c4 dxc4" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: "d4 d5 c4 e6" },
  { eco: "D35", name: "Queen's Gambit Declined: Exchange Variation", moves: "d4 d5 c4 e6 Nc3 Nf6 cxd5" },
  { eco: "D43", name: "Semi-Slav Defense", moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6" },
  { eco: "A45", name: "Indian Defense", moves: "d4 Nf6" },
  { eco: "E00", name: "Catalan Opening", moves: "d4 Nf6 c4 e6 g3" },
  { eco: "E12", name: "Queen's Indian Defense", moves: "d4 Nf6 c4 e6 Nf3 b6" },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: "d4 Nf6 c4 e6 Nc3 Bb4" },
  { eco: "E60", name: "King's Indian Defense", moves: "d4 Nf6 c4 g6" },
  { eco: "E70", name: "King's Indian Defense: Normal Variation", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4" },
  { eco: "D70", name: "Grünfeld Defense", moves: "d4 Nf6 c4 g6 Nc3 d5" },
  { eco: "A57", name: "Benko Gambit", moves: "d4 Nf6 c4 c5 d5 b5" },
  { eco: "A60", name: "Benoni Defense", moves: "d4 Nf6 c4 c5 d5 e6" },
  { eco: "A80", name: "Dutch Defense", moves: "d4 f5" },
  { eco: "A10", name: "English Opening", moves: "c4" },
  { eco: "A20", name: "English Opening: Reversed Sicilian", moves: "c4 e5" },
  { eco: "A04", name: "Zukertort Opening", moves: "Nf3" },
  { eco: "A07", name: "King's Indian Attack", moves: "Nf3 d5 g3" },
  { eco: "A00", name: "Polish Opening", moves: "b4" },
  { eco: "A00", name: "Grob Opening", moves: "g4" },
  { eco: "A01", name: "Nimzo-Larsen Attack", moves: "b3" },
  { eco: "A02", name: "Bird Opening", moves: "f4" },
];

const tok = (s) => s.replace(/[+#!?]/g, "");
const PARSED = OPENINGS.map((o) => ({ ...o, list: o.moves.split(" ") }));

/** Pembukaan terpanjang yang cocok dengan awalan langkah. plies = jumlah langkah (ply) teori. */
export function detectOpening(sans) {
  const s = sans.map(tok);
  let best = null;
  for (const o of PARSED) {
    if (o.list.length > s.length) continue;
    if (o.list.every((m, i) => m === s[i]) && (!best || o.list.length > best.plies)) best = { eco: o.eco, name: o.name, plies: o.list.length };
  }
  return best;
}

export const POPULAR = ["B20", "C50", "C60", "D06", "C00", "E60", "B10", "D02", "A10", "B90"]
  .map((eco) => OPENINGS.find((o) => o.eco === eco))
  .filter(Boolean);
