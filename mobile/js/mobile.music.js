(function(){
  const btn = document.getElementById("mobileMusicGenerateBtn");
  const titleEl = document.getElementById("musicTitle");
  const promptEl = document.getElementById("musicPrompt");
const moodEl = document.getElementById("mobileMusicMood") || document.getElementById("musicMood");
  const vocalEl = document.getElementById("mobileMusicVocal");
  const lyricsEl = document.getElementById("musicLyrics");
  const statusEl = document.getElementById("mobileMusicStatus");
  const resultsEl = document.getElementById("mobileMusicResults");
  const homeSectionEl = document.getElementById("mobileHomeSection");
  const productionsSectionEl = document.getElementById("mobileProductionsSection");
  const mobileMusicLibraryEl = document.getElementById("mobileMusicLibrary");
  const productionsNavEl = document.querySelector('.bottom-nav a[href="#productions"]');
  const homeNavEl = document.querySelector('.bottom-nav a[href="#home"]');
  const miniPlayerEl = document.getElementById("mobileMiniPlayer");
  const miniAudioEl = document.getElementById("mobileMiniAudio");
  const miniPlayBtn = document.getElementById("miniPlayBtn");
  const miniTitleEl = document.getElementById("miniTitle");
  const miniSubEl = document.getElementById("miniSub");
  const miniProgressFill = document.getElementById("miniProgressFill");

  if (!btn || !promptEl || !statusEl || !resultsEl || !homeSectionEl || !productionsSectionEl || !productionsNavEl || !homeNavEl || !miniPlayerEl || !miniAudioEl || !miniPlayBtn || !miniTitleEl || !miniSubEl || !miniProgressFill) return;

  function showMobileSection(name){
    const isProductions = name === "productions";

    homeSectionEl.hidden = isProductions;
    productionsSectionEl.hidden = !isProductions;

    homeNavEl.classList.toggle("active", !isProductions);
    productionsNavEl.classList.toggle("active", isProductions);
  }

  homeNavEl.addEventListener("click", function(e){
    e.preventDefault();
    showMobileSection("home");
  });

  productionsNavEl.addEventListener("click", function(e){
    e.preventDefault();
    showMobileSection("productions");

    resultsEl.hidden = true;

    if (mobileMusicLibraryEl) {
      mobileMusicLibraryEl.hidden = false;
      mobileMusicLibraryEl.style.display = "";

      const libraryTitleEl = mobileMusicLibraryEl.previousElementSibling;
      if (libraryTitleEl && libraryTitleEl.classList.contains("section-title")) {
        libraryTitleEl.hidden = false;
        libraryTitleEl.style.display = "";
      }
    }

    hydrateMusicLibrary();
  });

  async function hydrateMusicLibrary(){
    if (!mobileMusicLibraryEl) return;

      mobileMusicLibraryEl.innerHTML = `
      <div class="empty-card">
        ${musicText(
          "Kütüphane yükleniyor...",
          "Library is loading..."
        )}
      </div>
    `;

    try {
      const res = await fetch("/api/jobs/list?app=music", {
        headers:{
          "accept":"application/json"
        },
        cache:"no-store"
      });

      const data = await res.json();

      const rows = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.jobs)
          ? data.jobs
          : Array.isArray(data)
            ? data
            : [];

      if (!rows.length) {
            mobileMusicLibraryEl.innerHTML = `
          <div class="empty-card">
            ${musicText(
              "Henüz müzik bulunamadı.",
              "No music found yet."
            )}
          </div>
        `;
        return;
      }

      mobileMusicLibraryEl.innerHTML = "";

  const libraryRows = [];

rows.forEach(function(row){
  const baseTitle =
    row.meta?.title ||
    row.title ||
    row.meta?.song_title ||
    "Yeni müzik";

  const rawOutputs =
    Array.isArray(row.outputs) && row.outputs.length
      ? row.outputs
      : Array.isArray(row.meta?.outputs) && row.meta.outputs.length
        ? row.meta.outputs
        : Array.isArray(row.meta?.music_outputs) && row.meta.music_outputs.length
          ? row.meta.music_outputs
          : [];

  const audioOutputs = rawOutputs.filter(function(output){
    return output && (
      output.audio_url ||
      output.url ||
      output.archive_url ||
      output.raw_url ||
      output.src
    );
  });

  const providerSongIds = Array.isArray(row.meta?.provider_song_ids)
    ? row.meta.provider_song_ids
    : [];

  const versionCount = Math.max(audioOutputs.length, providerSongIds.length, 1);

  for (let index = 0; index < versionCount; index += 1) {
    const output = audioOutputs[index] || null;

    const versionTitle = index === 0
      ? baseTitle
      : baseTitle + " · Versiyon " + (index + 1);

    libraryRows.push({
      ...row,
      title: versionTitle,
      outputs: output ? [output] : [],
      audio_url:
        output?.audio_url ||
        output?.url ||
        output?.archive_url ||
        output?.raw_url ||
        output?.src ||
        "",
      meta: {
        ...(row.meta || {}),
        version_index: index
      }
    });
  }
});

libraryRows.forEach(function(row){
        const title =
          row.title ||
          row.prompt ||
          "Yeni müzik";

        const outputs = Array.isArray(row.outputs) ? row.outputs : [];

        const firstAudioOutput = outputs.find(function(output){
          return output && (
            output.audio_url ||
            output.url ||
            output.archive_url ||
            output.raw_url ||
            output.src
          );
        });

        const audioUrl =
          row.audio_url ||
          row.url ||
          row.output_url ||
          row.meta?.audio_url ||
          row.meta?.url ||
          row.meta?.final_audio_url ||
          firstAudioOutput?.audio_url ||
          firstAudioOutput?.url ||
          firstAudioOutput?.archive_url ||
          firstAudioOutput?.raw_url ||
          firstAudioOutput?.src ||
          "";

        let resolvedAudioUrl = audioUrl;
        let isReady = !!resolvedAudioUrl;

           const item = document.createElement("div");
        item.className = "mobile-library-row";
        item.dataset.aivoAudioUrl = String(resolvedAudioUrl || "");

        const stemsStorageKey = "aivo_mobile_stems_" + String(
          row.id ||
          row.job_id ||
          row.db_job_id ||
          row.internal_job_id ||
          row.meta?.internal_job_id ||
          resolvedAudioUrl ||
          title
        );

               try {
          const dbStems = row?.meta?.stems || null;
          const dbStemsStatus = String(dbStems?.status || "").toLowerCase();

          if (dbStemsStatus === "succeeded" && dbStems?.output) {
            item.dataset.stemsStatus = "ready";
            item.dataset.stemsOutput = JSON.stringify(dbStems.output);
          } else if (dbStemsStatus === "processing" || dbStemsStatus === "starting") {
            item.dataset.stemsStatus = "processing";
            item.dataset.stemsPredictionId = String(dbStems?.prediction_id || "");
          }

          const savedStems = JSON.parse(localStorage.getItem(stemsStorageKey) || "{}");

          if (!item.dataset.stemsStatus && savedStems.status === "ready" && savedStems.output) {
            item.dataset.stemsStatus = "ready";
            item.dataset.stemsOutput = JSON.stringify(savedStems.output);
          }
        } catch (err) {}

        item.innerHTML = `
          <div class="mobile-library-thumb">♪</div>

          <div class="mobile-library-meta">
            <div class="mobile-library-title">
              ${safe(title)}
            </div>

                 <div class="mobile-library-sub">
              ${
                item.dataset.stemsStatus === "ready"
                  ? musicText("Kanallar hazır", "Channels ready")
                  : item.dataset.stemsStatus === "processing"
                    ? musicText("Kanallar hazırlanıyor", "Channels are being prepared")
                    : isReady
                      ? musicText("Hazır", "Ready")
                      : musicText("Hazırlanıyor", "Preparing")
              }
            </div>
          </div>

                  <div class="mobile-library-actions">
            <button class="mobile-library-play" type="button">
              ${isReady ? "▶" : "…"}
            </button>

                 <button
           class="mobile-library-play mobile-library-download"
           type="button"
           title="${musicText("İndir", "Download")}"
           aria-label="${musicText("İndir", "Download")}"
         >
           ↓
         </button>

         <button
           class="mobile-library-play mobile-library-delete"
           type="button"
           title="${musicText("Sil", "Delete")}"
           aria-label="${musicText("Sil", "Delete")}"
         >
           ×
         </button>

         <button
           class="mobile-library-play mobile-library-lyrics mobile-action-lyrics"
           type="button"
           title="${musicText("Şarkı Sözleri", "Lyrics")}"
           aria-label="${musicText("Şarkı Sözleri", "Lyrics")}"
         >
           lyrics
         </button>

         <button
           class="mobile-library-play mobile-library-more"
           type="button"
           title="${musicText("Diğer işlemler", "More actions")}"
           aria-label="${musicText("Diğer işlemler", "More actions")}"
         >
           ...
         </button>
          </div>
        `;

        const subEl = item.querySelector(".mobile-library-sub");
        const playEl = item.querySelector(".mobile-library-play");
        const downloadEl = item.querySelector(".mobile-library-download");
        const deleteEl = item.querySelector(".mobile-library-delete");
        const lyricsEl = item.querySelector(".mobile-library-lyrics");

     if (lyricsEl) {
  lyricsEl.addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();

    openMusicLyricsSheet({
      title,
      row
    });
  });
}
      const moreEl = item.querySelector(".mobile-library-more");

if (moreEl) {
  moreEl.addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();

        openMusicMoreSheet({
      title,
      row,
      audioUrl: resolvedAudioUrl,
      item
    });
  });
}

if (downloadEl) {
  downloadEl.addEventListener("click", async function(e){
    e.preventDefault();
    e.stopPropagation();

    if (!isReady) {
      await wakeLibraryRow();
    }

    if (!resolvedAudioUrl) return;

    const filename = "aivo-music.mp3";
    const proxied = "/api/media/proxy?url=" + encodeURIComponent(resolvedAudioUrl) + "&filename=" + encodeURIComponent(filename);

    const a = document.createElement("a");
    a.href = proxied;
    a.download = filename;
    a.rel = "noopener";
      a.style.display = "none";

    document.body.appendChild(a);
    a.click();

    setTimeout(function(){
      try {
        a.remove();
      } catch (err) {}
    }, 1500);
  });
}

if (deleteEl) {
  deleteEl.addEventListener("click", async function(e){
    e.preventDefault();
    e.stopPropagation();

    item.remove();

    const deleteJobId =
      row.id ||
      row.job_id ||
      row.db_job_id ||
      row.internal_job_id ||
      row.meta?.internal_job_id ||
      "";

    if (!deleteJobId) return;

    try {
      await fetch("/api/jobs/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          job_id: deleteJobId,
          app: "music"
        })
      });
    } catch (err) {}
  });
}

        function activateLibraryRow(nextAudioUrl){
          resolvedAudioUrl = String(nextAudioUrl || "");
          isReady = !!resolvedAudioUrl;
          item.dataset.aivoAudioUrl = String(resolvedAudioUrl || "");

                  if (subEl) {
            subEl.textContent = isReady
              ? musicText("Hazır", "Ready")
              : musicText("Hazırlanıyor", "Preparing");
          }

          if (playEl) playEl.textContent = isReady ? "▶" : "…";
        }

        async function wakeLibraryRow(){
          if (isReady) return;

          const ids = Array.isArray(row.meta?.provider_song_ids)
            ? row.meta.provider_song_ids
            : [];

          const statusJobId =
            ids.length
              ? ids.join(",")
              : row.meta?.provider_job_id ||
                row.meta?.internal_job_id ||
                row.job_id ||
                "";

          if (!statusJobId) return;

          try {
            const res = await fetch("/api/music/status?job_id=" + encodeURIComponent(statusJobId), {
              headers: { "accept": "application/json" },
              cache: "no-store"
            });

            const data = await res.json();

            const statusOutputs = Array.isArray(data?.outputs) ? data.outputs : [];
           const versionIndex = Number(row.meta?.version_index || 0);

           const audioCandidates = statusOutputs.filter(function(output){
            return output && (
             output.url ||
            output.audio_url ||
             output.archive_url ||
           output.raw_url ||
          output.src
           );
        });

        const pickedAudio = audioCandidates[versionIndex] || audioCandidates[0] || null;
 
         const nextAudioUrl =
        pickedAudio?.url ||
        pickedAudio?.audio_url ||
       pickedAudio?.archive_url ||
        pickedAudio?.raw_url ||
        pickedAudio?.src ||
        data?.audio?.src ||
       data?.audio?.url ||
        "";

            if (nextAudioUrl) {
              activateLibraryRow(nextAudioUrl);
            }
          } catch (err) {}
        }

        item.addEventListener("click", async function(){
          if (!isReady) {
            await wakeLibraryRow();
          }

          if (!isReady) {
            return;
          }

          document.querySelectorAll(".mobile-library-row.is-playing").forEach(function(rowEl){
            rowEl.classList.remove("is-playing");

            const btnEl = rowEl.querySelector(".mobile-library-play");
            if (btnEl) btnEl.textContent = "▶";
          });

          item.classList.add("is-playing");
          if (playEl) playEl.textContent = "Ⅱ";

          loadMiniPlayer({
            title,
            sub:"AIVO Music",
            audioUrl: resolvedAudioUrl
          });
        });

        wakeLibraryRow();

        mobileMusicLibraryEl.appendChild(item);
      });

    } catch (err) {
          mobileMusicLibraryEl.innerHTML = `
        <div class="empty-card">
          ${musicText(
            "Kütüphane yüklenemedi.",
            "Library could not be loaded."
          )}
        </div>
      `;
    }
  }
  function openMusicLyricsSheet(payload){
  const oldSheet = document.getElementById("mobileMusicLyricsSheet");
  if (oldSheet) oldSheet.remove();

  const title = String(payload?.title || "Yeni müzik");

  const lyrics = String(
    payload?.row?.lyrics ||
    payload?.row?.meta?.lyrics ||
    payload?.row?.meta?.song_lyrics ||
    payload?.row?.meta?.text ||
    ""
  ).trim();

  const sheet = document.createElement("div");
  sheet.id = "mobileMusicLyricsSheet";
  sheet.className = "mobile-music-sheet-backdrop";

  sheet.innerHTML = `
    <div class="mobile-music-sheet" role="dialog" aria-modal="true">
      <div class="mobile-music-sheet-handle"></div>

      <div class="mobile-music-sheet-head">
        <div>
          <div class="mobile-music-sheet-kicker">
            ${musicText(
              "Şarkı Sözleri",
              "Lyrics"
            )}
          </div>

          <div class="mobile-music-sheet-title">${safe(title)}</div>
        </div>

        <button
          class="mobile-music-sheet-close"
          type="button"
          aria-label="${musicText("Kapat", "Close")}"
        >
          ×
        </button>
      </div>

      <div class="mobile-music-confirm-text" style="max-height:48vh; overflow:auto; text-align:left !important; white-space:pre-wrap;">
        ${lyrics
          ? safe(lyrics)
          : musicText(
              "Bu müzik için kayıtlı şarkı sözü bulunamadı.",
              "No lyrics were found for this music."
            )}
      </div>

      ${
        lyrics
          ? `
            <div class="mobile-music-confirm-actions">
              <button class="mobile-music-confirm-cancel" type="button" data-mobile-lyrics-action="share">
                ${musicText(
                  "Paylaş",
                  "Share"
                )}
              </button>

              <button class="mobile-music-confirm-submit" type="button" data-mobile-lyrics-action="copy">
                ${musicText(
                  "Kopyala",
                  "Copy"
                )}
              </button>
            </div>
          `
          : ""
      }
    </div>
  `;

  function closeSheet(){
    sheet.remove();
    document.body.classList.remove("mobile-sheet-open");
  }

  sheet.addEventListener("click", async function(e){
    if (e.target === sheet) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const closeBtn = e.target.closest(".mobile-music-sheet-close");
    if (closeBtn) {
      closeSheet();
      return;
    }

const copyBtn = e.target.closest('[data-mobile-lyrics-action="copy"]');
if (copyBtn) {
  e.preventDefault();
  e.stopPropagation();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(lyrics);
    } else {
      const ta = document.createElement("textarea");
      ta.value = lyrics;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }

     if (statusEl) {
      statusEl.textContent = musicText(
        "Şarkı sözleri kopyalandı.",
        "Lyrics copied."
      );
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = musicText(
        "Kopyalama başarısız.",
        "Copy failed."
      );
    }
  }

  return;
}

const shareBtn = e.target.closest('[data-mobile-lyrics-action="share"]');
if (shareBtn) {
  e.preventDefault();
  e.stopPropagation();

  const shareText = "AIVO Şarkı Sözleri - " + title + "\n\n" + lyrics;

  try {
    if (navigator.share && navigator.canShare) {
      await navigator.share({
        text: shareText
      });
    } else if (navigator.share) {
      await navigator.share({
        text: shareText
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = shareText;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();

        if (statusEl) {
        statusEl.textContent = musicText(
          "Paylaşım desteklenmiyor, sözler kopyalandı.",
          "Sharing is not supported, lyrics copied."
        );
      }
    }
  } catch (err) {
    try {
      const ta = document.createElement("textarea");
      ta.value = shareText;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();

        if (statusEl) {
        statusEl.textContent = musicText(
          "Paylaşım iptal edildi, sözler kopyalandı.",
          "Sharing cancelled, lyrics copied."
        );
      }
    } catch (copyErr) {}
  }

  return;
}
  });

  document.body.appendChild(sheet);
  document.body.classList.add("mobile-sheet-open");
}
    function openMusicMoreSheet(payload){
    const oldSheet = document.getElementById("mobileMusicMoreSheet");
    if (oldSheet) oldSheet.remove();
    const title = String(payload?.title || "Yeni müzik");
    const audioUrl = String(payload?.audioUrl || "");
    const itemEl = payload?.item || null;
    const currentStemsStatus = String(itemEl?.dataset?.stemsStatus || "");

    const stemsJobId = String(
      payload?.row?.job_id ||
      payload?.row?.id ||
      payload?.row?.db_job_id ||
      payload?.row?.internal_job_id ||
      payload?.row?.meta?.internal_job_id ||
      ""
    );

    const stemsStorageKey = "aivo_mobile_stems_" + String(
      payload?.row?.id ||
      payload?.row?.job_id ||
      payload?.row?.db_job_id ||
      payload?.row?.internal_job_id ||
      payload?.row?.meta?.internal_job_id ||
      audioUrl ||
      title
    );

    const sheet = document.createElement("div");
    sheet.id = "mobileMusicMoreSheet";
    sheet.className = "mobile-music-sheet-backdrop";

     sheet.innerHTML = `
      <div class="mobile-music-sheet" role="dialog" aria-modal="true">
        <div class="mobile-music-sheet-handle"></div>

        <div class="mobile-music-sheet-head">
          <div>
            <div class="mobile-music-sheet-kicker">
              ${musicText(
                "Diğer işlemler",
                "More actions"
              )}
            </div>

            <div class="mobile-music-sheet-title">${safe(title)}</div>
          </div>

          <button
            class="mobile-music-sheet-close"
            type="button"
            aria-label="${musicText("Kapat", "Close")}"
          >
            ×
          </button>
        </div>

        ${
          currentStemsStatus === "processing"
            ? `
              <div class="mobile-music-confirm-text">
                ${musicText(
                  "Kanallar hazırlanıyor. Bu işlem zaten başlatıldı.",
                  "Channels are being prepared. This process has already started."
                )}
              </div>
            `
            : currentStemsStatus === "ready"
              ? `
                <button class="mobile-music-sheet-action mobile-action-stems" type="button" data-mobile-sheet-action="channels">
                  <span>
                    <strong>${musicText("Kanallar", "Channels")}</strong>
                    <small>
                      ${musicText(
                        "Hazır dosyaları görüntüle",
                        "View ready files"
                      )}
                    </small>
                  </span>
                </button>
              `
              : `
                <button class="mobile-music-sheet-action mobile-action-stems" type="button" data-mobile-sheet-action="stems">
                  <span>
                    <strong>${musicText("Kanal Ayırma", "Stem Separation")}</strong>
                    <small>
                      ${musicText(
                        "Bu işlem 5 kredi kullanır",
                        "This action uses 5 credits"
                      )}
                    </small>
                  </span>
                </button>
              `
        }
      </div>
    `;
       function closeSheet(){
      sheet.remove();
      document.body.classList.remove("mobile-sheet-open");
    }

    function pollMobileStemsPrediction(predictionId){
      if (!predictionId) return;

      let tries = 0;

      async function tick(){
        tries += 1;

        try {
          const res = await fetch("/api/music/stems", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json"
            },
                body: JSON.stringify({
              prediction_id: predictionId,
              job_id: stemsJobId
            })
          });

          const data = await res.json();

          const status = String(data.status || "").toLowerCase();

          if (status === "succeeded") {
            sheet.querySelector(".mobile-music-sheet").innerHTML = `
              <div class="mobile-music-sheet-handle"></div>

              <div class="mobile-music-sheet-head">
                <div>
                  <div class="mobile-music-sheet-kicker">
                    ${musicText(
                      "Kanal Ayırma",
                      "Stem Separation"
                    )}
                  </div>

                  <div class="mobile-music-sheet-title">
                    ${musicText(
                      "Kanallar hazır",
                      "Channels ready"
                    )}
                  </div>
                </div>

                <button
                  class="mobile-music-sheet-close"
                  type="button"
                  aria-label="${musicText("Kapat", "Close")}"
                >
                  ×
                </button>
              </div>

              <div class="mobile-music-confirm-text">
                ${musicText(
                  "Kanal ayırma tamamlandı. Bir sonraki adımda bu dosyaları kart içine indirebilir hale getireceğiz.",
                  "Stem separation completed. In the next step, these files will be downloadable inside the card."
                )}
              </div>
            `;

            if (itemEl) {
              const subTextEl = itemEl.querySelector(".mobile-library-sub");

              if (subTextEl) {
                subTextEl.textContent = musicText(
                  "Kanallar hazır",
                  "Channels ready"
                );
              }

              itemEl.dataset.stemsStatus = "ready";
              itemEl.dataset.stemsOutput = JSON.stringify(data.output || {});

              try {
                localStorage.setItem(stemsStorageKey, JSON.stringify({
                  status: "ready",
                  output: data.output || {},
                  saved_at: new Date().toISOString()
                }));
              } catch (err) {}
            }

            if (statusEl) {
              statusEl.textContent = musicText(
                "Kanal ayırma tamamlandı.",
                "Stem separation completed."
              );
            }

            if (window.toast?.success) {
              window.toast.success(
                musicText(
                  "Kanallar hazır.",
                  "Channels ready."
                )
              );
            }

            return;
          }

          if (status === "failed" || status === "canceled" || status === "cancelled") {
            sheet.querySelector(".mobile-music-sheet").innerHTML = `
              <div class="mobile-music-sheet-handle"></div>

              <div class="mobile-music-sheet-head">
                <div>
                  <div class="mobile-music-sheet-kicker">
                    ${musicText(
                      "Kanal Ayırma",
                      "Stem Separation"
                    )}
                  </div>

                  <div class="mobile-music-sheet-title">
                    ${musicText(
                      "İşlem başarısız",
                      "Process failed"
                    )}
                  </div>
                </div>

                <button
                  class="mobile-music-sheet-close"
                  type="button"
                  aria-label="${musicText("Kapat", "Close")}"
                >
                  ×
                </button>
              </div>

              <div class="mobile-music-confirm-text">
                ${musicText(
                  "Kanal ayırma tamamlanamadı. Lütfen tekrar dene.",
                  "Stem separation could not be completed. Please try again."
                )}
              </div>
            `;

            if (statusEl) {
              statusEl.textContent = musicText(
                "Kanal ayırma başarısız.",
                "Stem separation failed."
              );
            }

            if (window.toast?.error) {
              window.toast.error(
                musicText(
                  "Kanal ayırma başarısız.",
                  "Stem separation failed."
                )
              );
            }

            return;
          }

          if (tries < 60) {
            setTimeout(tick, 2500);
          }
        } catch (err) {
          if (tries < 60) {
            setTimeout(tick, 3000);
          }
        }
      }

      tick();
    }

     sheet.addEventListener("click", async function(e){
        if (e.target === sheet) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const closeBtn = e.target.closest(".mobile-music-sheet-close");
      if (closeBtn) {
        closeSheet();
        return;
      }

           const stemsBtn = e.target.closest('[data-mobile-sheet-action="stems"]');
      if (stemsBtn) {
        e.preventDefault();
        e.stopPropagation();

          sheet.querySelector(".mobile-music-sheet").innerHTML = `
          <div class="mobile-music-sheet-handle"></div>

          <div class="mobile-music-sheet-head">
            <div>
              <div class="mobile-music-sheet-kicker">
                ${musicText(
                  "Kanal Ayırma",
                  "Stem Separation"
                )}
              </div>

              <div class="mobile-music-sheet-title">
                ${musicText(
                  "5 kredi kullanılacak",
                  "5 credits will be used"
                )}
              </div>
            </div>

            <button
              class="mobile-music-sheet-close"
              type="button"
              aria-label="${musicText("Kapat", "Close")}"
            >
              ×
            </button>
          </div>

          <div class="mobile-music-confirm-text">
            ${musicText(
              "Bu işlem başlamadan önce 5 kredi kullanır. Devam edilsin mi?",
              "This action uses 5 credits before starting. Continue?"
            )}
          </div>

          <div class="mobile-music-confirm-actions">
            <button
              class="mobile-music-confirm-cancel"
              type="button"
              data-mobile-sheet-action="cancel"
            >
              ${musicText(
                "İptal",
                "Cancel"
              )}
            </button>

            <button
              class="mobile-music-confirm-submit"
              type="button"
              data-mobile-sheet-action="confirm-stems"
            >
              ${musicText(
                "Onayla (5 Kredi)",
                "Confirm (5 Credits)"
              )}
            </button>
          </div>
        `;
        return;
      }
        const channelsBtn = e.target.closest('[data-mobile-sheet-action="channels"]');
      if (channelsBtn) {
        e.preventDefault();
        e.stopPropagation();

        let stemsOutput = {};
        try {
          stemsOutput = JSON.parse(itemEl?.dataset?.stemsOutput || "{}");
        } catch (err) {
          stemsOutput = {};
        }

        function pickStemUrl(key){
          if (!stemsOutput) return "";

          if (typeof stemsOutput[key] === "string") return stemsOutput[key];
          if (stemsOutput[key]?.url) return stemsOutput[key].url;
          if (stemsOutput[key]?.audio_url) return stemsOutput[key].audio_url;

          if (Array.isArray(stemsOutput)) {
            const found = stemsOutput.find(function(item){
              const text = String(item?.name || item?.key || item?.label || item?.type || "").toLowerCase();
              return text.includes(key);
            });

            return String(found?.url || found?.audio_url || found || "");
          }

          return "";
        }

             sheet.querySelector(".mobile-music-sheet").innerHTML = `
          <div class="mobile-music-sheet-handle"></div>

          <div class="mobile-music-sheet-head">
            <div>
              <div class="mobile-music-sheet-kicker">
                ${musicText(
                  "Kanallar",
                  "Channels"
                )}
              </div>

              <div class="mobile-music-sheet-title">${safe(title)}</div>
            </div>

            <button
              class="mobile-music-sheet-close"
              type="button"
              aria-label="${musicText("Kapat", "Close")}"
            >
              ×
            </button>
          </div>

          <div class="mobile-channel-grid">
            <button
              class="mobile-channel-btn mobile-channel-vocals"
              type="button"
              data-stem-key="vocals"
              title="${musicText("Vokal", "Vocals")}"
              aria-label="${musicText("Vokal", "Vocals")}"
            ></button>

            <button
              class="mobile-channel-btn mobile-channel-drums"
              type="button"
              data-stem-key="drums"
              title="${musicText("Davul", "Drums")}"
              aria-label="${musicText("Davul", "Drums")}"
            ></button>

            <button
              class="mobile-channel-btn mobile-channel-bass"
              type="button"
              data-stem-key="bass"
              title="${musicText("Bass", "Bass")}"
              aria-label="${musicText("Bass", "Bass")}"
            ></button>

            <button
              class="mobile-channel-btn mobile-channel-guitar"
              type="button"
              data-stem-key="guitar"
              title="${musicText("Gitar", "Guitar")}"
              aria-label="${musicText("Gitar", "Guitar")}"
            ></button>

            <button
              class="mobile-channel-btn mobile-channel-piano"
              type="button"
              data-stem-key="piano"
              title="${musicText("Piyano", "Piano")}"
              aria-label="${musicText("Piyano", "Piano")}"
            ></button>
          </div>

          <div class="mobile-music-confirm-text">
            ${musicText(
              "Hazır kanal dosyalarını indirmek için ikonlara dokun. 24 saat içinde indirin.",
              "Tap the icons to download ready channel files. Download within 24 hours."
            )}
          </div>
        `;

        sheet.querySelectorAll(".mobile-channel-btn[data-stem-key]").forEach(function(btn){
          btn.addEventListener("click", function(ev){
            ev.preventDefault();
            ev.stopPropagation();

            const key = String(btn.dataset.stemKey || "");
            const url = pickStemUrl(key);

                 if (!url) {
              if (statusEl) {
                statusEl.textContent = musicText(
                  "Bu kanal dosyası henüz bulunamadı.",
                  "This channel file was not found yet."
                );
              }

              return;
            }

            const filename = "aivo-" + key + ".mp3";
            const proxied = "/api/media/proxy?url=" + encodeURIComponent(url) + "&filename=" + encodeURIComponent(filename);

            const a = document.createElement("a");
            a.href = proxied;
            a.download = filename;
            a.rel = "noopener";
              a.style.display = "none";

              document.body.appendChild(a);
              a.click();

               setTimeout(function(){
              try {
             a.remove();
             } catch (err) {}
            }, 1500);
          });
        });

        return;
      }
      const cancelBtn = e.target.closest('[data-mobile-sheet-action="cancel"]');
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
        return;
      }

        const confirmStemsBtn = e.target.closest('[data-mobile-sheet-action="confirm-stems"]');
      if (confirmStemsBtn) {
        e.preventDefault();
        e.stopPropagation();

             if (!audioUrl) {
          if (statusEl) {
            statusEl.textContent = musicText(
              "Kanal ayırma için ses dosyası bulunamadı.",
              "Audio file for stem separation was not found."
            );
          }

          closeSheet();
          return;
        }

        let refundCtx = null;

        confirmStemsBtn.disabled = true;

        confirmStemsBtn.textContent = musicText(
          "Kredi kontrol ediliyor...",
          "Checking credits..."
        );

        try {
          refundCtx = await consumeMobileMusicCreditsForStems();

          if (window.toast?.success) {
            window.toast.success(
              musicText(
                "5 kredi düşüldü",
                "5 credits deducted"
              )
            );
          }
        } catch (creditErr) {
          console.warn("[MOBILE MUSIC][STEMS CREDIT ERROR]", creditErr);

          if (statusEl) {
            statusEl.textContent = musicText(
              "Yetersiz kredi.",
              "Insufficient credits."
            );
          }

          if (window.toast?.warning) {
            window.toast.warning(
              musicText(
                "Yetersiz kredi",
                "Insufficient credits"
              )
            );
          }

          closeSheet();

          location.hash = "#credits";

          const creditsNav =
            document.querySelector('.bottom-nav a[href="#credits"]') ||
            document.querySelector('[data-mobile-nav="credits"]') ||
            document.querySelector('[data-mobile-tab="credits"]');

          if (creditsNav) {
            creditsNav.click();
          }

          return;
        }

        confirmStemsBtn.textContent = musicText(
          "Başlatılıyor...",
          "Starting..."
        );

        if (itemEl) {
          const subTextEl = itemEl.querySelector(".mobile-library-sub");

          if (subTextEl) {
            subTextEl.textContent = musicText(
              "Kanallar hazırlanıyor",
              "Channels are being prepared"
            );
          }

          itemEl.dataset.stemsStatus = "processing";
        }

        try {
          const res = await fetch("/api/music/stems", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json"
            },
            body: JSON.stringify({
              audio_url: audioUrl,
              job_id: stemsJobId
            })
          });

          const data = await res.json();
          const stemsPredictionId = String(data.id || data.prediction_id || "");

             if (!res.ok || !data || data.ok === false) {
            const refunded = await refundMobileMusicCredits(refundCtx, "mobile_music_stems_failed", {
              error: String(data?.error || "stems_start_failed"),
              job_id: stemsJobId
            });

            if (statusEl) {
              statusEl.textContent = refunded
                ? musicText(
                    "Kanal ayırma başlatılamadı. Kredi iade edildi.",
                    "Stem separation could not be started. Credits refunded."
                  )
                : musicText(
                    "Kanal ayırma başlatılamadı.",
                    "Stem separation could not be started."
                  );
            }

            closeSheet();
            return;
          }

          sheet.querySelector(".mobile-music-sheet").innerHTML = `
            <div class="mobile-music-sheet-handle"></div>

            <div class="mobile-music-sheet-head">
              <div>
                <div class="mobile-music-sheet-kicker">
                  ${musicText(
                    "Kanal Ayırma",
                    "Stem Separation"
                  )}
                </div>

                <div class="mobile-music-sheet-title">
                  ${musicText(
                    "İşlem başlatıldı",
                    "Process started"
                  )}
                </div>
              </div>

              <button
                class="mobile-music-sheet-close"
                type="button"
                aria-label="${musicText("Kapat", "Close")}"
              >
                ×
              </button>
            </div>

            <div class="mobile-music-confirm-text">
              ${musicText(
                "Kanal ayırma hazırlanıyor. Sonuçlar hazır olunca bu müzik kartında gösterilecek.",
                "Stem separation is being prepared. Results will appear in this music card when ready."
              )}
            </div>
          `;

          if (itemEl) {
            const subTextEl = itemEl.querySelector(".mobile-library-sub");

            if (subTextEl) {
              subTextEl.textContent = musicText(
                "Kanallar hazırlanıyor",
                "Channels are being prepared"
              );
            }

            itemEl.dataset.stemsStatus = "processing";
            itemEl.dataset.stemsPredictionId = stemsPredictionId;
            itemEl.dataset.stemsRefundRequestId = refundCtx?.request_id || "";
            itemEl.dataset.stemsRefundTransactionId = refundCtx?.related_transaction_id || "";
          }

          if (statusEl) {
            statusEl.textContent = musicText(
              "Kanal ayırma başlatıldı.",
              "Stem separation started."
            );
          }

          if (window.toast?.success) {
            window.toast.success(
              musicText(
                "Kanal ayırma başlatıldı.",
                "Stem separation started."
              )
            );
          }

          pollMobileStemsPrediction(stemsPredictionId);
          return;
        } catch (err) {
          const refunded = await refundMobileMusicCredits(refundCtx, "mobile_music_stems_connection_failed", {
            error: String(err?.message || err || "stems_connection_failed"),
            job_id: stemsJobId
          });

          if (statusEl) {
            statusEl.textContent = refunded
              ? musicText(
                  "Kanal ayırma bağlantı hatası. Kredi iade edildi.",
                  "Stem separation connection error. Credits refunded."
                )
              : musicText(
                  "Kanal ayırma bağlantı hatası.",
                  "Stem separation connection error."
                );
          }

          closeSheet();
          return;
        }
      }
  
    });

    document.body.appendChild(sheet);
    document.body.classList.add("mobile-sheet-open");
  }

  function isMusicEn(){
    return String(window.AIVO_LANG || "")
      .toLowerCase()
      .indexOf("en") === 0;
  }

  function musicText(tr, en){
    return isMusicEn() ? en : tr;
  }

  function safe(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadMiniPlayer(payload){
    const title = String(
      payload.title || musicText(
        "Yeni müzik",
        "New music"
      )
    );

    const sub = String(
      payload.sub || "AIVO"
    );

    const audioUrl = String(payload.audioUrl || "");

    if (!audioUrl) return;

    miniPlayerEl.hidden = false;
    miniTitleEl.textContent = title;
    miniSubEl.textContent = sub;
    miniAudioEl.src = audioUrl;
    miniPlayerEl.dataset.aivoAudioUrl = audioUrl;
miniAudioEl.dataset.aivoAudioUrl = audioUrl;
    miniProgressFill.style.width = "0%";
    miniPlayBtn.textContent = "▶";
    miniPlayBtn.classList.remove("is-playing");

   miniPlayBtn.textContent = "Ⅱ";
miniPlayBtn.classList.add("is-playing");

miniAudioEl.play().then(function(){
  miniPlayBtn.textContent = "Ⅱ";
  miniPlayBtn.classList.add("is-playing");
}).catch(function(){
  miniPlayBtn.textContent = "▶";
  miniPlayBtn.classList.remove("is-playing");

  document.querySelectorAll(".mobile-library-row.is-playing").forEach(function(rowEl){
    rowEl.classList.remove("is-playing");

    const btnEl = rowEl.querySelector(".mobile-library-play");
    if (btnEl) btnEl.textContent = "▶";
  });
});
  }

  miniPlayBtn.addEventListener("click", function(){
    if (!miniAudioEl.src) return;

    if (miniAudioEl.paused) {
      miniAudioEl.play();
      miniPlayBtn.textContent = "Ⅱ";
      miniPlayBtn.classList.add("is-playing");

      const activeAudioUrl = miniAudioEl.dataset.aivoAudioUrl || miniPlayerEl.dataset.aivoAudioUrl || "";

      document.querySelectorAll(".mobile-library-row").forEach(function(rowEl){
        const isActiveRow = rowEl.dataset.aivoAudioUrl === activeAudioUrl;

        rowEl.classList.toggle("is-playing", isActiveRow);

        const btnEl = rowEl.querySelector(".mobile-library-play");
        if (btnEl) btnEl.textContent = isActiveRow ? "Ⅱ" : "▶";
      });
      } else {
      miniAudioEl.pause();
      miniPlayBtn.textContent = "▶";
      miniPlayBtn.classList.remove("is-playing");

      document.querySelectorAll(".mobile-library-row.is-playing").forEach(function(rowEl){
        rowEl.classList.remove("is-playing");

        const btnEl = rowEl.querySelector(".mobile-library-play");
        if (btnEl) btnEl.textContent = "▶";
      });
    }
  });

  miniAudioEl.addEventListener("timeupdate", function(){
    if (!miniAudioEl.duration || !Number.isFinite(miniAudioEl.duration)) return;

    const percent = Math.max(0, Math.min(100, (miniAudioEl.currentTime / miniAudioEl.duration) * 100));
    miniProgressFill.style.width = percent + "%";
  });

  const miniProgressEl = miniPlayerEl.querySelector(".mini-progress");

  if (miniProgressEl) {
    function seekMiniPlayer(e){
      if (!miniAudioEl.duration || !Number.isFinite(miniAudioEl.duration)) return;

      const point = e.touches && e.touches[0] ? e.touches[0] : e;
      const rect = miniProgressEl.getBoundingClientRect();
      const x = point.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));

      miniAudioEl.currentTime = miniAudioEl.duration * percent;
    }

    miniProgressEl.addEventListener("click", seekMiniPlayer);

    miniProgressEl.addEventListener("pointerdown", function(e){
      miniProgressEl.setPointerCapture(e.pointerId);
      seekMiniPlayer(e);

      function onMove(moveEvent){
        seekMiniPlayer(moveEvent);
      }

      function onUp(){
        miniProgressEl.removeEventListener("pointermove", onMove);
        miniProgressEl.removeEventListener("pointerup", onUp);
        miniProgressEl.removeEventListener("pointercancel", onUp);
      }

      miniProgressEl.addEventListener("pointermove", onMove);
      miniProgressEl.addEventListener("pointerup", onUp);
      miniProgressEl.addEventListener("pointercancel", onUp);
    });
  }

  miniAudioEl.addEventListener("ended", function(){
    miniPlayBtn.textContent = "▶";
    miniProgressFill.style.width = "0%";
  });

   async function refreshMobileMusicCredits(){
    try {
      const res = await fetch("/api/credits/get", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "accept": "application/json"
        }
      });

      const data = await res.json().catch(function(){ return null; });
      const nextCredits = data?.credits ?? data?.balance ?? data?.credit;

      if (typeof nextCredits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");
        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(nextCredits);
        }

              const mobileCreditEls = Array.from(document.querySelectorAll("[data-mobile-credit-balance]"));
        mobileCreditEls.forEach(function(el){
          el.textContent = musicText(
            "Kredi " + nextCredits,
            "Credits " + nextCredits
          );
        });

        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(nextCredits);
        }

        try {
          window.syncCreditsUI?.({ force:true });
        } catch (err) {}
      }
    } catch (err) {
      console.warn("[MOBILE MUSIC][CREDIT REFRESH FAILED]", err);
    }
  }

  async function consumeMobileMusicCredits(){
    const amount = 2;
    const action = "studio_music_generate";
    const requestId = "mobile-music:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "music",
        action: action,
        cost: amount,
        request_id: requestId,
        reason: action
      })
    });

    const data = await res.json().catch(function(){ return null; });

    if (!res.ok || !data || data.ok === false) {
      throw new Error("insufficient_credit");
    }

    await refreshMobileMusicCredits();

    return {
      app: "music",
      action: action,
      amount: amount,
      request_id: requestId,
      related_transaction_id: String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      ),
      idempotency_key: String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      )
        ? "mobile-music-refund:" + String(
            data?.transaction_id ||
            data?.transaction?.id ||
            data?.related_transaction_id ||
            data?.credit_transaction_id ||
            ""
          )
        : "",
      refunded: false,
      raw: data
    };
  }
   async function consumeMobileMusicCreditsForStems(){
    const amount = 5;
    const action = "studio_music_stems";
    const requestId = "mobile-music-stems:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "music",
        action: action,
        cost: amount,
        request_id: requestId,
        reason: action
      })
    });

    const data = await res.json().catch(function(){ return null; });

    if (!res.ok || !data || data.ok === false) {
      throw new Error("insufficient_credit");
    }

    await refreshMobileMusicCredits();

    return {
      app: "music",
      action: action,
      amount: amount,
      request_id: requestId,
      related_transaction_id: String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      ),
      idempotency_key: String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      )
        ? "mobile-music-stems-refund:" + String(
            data?.transaction_id ||
            data?.transaction?.id ||
            data?.related_transaction_id ||
            data?.credit_transaction_id ||
            ""
          )
        : "",
      refunded: false,
      raw: data
    };
  }
  async function refundMobileMusicCredits(refundCtx, reason, extraMeta){
    if (!refundCtx || refundCtx.refunded) return false;

    if (!refundCtx.related_transaction_id || refundCtx.amount <= 0) {
      console.warn("[MOBILE MUSIC][REFUND SKIPPED]", {
        reason: reason,
        refundCtx: refundCtx
      });
      return false;
    }

    refundCtx.refunded = true;

    try {
      const res = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: refundCtx.app,
          action: refundCtx.action,
          amount: refundCtx.amount,
          request_id: refundCtx.request_id,
          related_transaction_id: refundCtx.related_transaction_id,
          idempotency_key: refundCtx.idempotency_key,
          reason: reason || "mobile_music_failed",
          meta: {
            source: "mobile.music.js",
            ...(extraMeta || {})
          }
        })
      });

      const data = await res.json().catch(function(){ return null; });

         if (res.ok && data && data.ok) {
        await refreshMobileMusicCredits();

        if (data.refunded && window.toast?.error) {
          window.toast.error(
            musicText(
              "İşlem başarısız oldu, kredi iade edildi.",
              "Process failed, credits refunded."
            )
          );
        }

        return true;
      }

      console.warn("[MOBILE MUSIC][REFUND FAILED]", data);
    } catch (err) {
      console.error("[MOBILE MUSIC][REFUND ERROR]", err);
    }

    return false;
  }

  async function pollMobileMusicJob(jobId, title){
    let tries = 0;

    async function tick(){
      tries += 1;

      try {
        const res = await fetch("/api/music/status?job_id=" + encodeURIComponent(jobId), {
          headers: { "accept": "application/json" },
          cache: "no-store"
        });

        const data = await res.json();

        const outputs = Array.isArray(data && data.outputs)
          ? data.outputs.filter(function(output){
              return output && (output.url || output.audio_url);
            })
          : [];

           if ((data.state === "completed" || data.status === "completed") && outputs.length) {
          statusEl.textContent = "";

          if (window.toast?.success) {
            window.toast.success(
              musicText(
                "Müzik hazır.",
                "Music is ready."
              )
            );
          }

          if (productionsSectionEl) {
            productionsSectionEl.hidden = false;
          }

          resultsEl.hidden = false;
          resultsEl.className = "";

          if (!resultsEl.querySelector(".aivo-player-card")) {
            resultsEl.innerHTML = "";
          }

          resultsEl.querySelectorAll(".aivo-player-card.is-pending").forEach(function(card){
            if (card.dataset.mobilePollJobId === String(jobId || "")) {
              card.remove();
            }
          });
            outputs.forEach(function(output, index){
            const card = document.createElement("div");
            card.className = "aivo-player-card is-ready";
            card.style.marginBottom = index === outputs.length - 1 ? "0" : "6px";
            card.style.alignItems = "center";
            card.style.position = "relative";
           card.style.gridTemplateColumns = "54px minmax(0,1fr) 118px";
           card.style.paddingRight = "12px";
            card.style.minHeight = "78px";
            card.style.padding = "12px";
            card.style.borderRadius = "18px";
            card.style.background = "linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.035))";
            card.style.border = "1px solid rgba(255,255,255,.10)";
            card.style.boxShadow = "none";

            const audioUrl = output.url || output.audio_url || "";
            const cardTitle = index === 0
              ? (title || "Yeni müzik")
              : (title || "Yeni müzik") + " · Versiyon " + (index + 1);
card.innerHTML = `
  <button
    class="mobile-ready-thumb"
    type="button"
    data-action="mobile-play"
    title="${musicText("Oynat", "Play")}"
    aria-label="${musicText("Oynat", "Play")}"
  >
    ♫
  </button>

  <div class="mobile-ready-meta">
    <div class="mobile-ready-title">${safe(cardTitle)}</div>

    <div class="mobile-ready-sub">
      ${musicText(
        "Müzik hazır",
        "Music is ready"
      )}
    </div>

    <audio class="aivo-audio" preload="metadata" src="${safe(audioUrl)}"></audio>
  </div>

  <div class="mobile-ready-actions">
    <a
      class="mobile-ready-action"
      href="#"
      data-action="mobile-download"
      title="${musicText("İndir", "Download")}"
      aria-label="${musicText("İndir", "Download")}"
    >
      ↓
    </a>

    <button
      class="mobile-ready-action"
      type="button"
      data-action="mobile-remove"
      title="${musicText("Sil", "Delete")}"
      aria-label="${musicText("Sil", "Delete")}"
    >
      ×
    </button>
  </div>
`;
const playBtn = card.querySelector('[data-action="mobile-play"]');
const downloadBtn = card.querySelector('[data-action="mobile-download"]');
const deleteBtn = card.querySelector('[data-action="mobile-remove"]');

if (playBtn) {
  playBtn.addEventListener("click", function(){
    loadMiniPlayer({
          title: cardTitle,
      sub: index === 0
        ? musicText(
            "Orijinal",
            "Original"
          )
        : musicText(
            "Versiyon",
            "Version"
          ) + " " + (index + 1),
      audioUrl
    });
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();

    if (!audioUrl) return;

    const filename = (index === 0 ? "aivo-music.mp3" : "aivo-music-version-" + (index + 1) + ".mp3");
    const proxied = "/api/media/proxy?url=" + encodeURIComponent(audioUrl) + "&filename=" + encodeURIComponent(filename);

    const a = document.createElement("a");
    a.href = proxied;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

if (deleteBtn) {
              deleteBtn.addEventListener("click", function(){
                card.remove();

                     if (!resultsEl.querySelector(".aivo-player-card")) {
                  resultsEl.className = "empty-card";
                  resultsEl.innerHTML = musicText(
                    "Henüz mobil müzik üretimi başlatılmadı.",
                    "No mobile music generation has been started yet."
                  );
                  statusEl.textContent = "";
                }
              });
            }

            resultsEl.appendChild(card);
          });

          return;
        }
          } catch (err) {
        const pollingError = musicText(
          "Polling hatası:",
          "Polling error:"
        ) + " " + String(err && err.message ? err.message : err);

        statusEl.textContent = pollingError;

        if (window.toast?.error) {
          window.toast.error(pollingError);
        }

        return;
      }

      if (tries < 40) {
        setTimeout(tick, 3000);
      }
    }

    tick();
  }

  btn.addEventListener("click", async function(){
    const title = (titleEl.value || "").trim();
    const prompt = (promptEl.value || "").trim();
    const mood = (moodEl.value || "").trim();
    const vocal = (vocalEl?.value || "Vokalli").trim();
    const lyrics = (lyricsEl.value || "").trim();

 const blockedTerms = [
  "tarkan",
  "sezen aksu",
  "ajda pekkan",
  "sertab erener",
  "mustafa sandal",
  "kenan dogulu",
  "kenan doğulu",
  "hande yener",
  "demet akalin",
  "demet akalın",
  "gülşen",
  "gulsen",
  "hadise",
  "aleyna tilki",
  "edis",
  "murat boz",
  "simge sagin",
  "simge sağın",
  "sila",
  "sıla",
  "sila gencoglu",
  "sıla gençoglu",
  "özcan deniz",
  "ozcan deniz",
  "ebru gundes",
  "ebru gündeş",
  "özgün",
  "ferhat gocer",
  "ferhat göçer",
  "gokhan turkmen",
  "gökhan türkmen",
  "bengu",
  "bengü",
  "ziynet sali",
  "zeynep bastik",
  "zeynep bastık",
  "mabel matiz",
  "yildiz tilbe",
  "yıldız tilbe",
  "sibel can",
  "linet",
  "duman",
  "mor ve otesi",
  "mor ve ötesi",
  "teoman",
  "oguzhan koc",
  "oğuzhan koç",
  "cem adrian",
  "ceylan ertem",
  "haluk levent",
  "levent yuksel",
  "levent yüksel",
  "baris manco",
  "barış manço",
  "mfö",
  "mfo",
  "athena",
  "manga",
  "sagopa kajmer",
  "ceza",
  "ezhel",
  "ben fero",
  "gazapizm",
  "lvbel c5",
  "uzi",
  "reckol",
  "cakal",
  "çakal",
  "semicenk",
  "canozan",
  "motive",
  "khontkar",
  "norm ender",
  "contra",
  "sansar salvo",
  "selda bagcan",
  "selda bağcan",
  "müslüm gürses",
  "muslum gurses",
  "ibrahim tatlises",
  "ibrahim tatlıses",
  "orhan gencebay",
  "ferdi tayfur",
  "volkan konak",
  "candan ercetin",
  "nazan oncel",
  "nazan öncel",
  "yesim salkim",
  "yeşim salkım",
  "buray",
  "irem derici",
  "melek mosso",
  "koray avci",
  "koray avcı",
  "madrigal",
  "dedubluman",
  "yalin",
  "yalın",
  "emre aydin",
  "emre aydın",
  "sefo",

  "tarzında",
  "stilinde",
  "voice of",
  "in the style of",
  "sesini taklit",
  "birebir",
  "voice clone",
  "clone voice",
  "same voice",
  "aynı ses",
  "aynı vokal",
  "same vocal"
];

const normalizedPrompt = (prompt + " " + lyrics).toLowerCase();

const isPolicyBlocked = blockedTerms.some(function(term){
  return normalizedPrompt.includes(term);
});

if (isPolicyBlocked) {
  statusEl.textContent = musicText(
    "Sanatçı adı, kamu figürü veya taklit ifadesi algılandı.",
    "Artist name, public figure, or imitation request detected."
  );

  if (window.toast?.warning) {
    window.toast.warning(
      musicText(
        "Sanatçı adı, kamu figürü veya taklit ifadesi algılandı.",
        "Artist name, public figure, or imitation request detected."
      )
    );
  }

  return;
}

if (!prompt) {
  statusEl.textContent = musicText(
    "Prompt yazmadan üretim başlatılamaz.",
    "Generation cannot start without a prompt."
  );

  if (window.toast?.warning) {
    window.toast.warning(
      musicText(
        "Prompt yazmadan üretim başlatılamaz.",
        "Generation cannot start without a prompt."
      )
    );
  }

  return;
}

btn.disabled = true;
btn.textContent = musicText(
  "Üretiliyor...",
  "Generating..."
);

statusEl.textContent = musicText(
  "Müzik üretimi başlatılıyor...",
  "Music generation is starting..."
);

if (window.toast?.loading) {
  window.toast.loading(
    musicText(
      "Müzik üretimi başlatılıyor...",
      "Music generation is starting..."
    )
  );
}

    let refundCtx = null;

    try {
      refundCtx = await consumeMobileMusicCredits();

      if (window.toast?.success) {
        window.toast.success(
          musicText(
            "2 kredi düşüldü",
            "2 credits deducted"
          )
        );
      }

      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          title,
          prompt,
          mood,
          lyrics,
          vocal,
          mode: vocal === "Enstrümantal (Vokalsiz)" ? "instrumental" : "vocals"
        })
      });

      const data = await res.json();

      if (!data || data.ok === false) {
        throw new Error(data && data.error ? data.error : "unknown_error");
      }
      const jobId =
        data.internal_job_id ||
        data.db_job_id ||
        data.provider_job_id ||
        data.job_id ||
        musicText(
          "iş oluşturuldu",
          "job created"
        );

      const pollJobId =
        data.provider_job_id ||
        data.internal_job_id ||
        data.db_job_id ||
        data.job_id ||
        jobId;

      statusEl.textContent = musicText(
        "Üretim kuyruğa alındı.",
        "Generation queued."
      );

      if (window.toast?.success) {
        window.toast.success(
          musicText(
            "Üretim kuyruğa alındı.",
            "Generation queued."
          )
        );
      }

      if (productionsSectionEl) {
        productionsSectionEl.hidden = false;
      }

      if (mobileMusicLibraryEl) {
        mobileMusicLibraryEl.hidden = true;
        mobileMusicLibraryEl.style.display = "none";

        const libraryTitleEl = mobileMusicLibraryEl.previousElementSibling;
        if (libraryTitleEl && libraryTitleEl.classList.contains("section-title")) {
          libraryTitleEl.hidden = true;
          libraryTitleEl.style.display = "none";
        }
      }

      resultsEl.hidden = false;
      resultsEl.className = "";

         [
        musicText("Orijinal", "Original"),
        musicText("Versiyon 2", "Version 2")
      ].forEach(function(label, index){

        const baseMusicTitle = title || musicText(
          "Yeni müzik",
          "New music"
        );

        const cardTitle = index === 0
          ? baseMusicTitle
          : baseMusicTitle + " · " + musicText(
              "Versiyon 2",
              "Version 2"
            );

        const card = document.createElement("div");
        card.className = "aivo-player-card is-pending";
        card.dataset.mobilePollJobId = String(pollJobId || "");
        card.style.marginBottom = index === 1 ? "0" : "10px";
        card.style.minHeight = "78px";
        card.style.padding = "12px";
        card.style.opacity = ".96";
        card.style.gridTemplateColumns = "54px minmax(0,1fr)";
        card.style.gap = "12px";
        card.style.borderRadius = "18px";

        card.innerHTML = `
          <div class="aivo-player-left mobile-library-thumb">♪</div>

          <div class="aivo-player-mid">
            <div class="aivo-player-title" style="font-size:14px;line-height:1.15;margin:0 0 5px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safe(cardTitle)}
            </div>
                       <div class="aivo-player-sub" style="font-size:11px;margin:0;color:#c084fc;animation:mobileBlink 1s ease-in-out infinite;text-shadow:0 0 12px rgba(192,132,252,.35);">
              ${musicText(
                "Hazırlanıyor",
                "Preparing"
              )}
            </div>
          </div>

          <div class="aivo-player-actions mobile-pending-actions" aria-hidden="true"></div>
        `;

        resultsEl.appendChild(card);
      });

        pollMobileMusicJob(
        pollJobId,
        title || musicText(
          "Yeni müzik",
          "New music"
        )
      );
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);

        if (msg === "insufficient_credit") {
        statusEl.textContent = musicText(
          "Yetersiz kredi.",
          "Insufficient credits."
        );

        if (window.toast?.warning) {
          window.toast.warning(musicText(
            "Yetersiz kredi",
            "Insufficient credits"
          ));
        }

              location.hash = "#credits";

        const creditsNav =
          document.querySelector('.bottom-nav a[href="#credits"]') ||
          document.querySelector('[data-mobile-nav="credits"]') ||
          document.querySelector('[data-mobile-tab="credits"]');

        if (creditsNav) {
          creditsNav.click();
        }

        return;
      }

      const refunded = await refundMobileMusicCredits(refundCtx, "mobile_music_generate_failed", {
        error: msg
      });

         statusEl.textContent = refunded
        ? musicText(
            "Müzik üretilemedi. Kredi iade edildi.",
            "Music generation failed. Credits refunded."
          )
        : musicText(
            "Müzik üretilemedi:",
            "Music generation failed:"
          ) + " " + msg;

      if (!refunded && window.toast?.error) {
        window.toast.error(
          musicText(
            "Müzik üretilemedi.",
            "Music generation failed."
          )
        );
      }
    } finally {
      btn.disabled = false;

      btn.textContent = musicText(
        "Müzik Üret",
        "Generate Music"
      );
    }
  });
})();
