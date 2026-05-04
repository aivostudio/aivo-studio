export const config = { runtime: "nodejs" };

import { putObject } from "../_lib/r2.js";

const LIPSYNC_ALLOWED_VOICES = {
  tranquil_tulin: {
    voice_id: process.env.HEYGEN_VOICE_ID,
    file_name: "tranquil-tulin.mp3",
  },
  iker: {
    voice_id: "117821d0abb146e89cc2a2e99f65d807",
    file_name: "iker.mp3",
  },
  deep_dieter: {
    voice_id: "118949676b0a46629d1ad52981c3ef84",
    file_name: "deep-dieter.mp3",
  },
  william: {
    voice_id: "13be37a20b2448b7ad9db1a8669e5569",
    file_name: "william.mp3",
  },
  menon: {
    voice_id: "145980ae9ed74dd880175c44cc08615a",
    file_name: "menon.mp3",
  },
  knox: {
    voice_id: "158b76b48ed048d381951887e771e412",
    file_name: "knox.mp3",
  },
  aaron: {
    voice_id: "184c9014f94142ae949363089aaf53dd",
    file_name: "aaron.mp3",
  },
  lily: {
    voice_id: "14979664b31246cbb735cc86d17b7907",
    file_name: "lily.mp3",
  },
  april: {
    voice_id: "1508afc3681349ad842f2e7194b7eb22",
    file_name: "april.mp3",
  },
  tiffany: {
    voice_id: "1519fd8fe5d440a2b58770a6762511de",
    file_name: "tiffany.mp3",
  },
  brianna: {
    voice_id: "154e13cce06c4452ba3b9865dcdf1434",
    file_name: "brianna.mp3",
  },
  evelyn: {
    voice_id: "15c34793e92442388fc489bbcd58992b",
    file_name: "evelyn.mp3",
  },
  laurel: {
    voice_id: "162b75e583c465cb9ed047a538d8f6b",
    file_name: "laurel.mp3",
  },
  seena: {
    voice_id: "166aa8d7acd1495a83d34024ccb1505",
    file_name: "seena.mp3",
  },
};

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    const apiKey = String(process.env.HEYGEN_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_heygen_api_key",
      });
    }

    const body = req.body || {};
    const voiceKey = String(body.voice_key || body.voiceKey || "").trim();

    if (!voiceKey) {
      return res.status(400).json({
        ok: false,
        error: "voice_key_required",
      });
    }

    const pickedVoice = LIPSYNC_ALLOWED_VOICES[voiceKey];

    if (!pickedVoice || !pickedVoice.voice_id) {
      return res.status(400).json({
        ok: false,
        error: "unknown_voice_key",
        voice_key: voiceKey,
      });
    }

    const text = String(
      body.text || "Merhaba, ben AIVO ses ön izlemesiyim."
    )
      .trim()
      .slice(0, 500);

    const speed = Math.max(0.5, Math.min(2, Number(body.voiceSpeed || body.voice_speed || 1)));

    const heygenRes = await fetch("https://api.heygen.com/v3/voices/speech", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: pickedVoice.voice_id,
        input_type: "text",
        speed,
        language: "tr",
      }),
    });

    const rawText = await heygenRes.text().catch(() => "");
    let heygenData = null;

    try {
      heygenData = rawText ? JSON.parse(rawText) : null;
    } catch {
      heygenData = { raw: rawText };
    }

    const audioUrl = String(
      heygenData?.data?.audio_url ||
      heygenData?.audio_url ||
      heygenData?.data?.url ||
      heygenData?.url ||
      ""
    ).trim();

    if (!heygenRes.ok || !audioUrl) {
      return res.status(heygenRes.status || 500).json({
        ok: false,
        error: "heygen_voice_preview_failed",
        provider_status: heygenRes.status,
        detail: heygenData,
      });
    }

    const audioRes = await fetch(audioUrl);

    if (!audioRes.ok) {
      return res.status(502).json({
        ok: false,
        error: "audio_download_failed",
        provider_status: audioRes.status,
        audio_url: audioUrl,
      });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const key = `lipsync/voice-previews/${pickedVoice.file_name}`;

    const publicUrl = await putObject({
      key,
      body: audioBuffer,
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline",
    });

    return res.status(200).json({
      ok: true,
      voice_key: voiceKey,
      key,
      url: publicUrl,
      audio_url: publicUrl,
      source_audio_url: audioUrl,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "upload_voice_preview_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
