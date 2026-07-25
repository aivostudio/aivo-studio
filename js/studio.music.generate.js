/* ==========================================================
   AIVO Studio – Music Generate
   File: /js/studio.music.generate.js

   - Desktop TR / EN support
   - Music generation
   - Credit consumption and refund
   - Dynamic button translation
   - Music job dispatch
   - Status polling
   ========================================================== */

async function generateMusic(payload) {
  const response =
    await fetch(
      "/api/music/generate",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body:
          JSON.stringify(payload)
      }
    );

  const result =
    await response.json();

  if (!result.ok) {
    throw new Error(
      "generate_failed"
    );
  }

  return result.provider_job_id;
}

/* ========================================================= */

(function AIVO_STUDIO_MUSIC_GENERATE() {
  "use strict";

  if (
    window.__AIVO_STUDIO_MUSIC_GENERATE__
  ) {
    return;
  }

  window.__AIVO_STUDIO_MUSIC_GENERATE__ =
    true;

  const BTN_ID =
    "musicGenerateBtn";

  const PROMPT_SELECTOR =
    "#prompt";

  const CREDIT_COST =
    2;

  const CREDIT_REASON =
    "studio_music_generate";

  let boundButton = null;
  let isBusy = false;
  let moduleObserver = null;

  /* =========================================================
     MODULE DICTIONARY
     ========================================================= */

  const MUSIC_GENERATE_DICTIONARY = {
    tr: {
      "studio.music.generate.fixed":
        "🎵 Müzik Üret (2 Kredi)",

      "studio.music.generate.loading":
        "Üretiliyor...",

      "studio.music.generate.promptRequired":
        "Müzik üretmek için prompt yazmalısın.",

      "studio.music.generate.creditConsumeFailed":
        "Kredi düşülemedi. Lütfen bakiyeni kontrol et.",

      "studio.music.generate.creditConsumed":
        "2 kredi düşüldü.",

      "studio.music.generate.creditConnectionError":
        "Kredi düşümünde bağlantı hatası oluştu.",

      "studio.music.generate.refunded":
        "Müzik üretimi başarısız oldu. 2 kredi hesabına iade edildi.",

      "studio.music.generate.policyFailedRefunded":
        "Üretim başarısız oldu. Belirli sanatçı adı veya telifli şarkı sözü kullanmadığından emin ol. 2 kredi hesabına iade edildi.",

      "studio.music.generate.policyFailed":
        "Üretim başarısız oldu. Belirli sanatçı adı veya telifli şarkı sözü kullanmadığından emin ol.",

      "studio.music.generate.startFailed":
        "Müzik üretimi başlatılamadı. Promptu sadeleştirip tekrar deneyin.",

      "studio.music.generate.jobMissing":
        "Üretim oluşturuldu ancak gerekli iş numarası alınamadı.",

      "studio.music.generate.started":
        "Müzik üretimi başladı.",

      "studio.music.generate.ready":
        "Müzik hazır.",

      "studio.music.generate.genericError":
        "Müzik üretiminde bir hata oluştu.",

      "studio.music.generate.insufficientCredits":
        "Bu işlem için yeterli krediniz bulunmuyor.",

      "studio.music.generate.loginRequired":
        "Kredi işlemi için yeniden giriş yapmanız gerekiyor."
    },

    en: {
      "studio.music.generate.fixed":
        "🎵 Generate Music (2 Credits)",

      "studio.music.generate.loading":
        "Generating...",

      "studio.music.generate.promptRequired":
        "Enter a prompt before generating music.",

      "studio.music.generate.creditConsumeFailed":
        "Credits could not be deducted. Please check your balance.",

      "studio.music.generate.creditConsumed":
        "2 credits deducted.",

      "studio.music.generate.creditConnectionError":
        "A connection error occurred while deducting credits.",

      "studio.music.generate.refunded":
        "Music generation failed. 2 credits were refunded to your account.",

      "studio.music.generate.policyFailedRefunded":
        "Generation failed. Make sure your request does not include a specific artist name or copyrighted lyrics. 2 credits were refunded to your account.",

      "studio.music.generate.policyFailed":
        "Generation failed. Make sure your request does not include a specific artist name or copyrighted lyrics.",

      "studio.music.generate.startFailed":
        "Music generation could not be started. Simplify your prompt and try again.",

      "studio.music.generate.jobMissing":
        "The generation was created, but the required job ID was not returned.",

      "studio.music.generate.started":
        "Music generation started.",

      "studio.music.generate.ready":
        "Your music is ready.",

      "studio.music.generate.genericError":
        "An error occurred during music generation.",

      "studio.music.generate.insufficientCredits":
        "You do not have enough credits for this operation.",

      "studio.music.generate.loginRequired":
        "Please sign in again to complete the credit operation."
    }
  };

  /* =========================================================
     TRANSLATION HELPERS
     ========================================================= */

  function normalizeLanguage(value) {
    const language =
      String(value || "")
        .trim()
        .toLowerCase();

    return language.startsWith("en")
      ? "en"
      : "tr";
  }

  function currentLanguage() {
    return normalizeLanguage(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      "tr"
    );
  }

  function formatText(
    value,
    parameters
  ) {
    let output =
      String(
        value == null
          ? ""
          : value
      );

    if (
      !parameters ||
      typeof parameters !== "object"
    ) {
      return output;
    }

    Object.keys(parameters)
      .forEach(function (key) {
        output =
          output.replace(
            new RegExp(
              "\\{" + key + "\\}",
              "g"
            ),
            String(parameters[key])
          );
      });

    return output;
  }

  function registerDictionary() {
    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window
          .AIVO_STUDIO_I18N
          .registerPack ===
          "function"
      ) {
        window
          .AIVO_STUDIO_I18N
          .registerPack(
            MUSIC_GENERATE_DICTIONARY
          );

        return;
      }

      if (
        window.AIVO_I18N &&
        window.AIVO_I18N.tr &&
        window.AIVO_I18N.en
      ) {
        Object.assign(
          window.AIVO_I18N.tr,
          MUSIC_GENERATE_DICTIONARY.tr
        );

        Object.assign(
          window.AIVO_I18N.en,
          MUSIC_GENERATE_DICTIONARY.en
        );
      }
    } catch (error) {
      console.warn(
        "[music.generate] dictionary registration failed:",
        error
      );
    }
  }

  function musicText(
    key,
    parameters
  ) {
    const language =
      currentLanguage();

    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window
          .AIVO_STUDIO_I18N
          .t ===
          "function"
      ) {
        const translated =
          window
            .AIVO_STUDIO_I18N
            .t(
              key,
              "",
              parameters
            );

        if (
          translated &&
          translated !== key
        ) {
          return translated;
        }
      }
    } catch (_) {}

    try {
      if (
        typeof window.t ===
        "function"
      ) {
        const translated =
          window.t(
            key,
            parameters
          );

        if (
          translated &&
          translated !== key
        ) {
          return formatText(
            translated,
            parameters
          );
        }
      }
    } catch (_) {}

    const languagePack =
      MUSIC_GENERATE_DICTIONARY[
        language
      ] ||
      MUSIC_GENERATE_DICTIONARY.tr;

    const fallbackPack =
      MUSIC_GENERATE_DICTIONARY.tr;

    return formatText(
      languagePack[key] ||
      fallbackPack[key] ||
      key,
      parameters
    );
  }

  /* =========================================================
     GENERAL HELPERS
     ========================================================= */

  function query(
    selector,
    root
  ) {
    return (
      root || document
    ).querySelector(selector);
  }

  function sleep(milliseconds) {
    return new Promise(
      function (resolve) {
        setTimeout(
          resolve,
          milliseconds
        );
      }
    );
  }

  function showToast(
    type,
    message
  ) {
    try {
      if (
        window.toast &&
        typeof window.toast[type] ===
          "function"
      ) {
        return window.toast[type](
          message
        );
      }

      if (
        typeof window.toast ===
        "function"
      ) {
        return window.toast(
          message,
          type
        );
      }

      if (
        window.Toast &&
        typeof window.Toast.show ===
          "function"
      ) {
        return window.Toast.show(
          message,
          type
        );
      }
    } catch (error) {
      console.warn(
        "[music.generate] toast failed:",
        error
      );
    }

    if (type === "error") {
      console.warn(
        "[music.generate]",
        message
      );

      return;
    }

    console.log(
      "[music.generate]",
      message
    );
  }

  function toastError(message) {
    showToast(
      "error",
      message
    );
  }

  function toastSuccess(message) {
    showToast(
      "success",
      message
    );
  }

  function dispatchJob(job) {
    try {
      window.dispatchEvent(
        new CustomEvent(
          "aivo:job",
          {
            detail: job
          }
        )
      );
    } catch (error) {
      console.warn(
        "[music.generate] dispatch aivo:job failed:",
        error
      );
    }
  }

  function getPrompt() {
    const element =
      query(PROMPT_SELECTOR);

    return String(
      element &&
      element.value
        ? element.value
        : ""
    ).trim();
  }

  /* =========================================================
     BUTTON
     ========================================================= */

  function normalButtonText() {
    return musicText(
      "studio.music.generate.fixed"
    );
  }

  function loadingButtonText() {
    return musicText(
      "studio.music.generate.loading"
    );
  }

  function syncGenerateButton(
    button
  ) {
    const target =
      button ||
      document.getElementById(
        BTN_ID
      );

    if (!target) {
      return;
    }

    if (
      target.getAttribute(
        "aria-busy"
      ) === "true"
    ) {
      target.textContent =
        loadingButtonText();

      return;
    }

    target.textContent =
      normalButtonText();

    target.setAttribute(
      "data-credit-cost",
      String(CREDIT_COST)
    );
  }

  function setButtonBusy(
    button,
    busy
  ) {
    if (!button) {
      return;
    }

    button.disabled =
      Boolean(busy);

    button.classList.toggle(
      "is-loading",
      Boolean(busy)
    );

    if (busy) {
      button.setAttribute(
        "aria-busy",
        "true"
      );

      button.textContent =
        loadingButtonText();

      return;
    }

    button.removeAttribute(
      "aria-busy"
    );

    button.textContent =
      normalButtonText();
  }

  /* =========================================================
     CREDIT ERROR TRANSLATION
     ========================================================= */

  function creditErrorMessage(data) {
    const raw =
      String(
        data &&
        (
          data.error ||
          data.message
        )
          ? (
              data.error ||
              data.message
            )
          : ""
      )
        .trim()
        .toLowerCase();

    if (
      raw.includes(
        "insufficient"
      ) ||
      raw.includes(
        "not_enough"
      ) ||
      raw.includes(
        "yetersiz"
      ) ||
      raw.includes(
        "balance"
      ) ||
      raw.includes(
        "bakiye"
      )
    ) {
      return musicText(
        "studio.music.generate.insufficientCredits"
      );
    }

    if (
      raw.includes(
        "unauthorized"
      ) ||
      raw.includes(
        "login"
      ) ||
      raw.includes(
        "session"
      ) ||
      raw.includes(
        "auth"
      ) ||
      raw.includes(
        "oturum"
      )
    ) {
      return musicText(
        "studio.music.generate.loginRequired"
      );
    }

    return musicText(
      "studio.music.generate.creditConsumeFailed"
    );
  }

  /* =========================================================
     API
     ========================================================= */

  async function callGenerateAPI(
    prompt
  ) {
    const titleElement =
      document.querySelector(
        "#songName"
      );

    const lyricsElement =
      document.querySelector(
        "#lyrics"
      );

    const vocalElement =
      document.querySelector(
        "#vocalType"
      );

    const moodElement =
      document.querySelector(
        "#mood"
      );

    const title =
      titleElement
        ? titleElement.value.trim()
        : "";

    const lyrics =
      lyricsElement
        ? lyricsElement.value.trim()
        : "";

    /*
      Values are intentionally read from option.value.

      The visible option text can change according to the
      selected language, while the values sent to the API
      remain stable.
    */

    const vocalText =
      vocalElement
        ? String(
            vocalElement.value ||
            ""
          ).trim()
        : "";

    const moodText =
      moodElement
        ? String(
            moodElement.value ||
            ""
          ).trim()
        : "";

    const vocal =
      vocalText;

    const mood =
      moodText;

    const mode =
      vocal ===
      "Enstrümantal (Vokalsiz)"
        ? "instrumental"
        : "vocals";

    const referenceAudioUrl =
      String(
        window
          .__MUSIC_REF_AUDIO_URL__ ||
        ""
      ).trim();

    const payload = {
      prompt:
        prompt,

      mode:
        mode,

      title:
        title,

      lyrics:
        lyrics,

      vocal:
        vocal,

      mood:
        mood,

      use_credits:
        true,

      charge:
        true,

      credits:
        CREDIT_COST,

      cost:
        CREDIT_COST,

      ...(
        referenceAudioUrl
          ? {
              reference_audio_url:
                referenceAudioUrl
            }
          : {}
      )
    };

    const response =
      await fetch(
        "/api/music/generate",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          credentials:
            "include",

          body:
            JSON.stringify(
              payload
            )
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch (_) {
      data = {
        ok: false,
        error:
          "non_json_response",
        status:
          response.status
      };
    }

    if (
      !response.ok ||
      !data ||
      !data.ok
    ) {
      const errorMessage =
        data &&
        data.error
          ? data.error
          : (
              "http_" +
              response.status
            );

      throw new Error(
        "generate_failed:" +
        errorMessage
      );
    }

    return data;
  }

  /* =========================================================
     GENERATE
     ========================================================= */

  async function doGenerate() {
    if (isBusy) {
      return;
    }

    isBusy = true;

    const button =
      document.getElementById(
        BTN_ID
      );

    const startedAt =
      Date.now();

    setButtonBusy(
      button,
      true
    );

    try {
      const prompt =
        getPrompt();

      if (!prompt) {
        toastError(
          musicText(
            "studio.music.generate.promptRequired"
          )
        );

        return;
      }

      /*
        Preserve the user's own title, lyrics and prompt.
        These values must never be translated.
      */

      const uiTitle =
        String(
          document
            .querySelector(
              "#songName"
            )
            ?.value ||
          ""
        ).trim();

      const uiLyrics =
        String(
          document
            .querySelector(
              "#lyrics"
            )
            ?.value ||
          ""
        ).trim();

      const uiPrompt =
        String(
          document
            .querySelector(
              "#prompt"
            )
            ?.value ||
          ""
        ).trim();

      window.__LAST_PROMPT__ =
        prompt;

      let consumed = false;

      let consumeTransactionId =
        null;

      const consumeRequestId =
        "music:" +
        Date.now() +
        ":" +
        Math.random()
          .toString(36)
          .slice(2, 8);

      /* =====================================================
         CREDIT REFUND
         ===================================================== */

      async function refundMusicCredit(
        reason,
        extraMeta
      ) {
        if (
          !consumed ||
          !consumeTransactionId
        ) {
          return false;
        }

        try {
          const refundResponse =
            await fetch(
              "/api/credits/refund",
              {
                method: "POST",

                credentials:
                  "include",

                headers: {
                  "content-type":
                    "application/json",

                  "accept":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    app:
                      "music",

                    action:
                      CREDIT_REASON,

                    amount:
                      CREDIT_COST,

                    request_id:
                      consumeRequestId,

                    related_transaction_id:
                      consumeTransactionId,

                    reason:
                      reason,

                    meta: {
                      source:
                        "studio.music.generate",

                      prompt:
                        prompt,

                      ...(
                        extraMeta || {}
                      )
                    }
                  })
              }
            );

          const refundData =
            await refundResponse
              .json()
              .catch(
                function () {
                  return null;
                }
              );

          const refundAccepted =
            refundResponse.ok &&
            refundData &&
            refundData.ok &&
            (
              refundData.refunded ||
              refundData.deduped ||
              refundData.skipped
            );

          if (!refundAccepted) {
            return false;
          }

          try {
            const creditGetResponse =
              await fetch(
                "/api/credits/get",
                {
                  credentials:
                    "include",

                  cache:
                    "no-store",

                  headers: {
                    "accept":
                      "application/json"
                  }
                }
              );

            const creditGetData =
              await creditGetResponse
                .json()
                .catch(
                  function () {
                    return null;
                  }
                );

            if (
              creditGetData &&
              creditGetData.ok &&
              typeof
                creditGetData.credits ===
                "number"
            ) {
              const creditCountElement =
                document.getElementById(
                  "topCreditCount"
                );

              if (
                creditCountElement
              ) {
                creditCountElement
                  .textContent =
                  String(
                    creditGetData.credits
                  );
              }

              if (
                window.AIVO_STORE_V1 &&
                typeof window
                  .AIVO_STORE_V1
                  .setCredits ===
                  "function"
              ) {
                window
                  .AIVO_STORE_V1
                  .setCredits(
                    creditGetData.credits
                  );
              }
            }
          } catch (_) {}

          try {
            if (
              typeof window
                .syncCreditsUI ===
                "function"
            ) {
              window.syncCreditsUI({
                force: true
              });
            }
          } catch (_) {}

          return true;
        } catch (refundError) {
          console.error(
            "[music.generate] refund failed:",
            refundError
          );

          return false;
        }
      }

      /* =====================================================
         CONSUME CREDIT
         ===================================================== */

      try {
        const creditResponse =
          await fetch(
            "/api/credits/consume-ledger",
            {
              method: "POST",

              credentials:
                "include",

              headers: {
                "content-type":
                  "application/json",

                "accept":
                  "application/json"
              },

              body:
                JSON.stringify({
                  app:
                    "music",

                  action:
                    CREDIT_REASON,

                  cost:
                    CREDIT_COST,

                  request_id:
                    consumeRequestId,

                  reason:
                    CREDIT_REASON
                })
            }
          );

        let creditData = null;

        try {
          creditData =
            await creditResponse
              .json();
        } catch (_) {
          creditData = {
            ok: false,
            error:
              "non_json_response",
            status:
              creditResponse.status
          };
        }

        if (
          !creditResponse.ok ||
          !creditData ||
          !creditData.ok
        ) {
          toastError(
            creditErrorMessage(
              creditData
            )
          );

          return;
        }

        consumed = true;

        consumeTransactionId =
          creditData.transaction_id ||
          (
            creditData.transaction &&
            creditData.transaction.id
          ) ||
          null;

        try {
          const creditGetResponse =
            await fetch(
              "/api/credits/get",
              {
                credentials:
                  "include",

                cache:
                  "no-store",

                headers: {
                  "accept":
                    "application/json"
                }
              }
            );

          const creditGetData =
            await creditGetResponse
              .json()
              .catch(
                function () {
                  return null;
                }
              );

          if (
            creditGetData &&
            creditGetData.ok &&
            typeof
              creditGetData.credits ===
              "number"
          ) {
            const creditCountElement =
              document.getElementById(
                "topCreditCount"
              );

            if (
              creditCountElement
            ) {
              creditCountElement
                .textContent =
                String(
                  creditGetData.credits
                );
            }

            if (
              window.AIVO_STORE_V1 &&
              typeof window
                .AIVO_STORE_V1
                .setCredits ===
                "function"
            ) {
              window
                .AIVO_STORE_V1
                .setCredits(
                  creditGetData.credits
                );
            }
          }
        } catch (_) {}

        toastSuccess(
          musicText(
            "studio.music.generate.creditConsumed"
          )
        );
      } catch (creditError) {
        console.error(
          "[music.generate] credits consume failed:",
          creditError
        );

        toastError(
          musicText(
            "studio.music.generate.creditConnectionError"
          )
        );

        return;
      }

      /* =====================================================
         GENERATE API
         ===================================================== */

      let result = null;

      try {
        result =
          await callGenerateAPI(
            prompt
          );
      } catch (apiError) {
        console.warn(
          "[music.generate] /api/music/generate failed. Credit refund will be attempted:",
          apiError
        );

        const refunded =
          await refundMusicCredit(
            "music_generate_failed",
            {
              error:
                String(
                  apiError &&
                  apiError.message
                    ? apiError.message
                    : (
                        apiError ||
                        "generate_failed"
                      )
                )
            }
          );

        toastError(
          musicText(
            refunded
              ? "studio.music.generate.policyFailedRefunded"
              : "studio.music.generate.policyFailed"
          )
        );

        return;
      }

      /* =====================================================
         NORMALIZE RESULT
         ===================================================== */

      const providerJobId =
        result.provider_job_id ||
        result.providerJobId ||
        (
          result.data &&
          result.data.provider_job_id
        ) ||
        (
          result.data &&
          result.data.providerJobId
        ) ||
        null;

      const internalJobId =
        result.job_id ||
        result.jobId ||
        result.internal_job_id ||
        result.id ||
        (
          result.data &&
          result.data.job_id
        ) ||
        (
          result.data &&
          result.data.id
        ) ||
        null;

      const providerSongIds =
        result.provider_song_ids ||
        result.providerSongIds ||
        (
          result.data &&
          result.data.provider_song_ids
        ) ||
        (
          result.data &&
          result.data.providerSongIds
        ) ||
        [];

      const jobId =
        providerJobId ||
        internalJobId;

      /*
        The status endpoint requires provider_job_id.
      */

      if (!providerJobId) {
        console.warn(
          "[music.generate] missing provider_job_id, result:",
          result
        );

        toastError(
          musicText(
            "studio.music.generate.startFailed"
          )
        );

        return;
      }

      if (!jobId) {
        console.warn(
          "[music.generate] generate response:",
          result
        );

        toastError(
          musicText(
            "studio.music.generate.jobMissing"
          )
        );

        return;
      }

      /* =====================================================
         DEBUG STATE
         ===================================================== */

      window
        .__LAST_MUSIC_GENERATE_RESPONSE__ =
        result;

      window
        .__LAST_MUSIC_JOB_ID__ =
        jobId;

      window
        .__LAST_MUSIC_PROVIDER_JOB_ID__ =
        providerJobId;

      window
        .__LAST_MUSIC_INTERNAL_JOB_ID__ =
        internalJobId;

      console.log(
        "[music.generate] FULL_RESPONSE:",
        result
      );

      console.log(
        "[music.generate] job_id chosen:",
        jobId,
        {
          provider_job_id:
            providerJobId,

          internal_job_id:
            internalJobId
        }
      );

      const isProviderJob =
        String(jobId)
          .startsWith(
            "prov_music_"
          );

      const jobType =
        "music";

      toastSuccess(
        musicText(
          "studio.music.generate.started"
        )
      );

      /* =====================================================
         PANEL EVENT
         ===================================================== */

      dispatchJob({
        type:
          jobType,

        kind:
          jobType,

        job_id:
          jobId,

        id:
          jobId,

        status:
          result.state ||
          result.status ||
          "queued",

        title:
          uiTitle,

        lyrics:
          uiLyrics,

        prompt:
          uiPrompt,

        __ui_state:
          "processing",

        __audio_src:
          "",

        provider_job_id:
          providerJobId,

        provider_song_ids:
          Array.isArray(
            providerSongIds
          )
            ? providerSongIds
            : [],

        __real_job_id:
          internalJobId ||
          jobId,

        __provider_job:
          isProviderJob,

        __provider_job_id:
          providerJobId,

        __internal_job_id:
          internalJobId
      });

      /* =====================================================
         AIVO JOB STORE
         ===================================================== */

      try {
        if (
          window.AIVO_JOBS &&
          typeof window
            .AIVO_JOBS
            .upsert ===
            "function"
        ) {
          window.AIVO_JOBS.upsert({
            type:
              jobType,

            kind:
              jobType,

            job_id:
              jobId,

            id:
              jobId,

            status:
              result.state ||
              result.status ||
              "queued",

            title:
              uiTitle,

            lyrics:
              uiLyrics,

            prompt:
              uiPrompt,

            createdAt:
              new Date()
                .toISOString(),

            __provider_job:
              isProviderJob,

            __provider_job_id:
              providerJobId,

            __internal_job_id:
              internalJobId
          });

          /* ===============================================
             STATUS POLLING
             =============================================== */

          if (providerJobId) {
            const pollInterval =
              setInterval(
                async function () {
                  try {
                    const statusResponse =
                      await fetch(
                        "/api/music/status" +
                        "?provider_job_id=" +
                        encodeURIComponent(
                          providerJobId
                        )
                      );

                    const statusData =
                      await statusResponse
                        .json();

                    console.log(
                      "[music.generate] poll status:",
                      statusData
                    );

                    if (
                      statusData &&
                      statusData.state ===
                        "ready" &&
                      statusData.audio &&
                      statusData.audio.src
                    ) {
                      clearInterval(
                        pollInterval
                      );

                      console.log(
                        "[music.generate] READY → dispatch UI update",
                        statusData
                      );

                      dispatchJob({
                        type:
                          "music",

                        kind:
                          "music",

                        job_id:
                          providerJobId,

                        id:
                          providerJobId,

                        status:
                          "ready",

                        state:
                          "ready",

                        title:
                          uiTitle,

                        lyrics:
                          uiLyrics,

                        prompt:
                          uiPrompt,

                        __ui_state:
                          "ready",

                        __audio_src:
                          statusData.audio.src,

                        audio: {
                          src:
                            statusData.audio.src
                        },

                        mp3_url:
                          statusData.audio.src,

                        output_id:
                          statusData.output_id,

                        internal_job_id:
                          statusData.internal_job_id,

                        __provider_job:
                          true,

                        __provider_job_id:
                          providerJobId,

                        __internal_job_id:
                          statusData.internal_job_id
                      });

                      toastSuccess(
                        musicText(
                          "studio.music.generate.ready"
                        )
                      );
                    }
                  } catch (
                    statusError
                  ) {
                    console.warn(
                      "[music.generate] status poll failed:",
                      statusError
                    );
                  }
                },
                1500
              );
          }
        }
      } catch (jobStoreError) {
        console.warn(
          "[music.generate] AIVO_JOBS.upsert failed:",
          jobStoreError
        );
      }
    } catch (error) {
      console.error(
        "[music.generate] error:",
        error
      );

      toastError(
        musicText(
          "studio.music.generate.genericError"
        )
      );
    } finally {
      /*
        Keep the loading state visible for at least
        3.5 seconds so the button interaction is clear.
      */

      const minimumLoadingTime =
        3500;

      const elapsed =
        Date.now() -
        startedAt;

      if (
        elapsed <
        minimumLoadingTime
      ) {
        await sleep(
          minimumLoadingTime -
          elapsed
        );
      }

      setButtonBusy(
        button,
        false
      );

      isBusy = false;
    }
  }

  /* =========================================================
     BIND
     ========================================================= */

  function handleGenerateClick(
    event
  ) {
    if (
      event &&
      event
        .__aivoMusicGenerateHandled
    ) {
      return;
    }

    if (event) {
      event
        .__aivoMusicGenerateHandled =
        true;

      event.preventDefault();
      event.stopPropagation();
    }

    doGenerate();
  }

  function bind() {
    const button =
      document.getElementById(
        BTN_ID
      );

    if (!button) {
      return;
    }

    syncGenerateButton(
      button
    );

    if (
      boundButton === button
    ) {
      return;
    }

    boundButton =
      button;

    button.addEventListener(
      "click",
      handleGenerateClick
    );

    console.log(
      "[studio.music.generate] bound OK:",
      BTN_ID
    );
  }

  /*
    Delegated listener is retained because the music module
    is loaded dynamically into #moduleHost.
  */

  document.addEventListener(
    "click",
    function (event) {
      const button =
        event.target &&
        event.target.closest
          ? event.target.closest(
              "#musicGenerateBtn"
            )
          : null;

      if (!button) {
        return;
      }

      handleGenerateClick(
        event
      );
    }
  );

  /* =========================================================
     DYNAMIC MODULE OBSERVER
     ========================================================= */

  function startObserver() {
    if (
      moduleObserver ||
      !document.body ||
      typeof MutationObserver ===
        "undefined"
    ) {
      return;
    }

    moduleObserver =
      new MutationObserver(
        function (mutations) {
          const hasMusicButton =
            mutations.some(
              function (mutation) {
                return Array.from(
                  mutation.addedNodes ||
                  []
                ).some(
                  function (node) {
                    if (
                      !node ||
                      node.nodeType !== 1
                    ) {
                      return false;
                    }

                    if (
                      node.id === BTN_ID
                    ) {
                      return true;
                    }

                    return Boolean(
                      node.querySelector &&
                      node.querySelector(
                        "#" + BTN_ID
                      )
                    );
                  }
                );
              }
            );

          if (hasMusicButton) {
            requestAnimationFrame(
              bind
            );
          }
        }
      );

    moduleObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  /* =========================================================
     LANGUAGE EVENTS
     ========================================================= */

  function refreshLanguage() {
    registerDictionary();

    setTimeout(
      function () {
        syncGenerateButton();
      },
      0
    );
  }

  document.addEventListener(
    "aivo:language-change",
    refreshLanguage
  );

  document.addEventListener(
    "aivo:studio:i18n-applied",
    function () {
      setTimeout(
        function () {
          syncGenerateButton();
        },
        0
      );
    }
  );

  document.addEventListener(
    "aivo:module:loaded",
    function () {
      requestAnimationFrame(
        bind
      );
    }
  );

  document.addEventListener(
    "aivo:studio:module-loaded",
    function () {
      requestAnimationFrame(
        bind
      );
    }
  );

  /* =========================================================
     BOOT
     ========================================================= */

  registerDictionary();

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        registerDictionary();
        bind();
        startObserver();
      },
      {
        once: true
      }
    );
  } else {
    bind();
    startObserver();
  }

  window.addEventListener(
    "load",
    function () {
      bind();
      syncGenerateButton();
    }
  );
})();
