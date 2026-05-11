(function(){
  const btn = document.getElementById("mobileMusicGenerateBtn");
  const titleEl = document.getElementById("musicTitle");
  const promptEl = document.getElementById("musicPrompt");
const moodEl = document.getElementById("mobileMusicMood") || document.getElementById("musicMood");
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
        Kütüphane yükleniyor...
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
            Henüz müzik bulunamadı.
          </div>
        `;
        return;
      }

      mobileMusicLibraryEl.innerHTML = "";

      rows.reverse().forEach(function(row){
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

        item.innerHTML = `
          <div class="mobile-library-thumb">♪</div>

          <div class="mobile-library-meta">
            <div class="mobile-library-title">
              ${safe(title)}
            </div>

            <div class="mobile-library-sub">
              ${isReady ? "Hazır" : "Hazırlanıyor"}
            </div>
          </div>

                  <div class="mobile-library-actions">
            <button class="mobile-library-play" type="button">
              ${isReady ? "▶" : "…"}
            </button>

         <button class="mobile-library-play mobile-library-download" type="button" title="İndir" aria-label="İndir">
         ↓
         </button>

         <button class="mobile-library-play mobile-library-delete" type="button" title="Sil" aria-label="Sil">
         ×
        </button>

        <button class="mobile-library-play mobile-library-lyrics mobile-action-lyrics" type="button" title="Şarkı Sözleri" aria-label="Şarkı Sözleri">
         lyrics
        </button>

        <button class="mobile-library-play mobile-library-more" type="button" title="Diğer işlemler" aria-label="Diğer işlemler">
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
      audioUrl: resolvedAudioUrl
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
    document.body.appendChild(a);
    a.click();
    a.remove();
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

          if (subEl) subEl.textContent = isReady ? "Hazır" : "Hazırlanıyor";
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
            const firstAudio = statusOutputs.find(function(output){
              return output && (
                output.url ||
                output.audio_url ||
                output.archive_url ||
                output.raw_url ||
                output.src
              );
            });

            const nextAudioUrl =
              data?.audio?.src ||
              data?.audio?.url ||
              firstAudio?.url ||
              firstAudio?.audio_url ||
              firstAudio?.archive_url ||
              firstAudio?.raw_url ||
              firstAudio?.src ||
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
          Kütüphane yüklenemedi.
        </div>
      `;
    }
  }
    function openMusicMoreSheet(payload){
    const oldSheet = document.getElementById("mobileMusicMoreSheet");
    if (oldSheet) oldSheet.remove();

    const title = String(payload?.title || "Yeni müzik");
     const audioUrl = String(payload?.audioUrl || "");

    const sheet = document.createElement("div");
    sheet.id = "mobileMusicMoreSheet";
    sheet.className = "mobile-music-sheet-backdrop";

    sheet.innerHTML = `
      <div class="mobile-music-sheet" role="dialog" aria-modal="true">
        <div class="mobile-music-sheet-handle"></div>

        <div class="mobile-music-sheet-head">
          <div>
            <div class="mobile-music-sheet-kicker">Diğer işlemler</div>
            <div class="mobile-music-sheet-title">${safe(title)}</div>
          </div>

          <button class="mobile-music-sheet-close" type="button" aria-label="Kapat">
            ×
          </button>
        </div>

        <button class="mobile-music-sheet-action mobile-action-stems" type="button" data-mobile-sheet-action="stems">
          <span>
            <strong>Kanal Ayırma</strong>
            <small>Bu işlem 5 kredi kullanır</small>
          </span>
        </button>
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
              prediction_id: predictionId
            })
          });

          const data = await res.json();

          const status = String(data.status || "").toLowerCase();

          if (status === "succeeded") {
            sheet.querySelector(".mobile-music-sheet").innerHTML = `
              <div class="mobile-music-sheet-handle"></div>

              <div class="mobile-music-sheet-head">
                <div>
                  <div class="mobile-music-sheet-kicker">Kanal Ayırma</div>
                  <div class="mobile-music-sheet-title">Kanallar hazır</div>
                </div>

                <button class="mobile-music-sheet-close" type="button" aria-label="Kapat">
                  ×
                </button>
              </div>

              <div class="mobile-music-confirm-text">
                Kanal ayırma tamamlandı. Bir sonraki adımda bu dosyaları kart içine indirebilir hale getireceğiz.
              </div>
            `;

            if (statusEl) {
              statusEl.textContent = "Kanal ayırma tamamlandı.";
            }

            return;
          }

          if (status === "failed" || status === "canceled" || status === "cancelled") {
            sheet.querySelector(".mobile-music-sheet").innerHTML = `
              <div class="mobile-music-sheet-handle"></div>

              <div class="mobile-music-sheet-head">
                <div>
                  <div class="mobile-music-sheet-kicker">Kanal Ayırma</div>
                  <div class="mobile-music-sheet-title">İşlem başarısız</div>
                </div>

                <button class="mobile-music-sheet-close" type="button" aria-label="Kapat">
                  ×
                </button>
              </div>

              <div class="mobile-music-confirm-text">
                Kanal ayırma tamamlanamadı. Lütfen tekrar dene.
              </div>
            `;

            if (statusEl) {
              statusEl.textContent = "Kanal ayırma başarısız.";
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
        closeSheet();
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
              <div class="mobile-music-sheet-kicker">Kanal Ayırma</div>
              <div class="mobile-music-sheet-title">5 kredi kullanılacak</div>
            </div>

            <button class="mobile-music-sheet-close" type="button" aria-label="Kapat">
              ×
            </button>
          </div>

          <div class="mobile-music-confirm-text">
            Bu işlem başlamadan önce 5 kredi kullanır. Devam edilsin mi?
          </div>

          <div class="mobile-music-confirm-actions">
            <button class="mobile-music-confirm-cancel" type="button" data-mobile-sheet-action="cancel">
              İptal
            </button>

            <button class="mobile-music-confirm-submit" type="button" data-mobile-sheet-action="confirm-stems">
              Onayla (5 Kredi)
            </button>
          </div>
        `;
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
          if (statusEl) statusEl.textContent = "Kanal ayırma için ses dosyası bulunamadı.";
          closeSheet();
          return;
        }

        confirmStemsBtn.disabled = true;
        confirmStemsBtn.textContent = "Başlatılıyor...";

        try {
          const res = await fetch("/api/music/stems", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json"
            },
            body: JSON.stringify({
              audio_url: audioUrl
            })
          });

               const data = await res.json();
          const stemsPredictionId = String(data.id || data.prediction_id || "");

          if (!res.ok || !data || data.ok === false) {
            if (statusEl) {
              statusEl.textContent = "Kanal ayırma başlatılamadı.";
            }
            closeSheet();
            return;
          }

                  sheet.querySelector(".mobile-music-sheet").innerHTML = `
            <div class="mobile-music-sheet-handle"></div>

            <div class="mobile-music-sheet-head">
              <div>
                <div class="mobile-music-sheet-kicker">Kanal Ayırma</div>
                <div class="mobile-music-sheet-title">İşlem başlatıldı</div>
              </div>

              <button class="mobile-music-sheet-close" type="button" aria-label="Kapat">
                ×
              </button>
            </div>

            <div class="mobile-music-confirm-text">
              Kanal ayırma hazırlanıyor. Sonuçlar hazır olunca bu müzik kartında gösterilecek.
            </div>
          `;

                  if (statusEl) {
            statusEl.textContent = "Kanal ayırma başlatıldı.";
          }

          pollMobileStemsPrediction(stemsPredictionId);
          return;

          return;
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = "Kanal ayırma bağlantı hatası.";
          }

          closeSheet();
          return;
        }
      }
    });

    document.body.appendChild(sheet);
    document.body.classList.add("mobile-sheet-open");
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
    const title = String(payload.title || "Yeni müzik");
    const sub = String(payload.sub || "AIVO");
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
          statusEl.textContent = "Müzik hazır, player kartlara çevriliyor...";

             if (productionsSectionEl) {
        productionsSectionEl.hidden = false;
      }

      resultsEl.hidden = false;
      resultsEl.className = "";
      resultsEl.innerHTML = "";

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
  <button class="mobile-ready-thumb" type="button" data-action="mobile-play" title="Oynat" aria-label="Oynat">
    ♫
  </button>

  <div class="mobile-ready-meta">
    <div class="mobile-ready-title">${safe(cardTitle)}</div>
    <div class="mobile-ready-sub">Müzik hazır</div>
    <audio class="aivo-audio" preload="metadata" src="${safe(audioUrl)}"></audio>
  </div>

  <div class="mobile-ready-actions">
  <a class="mobile-ready-action" href="#" data-action="mobile-download" title="İndir" aria-label="İndir">
      ↓
    </a>
    <button class="mobile-ready-action" type="button" data-action="mobile-remove" title="Sil" aria-label="Sil">
      ×
    </button>
  </div>
`;const playBtn = card.querySelector('[data-action="mobile-play"]');
const downloadBtn = card.querySelector('[data-action="mobile-download"]');
const deleteBtn = card.querySelector('[data-action="mobile-remove"]');

if (playBtn) {
  playBtn.addEventListener("click", function(){
    loadMiniPlayer({
      title: cardTitle,
      sub: index === 0 ? "Orijinal" : "Versiyon " + (index + 1),
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
                  resultsEl.innerHTML = "Henüz mobil müzik üretimi başlatılmadı.";
                  statusEl.textContent = "";
                }
              });
            }

            resultsEl.appendChild(card);
          });

          return;
        }
      } catch (err) {
        statusEl.textContent = "Polling hatası: " + String(err && err.message ? err.message : err);
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
    const lyrics = (lyricsEl.value || "").trim();

    if (!prompt) {
      statusEl.textContent = "Prompt yazmadan üretim başlatılamaz.";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Üretiliyor...";
    statusEl.textContent = "Müzik üretimi başlatılıyor...";

    try {
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
          vocal: "Vokalli",
          mode: "vocals"
        })
      });

      const data = await res.json();

      if (!data || data.ok === false) {
        statusEl.textContent = "Üretim başlatılamadı: " + (data && data.error ? data.error : "unknown_error");
        return;
      }

      const jobId = data.internal_job_id || data.db_job_id || data.provider_job_id || data.job_id || "job oluşturuldu";
      const pollJobId = data.provider_job_id || data.internal_job_id || data.db_job_id || data.job_id || jobId;

           statusEl.textContent = "Üretim kuyruğa alındı.";

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
      resultsEl.innerHTML = "";
      ["Orijinal", "Versiyon 2"].forEach(function(label, index){
        const cardTitle = index === 0
          ? (title || "Yeni müzik")
          : (title || "Yeni müzik") + " · Versiyon 2";

        const card = document.createElement("div");
        card.className = "aivo-player-card is-pending";
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
              Hazırlanıyor
            </div>
          </div>

          <div class="aivo-player-actions mobile-pending-actions" aria-hidden="true"></div>
        `;

        resultsEl.appendChild(card);
      });

      pollMobileMusicJob(pollJobId, title || "Yeni müzik");
    } catch (err) {
      statusEl.textContent = "Bağlantı hatası: " + String(err && err.message ? err.message : err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Müzik Üret";
    }
  });
})();
