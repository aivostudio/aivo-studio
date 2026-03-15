export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/cartoon/create.js
import { neon } from "@neondatabase/serverless";
import authModule from "../../../_lib/auth.js";
const { requireAuth } = authModule;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function safeJson(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;

    for (const k of parts) {
      if (!cur || typeof cur !== "object" || !(k in cur)) {
        ok = false;
        break;
      }
      cur = cur[k];
    }

    if (ok && cur != null) return cur;
  }
  return null;
}

function extractFalStatusUrl(data) {
  const direct =
    pick(data, [
      "status_url",
      "statusUrl",
      "response_url",
      "responseUrl",
      "urls.status",
      "urls.response",
      "links.status",
      "links.response",
      "data.status_url",
      "data.response_url",
      "result.status_url",
      "result.response_url",
    ]) || null;

  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function mapScene(scene) {
  const map = {
    underwater: "underwater sea world",
    pond: "small cute pond",
    forest: "magical cartoon forest",
    farm: "sunny cartoon farm",
    sky: "bright dreamy sky world",
    beach: "happy cartoon beach",
  };
  return map[String(scene || "").trim()] || String(scene || "").trim() || "cartoon world";
}

function mapAction(action) {
  const map = {
    swimming: "swimming happily",
    jumping: "jumping joyfully",
    playing: "playing cheerfully",
    laughing: "laughing happily",
    dancing: "dancing cutely",
    waving: "waving to the audience",
    "moving-slowly": "moving slowly and softly",
    running: "running playfully",
  };
  return map[String(action || "").trim()] || String(action || "").trim() || "moving happily";
}

function mapCharacter(char) {
  const map = {
    "red-fish": "a cute red fish",
    chick: "a cute yellow chick",
    duck: "a cute little duck",
    "small-fish-school": "small colorful fish friends",
    frog: "a cute green frog",
    crab: "a small friendly crab",
  };
  return map[String(char || "").trim()] || String(char || "").trim();
}

function buildBasicPrompt(body) {
  const sceneText = mapScene(body.scene);
  const actionText = mapAction(body.action);
  const mainCharacter = mapCharacter(body.mainCharacter);

  const helpers = Array.isArray(body.helperCharacters)
    ? body.helperCharacters.map(mapCharacter).filter(Boolean)
    : [];

  const extraPrompt = String(body.extraPrompt || "").trim();
  const hasCustomCharacterImage = !!String(
    body.characterImageUrl ||
    body.character_image_url ||
    body.image_url ||
    body.start_image_url ||
    ""
  ).trim();

  const mainCharacterText = hasCustomCharacterImage
    ? "Use the uploaded custom character as the main subject."
    : `Main character: ${mainCharacter}.`;

  const helperCharactersText = hasCustomCharacterImage
    ? ""
    : (helpers.length ? `Helper characters: ${helpers.join(", ")}.` : "");

  const parts = [
    "Cute kids cartoon style.",
    "Bright colorful animated scene.",
    mainCharacterText,
    helperCharactersText,
    `Scene: ${sceneText}.`,
    `Action: ${actionText}.`,
    "Friendly, adorable, child-safe, expressive animation.",
    "Clean frame, no text, no subtitles, no watermark.",
    extraPrompt ? `Extra direction: ${extraPrompt}.` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e),
    });
  }

  const email = auth?.email ? String(auth.email) : null;
  if (!email) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "missing_email",
    });
  }

  const conn = pickConn();
  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }
  const sql = neon(conn);

  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  const body = safeJson(req);

  const mode = String(body.mode || "basic").toLowerCase();
  if (!["basic", "character"].includes(mode)) {
    return res.status(400).json({
      ok: false,
      error: "unsupported_mode",
      message: "this first version only supports basic mode and character mode",
    });
  }

  const requestNonce =
    mode === "basic"
      ? `shot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : "";

  const userRow = await sql`
    select id
    from users
    where email = ${email}
    limit 1
  `;

  if (!userRow.length) {
    return res.status(401).json({ ok: false, error: "user_not_found", email });
  }

  const user_uuid = String(userRow[0].id);

  const app = "cartoon";

  const characterType = String(body.type || "").trim();
  const characterName = String(body.name || "").trim();
  const characterStyle = String(body.style || "").trim();
  const characterPromptRaw = String(body.prompt || "").trim();

  const characterHairType = String(body.hairType || "").trim();
  const characterHairColor = String(body.hairColor || "").trim();
  const characterOutfit = String(body.outfit || "").trim();
  const characterGlasses = String(body.glasses || "").trim();
  const characterAccessory = String(body.accessory || "").trim();
  const characterExpression = String(body.expression || "").trim();

  const prompt =
    mode === "character"
      ? [
          "Cute kids cartoon character design.",
          characterType ? `Character type: ${characterType}.` : "",
          characterName ? `Character name: ${characterName}.` : "",
          characterStyle ? `Visual style: ${characterStyle}.` : "",
          characterPromptRaw ? `Description: ${characterPromptRaw}.` : "",

          characterHairType ? `Hair type: ${characterHairType}.` : "",
          characterHairColor ? `Hair color: ${characterHairColor}.` : "",
          characterOutfit ? `Outfit: ${characterOutfit}.` : "",
          characterGlasses ? `Glasses: ${characterGlasses}.` : "",
          characterAccessory ? `Accessory: ${characterAccessory}.` : "",
          characterExpression ? `Facial expression: ${characterExpression}.` : "",

          "Single character only.",
          "Full body character.",
          "Centered composition.",
          "Clean simple background.",
          "Child-friendly, adorable, expressive design.",
          "No text, no watermark."
        ].filter(Boolean).join(" ")
      : `${buildBasicPrompt(body)} Unique shot token: ${requestNonce}.`;

  const duration = String(body.duration || "5");
  const aspect_ratio = String(body.aspectRatio || body.aspect_ratio || "16:9");
  const generate_audio = !!body.audioEnabled;

  const characterImageUrl =
    pick(body, [
      "characterImageUrl",
      "character_image_url",
      "image_url",
      "start_image_url",
    ]) || null;

  const referenceImageUrl =
    pick(body, [
      "referenceImageUrl",
      "reference_image_url",
      "referenceImage.image_url",
      "reference.image_url",
      "image_urls.0",
      "imageUrls.0",
    ]) || null;

  const falModel =
    mode === "character"
      ? "fal-ai/nano-banana-pro"
      : "fal-ai/kling-video/o3/standard/reference-to-video";

  const falUrl = `https://queue.fal.run/${falModel}`;

  const falInput =
    mode === "character"
      ? {
          prompt,
          num_images: 1,
          aspect_ratio:
            aspect_ratio === "16:9" || aspect_ratio === "9:16" || aspect_ratio === "1:1"
              ? aspect_ratio
              : "4:5",
          output_format: "png",
          safety_tolerance: "4",
          resolution: "1K",
          ...(referenceImageUrl ? { image_urls: [String(referenceImageUrl)] } : {})
        }
      : {
          prompt,
          duration,
          aspect_ratio,
          generate_audio,
          shot_type: "customize",
          ...(characterImageUrl ? { start_image_url: String(characterImageUrl) } : {}),
        };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);

  let r;
  try {
    r = await fetch(falUrl, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(falInput),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    return res.status(504).json({
      ok: false,
      provider: "fal",
      error: "fal_timeout_or_network_error",
      message: e?.message || "unknown_fetch_error",
    });
  } finally {
    clearTimeout(t);
  }

  const text = await r.text().catch(() => "");
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _non_json: text };
  }

  if (!r.ok) {
    return res.status(r.status).json({
      ok: false,
      provider: "fal",
      error: "fal_error",
      fal_status: r.status,
      fal_response: data,
    });
  }

  const request_id =
    data?.request_id || data?.requestId || data?.id || data?._id || null;

  const status_url = extractFalStatusUrl(data);

  const metaObj = {
    app,
    mode,
    kind: "cartoon_video",
    provider: "fal",
    model: falModel,
    request_id,
    ui_state: {
      name: characterName || null,
      type: characterType || null,
      style: characterStyle || null,
      prompt: characterPromptRaw || "",

      hairType: characterHairType || "",
      hairColor: characterHairColor || "",
      outfit: characterOutfit || "",
      glasses: characterGlasses || "",
      accessory: characterAccessory || "",
      expression: characterExpression || "",

      mainCharacter: body.mainCharacter || null,
      helperCharacters: Array.isArray(body.helperCharacters) ? body.helperCharacters : [],
      scene: body.scene || null,
      action: body.action || null,
      extraPrompt: body.extraPrompt || "",
      duration,
      aspect_ratio,
      generate_audio,
      characterImageUrl: characterImageUrl || null,
      referenceImageUrl: referenceImageUrl || null,
      requestNonce: requestNonce || null,
    },
    fal_input: falInput,
    provider_response: {
      status_url: status_url || null,
      response_url: status_url || null,
      raw: data,
    },
  };

  const now = new Date().toISOString();

  const rows = await sql`
    insert into jobs (
      user_id,
      user_uuid,
      type,
      app,
      status,
      prompt,
      meta,
      outputs,
      created_at,
      updated_at
    )
    values (
      ${email},
      ${user_uuid}::uuid,
      ${app},
      ${app},
      ${"queued"},
      ${prompt},
      ${JSON.stringify(metaObj)}::jsonb,
      ${"[]"}::jsonb,
      ${now},
      ${now}
    )
    returning id
  `;

  return res.status(200).json({
    ok: true,
    provider: "fal",
    app,
    mode,
    model: falModel,
    request_id,
    status_url: status_url || null,
    job_id: rows?.[0]?.id || null,
    raw: data,
  });
}
