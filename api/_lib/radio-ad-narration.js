// Shared Eleven v3 / Gemini fallback contract for AIVO Radio Ad narration.
import crypto from "crypto";
import { putObject } from "./r2.js";

export const PRIMARY_MODEL = "fal-ai/elevenlabs/tts/eleven-v3";
export const FALLBACK_MODEL = "fal-ai/gemini-3.1-flash-tts";
export const GENERATION_TTL_MS = 15 * 60 * 1000;

export const LANGUAGES = new Map([
  ["tr", "Turkish (Turkey)"],
  ["en", "English (US)"],
  ["de", "German (Germany)"],
  ["fr", "French (France)"],
  ["es", "Spanish (Spain)"],
  ["it", "Italian (Italy)"],
  ["pt", "Portuguese (Brazil)"],
  ["ar", "Arabic (World)"],
  ["ru", "Russian (Russia)"],
  ["nl", "Dutch (Netherlands)"],
  ["pl", "Polish (Poland)"],
  ["uk", "Ukrainian (Ukraine)"],
  ["hi", "Hindi (India)"],
  ["id", "Indonesian (Indonesia)"],
  ["ms", "Malay (Malaysia)"],
  ["ja", "Japanese (Japan)"],
  ["ko", "Korean (South Korea)"],
  ["zh", "Chinese Mandarin (China)"],
  ["vi", "Vietnamese (Vietnam)"],
  ["th", "Thai (Thailand)"],
]);

export const VOICES = Object.freeze({
  warm_female: { primary: "Aria", fallback: "Aoede" },
  professional_male: { primary: "Roger", fallback: "Charon" },
  energetic_male: { primary: "Liam", fallback: "Puck" },
  clear_female: { primary: "Sarah", fallback: "Zephyr" },
});

const DURATIONS = new Set([10, 15, 20, 30, 45, 60]);
const STYLES = new Set(["warm", "energetic", "premium", "natural"]);
const SPEEDS = new Set(["slow", "balanced", "fast"]);
const FLOWS = new Set(["natural", "balanced", "emphatic"]);
const RATE = Object.freeze({
  slow: { target: 1.45, max: 1.62 },
  balanced: { target: 1.82, max: 2.02 },
  fast: { target: 2.18, max: 2.42 },
});

export function clean(value, max = 2400) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

export function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { raw: text || "" };
  }
}

function words(text) {
  try {
    return text.match(/[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu) || [];
  } catch (_) {
    return text.split(/\s+/).filter(Boolean);
  }
}

function stripUserAudioTags(value) {
  return clean(value, 2400)
    .replace(/\[[^\]\r\n]{1,80}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDirectionTag(style, flow) {
  if (style === "energetic") return "[excited]";
  if (style === "premium" || flow === "emphatic") return "[confident]";
  if (style === "warm") return "[softly]";
  return "";
}

export function normalizeNarrationInput(raw, project) {
  const source = raw && typeof raw === "object" ? raw : {};
  const current = project?.narration || {};
  const output = project?.output || {};
  const text = stripUserAudioTags(source.text ?? current.text);
  return {
    text,
    providerText: `${safeDirectionTag(
      clean(source.voiceStyle ?? current.voiceStyle, 30).toLowerCase(),
      clean(source.flow ?? current.flow, 20).toLowerCase()
    )} ${text}`.trim(),
    language: clean(source.language ?? current.language ?? "tr", 10).toLowerCase(),
    voice: clean(source.voice ?? current.voice ?? "warm_female", 40).toLowerCase(),
    voiceStyle: clean(source.voiceStyle ?? current.voiceStyle ?? "warm", 30).toLowerCase(),
    speed: clean(source.speed ?? current.speed ?? "fast", 20).toLowerCase(),
    flow: clean(source.flow ?? current.flow ?? "natural", 20).toLowerCase(),
    duration: Number.parseInt(source.duration ?? output.duration ?? 10, 10),
  };
}

export function narrationFingerprint(settings) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      text: settings.text,
      language: settings.language,
      voice: settings.voice,
      voiceStyle: settings.voiceStyle,
      speed: settings.speed,
      flow: settings.flow,
      duration: settings.duration,
    }))
    .digest("hex")
    .slice(0, 32);
}

