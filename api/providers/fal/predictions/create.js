import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { copyUrlToR2 } from "../../../_lib/copy-to-r2.js";

function extractUserId(req) {
  const cookie = req.headers.cookie || "";
  const match =
    cookie.match(/aivo_session=([^;]+)/) ||
    cookie.match(/aivo_sess=([^;]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { input } = req.body || {};
    const promptRaw = (input?.prompt || "").trim();

    if (!promptRaw) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
    function looksTurkish(text) {
      // Turkish-specific chars OR some common TR words (very light heuristic)
      if (/[çğıİöşüÇĞÖŞÜ]/.test(text)) return true;
      const t = ` ${text.toLowerCase()} `;
      const common = [
        " ve ",
        " bir ",
        " için ",
        " ile ",
        " gibi ",
        " ama ",
        " çünkü ",
        " olsun ",
        " olsun.",
        " olsun,",
        " lütfen ",
      ];
      return common.some((w) => t.includes(w));
    }

    async function translateWithOpenAI(trText) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;

      const model = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You translate Turkish to natural, detailed English prompts for image generation. Keep meaning, add no extra objects. Output ONLY the English translation.",
            },
            { role: "user", content: trText },
          ],
        }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return null;

      const out = (j.choices?.[0]?.message?.content || "").trim();
      return out || null;
    }

    async function translateWithGoogleGTX(trText) {
      // Unofficial fallback (no key). If blocked in your env, it will just fail gracefully.
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=" +
        encodeURIComponent(trText);

      const r = await fetch(url, { method: "GET" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return null;

      // format: [[[translated, original, ...], ...], ...]
      const translated = Array.isArray(j?.[0])
        ? j[0].map((row) => (Array.isArray(row) ? row[0] : "")).join("")
        : "";

      return (translated || "").trim() || null;
    }

    async function maybeTranslatePrompt(prompt) {
      const needsTranslate = looksTurkish(prompt);
      if (!needsTranslate) {
        return {
          prompt_original: prompt,
          prompt_sent: prompt,
          translated: false,
          translate_engine: null,
        };
      }

      // 1) OpenAI
      const viaOpenAI = await translateWithOpenAI(prompt);
      if (viaOpenAI) {
        return {
          prompt_original: prompt,
          prompt_sent: viaOpenAI,
          translated: true,
          translate_engine: "openai",
        };
      }

      // 2) Google GTX fallback
      const viaGTX = await translateWithGoogleGTX(prompt);
      if (viaGTX) {
        return {
          prompt_original: prompt,
          prompt_sent: viaGTX,
          translated: true,
          translate_engine: "google_gtx",
        };
      }

      // 3) give up: send original
      return {
        prompt_original: prompt,
        prompt_sent: prompt,
        translated: false,
        translate_engine: "failed",
      };
    }

    // ------------------------------------------------------------
    // Translate (if needed)
    // ------------------------------------------------------------
    const t = await maybeTranslatePrompt(promptRaw);

    // ------------------------------------------------------------
    // Model routing (NO arbitrary body.model)
    // ------------------------------------------------------------
    const qualityRaw = String(input?.quality || "artist").toLowerCase();
    const quality = qualityRaw === "ultra" ? "ultra" : "artist";

    const MODEL_MAP = {
      artist: "fal-ai/flux-2-pro",
      ultra: "fal-ai/flux-pro/v1.1-ultra",
    };

    const CREDIT_MAP = {
      artist: 6,
      ultra: 9,
    };

    const model = MODEL_MAP[quality];

    // ------------------------------------------------------------
    // Fal payload
    // ------------------------------------------------------------
    const image_size = (input?.image_size || "square_hd").trim();

    const falPayload = {
      prompt: t.prompt_sent,
      image_size,
    };

    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falPayload),
    });

    const data = await falRes.json().catch(() => ({}));

    if (!falRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        fal_status: falRes.status,
        fal_response: data,
        meta: {
          quality,
          model,
          credit_cost: CREDIT_MAP[quality],
          translated: t.translated,
          translate_engine: t.translate_engine,
          prompt_original: t.prompt_original,
          prompt_sent: t.prompt_sent,
        },
      });
    }

    // ------------------------------------------------------------
    // R2 COPY (CRITICAL)
    // Fal URL -> R2 URL
    // ------------------------------------------------------------
    const falUrl = data?.images?.[0]?.url || null;

    if (!falUrl) {
      return res.status(500).json({
        ok: false,
        error: "missing_fal_output_url",
        fal_response: data,
      });
    }

    let r2Url = null;

    try {
      const ext =
        (new URL(falUrl).pathname.split(".").pop() || "").toLowerCase() || "jpg";

      const key = `cover/${new Date().toISOString().slice(0, 10)}/${crypto
        .randomUUID()
        .replace(/-/g, "")}.${ext}`;

      r2Url = await copyUrlToR2({ url: falUrl, key });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "r2_copy_failed",
        detail: String(e?.message || e),
      });
    }

    // ------------------------------------------------------------
    // DB Persist (same pattern as video)
    // - Create a job row so /api/jobs/list?app=cover shows it in ALL browsers
    // ------------------------------------------------------------
    const job_id = crypto.randomUUID();
    let db_debug = { tried: false, hasConn: false, inserted: false, error: null };

    try {
      db_debug.tried = true;

      const conn =
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.DATABASE_URL_UNPOOLED;

      db_debug.hasConn = !!conn;

      if (conn) {
        const sql = neon(conn);
        const user_id = extractUserId(req) || "anonymous";

        const outputs = [
          {
            type: "image",
            url: r2Url,
            meta: {
              app: "cover",
              quality,
              model,
              credit_cost: CREDIT_MAP[quality],
            },
          },
        ];

        const meta = {
          quality,
          model,
          credit_cost: CREDIT_MAP[quality],
          translated: t.translated,
          translate_engine: t.translate_engine,
          prompt_original: t.prompt_original,
          prompt_sent: t.prompt_sent,
          fal_url: falUrl,
          r2_url: r2Url,
          image_size,
        };

        await sql`
          insert into jobs (
            id,
            user_id,
            app,
            provider,
            request_id,
            status,
            prompt,
            meta,
            outputs,
            error,
            created_at,
            updated_at
          )
          values (
            ${String(job_id)}::uuid,
            ${user_id},
            ${"cover"},
            ${"fal"},
            ${String(job_id)},
            ${"completed"},
            ${t.prompt_original},
            ${JSON.stringify(meta)},
            ${JSON.stringify(outputs)},
            ${null},
            now(),
            now()
          )
          on conflict (id) do nothing
        `;

        db_debug.inserted = true;
      }
    } catch (e) {
      db_debug.error = String(e?.message || e);
      console.error("DB insert failed:", e);
    }

    // ------------------------------------------------------------
    // Response (IMPORTANT: output artık R2 URL olacak)
    // ------------------------------------------------------------
    return res.status(200).json({
      ok: true,
      job_id,
      provider: "fal",
      status: "succeeded",
      output: r2Url,
      fal: data,
      meta: {
        quality,
        model,
        credit_cost: CREDIT_MAP[quality],
        translated: t.translated,
        translate_engine: t.translate_engine,
        prompt_original: t.prompt_original,
        prompt_sent: t.prompt_sent,
        fal_url: falUrl,
        r2_url: r2Url,
        image_size,
      },
      db_debug,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err),
    });
  }
}
