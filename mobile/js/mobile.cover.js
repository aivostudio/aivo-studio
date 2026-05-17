(function(){
  const root = document.getElementById("mobileCoverSection");
  if (!root || root.__mobileCoverBound) return;
  root.__mobileCoverBound = true;

  const promptEl = root.querySelector("#coverPrompt");
  const countEl = root.querySelector("#coverPromptCount");
  const qualityBtns = Array.from(root.querySelectorAll(".mobile-quality-pill"));
  const styleBtns = Array.from(root.querySelectorAll(".mobile-style-card"));
  const countSelect = root.querySelector("#coverCount");
  const ratioSelect = root.querySelector("#coverRatio");
  const creditEl = root.querySelector("#coverRequiredCredit");
  const generateBtn = root.querySelector("#coverGenerateBtn");
  const statusEl = root.querySelector("#mobileCoverStatus");
  const resultsEl = root.querySelector("#mobileCoverResults");

  if (!promptEl || !generateBtn || !statusEl || !resultsEl) return;

  let selectedQuality = "artist";
  let selectedCredit = 6;
  let selectedStyle = "";

  function safe(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function postJSON(url, payload){
    return fetch(url, {
      method:"POST",
      credentials:"include",
      headers:{
        "content-type":"application/json",
        "accept":"application/json"
      },
      body:JSON.stringify(payload)
    }).then(async function(res){
      const data = await res.json().catch(function(){ return null; });

      if (!res.ok || !data || data.ok === false) {
        throw new Error(data && data.error ? data.error : "request_failed");
      }

      return data;
    });
  }

  function updatePromptCount(){
    if (!countEl) return;
    countEl.textContent = String((promptEl.value || "").length) + " / 1000";
  }

  function coverText(key, fallback){
    if (typeof window.t === "function") {
      const value = window.t(key);
      if (value && value !== key) return value;
    }

    return fallback;
  }

  function coverGenerateText(){
    if (window.AIVO_LANG === "en") {
      return "🖼️ Generate Cover (" + selectedCredit + " Credits)";
    }

    return "🖼️ Kapak Üret (" + selectedCredit + " Kredi)";
  }

  function getCoverStylePrompt(btn){
    const key = String(
      btn?.querySelector("[data-i18n]")?.getAttribute("data-i18n") || ""
    ).trim();

    if (window.AIVO_LANG === "en") {
      if (key === "cover.styleRealistic") {
        return "Spotify album cover, realistic portrait, studio lighting, premium, sharp detail, 1:1";
      }

      if (key === "cover.styleArtistic") {
        return "Artistic album cover, oil paint texture, dramatic lighting, deep colors, 1:1";
      }

      if (key === "cover.styleCartoon") {
        return "Cartoon album cover, vibrant colors, bold outline, fun character style, 1:1";
      }

      if (key === "cover.styleAbstract") {
        return "Abstract album cover, geometric shapes, soft gradients, modern design, 1:1";
      }

      if (key === "cover.stylePhoto") {
        return "Photographic album cover, cinematic lighting, depth of field, premium photography aesthetic, 1:1";
      }

      if (key === "cover.styleAnime") {
        return "Anime album cover, Japanese manga style, soft lighting, clean lines, 1:1";
      }
    }

    return String(btn && btn.getAttribute("data-prompt") || "").trim();
  }

  function setQuality(btn){
    const q = String(btn.getAttribute("data-quality") || "artist");
    const credit = Number(btn.getAttribute("data-credit-cost") || (q === "ultra" ? 9 : 6));

    selectedQuality = q === "ultra" ? "ultra" : "artist";
    selectedCredit = credit || (selectedQuality === "ultra" ? 9 : 6);

    qualityBtns.forEach(function(item){
      const on = item === btn;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (creditEl) creditEl.textContent = String(selectedCredit);

    generateBtn.setAttribute("data-credit-cost", String(selectedCredit));
    generateBtn.textContent = coverGenerateText();

    if (selectedQuality === "ultra") {
      promptEl.value = "";
      promptEl.placeholder = coverText(
        "cover.ultraPlaceholder",
        window.AIVO_LANG === "en"
          ? "Write the scene yourself for Cinematic mode. E.g. a lonely character walking through a night city, neon lights, cinematic atmosphere"
          : "Cinematic mod için sahneyi kendin yaz. Örn: gece şehirde yalnız yürüyen karakter, neon ışıklar, sinematik atmosfer"
      );
      updatePromptCount();
      return;
    }

    const activeStyleBtn = styleBtns.find(function(item){
      return item.classList.contains("is-active");
    });

    const stylePrompt = activeStyleBtn ? getCoverStylePrompt(activeStyleBtn) : "";

    if (stylePrompt) {
      promptEl.value = stylePrompt;
      promptEl.placeholder = "";
      updatePromptCount();
    }
  }

  function setStyle(btn){
    selectedStyle = String(btn.getAttribute("data-style") || "");

    styleBtns.forEach(function(item){
      const on = item === btn;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const stylePrompt = getCoverStylePrompt(btn);

    if (stylePrompt) {
      promptEl.value = stylePrompt;
      updatePromptCount();
    }
  }


  function withCoverPrompt(raw, quality){
    const base = String(raw || "").trim();

    const guard = [
      base,
      "premium music cover artwork",
      "spotify and apple music quality album cover",
      "clean balanced composition",
      "strong focal subject",
      "cinematic lighting",
      "premium color grading",
      "minimal clutter",
      "no text",
      "no typography",
      "no letters",
      "no words",
      "no logo",
      "no watermark"
    ].join(", ");

    if (quality !== "ultra") return guard;

    return [
      "Kullanıcı isteğine sadık kal:",
      base,
      "Ana özneyi doğru koru.",
      "Alakasız insan yüzü, portre, kadın, erkek veya manzara ekleme.",
      "Temiz, güçlü, premium cover kompozisyonu üret.",
      "Yazı, harf, logo, watermark, tipografi olmasın.",
      guard
    ].join(" ");
  }

  async function generateOneCover(prompt, ratio, quality, index){
    const promptForModel = withCoverPrompt(
      index > 0 ? prompt + " #" + (index + 1) : prompt,
      quality
    );

    const falData = await postJSON("/api/providers/fal/predictions/create?app=cover", {
      input:{
        prompt: promptForModel,
        quality,
        ratio
      }
    });

    const imageUrl =
      falData.output ||
      falData.imageUrl ||
      falData.image_url ||
      falData.url ||
      falData.fal?.images?.[0]?.url ||
      "";

    if (!imageUrl) {
      throw new Error("cover_generate_no_image");
    }

    const dbData = await postJSON("/api/cover/generate", {
      prompt,
      style: selectedStyle || null,
      quality,
      ratio,
      imageUrl
    });

    return {
      imageUrl,
      jobId: dbData.job_id || "",
      prompt,
      quality,
      ratio
    };
  }

  function renderLoadingCards(count){
    resultsEl.className = "";
    resultsEl.innerHTML = "";

    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("div");
      card.className = "mobile-cover-result-card";
      card.innerHTML = `
        <div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(236,72,153,.14));">
          <div style="width:28px;height:28px;border-radius:999px;border:3px solid rgba(255,255,255,.32);border-top-color:#fff;animation:aivoSpin .85s linear infinite;"></div>
        </div>
        <div class="mobile-cover-result-meta">
          <span>${window.AIVO_LANG === "en" ? "Preparing" : "Hazırlanıyor"}</span>
          <span>${i === 0 ? (window.AIVO_LANG === "en" ? "Original" : "Orijinal") : (window.AIVO_LANG === "en" ? "Version " : "Versiyon ") + (i + 1)}</span>
        </div>
      `;
      resultsEl.appendChild(card);
    }
  }
  function renderCoverCard(payload, index){
    const card = document.createElement("div");
    card.className = "mobile-cover-result-card";

    const imageUrl = String(payload.imageUrl || "");
    const jobId = String(payload.jobId || "");

    card.innerHTML = `
      <div class="mobile-cover-thumb-wrap">
        <img src="${safe(imageUrl)}" alt="${window.AIVO_LANG === "en" ? "AIVO cover image" : "AIVO kapak görseli"}">

        <div class="mobile-cover-badge">${window.AIVO_LANG === "en" ? "Ready" : "Hazır"}</div>

        <div class="mobile-cover-overlay">
          <div class="mobile-cover-overlay-actions">
            <button class="mobile-cover-overlay-btn" type="button" data-action="open-cover" data-mobile-cover-act="fullscreen" title="${window.AIVO_LANG === "en" ? "View" : "Görüntüle"}">👁</button>
            <button class="mobile-cover-overlay-btn" type="button" data-action="download-cover" data-mobile-cover-act="download" title="${window.AIVO_LANG === "en" ? "Download" : "İndir"}">↓</button>
            <button class="mobile-cover-overlay-btn" type="button" data-action="share-cover" data-mobile-cover-act="share" title="${window.AIVO_LANG === "en" ? "Share" : "Paylaş"}">↗</button>
            <button class="mobile-cover-overlay-btn is-danger" type="button" data-action="delete-cover" data-mobile-cover-act="delete" title="${window.AIVO_LANG === "en" ? "Delete" : "Sil"}">🗑</button>
          </div>
        </div>
      </div>

      <div class="mobile-cover-result-meta">
        <span>${index === 0 ? (window.AIVO_LANG === "en" ? "Cover is ready" : "Kapak hazır") : (window.AIVO_LANG === "en" ? "Version " : "Versiyon ") + (index + 1)}</span>
      </div>
    `;

    const openBtn = card.querySelector('[data-action="open-cover"]');
    const downloadBtn = card.querySelector('[data-action="download-cover"]');
    const shareBtn = card.querySelector('[data-action="share-cover"]');
    const deleteBtn = card.querySelector('[data-action="delete-cover"]');

      if (openBtn) {
      openBtn.addEventListener("click", function(){
        if (!imageUrl) return;

        const oldViewer = document.querySelector("[data-mobile-cover-viewer]");
        if (oldViewer) oldViewer.remove();

        const viewer = document.createElement("div");
        viewer.setAttribute("data-mobile-cover-viewer", "true");
        viewer.style.cssText = [
          "position:fixed",
          "inset:0",
          "z-index:99999",
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "padding:18px",
          "background:rgba(3,5,14,.92)",
          "backdrop-filter:blur(18px)",
          "-webkit-backdrop-filter:blur(18px)"
        ].join(";");

            viewer.innerHTML = `
          <button type="button" aria-label="${window.AIVO_LANG === "en" ? "Close" : "Kapat"}" style="
            position:absolute;
            right:18px;
            top:calc(18px + env(safe-area-inset-top));
            width:46px;
            height:46px;
            border-radius:999px;
            border:1px solid rgba(255,255,255,.18);
            background:rgba(255,255,255,.10);
            color:#fff;
            font-size:28px;
            font-weight:900;
            line-height:1;
          ">×</button>

          <img src="${safe(imageUrl)}" alt="${window.AIVO_LANG === "en" ? "AIVO cover image" : "AIVO kapak görseli"}" style="
            width:100%;
            max-width:430px;
            max-height:82vh;
            object-fit:contain;
            border-radius:24px;
            box-shadow:0 24px 80px rgba(0,0,0,.48);
          ">
        `;

        viewer.addEventListener("click", function(ev){
          if (ev.target === viewer || ev.target.tagName === "BUTTON") {
            viewer.remove();
          }
        });

        document.body.appendChild(viewer);
      });
    }

     if (downloadBtn) {
      downloadBtn.addEventListener("click", function(){
        if (!imageUrl) return;

        const proxied =
          "/api/media/proxy?url=" +
          encodeURIComponent(imageUrl) +
          "&filename=" +
          encodeURIComponent("aivo-kapak.jpg");

        const a = document.createElement("a");
        a.href = proxied;
        a.download = "aivo-kapak.jpg";
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

     if (shareBtn) {
      shareBtn.addEventListener("click", async function(){
        if (!imageUrl) return;

        if (navigator.share) {
          try {
            await navigator.share({ url:imageUrl });
          } catch (err) {}
          return;
        }

        try {
          await navigator.clipboard.writeText(imageUrl);
          statusEl.textContent = window.AIVO_LANG === "en"
            ? "Cover link copied."
            : "Kapak linki kopyalandı.";
        } catch (err) {
          statusEl.textContent = window.AIVO_LANG === "en"
            ? "Sharing is not supported."
            : "Paylaşım desteklenmiyor.";
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", async function(){
        if (jobId) {
          try {
            await fetch("/api/jobs/delete", {
              method:"POST",
              credentials:"include",
              headers:{
                "content-type":"application/json",
                "accept":"application/json"
              },
              body:JSON.stringify({ job_id:jobId })
            });
          } catch (err) {}
        }

             card.remove();

        if (window.toast?.success) {
          window.toast.success(
            window.AIVO_LANG === "en"
              ? "Cover deleted."
              : "Kapak silindi."
          );
        }

        if (!resultsEl.querySelector(".mobile-cover-result-card")) {
          resultsEl.className = "empty-card";
          resultsEl.innerHTML = window.AIVO_LANG === "en"
            ? "No mobile cover generation has been started yet."
            : "Henüz mobil kapak üretimi başlatılmadı.";
          statusEl.textContent = "";
        }
      });
    }

    return card;
  }
  async function refreshMobileCoverCredits(){
    try {
      const res = await fetch("/api/credits/get", {
        method:"GET",
        credentials:"include",
        cache:"no-store",
        headers:{
          "accept":"application/json"
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
          el.textContent = window.AIVO_LANG === "en"
            ? "Credits " + nextCredits
            : "Kredi " + nextCredits;
        });

        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(nextCredits);
        }

        try {
          window.syncCreditsUI?.({ force:true });
        } catch (err) {}
      }
    } catch (err) {
      console.warn("[MOBILE COVER][CREDIT REFRESH FAILED]", err);
    }
  }

  function getMobileCoverCreditAction(){
    return selectedQuality === "ultra"
      ? "studio_cover_generate_ultra"
      : "studio_cover_generate_artist";
  }

  async function consumeCredits(cost){
    const amount = Number(cost || selectedCredit || 0);
    const action = getMobileCoverCreditAction();
    const requestId = "mobile-cover:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

    const res = await fetch("/api/credits/consume-ledger", {
      method:"POST",
      credentials:"include",
      headers:{
        "content-type":"application/json",
        "accept":"application/json"
      },
      body:JSON.stringify({
        app:"cover",
        action:action,
        cost:amount,
        request_id:requestId,
        reason:action
      })
    });

    const data = await res.json().catch(function(){ return null; });

    if (!res.ok || !data || data.ok === false) {
      throw new Error("insufficient_credit");
    }

    await refreshMobileCoverCredits();

    return {
      app:"cover",
      action:action,
      amount:amount,
      request_id:requestId,
      related_transaction_id:String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      ),
      idempotency_key:String(
        data?.transaction_id ||
        data?.transaction?.id ||
        data?.related_transaction_id ||
        data?.credit_transaction_id ||
        ""
      )
        ? "mobile-cover-refund:" + String(
            data?.transaction_id ||
            data?.transaction?.id ||
            data?.related_transaction_id ||
            data?.credit_transaction_id ||
            ""
          )
        : "",
      quality:selectedQuality,
      refunded:false,
      raw:data
    };
  }

  async function refundMobileCoverCredits(refundCtx, reason, extraMeta){
    if (!refundCtx || refundCtx.refunded) return false;

    if (!refundCtx.related_transaction_id || refundCtx.amount <= 0) {
      console.warn("[MOBILE COVER][REFUND SKIPPED]", {
        reason:reason,
        refundCtx:refundCtx
      });
      return false;
    }

    refundCtx.refunded = true;

    try {
      const res = await fetch("/api/credits/refund", {
        method:"POST",
        credentials:"include",
        headers:{
          "content-type":"application/json",
          "accept":"application/json"
        },
        body:JSON.stringify({
          app:refundCtx.app,
          action:refundCtx.action,
          amount:refundCtx.amount,
          request_id:refundCtx.request_id,
          related_transaction_id:refundCtx.related_transaction_id,
          idempotency_key:refundCtx.idempotency_key,
          reason:reason || "mobile_cover_failed",
          meta:{
            source:"mobile.cover.js",
            quality:refundCtx.quality,
            ...(extraMeta || {})
          }
        })
      });

      const data = await res.json().catch(function(){ return null; });

      if (res.ok && data && data.ok) {
        await refreshMobileCoverCredits();

        if (data.refunded && window.toast?.error) {
          window.toast.error(
            window.AIVO_LANG === "en"
              ? "The process failed, credits were refunded."
              : "İşlem başarısız oldu, kredi iade edildi."
          );
        }

        return true;
      }

      console.warn("[MOBILE COVER][REFUND FAILED]", data);
    } catch (err) {
      console.error("[MOBILE COVER][REFUND ERROR]", err);
    }

    return false;
  }

  qualityBtns.forEach(function(btn){
    btn.addEventListener("click", function(){
      setQuality(btn);

      if (window.toast?.success) {
        if (selectedQuality === "ultra") {
          window.toast.success(
            window.AIVO_LANG === "en"
              ? "Cinematic Ultra HD selected · 9 credits"
              : "Cinematic Ultra HD seçildi · 9 kredi"
          );
        } else {
          window.toast.success(
            window.AIVO_LANG === "en"
              ? "Artist selected · 6 credits"
              : "Artist seçildi · 6 kredi"
          );
        }
      }
    });
  });

  styleBtns.forEach(function(btn){
    btn.addEventListener("click", function(){
      setStyle(btn);
    });
  });

  promptEl.addEventListener("input", updatePromptCount);
  promptEl.addEventListener("change", updatePromptCount);

  generateBtn.addEventListener("click", async function(){
    const prompt = String(promptEl.value || "").trim();
    const count = Number(countSelect?.value || 1) || 1;
    const ratio = String(ratioSelect?.value || "1:1");

    if (!prompt) {
      statusEl.textContent = window.AIVO_LANG === "en"
        ? "Cover generation cannot start without a prompt."
        : "Prompt yazmadan kapak üretimi başlatılamaz.";

      if (window.toast?.warning) {
        window.toast.warning(
          window.AIVO_LANG === "en"
            ? "Cover generation cannot start without a prompt."
            : "Prompt yazmadan kapak üretimi başlatılamaz."
        );
      }

      return;
    }

    let refundCtx = null;

    generateBtn.disabled = true;
    generateBtn.textContent = window.AIVO_LANG === "en"
      ? "Generating..."
      : "Üretiliyor...";
    generateBtn.classList.add("is-loading");
    statusEl.textContent = window.AIVO_LANG === "en"
      ? "Checking credits..."
      : "Kredi kontrol ediliyor...";

    if (window.toast?.loading) {
      window.toast.loading(
        window.AIVO_LANG === "en"
          ? "Starting cover generation..."
          : "Kapak üretimi başlatılıyor..."
      );
    }

    try {
      refundCtx = await consumeCredits(selectedCredit);

      statusEl.textContent = window.AIVO_LANG === "en"
        ? "Cover generation started..."
        : "Kapak üretimi başlatıldı...";

      if (window.toast?.success) {
        if (selectedCredit === 9) {
          window.toast.success(
            window.AIVO_LANG === "en"
              ? "9 credits used"
              : "9 kredi düşüldü"
          );
        } else {
          window.toast.success(
            window.AIVO_LANG === "en"
              ? "6 credits used"
              : "6 kredi düşüldü"
          );
        }

        window.toast.success(
          window.AIVO_LANG === "en"
            ? "Cover generation started"
            : "Kapak üretimi başladı"
        );
      }

      resultsEl.hidden = false;
      renderLoadingCards(count);

      const created = [];

      for (let i = 0; i < count; i += 1) {
        const item = await generateOneCover(prompt, ratio, selectedQuality, i);
        created.push(item);
      }

      if (!created.length) {
        throw new Error("cover_generate_no_image");
      }

      resultsEl.className = "";
      resultsEl.innerHTML = "";

      created.forEach(function(item, index){
        resultsEl.appendChild(renderCoverCard(item, index));
      });

      statusEl.textContent = window.AIVO_LANG === "en"
        ? "Cover is ready."
        : "Kapak hazır.";

      if (window.toast?.success) {
        window.toast.success(
          window.AIVO_LANG === "en"
            ? "Cover is ready"
            : "Kapak hazır"
        );
      }
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);

      if (msg === "insufficient_credit") {
        statusEl.textContent = window.AIVO_LANG === "en"
          ? "Insufficient credits. Redirecting you to packages..."
          : "Kredi yetersiz. Paket sayfasına yönlendiriliyorsun...";

        if (window.toast?.warning) {
          window.toast.warning(
            window.AIVO_LANG === "en"
              ? "Insufficient credits. Opening packages..."
              : "Kredi yetersiz. Paketler açılıyor..."
          );
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

      const refunded = await refundMobileCoverCredits(refundCtx, "mobile_cover_generate_failed", {
        error:msg,
        quality:selectedQuality,
        ratio:ratio,
        count:count
      });

      statusEl.textContent = refunded
        ? (
            window.AIVO_LANG === "en"
              ? "Cover could not be generated. Credits were refunded."
              : "Kapak üretilemedi. Kredi iade edildi."
          )
        : (
            window.AIVO_LANG === "en"
              ? "Cover could not be generated: " + msg
              : "Kapak üretilemedi: " + msg
          );

      if (!refunded && window.toast?.error) {
        window.toast.error(
          window.AIVO_LANG === "en"
            ? "Cover could not be generated."
            : "Kapak üretilemedi."
        );
      }

      resultsEl.className = "empty-card";
      resultsEl.innerHTML = refunded
        ? (
            window.AIVO_LANG === "en"
              ? "Cover could not be generated. Credits were refunded."
              : "Kapak üretilemedi. Kredi iade edildi."
          )
        : (
            window.AIVO_LANG === "en"
              ? "Cover could not be generated. Credit refund was checked."
              : "Kapak üretilemedi. Kredi iadesi kontrol edildi."
          );
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = coverGenerateText();
      generateBtn.classList.remove("is-loading");
    }
  });

  async function hydrateCoverLibrary(){
    resultsEl.className = "empty-card";
    resultsEl.innerHTML = window.AIVO_LANG === "en"
      ? "Covers are loading..."
      : "Kapaklar yükleniyor...";

    try {
      const res = await fetch("/api/jobs/list?app=cover", {
        credentials:"include",
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
        resultsEl.className = "empty-card";
        resultsEl.innerHTML = window.AIVO_LANG === "en"
          ? "No mobile cover generation has been started yet."
          : "Henüz mobil kapak üretimi başlatılmadı.";
        return;
      }

      resultsEl.className = "";
      resultsEl.innerHTML = "";

      rows.forEach(function(row, index){
        const outputs = Array.isArray(row.outputs) ? row.outputs : [];

        const firstImageOutput = outputs.find(function(output){
          return output && (
            output.url ||
            output.imageUrl ||
            output.image_url ||
            output.src
          );
        });

        const imageUrl =
          row.imageUrl ||
          row.image_url ||
          row.url ||
          row.output_url ||
          row.meta?.imageUrl ||
          row.meta?.image_url ||
          row.meta?.url ||
          firstImageOutput?.url ||
          firstImageOutput?.imageUrl ||
          firstImageOutput?.image_url ||
          firstImageOutput?.src ||
          "";

        if (!imageUrl) return;

        resultsEl.appendChild(renderCoverCard({
          imageUrl,
          jobId: row.id || row.job_id || "",
          prompt: row.prompt || row.meta?.prompt || "",
          quality: row.meta?.quality || "artist",
          ratio: row.meta?.ratio || "1:1"
        }, index));
      });

      if (!resultsEl.querySelector(".mobile-cover-result-card")) {
        resultsEl.className = "empty-card";
        resultsEl.innerHTML = window.AIVO_LANG === "en"
          ? "No mobile cover generation has been started yet."
          : "Henüz mobil kapak üretimi başlatılmadı.";
      }
    } catch (err) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = window.AIVO_LANG === "en"
        ? "Covers could not be loaded."
        : "Kapaklar yüklenemedi.";
    }
  }

  window.mobileCoverHydrate = hydrateCoverLibrary;

  updatePromptCount();

  if (qualityBtns[0]) setQuality(qualityBtns[0]);
  if (styleBtns[0]) setStyle(styleBtns[0]);
})();
