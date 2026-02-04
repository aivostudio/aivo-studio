// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] FINAL script loaded");

(function () {
  if (window.__MUSIC_GENERATE_WIRED__) return;
  window.__MUSIC_GENERATE_WIRED__ = true;

  function findBtn() {
    return (
      document.getElementById("musicGenerateBtnn") ||
      document.getElementById("musicGenerateBtn") ||
      document.querySelector('button[data-generate="music"]')
    );
  }

  function getHost() {
    return document.getElementById("rightPanelHost");
  }

  function getTemplateCard() {
    // Sayfadaki GERÇEK çalışan player kartı (tam DOM)
    return document.querySelector(".aivo-player-card");
  }

  function ensureList(host) {
    // Sağ panelde player.css’in hedeflediği liste
    let list = host.querySelector(".aivo-player-list");
    if (!list) {
      list = document.createElement("div");
      list.className = "aivo-player-list";
      // player.css zaten var; sadece güvenli layout
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "10px";
      list.style.padding = "10px";
      host.prepend(list);
    }
    return list;
  }

  function setTextFirst(el, selectors, text) {
    for (const sel of selectors) {
      const t = el.querySelector(sel);
      if (t) {
        t.textContent = text;
        return true;
      }
    }
    return false;
  }

  function sanitizeToProcessing(card, { label, jobId, suffix }) {
    const jid = jobId ? `${jobId}:${suffix}` : `pending:${suffix}:${Date.now()}`;

    // data attr’lar
    card.setAttribute("data-job-id", jid);
    card.setAttribute("data-output-id", jid);
    card.setAttribute("data-title", label);
    card.setAttribute("data-src", ""); // hazır olunca status poll bağlayacağız
    card.classList.add("is-processing");

    // Play butonu disable
    const playBtn = card.querySelector('[data-action="toggle-play"], .aivo-player-btn');
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.style.opacity = "0.55";
      playBtn.title = "İşleniyor";
      playBtn.setAttribute("aria-label", "İşleniyor");
    }

    // Diğer aksiyonları kapat (indir/sil/yenile/düzenle/paylaş vs)
    card.querySelectorAll("button, a").forEach((el) => {
      const act = el.getAttribute("data-action") || "";
      if (act && act !== "toggle-play") el.style.display = "none";
    });

    // Başlık/alt başlık alanlarını olabildiğince güvenli güncelle
    // (Sınıf isimleri değişse bile ilk strong/h* yakalama şansı yüksek)
    const titleSelectors = [
      ".aivo-player-title",
      ".aivo-player-name",
      ".aivo-player-meta .title",
      ".aivo-player-meta strong",
      "strong",
      "h4",
      "h3",
    ];
    const subSelectors = [
      ".aivo-player-subtitle",
      ".aivo-player-desc",
      ".aivo-player-meta small",
      "small",
      ".subtitle",
    ];

    setTextFirst(card, titleSelectors, label);
    setTextFirst(card, subSelectors, "Hazırlanıyor…");

    // Badge’leri “İşleniyor” yap (varsa)
    // Çok agresif olmadan: içinde “Hazır” geçen rozetleri değiştir
    card.querySelectorAll("*").forEach((node) => {
      if (!node || !node.textContent) return;
      const txt = node.textContent.trim();
      if (txt === "Hazır") node.textContent = "İşleniyor";
    });

    // Süre/tarih gibi meta varsa temizle (varsa)
    card.querySelectorAll("*").forEach((node) => {
      const t = (node.textContent || "").trim();
      if (!t) return;
      // 1:40, 04.02.2026 gibi şeyleri temizlemeye çalış
      if (/^\d{1,2}:\d{2}$/.test(t) || /^\d{2}\.\d{2}\.\d{4}/.test(t)) {
        node.textContent = "";
      }
    });

    // Progress bar sıfırla (varsa)
    const bars = card.querySelectorAll("progress, [role='progressbar'], .aivo-progress, .progress, .bar");
    bars.forEach((b) => {
      try {
        if (b.tagName === "PROGRESS") {
          b.value = 0;
          b.max = 1;
        } else {
          b.style.width = "0%";
        }
      } catch (_) {}
    });

    return jid;
  }

  function addProcessingPair(jobId = null) {
    const host = getHost();
    if (!host) {
      console.error("[music-generate] #rightPanelHost yok");
      return null;
    }

    const tpl = getTemplateCard();
    if (!tpl) {
      console.error("[music-generate] template .aivo-player-card bulunamadı (sayfada en az 1 hazır kart olmalı)");
      return null;
    }

    const list = ensureList(host);

    // container: her tıkta üst üste çift
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";

    const v1 = tpl.cloneNode(true);
    const v2 = tpl.cloneNode(true);

    const jid1 = sanitizeToProcessing(v1, { label: "Original (v1) • Processing", jobId, suffix: "v1" });
    const jid2 = sanitizeToProcessing(v2, { label: "Revize (v2) • Processing", jobId, suffix: "v2" });

    wrap.appendChild(v1);
    wrap.appendChild(v2);
    list.prepend(wrap);

    console.log("[music-generate] injected real-ui processing pair", { jid1, jid2 });
    return { wrap, v1, v2 };
  }

  function updatePairJob(pair, jobId) {
    try {
      sanitizeToProcessing(pair.v1, { label: "Original (v1) • Processing", jobId, suffix: "v1" });
      sanitizeToProcessing(pair.v2, { label: "Revize (v2) • Processing", jobId, suffix: "v2" });
    } catch (_) {}
  }

  function wire() {
    const btn = findBtn();
    if (!btn) {
      console.warn("[music-generate] button not found, retrying…");
      setTimeout(wire, 500);
      return;
    }

    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";

    console.log("[music-generate] wired", btn);

    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (btn.dataset.busy === "1") {
          console.warn("[music-generate] busy, ignore click");
          return;
        }
        btn.dataset.busy = "1";
        btn.disabled = true;

        console.log("[music-generate] clicked");

        // ✅ anında UI (gerçek player görünümünde, ama “processing”)
        const pair = addProcessingPair(null);

        try {
          const r = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "music" }),
          });

          const j = await r.json().catch(() => null);
          console.log("[music-generate] response", j);

          const jobId = j?.job_id || j?.jobId || j?.id;
          if (!jobId) {
            console.error("[music-generate] job_id yok", j);
            return;
          }

          window.AIVO_JOBS?.upsert?.({
            job_id: jobId,
            type: "music",
            created_at: Date.now(),
          });

          if (pair) updatePairJob(pair, jobId);
        } catch (err) {
          console.error("[music-generate] error", err);
        } finally {
          btn.dataset.busy = "0";
          btn.disabled = false;
        }
      },
      true
    );
  }

  wire();
})();
