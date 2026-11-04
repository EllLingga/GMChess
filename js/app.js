import { $, $$, esc } from "./ui.js";

const routes = {
  "": () => import("./pages/home.js"),
  play: () => import("./pages/play.js"),
  arena: () => import("./pages/arena.js"),
  analysis: () => import("./pages/analysis.js"),
  openings: () => import("./pages/openings.js"),
  history: () => import("./pages/history.js"),
  settings: () => import("./pages/settings.js"),
  review: () => import("./pages/review.js"),
};
let cleanup = null, token = 0;

async function route() {
  const t = ++token;
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
  const name = parts[0], params = parts.slice(1);
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  $$("#nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#/" + name));
  $("#nav").classList.remove("open");
  const root = $("#app");
  root.innerHTML = '<p class="mut center" style="padding:48px">Memuat…</p>';
  window.scrollTo(0, 0);
  try {
    const loader = routes[name] || routes[""];
    const mod = await loader();
    if (t !== token) return;
    root.innerHTML = "";
    cleanup = (await mod.mount(root, params)) || null;
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="alert bad">Gagal memuat halaman: ${esc(e.message)}<br><span class="sm">Pastikan koneksi internet aktif (library chess.js dimuat dari CDN).</span></div>`;
  }
}
$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
window.addEventListener("hashchange", route);
route();