export function timing(text, duration, speed) {
  const count = words(text).length;
  const rate = RATE[speed] || RATE.balanced;
  const commas = (text.match(/[,;:]/g) || []).length;
  const stops = (text.match(/[.!?…]/g) || []).length;
  const estimatedSeconds = count / rate.target + commas * 0.12 + stops * 0.28;
  const usableSeconds = Math.max(1, duration - 0.35);
  return {
    wordCount: count,
    maxWords: Math.max(5, Math.floor(usableSeconds * rate.max)),
    estimatedSeconds: Number(estimatedSeconds.toFixed(2)),
    usableSeconds: Number(usableSeconds.toFixed(2)),
  };
}

export function validateNarrationInput(settings) {
  if (settings.text.length < 3) return { error: "missing_narration_text" };
  if (!LANGUAGES.has(settings.language)) return { error: "unsupported_language" };
  if (!VOICES[settings.voice]) return { error: "unsupported_voice" };
  if (!STYLES.has(settings.voiceStyle)) return { error: "unsupported_voice_style" };
  if (!SPEEDS.has(settings.speed)) return { error: "unsupported_speed" };
  if (!FLOWS.has(settings.flow)) return { error: "unsupported_flow" };
  if (!DURATIONS.has(settings.duration)) return { error: "invalid_duration" };
  const measured = timing(settings.text, settings.duration, settings.speed);
  if (measured.wordCount > measured.maxWords || measured.estimatedSeconds > measured.usableSeconds) {
    return {
      error: "narration_too_long",
      word_count: measured.wordCount,
      max_words: measured.maxWords,
      estimated_seconds: measured.estimatedSeconds,
      usable_seconds: measured.usableSeconds,
    };
  }
  return { timing: measured };
}

function primarySettings(style, flow) {
  const base = {
    warm: { stability: 0.61, similarity_boost: 0.8, style: 0.28 },
    energetic: { stability: 0.36, similarity_boost: 0.76, style: 0.72 },
    premium: { stability: 0.74, similarity_boost: 0.84, style: 0.2 },
    natural: { stability: 0.52, similarity_boost: 0.77, style: 0.14 },
  }[style] || { stability: 0.52, similarity_boost: 0.77, style: 0.16 };

  let stability = base.stability;
  let styleAmount = base.style;
  if (flow === "natural") {
    stability += 0.04;
    styleAmount -= 0.03;
  } else if (flow === "emphatic") {
    stability -= 0.08;
    styleAmount += 0.13;
  }

  return {
    stability: Math.max(0.2, Math.min(0.86, Number(stability.toFixed(2)))),
    similarity_boost: base.similarity_boost,
    style: Math.max(0, Math.min(0.86, Number(styleAmount.toFixed(2)))),
  };
}

function speedValue(speed) {
  return speed === "slow" ? 0.88 : speed === "fast" ? 1.12 : 1;
}

function fallbackInstructions(settings) {
  const styleText = {
    warm: "Warm, reassuring and trustworthy professional radio-commercial delivery.",
    energetic: "Energetic, confident and lively professional radio-commercial delivery.",
    premium: "Premium, calm, polished and cinematic professional radio-commercial delivery.",
    natural: "Natural, conversational and human professional radio-commercial delivery.",
  }[settings.voiceStyle] || "Natural and polished professional radio-commercial delivery.";
  const speedText = settings.speed === "slow"
    ? "Use a measured pace."
    : settings.speed === "fast"
      ? "Use a brisk but clearly intelligible pace."
      : "Use a balanced pace.";
  const flowText = settings.flow === "emphatic"
    ? "Emphasize the key brand and benefit words without shouting."
    : settings.flow === "balanced"
      ? "Keep emphasis controlled and balanced."
      : "Use smooth phrasing and natural pauses.";
  return `${styleText} ${speedText} ${flowText} Speak only the supplied advertising text in ${LANGUAGES.get(settings.language)}. Do not add, remove, translate or repeat any words. Do not sing, laugh, cough or make non-verbal sounds.`;
}

