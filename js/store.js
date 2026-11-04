// Semua data disimpan di localStorage browser (tanpa server / database).
const K = { profiles: "gm_profiles", games: "gm_games", prefs: "gm_prefs" };

function read(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const profiles = {
  list: () => read(K.profiles, []),
  get: (id) => read(K.profiles, []).find((p) => p.id === id),
  save(p) {
    const all = read(K.profiles, []);
    if (all.some((x) => x.id !== p.id && x.name.toLowerCase() === p.name.toLowerCase())) throw new Error("Nama sudah dipakai, pilih nama lain");
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = p; else all.push(p);
    if (!write(K.profiles, all)) throw new Error("Penyimpanan browser penuh / diblokir");
    return p;
  },
  remove(id) { write(K.profiles, read(K.profiles, []).filter((p) => p.id !== id)); },
};

export const games = {
  list: () => read(K.games, []).sort((a, b) => b.createdAt - a.createdAt),
  get: (id) => read(K.games, []).find((g) => g.id === id),
  add(g) {
    const all = read(K.games, []);
    g.id = uid(); g.createdAt = Date.now();
    all.push(g);
    if (!write(K.games, all)) throw new Error("Penyimpanan browser penuh. Hapus game lama atau export backup.");
    return g;
  },
  update(id, patch) {
    const all = read(K.games, []); const i = all.findIndex((g) => g.id === id);
    if (i < 0) return false;
    all[i] = { ...all[i], ...patch };
    return write(K.games, all);
  },
  remove(id) { write(K.games, read(K.games, []).filter((g) => g.id !== id)); },
};

export const prefs = {
  get: (k, d) => read(K.prefs, {})[k] ?? d,
  set(k, v) { const p = read(K.prefs, {}); p[k] = v; write(K.prefs, p); },
};

export function exportAll(includeKeys) {
  const p = profiles.list().map((x) => (includeKeys ? x : { ...x, apiKey: "" }));
  return JSON.stringify({ app: "grandmaster", version: 1, profiles: p, games: read(K.games, []) });
}
export function importAll(text) {
  const d = JSON.parse(text);
  if (d.app !== "grandmaster") throw new Error("Bukan file backup GRANDMASTER");
  const cur = read(K.profiles, []);
  for (const p of d.profiles || []) if (!cur.some((c) => c.id === p.id)) cur.push(p);
  const g = read(K.games, []);
  for (const x of d.games || []) if (!g.some((c) => c.id === x.id)) g.push(x);
  if (!write(K.profiles, cur) || !write(K.games, g)) throw new Error("Penyimpanan penuh");
  return { profiles: (d.profiles || []).length, games: (d.games || []).length };
}
export function wipeAll() { Object.values(K).forEach((k) => localStorage.removeItem(k)); }
