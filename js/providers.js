import { Chess } from "./chesslib.js";

export class ProviderError extends Error { constructor(m, s = 0) { super(m); this.status = s; } }
export class AiError extends Error {}

const scrub = (s, secret) => (secret ? String(s).split(secret).join("***") : String(s));
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal && signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); });
});

async function post(url, headers, body, timeoutMs, secret, ext) {
  const ac = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);
  const onAbort = () => ac.abort(); ext && ext.addEventListener("abort", onAbort);
  const t0 = performance.now();
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ac.signal });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    if (!r.ok) {
      const raw = (j && j.error && j.error.message) || (j && typeof j.error === "string" && j.error) || (j && j.message) || txt.slice(0, 300);
      throw new ProviderError(scrub(raw, secret), r.status);
    }
    if (!j) throw new ProviderError("Respons API bukan JSON", r.status);
    return { j, status: r.status, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e.name === "AbortError") { if (timedOut) throw new ProviderError(`Timeout setelah ${Math.round(timeoutMs / 1000)} detik`, 408); throw e; }
    throw new ProviderError("Gagal terhubung ke API. Penyebab umum: tidak ada internet, API key/Base URL salah, atau provider memblokir akses langsung dari browser (CORS).", 0);
  } finally { clearTimeout(timer); ext && ext.removeEventListener("abort", onAbort); }
}

/** p = profil AI (dengan apiKey). Mengembalikan { text, inTokens, outTokens, status, ms } */
export async function generate(p, { system, user, maxTokens, signal }) {
  const timeoutMs = (p.timeoutS || 60) * 1000, mt = maxTokens ?? p.maxTokens ?? 1024, key = p.apiKey;
  if (!key) throw new ProviderError("API key kosong", 401);

  if (p.provider === "anthropic") {
    const think = p.thinkingBudget && p.thinkingBudget >= 1024;
    const body = { model: p.model, max_tokens: think ? Math.max(mt, p.thinkingBudget + 1024) : mt, system, messages: [{ role: "user", content: user }] };
    if (think) body.thinking = { type: "enabled", budget_tokens: p.thinkingBudget };
    else if (p.temperature != null) body.temperature = Math.min(1, p.temperature);
    const { j, status, ms } = await post("https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body, timeoutMs, key, signal);
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");  // blok thinking diabaikan
    if (!text) throw new ProviderError(`Respons kosong (stop_reason: ${j.stop_reason || "?"}). Coba naikkan Max tokens.`, status);
    return { text, inTokens: j.usage?.input_tokens, outTokens: j.usage?.output_tokens, status, ms };
  }

  if (p.provider === "gemini") {
    const model = p.model.replace(/^models\//, "");
    const gc = { maxOutputTokens: mt, responseMimeType: "application/json" };
    if (p.temperature != null) gc.temperature = p.temperature;
    if (p.thinkingBudget != null) gc.thinkingConfig = { thinkingBudget: p.thinkingBudget };
    const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: gc };
    const { j, status, ms } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": key }, body, timeoutMs, key, signal);
    const cand = j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter((x) => !x.thought && x.text).map((x) => x.text).join("");
    if (!text) throw new ProviderError(`Respons kosong (${(cand && cand.finishReason) || (j.promptFeedback && j.promptFeedback.blockReason) || "?"}). Coba naikkan Max tokens.`, status);
    const u = j.usageMetadata || {};
    return { text, inTokens: u.promptTokenCount, outTokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), status, ms };
  }

  // OpenAI, DeepSeek, Custom (OpenAI-compatible)
  const base = p.provider === "openai" ? "https://api.openai.com/v1" : p.provider === "deepseek" ? "https://api.deepseek.com" : (p.baseUrl || "").replace(/\/+$/, "");
  if (!base) throw new ProviderError("Base URL belum diisi", 400);
  const reasoning = p.provider === "openai" && /^(o\d|gpt-5)/i.test(p.model);
  const dsReasoner = p.provider === "deepseek" && /reasoner|r1/i.test(p.model);
  const body = { model: p.model, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  if (p.provider === "openai") body.max_completion_tokens = mt; else body.max_tokens = mt;
  if (!reasoning && !dsReasoner && p.temperature != null) body.temperature = p.temperature;
  if (reasoning && p.thinkingBudget) body.reasoning_effort = p.thinkingBudget <= 2000 ? "low" : p.thinkingBudget <= 8000 ? "medium" : "high";
  if ((p.provider === "openai" || p.provider === "deepseek") && !dsReasoner) body.response_format = { type: "json_object" };
  const { j, status, ms } = await post(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, body, timeoutMs, key, signal);
  const ch = j.choices && j.choices[0];
  const text = ch && ch.message && ch.message.content;
  if (!text) throw new ProviderError(`Respons kosong (finish_reason: ${(ch && ch.finish_reason) || "?"}). Coba naikkan Max tokens.`, status);
  return { text, inTokens: j.usage?.prompt_tokens, outTokens: j.usage?.completion_tokens, status, ms };
}

export const DIFFICULTY = {
  beginner: "Play like a beginner of about 600 Elo: develop pieces naively, sometimes overlook tactics, and occasionally make natural but weak moves. Do NOT play perfectly.",
  intermediate: "Play like a club player of about 1200 Elo: sound basics, but miss deeper tactics sometimes. Do NOT play perfectly.",
  advanced: "Play like a strong amateur of about 1800 Elo: solid tactics and strategy, with occasional inaccuracies.",
  expert: "Play like an expert of about 2200 Elo: precise and tactically alert.",
  grandmaster: "Play the strongest move you can find, like a grandmaster.",
};

function buildPrompts(o) {
  let system = "You are a chess player in a live game. You receive the position as FEN, the PGN so far and the complete list of legal moves.\n" +
    "Choose exactly ONE move from the legal move list. Respond with ONLY a JSON object, no markdown fences, no extra text:\n" +
    '{"move":"e2e4","comment":"one short sentence explaining the move","confidence":0.0}\n' +
    '"move" must be UCI (e.g. e2e4, g1f3, e7e8q for promotion) and must appear in the legal moves list. "confidence" is a number from 0 to 1. ' +
    'Keep "comment" to a brief public explanation; do not include your private reasoning.';
  if (o.difficulty && DIFFICULTY[o.difficulty]) system += "\n\nDifficulty: " + DIFFICULTY[o.difficulty];
  if (o.customSystem) system += "\n\n" + o.customSystem;
  const hist = o.history.length ? o.history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(" ") : "(game start)";
  let user = `You are playing ${o.side}. Side to move: ${o.side}.\nFEN: ${o.fen}\nPGN: ${o.pgn || "(none)"}\nMoves so far (SAN): ${hist}\n` +
    `Legal moves (UCI): ${o.legal.map((m) => m.uci).join(" ")}\nLegal moves (SAN): ${o.legal.map((m) => m.san).join(" ")}`;
  if (o.feedback) user += `\n\nIMPORTANT: ${o.feedback}`;
  return { system, user: user + "\n\nReply with the JSON object only." };
}

function parseJson(text) {
  const clean = text.replace(/```json|```/gi, "").trim();
  try { return JSON.parse(clean); } catch {}
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch {} }
  return null;
}

