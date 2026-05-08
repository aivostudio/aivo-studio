(function(){
  const btn = document.getElementById("mobileMusicGenerateBtn");
  const titleEl = document.getElementById("musicTitle");
  const promptEl = document.getElementById("musicPrompt");
  const moodEl = document.getElementById("musicMood");
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

          <button class="mobile-library-play" type="button">
            ${isReady ? "▶" : "…"}
          </button>
        `;

        const subEl = item.querySelector(".mobile-library-sub");
        const playEl = item.querySelector(".mobile-library-play");

        function activateLibraryRow(nextAudioUrl){
          resolvedAudioUrl = String(nextAudioUrl || "");
          isReady = !!resolvedAudioUrl;

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
    miniProgressFill.style.width = "0%";
    miniPlayBtn.textContent = "▶";
    miniPlayBtn.classList.remove("is-playing");

    miniAudioEl.play().then(function(){
      miniPlayBtn.textContent = "Ⅱ";
      miniPlayBtn.classList.add("is-playing");
    }).catch(function(){
      miniPlayBtn.textContent = "▶";
      miniPlayBtn.classList.remove("is-playing");
    });
  }

  miniPlayBtn.addEventListener("click", function(){
    if (!miniAudioEl.src) return;

    if (miniAudioEl.paused) {
      miniAudioEl.play();
      miniPlayBtn.textContent = "Ⅱ";
      miniPlayBtn.classList.add("is-playing");

      document.querySelectorAll(".mobile-library-row.is-playing").forEach(function(rowEl){
        const btnEl = rowEl.querySelector(".mobile-library-play");
        if (btnEl) btnEl.textContent = "Ⅱ";
      });
    } else {
      miniAudioEl.pause();
      miniPlayBtn.textContent = "▶";
      miniPlayBtn.classList.remove("is-playing");

      document.querySelectorAll(".mobile-library-row.is-playing").forEach(function(rowEl){
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

          resultsEl.hidden = false;
          resultsEl.className = "";
          resultsEl.innerHTML = "";

          outputs.forEach(function(output, index){
            const card = document.createElement("div");
            card.className = "aivo-player-card is-ready";
            card.style.marginBottom = index === outputs.length - 1 ? "0" : "6px";
            card.style.padding = "8px 0";
            card.style.minHeight = "58px";
            card.style.alignItems = "center";
            card.style.position = "relative";
            card.style.gridTemplateColumns = "46px minmax(0,1fr)";
            card.style.paddingRight = "78px";
            card.style.borderRadius = "18px";
            card.style.background = "linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.035))";
            card.style.border = "1px solid rgba(255,255,255,.10)";
            card.style.boxShadow = "none";

            const audioUrl = output.url || output.audio_url || "";
            const cardTitle = index === 0
              ? (title || "Yeni müzik")
              : (title || "Yeni müzik") + " · Versiyon " + (index + 1);

           card.innerHTML = `
  <div class="aivo-player-left">
    <button class="aivo-action mobile-player-icon-btn mobile-player-play-btn" type="button" data-action="mobile-play" title="Oynat" aria-label="Oynat"></button>
  </div>

  <div class="aivo-player-mid">
    <div class="aivo-player-titleRow">
      <div class="aivo-player-title" style="font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(cardTitle)}</div>
    </div>
    <div class="aivo-player-sub" style="font-size:11px;margin-top:2px;">Müzik hazır</div>
    <audio class="aivo-audio" preload="metadata" src="${safe(audioUrl)}"></audio>
  </div>

  <div class="aivo-player-actions mobile-player-actions">
    <a class="aivo-action mobile-player-icon-btn mobile-player-download-btn" href="${safe(audioUrl)}" download title="İndir" aria-label="İndir"></a>
    <button class="aivo-action mobile-player-icon-btn mobile-player-delete-btn" type="button" data-action="mobile-remove" title="Sil" aria-label="Sil"></button>
  </div>
`;

            const playBtn = card.querySelector('[data-action="mobile-play"]');
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

      resultsEl.hidden = false;
      resultsEl.className = "";
      resultsEl.innerHTML = "";

      ["Orijinal", "Versiyon 2"].forEach(function(label, index){
        const cardTitle = index === 0
          ? (title || "Yeni müzik")
          : (title || "Yeni müzik") + " · Versiyon 2";

        const card = document.createElement("div");
        card.className = "aivo-player-card is-ready";
        card.style.marginBottom = index === 1 ? "0" : "10px";
        card.style.padding = "10px 12px";
        card.style.minHeight = "68px";
        card.style.opacity = ".9";

        card.innerHTML = `
          <div class="aivo-player-left" style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#8b5cf6,#ec4899);">
            <div class="aivo-player-spinner" style="width:17px;height:17px;border-width:3px;"></div>
          </div>

          <div class="aivo-player-mid">
            <div class="aivo-player-title" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safe(cardTitle)}
            </div>
            <div class="aivo-player-sub" style="font-size:11px;margin-top:4px;color:#c084fc;animation:mobileBlink 1s ease-in-out infinite;text-shadow:0 0 12px rgba(192,132,252,.35);">
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