export function providerInput(provider, settings) {
  const voice = VOICES[settings.voice] || VOICES.warm_female;
  if (provider === "primary") {
    return {
      text: settings.providerText || settings.text,
      voice: voice.primary,
      language_code: settings.language,
      speed: speedValue(settings.speed),
      ...primarySettings(settings.voiceStyle, settings.flow),
      apply_text_normalization: "auto",
      timestamps: true,
      output_format: "mp3_44100_192",
    };
  }
  return {
    prompt: settings.text,
    style_instructions: fallbackInstructions(settings),
    voice: voice.fallback,
    language_code: LANGUAGES.get(settings.language),
    output_format: "mp3",
  };
}

export async function submitNarration(provider, settings, key) {
  const model = provider === "primary" ? PRIMARY_MODEL : FALLBACK_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(providerInput(provider, settings)),
      signal: controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    return {
      ok: response.ok && !!requestId,
      status: response.status,
      data,
      model,
      requestId,
      statusUrl: clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1800),
      responseUrl: clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1800),
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === "AbortError" ? 504 : 502,
      data: { message: String(error?.message || error) },
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function pick(object, paths) {
  for (const path of paths) {
    let current = object;
    let valid = true;
    for (const key of path.split(".")) {
      if (!current || typeof current !== "object" || !(key in current)) {
        valid = false;
        break;
      }
      current = current[key];
    }
    if (valid && current != null) return current;
  }
  return null;
}

export function normalizeStatus(value, audioUrl) {
  if (audioUrl) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}

function inferredContentType(value) {
  const normalized = clean(value, 220).toLowerCase();
  if (/\.wav(?:$|\?)/.test(normalized) || normalized.includes("audio/wav")) return "audio/wav";
  if (/\.ogg(?:$|\?)/.test(normalized) || normalized.includes("audio/ogg")) return "audio/ogg";
  if (/\.opus(?:$|\?)/.test(normalized) || normalized.includes("audio/opus")) return "audio/opus";
  return "audio/mpeg";
}

export function audioFrom(payload) {
  const object = pick(payload, ["audio", "data.audio", "result.audio", "output.audio", "response.audio"]);
  if (object && typeof object === "object" && /^https:\/\//i.test(String(object.url || ""))) {
    const contentType = clean(object.content_type || object.contentType, 100);
    return {
      url: String(object.url),
      contentType: /^audio\//i.test(contentType)
        ? contentType.toLowerCase()
        : inferredContentType(`${object.file_name || ""} ${object.url || ""}`),
      fileName: clean(object.file_name || object.fileName, 180) || null,
      fileSize: Number(object.file_size || object.fileSize) || null,
      duration: Number(object.duration || object.duration_seconds) || null,
      timestamps: pick(payload, ["timestamps", "data.timestamps", "result.timestamps"]) || null,
    };
  }
  const url = pick(payload, ["audio_url", "data.audio_url", "result.audio_url", "output.audio_url", "response.audio_url"]);
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null;
  return {
    url,
    contentType: inferredContentType(url),
    fileName: null,
    fileSize: null,
    duration: null,
    timestamps: pick(payload, ["timestamps", "data.timestamps", "result.timestamps"]) || null,
  };
}

export async function falFetch(url, key) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Key ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    return { response, data: parseJson(await response.text().catch(() => "")) };
  } finally {
    clearTimeout(timeout);
  }
}

export function resultUrl(generation) {
  if (generation?.responseUrl) return clean(generation.responseUrl, 1800);
  return clean(generation?.statusUrl, 1800).replace(/\/status\/?(?:\?.*)?$/i, "");
}

export function audioExtension(contentType, fileName, url) {
  const source = `${contentType || ""} ${fileName || ""} ${url || ""}`.toLowerCase();
  if (source.includes("wav")) return "wav";
  if (source.includes("ogg")) return "ogg";
  if (source.includes("opus")) return "opus";
  return "mp3";
}

export async function copyRemoteAudioToR2({ url, key, contentType, maxBytes = 40 * 1024 * 1024 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`audio_download_failed:${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("audio_download_too_large");
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > maxBytes) throw new Error("invalid_audio_download_size");
    const finalContentType = /^audio\//i.test(contentType || "")
      ? contentType
      : inferredContentType(`${url} ${response.headers.get("content-type") || ""}`);
    return await putObject({
      key,
      body,
      contentType: finalContentType,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("audio_download_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
