export const config = { runtime: "nodejs" };

const LIPSYNC_ALLOWED_VOICES = {
  tranquil_tulin: {
    voice_id: process.env.HEYGEN_VOICE_ID,
    voice_name: "Tranquil Tülin",
  },
  iker: {
    voice_id: "117821d0abb146e89cc2a2e99f65d807",
    voice_name: "Iker",
  },
  deep_dieter: {
    voice_id: "118949676b0a46629d1ad52981c3ef84",
    voice_name: "Deep Dieter",
  },
  william: {
    voice_id: "13be37a20b2448b7ad9db1a8669e5569",
    voice_name: "William Prescott",
  },
  menon: {
    voice_id: "145980ae9ed74dd880175c44cc08615a",
    voice_name: "Menon",
  },
  knox: {
    voice_id: "158b76b48ed048d381951887e771e412",
    voice_name: "Knox",
  },
  aaron: {
    voice_id: "184c9014f94142ae949363089aaf53dd",
    voice_name: "Aaron",
  },
  lily: {
    voice_id: "14979664b31246cbb735cc86d17b7907",
    voice_name: "Lily",
  },
  april: {
    voice_id: "1508afc3681349ad842f2e7194b7eb22",
    voice_name: "April",
  },
  tiffany: {
    voice_id: "1519fd8fe5d440a2b58770a6762511de",
    voice_name: "Tiffany",
  },
  brianna: {
    voice_id: "154e13cce06c4452ba3b9865dcdf1434",
    voice_name: "Brianna",
  },
  evelyn: {
    voice_id: "15c34793e92442388fc489bbcd58992b",
    voice_name: "Evelyn Harper",
  },
  laurel: {
    voice_id: "162b75e583c465cb9ed047a538d8f6b",
    voice_name: "Laurel",
  },
  seena: {
    voice_id: "166aa8d7acd1495a83d34024ccb1505",
    voice_name: "Seena Professional",
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

    const voiceKey = String(body.voice_key || body.voiceKey || "tranquil_tulin").trim();
    const pickedVoice = LIPSYNC_ALLOWED_VOICES[voiceKey] || LIPSYNC_ALLOWED_VOICES.tranquil_tulin;

    if (!pickedVoice?.voice_id) {
      return res.status(400).json({
        ok: false,
        error: "missing_voice_id",
      });
    }

    const text = String(body.text || "Merhaba, ben AIVO ses ön izlemesiyim.")
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

    return res.status(200).json({
      ok: true,
      provider: "heygen",
      voice_key: voiceKey,
      voice_name: pickedVoice.voice_name,
      voice_id: pickedVoice.voice_id,
      audio_url: audioUrl,
      payload: heygenData,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_voice_check_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