/**
 * Meminta langkah dari AI. Langkah SELALU divalidasi chess.js (bukan oleh AI).
 * Ilegal / JSON rusak → feedback + retry sampai maxRetries, lalu AiError.
 */
export async function getAiMove({ profile: p, game, difficulty, signal, onStatus }) {
  const t0 = performance.now(), total = Math.max(1, (p.maxRetries ?? 3) + 1);
  const legal = game.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion || ""), san: m.san }));
  const side = game.turn() === "w" ? "White" : "Black", history = game.history(), pgn = game.pgn();
  let feedback, inT = 0, outT = 0, lastErr = "", http = null;
  for (let a = 1; a <= total; a++) {
    onStatus && onStatus({ attempt: a, total, message: a === 1 ? "Thinking…" : `Retry ${a - 1}/${total - 1}: ${lastErr.slice(0, 50)}`, http });
    const { system, user } = buildPrompts({ fen: game.fen(), pgn, history, legal, side, feedback, difficulty, customSystem: p.systemPrompt });
    let out;
    try { out = await generate(p, { system, user, signal }); }
    catch (e) {
      if (e.name === "AbortError") throw e;
      if (!(e instanceof ProviderError)) throw e;
      lastErr = e.message; http = e.status || null;
      onStatus && onStatus({ attempt: a, total, message: "API error", http });
      if ([400, 401, 403, 404].includes(e.status)) throw new AiError(`API error ${e.status}: ${e.message}`);
      await sleep(1500 * a, signal); continue;
    }
    inT += out.inTokens || 0; outT += out.outTokens || 0; http = out.status;
    const parsed = parseJson(out.text);
    if (!parsed || typeof parsed.move !== "string") {
      lastErr = "invalid JSON"; feedback = 'Your reply was not valid JSON with a "move" field. Reply ONLY with {"move":"e2e4","comment":"...","confidence":0.9}.';
      onStatus && onStatus({ attempt: a, total, message: "Rejected: invalid JSON", http }); continue;
    }
    const raw = parsed.move.trim(); let found = /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(raw) ? legal.find((m) => m.uci === raw.toLowerCase()) : null;
    if (!found) { try { const m = new Chess(game.fen()).move(raw); found = legal.find((x) => x.san === m.san); } catch {} }
    if (!found) {
      lastErr = `illegal move "${raw.slice(0, 12)}"`;
      feedback = `The move "${raw.slice(0, 20)}" is ILLEGAL in this position. Choose one move from the legal moves list exactly as written.`;
      onStatus && onStatus({ attempt: a, total, message: "Rejected: illegal move", http }); continue;
    }
    const conf = Number(parsed.confidence);
    return {
      uci: found.uci, san: found.san, http, attempts: a, inTokens: inT, outTokens: outT, ms: Math.round(performance.now() - t0),
      comment: typeof parsed.comment === "string" ? parsed.comment.slice(0, 300) : "",
      confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : null,
    };
  }
  throw new AiError(`Gagal setelah ${total} percobaan. Terakhir: ${lastErr}`);
}
