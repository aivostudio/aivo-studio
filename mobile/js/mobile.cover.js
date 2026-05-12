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
    generateBtn.textContent = "🖼️ Kapak Üret (" + selectedCredit + " Kredi)";
  }

  function setStyle(btn){
    selectedStyle = String(btn.getAttribute("data-style") || "");

    styleBtns.forEach(function(item){
      const on = item === btn;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const stylePrompt = String(btn.getAttribute("data-prompt") || "").trim();

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
          <span>Hazırlanıyor</span>
          <span>${i === 0 ? "Orijinal" : "Versiyon " + (i + 1)}</span>
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
        <img src="${safe(imageUrl)}" alt="AIVO kapak görseli">

        <div class="mobile-cover-badge">Hazır</div>

        <div class="mobile-cover-overlay">
          <div class="mobile-cover-overlay-actions">
            <button class="mobile-cover-overlay-btn" type="button" data-action="open-cover" title="Görüntüle">👁</button>
            <button class="mobile-cover-overlay-btn" type="button" data-action="download-cover" title="İndir">↓</button>
            <button class="mobile-cover-overlay-btn" type="button" data-action="share-cover" title="Paylaş">↗</button>
            <button class="mobile-cover-overlay-btn is-danger" type="button" data-action="delete-cover" title="Sil">🗑</button>
          </div>
        </div>
      </div>

      <div class="mobile-cover-result-meta">
        <span>${index === 0 ? "Kapak hazır" : "Versiyon " + (index + 1)}</span>
      </div>
    `;

    const openBtn = card.querySelector('[data-action="open-cover"]');
    const downloadBtn = card.querySelector('[data-action="download-cover"]');
    const shareBtn = card.querySelector('[data-action="share-cover"]');
    const deleteBtn = card.querySelector('[data-action="delete-cover"]');

    if (openBtn) {
      openBtn.addEventListener("click", function(){
        if (!imageUrl) return;
        window.open(imageUrl, "_blank", "noopener");
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener("click", function(){
        if (!imageUrl) return;

        const proxied = "/api/media/proxy?url=" + encodeURIComponent(imageUrl) + "&filename=cover.jpg";

        const a = document.createElement("a");
        a.href = proxied;
        a.download = "cover.jpg";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
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
          statusEl.textContent = "Kapak linki kopyalandı.";
        } catch (err) {
          statusEl.textContent = "Paylaşım desteklenmiyor.";
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

        if (!resultsEl.querySelector(".mobile-cover-result-card")) {
          resultsEl.className = "empty-card";
          resultsEl.innerHTML = "Henüz mobil kapak üretimi başlatılmadı.";
          statusEl.textContent = "";
        }
      });
    }

    return card;
  }
  async function consumeCredits(cost){
    const requestId = "mobile-cover:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
    const reason = selectedQuality === "ultra"
      ? "mobile_cover_generate_ultra"
      : "mobile_cover_generate_artist";

    const res = await fetch("/api/credits/consume-ledger", {
      method:"POST",
      credentials:"include",
      headers:{
        "content-type":"application/json",
        "accept":"application/json"
      },
      body:JSON.stringify({
        app:"cover",
        action:reason,
        cost,
        request_id:requestId,
        reason
      })
    });

    const data = await res.json().catch(function(){ return null; });

    if (!res.ok || !data || data.ok === false) {
      throw new Error("insufficient_credit");
    }

    return data;
  }

 qualityBtns.forEach(function(btn){
  btn.addEventListener("click", function(){
    setQuality(btn);

    if (window.toast?.success) {
      if (selectedQuality === "ultra") {
        window.toast.success("Cinematic Ultra HD seçildi · 9 kredi");
      } else {
        window.toast.success("Artist seçildi · 6 kredi");
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
  statusEl.textContent = "Prompt yazmadan kapak üretimi başlatılamaz.";

  if (window.toast?.warning) {
    window.toast.warning("Prompt yazmadan kapak üretimi başlatılamaz.");
  }

  return;
}

    generateBtn.disabled = true;
    generateBtn.textContent = "Üretiliyor...";
    statusEl.textContent = "Kredi kontrol ediliyor...";
    if (window.toast?.loading) {
  window.toast.loading("Kapak üretimi başlatılıyor...");
}

    try {
      await consumeCredits(selectedCredit);

      statusEl.textContent = "Kapak üretimi başlatıldı...";

if (window.toast?.success) {
  if (selectedCredit === 9) {
    window.toast.success("9 kredi düşüldü");
  } else {
    window.toast.success("6 kredi düşüldü");
  }
}

if (window.toast?.success) {
  window.toast.success("Kapak üretimi başladı");
}

      resultsEl.hidden = false;
      renderLoadingCards(count);

      const created = [];

      for (let i = 0; i < count; i += 1) {
        const item = await generateOneCover(prompt, ratio, selectedQuality, i);
        created.push(item);
      }

      resultsEl.className = "";
      resultsEl.innerHTML = "";

      created.forEach(function(item, index){
        resultsEl.appendChild(renderCoverCard(item, index));
      });

    statusEl.textContent = "Kapak hazır.";

if (window.toast?.success) {
  window.toast.success("Kapak hazır");
}
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);

     if (msg === "insufficient_credit") {
  statusEl.textContent = "Kredi yetersiz. Paket sayfasına yönlendiriliyorsun...";

  if (window.toast?.warning) {
    window.toast.warning("Kredi yetersiz. Paketler açılıyor...");
  }

  const to = encodeURIComponent(location.pathname + location.search + location.hash);
  location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
  return;
}

     statusEl.textContent = "Kapak üretilemedi: " + msg;

if (window.toast?.error) {
  window.toast.error("Kapak üretilemedi.");
}
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "🖼️ Kapak Üret (" + selectedCredit + " Kredi)";
    }
  });

  async function hydrateCoverLibrary(){
    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "Kapaklar yükleniyor...";

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
        resultsEl.innerHTML = "Henüz mobil kapak üretimi başlatılmadı.";
        return;
      }

      resultsEl.className = "";
      resultsEl.innerHTML = "";

      rows.reverse().forEach(function(row, index){
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
        resultsEl.innerHTML = "Henüz mobil kapak üretimi başlatılmadı.";
      }
    } catch (err) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Kapaklar yüklenemedi.";
    }
  }

  window.mobileCoverHydrate = hydrateCoverLibrary;

  updatePromptCount();

  if (qualityBtns[0]) setQuality(qualityBtns[0]);
  if (styleBtns[0]) setStyle(styleBtns[0]);

  hydrateCoverLibrary();
})();
