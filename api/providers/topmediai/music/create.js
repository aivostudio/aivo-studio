// api/providers/topmediai/music/create.js
// TopMediai v3 generate
// - title/lyrics icin action="custom"
// - referans ses provider'a gonderilmez
// - TopMediai'nin bilinen yanlis pozitif "agir" eslesmesi
//   provider'a gitmeden dar kapsamda yumusatilir

function normalizeSpaces(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceStandaloneTurkishWord(
  source,
  word,
  replacement
) {
  const letters =
    "A-Za-zÇĞİÖŞÜçğıöşü";

  const rx = new RegExp(
    `(^|[^${letters}])${word}(?=$|[^${letters}])`,
    "giu"
  );

  return String(source || "").replace(
    rx,
    (match, lead) =>
      `${lead}${replacement}`
  );
}

function sanitizeTopMediaiStyleText(value) {
  let output = String(value || "");

  /*
   * TopMediai "ağır/agir" kelimesini bazen
   * "Agir" adlı sanatçı gibi algılıyor.
   *
   * Yalnızca provider'a gönderilen style
   * metninde anlamı koruyan genel bir
   * kelimeye çeviriyoruz.
   */
  output = replaceStandaloneTurkishWord(
    output,
    "ağır",
    "yoğun"
  );

  output = replaceStandaloneTurkishWord(
    output,
    "agir",
    "yoğun"
  );

  return normalizeSpaces(output);
}

function normalizeMood(value) {
  const clean =
    normalizeSpaces(value);

  if (!clean) {
    return "";
  }

  const normalized =
    clean.toLocaleLowerCase("tr-TR");

  const placeholders = new Set([
    "mood / tür seç",
    "mood / tur sec",
    "ruh halini seç",
    "ruh halini sec",
    "mood seç",
    "mood sec",
  ]);

  return placeholders.has(normalized)
    ? ""
    : clean;
}

function readProviderError(data) {
  const status =
    Number(data?.status);

  const message =
    String(
      data?.message ||
      data?.error ||
      ""
    ).trim();

  if (
    status === 400015 ||
    /insufficient account balance/i.test(
      message
    )
  ) {
    return {
      error:
        "topmediai_insufficient_balance",
      message:
        message ||
        "Insufficient account balance",
    };
  }

  if (
    (
      Number.isFinite(status) &&
      status !== 0
    ) ||
    message
  ) {
    return {
      error:
        "topmediai_request_rejected",
      message:
        message ||
        `TopMediai status ${status}`,
    };
  }

  return null;
}

export default async function handler(
  req,
  res
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error:
          "method_not_allowed",
      });
    }

    const KEY =
      process.env.TOPMEDIAI_API_KEY;

    if (!KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "missing_topmediai_api_key",
      });
    }

    const body =
      req.body || {};

    const originalPrompt = String(
      body.prompt ||
      body?.input?.prompt ||
      body?.text ||
      ""
    ).trim();

    const providerPrompt =
      sanitizeTopMediaiStyleText(
        originalPrompt
      );

    const lyrics = String(
      body.lyrics ||
      body?.input?.lyrics ||
      ""
    ).trim();

    const title = String(
      body.title ||
      ""
    ).trim();

    /*
     * UI referans ses gönderebilir.
     * Bu entegrasyonda provider'a
     * gönderilmiyor.
     */
    const reference_audio_url = String(
      body.reference_audio_url ||
      body.referenceAudioUrl ||
      ""
    ).trim();

    if (!originalPrompt) {
      return res.status(400).json({
        ok: false,
        error:
          "missing_prompt",
      });
    }

    const vocalLabel = String(
      body.vocal ||
      ""
    ).trim();

    const mood =
      normalizeMood(body.mood);

    const genderMap = {
      "Erkek Vokal (AI)":
        "male",
      "Kadın Vokal (AI)":
        "female",
      "Soft / Çocuk Vokal (AI)":
        "child",
    };

    const isInstrumental =
      vocalLabel ===
      "Enstrümantal (Vokalsiz)";

    const gender =
      genderMap[vocalLabel] ||
      undefined;

    /*
     * TopMediai style alanına yalnızca
     * temizlenmiş prompt ve gerçek bir
     * mood seçilmişse mood eklenir.
     */
    const style = mood
      ? `${providerPrompt}, mood: ${mood}`
      : providerPrompt;

    const hasLyricsOrTitle =
      Boolean(lyrics) ||
      Boolean(title);

    const action =
      hasLyricsOrTitle
        ? "custom"
        : "auto";

    /*
     * audio_url ve upload yok.
     * Referans ses klonlama modu
     * tetiklenmez.
     */
    const payload = {
      action,
      style,
      mv: "v5.0",
      instrumental:
        isInstrumental ? 1 : 0,

      ...(gender
        ? { gender }
        : {}),

      ...(
        action === "custom" &&
        title
          ? { title }
          : {}
      ),

      ...(
        action === "custom" &&
        lyrics
          ? { lyrics }
          : {}
      ),
    };

    const topmediaiUrl =
      "https://api.topmediai.com/v3/music/generate";

    const controller =
      new AbortController();

    const HARD_TIMEOUT_MS =
      Number(
        process.env
          .TOPMEDIAI_SUBMIT_TIMEOUT_MS ||
        25000
      );

    const timeout = setTimeout(
      () => {
        try {
          controller.abort(
            "topmediai_submit_timeout"
          );
        } catch {}
      },
      HARD_TIMEOUT_MS
    );

    let r;

    try {
      r = await fetch(
        topmediaiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
            "x-api-key":
              KEY,
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal,
        }
      );
    } catch (err) {
      const msg =
        String(
          err?.message ||
          err ||
          ""
        );

      const lower =
        msg.toLowerCase();

      const isAbort =
        err?.name ===
          "AbortError" ||
        lower.includes(
          "abort"
        ) ||
        lower.includes(
          "timeout"
        );

      if (isAbort) {
        return res
          .status(504)
          .json({
            ok: false,

            error:
              "topmediai_submit_timeout",

            provider:
              "topmediai",

            message:
              "TopMediai üretim isteği zaman aşımına uğradı. Lütfen tekrar deneyin.",

            topmediai_url:
              topmediaiUrl,

            sent_payload:
              payload,

            provider_prompt_sanitized:
              providerPrompt !==
              originalPrompt,

            reference_audio_ignored:
              Boolean(
                reference_audio_url
              ),
          });
      }

      return res
        .status(500)
        .json({
          ok: false,

          error:
            "topmediai_submit_fetch_failed",

          detail:
            msg,

          topmediai_url:
            topmediaiUrl,

          sent_payload:
            payload,

          provider_prompt_sanitized:
            providerPrompt !==
            originalPrompt,

          reference_audio_ignored:
            Boolean(
              reference_audio_url
            ),
        });
    } finally {
      clearTimeout(timeout);
    }

    const rawText =
      await r.text();

    let data = null;

    try {
      data =
        JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!r.ok || !data) {
      return res
        .status(500)
        .json({
          ok: false,

          error:
            "topmediai_create_failed",

          topmediai_status:
            r.status,

          topmediai_url:
            topmediaiUrl,

          topmediai_preview:
            String(
              rawText ||
              ""
            ).slice(
              0,
              1000
            ),

          topmediai_response:
            data,

          sent_payload:
            payload,

          provider_prompt_sanitized:
            providerPrompt !==
            originalPrompt,

          reference_audio_ignored:
            Boolean(
              reference_audio_url
            ),
        });
    }

    /*
     * TopMediai'den gelebilecek
     * farklı ID yapılarını normalize et.
     */
    const tracks =
      Array.isArray(
        data?.data?.tracks
      )
        ? data.data.tracks
        : [];

    const trackIds =
      tracks
        .map(
          (track) =>
            String(
              track?.id ||
              ""
            ).trim()
        )
        .filter(Boolean);

    const idsRaw =
      data?.data?.ids ||
      data?.data?.IDs ||
      data?.ids ||
      data?.IDs ||
      null;

    const idsList =
      Array.isArray(idsRaw)
        ? idsRaw
            .map(
              (value) =>
                String(
                  value ||
                  ""
                ).trim()
            )
            .filter(Boolean)
        : [];

    const songIdsRaw =
      data?.data?.song_ids ||
      data?.data?.songIds ||
      data?.song_ids ||
      data?.songIds ||
      null;

    const songIdsFallback =
      Array.isArray(
        songIdsRaw
      )
        ? songIdsRaw
            .map(
              (value) =>
                String(
                  value ||
                  ""
                ).trim()
            )
            .filter(Boolean)
        : [];

    const provider_song_ids =
      trackIds.length
        ? trackIds
        : idsList.length
        ? idsList
        : songIdsFallback;

    /*
     * HTTP 200 gelse bile provider hata
     * mesajı döndürmüş olabilir.
     */
    if (!provider_song_ids.length) {
      const providerError =
        readProviderError(data);

      return res
        .status(500)
        .json({
          ok: false,

          error:
            providerError?.error ||
            "topmediai_missing_ids",

          message:
            providerError?.message ||
            "TopMediai yanıtında şarkı kimliği bulunamadı.",

          note:
            "no_tracks_ids_or_ids_or_song_ids_in_response",

          topmediai_url:
            topmediaiUrl,

          topmediai_response:
            data,

          sent_payload:
            payload,

          provider_prompt_sanitized:
            providerPrompt !==
            originalPrompt,

          reference_audio_ignored:
            Boolean(
              reference_audio_url
            ),
        });
    }

    const provider_job_id =
      provider_song_ids[0];

    const taskId =
      data?.data?.taskId ||
      data?.data?.task_id ||
      data?.taskId ||
      data?.task_id ||
      null;

    return res
      .status(200)
      .json({
        ok: true,

        provider:
          "topmediai",

        provider_job_id,

        provider_song_ids,

        status:
          "processing",

        state:
          "PROCESSING",

        topmediai_task_id:
          taskId
            ? String(taskId)
            : null,

        topmediai:
          data,

        topmediai_url:
          topmediaiUrl,

        /*
         * Debug: provider'a gerçekten
         * ne gönderildiğini gösterir.
         */
        sent_payload:
          payload,

        provider_prompt_sanitized:
          providerPrompt !==
          originalPrompt,

        reference_audio_ignored:
          Boolean(
            reference_audio_url
          ),
      });
  } catch (err) {
    return res
      .status(500)
      .json({
        ok: false,

        error:
          "server_error",

        detail:
          err?.message
            ? String(
                err.message
              )
            : String(err),
      });
  }
}
