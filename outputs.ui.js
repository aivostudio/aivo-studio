/* ✅ TEK BLOK: outputs.ui.js içinden MÜZİK PLAYER/preview çıkar
   - Audio kartta <audio controls> YOK
   - Audio open/click => window.AIVO_MUSIC.play(item)
   - openPreview sadece VIDEO
*/

/* 1) cardHTML(item) — audio thumb düzelt */
function cardHTML(item) {
  const safeSrc = escapeHtml(item.src || "");
  const sub = item.sub || (item.type === "video" ? "MP4 çıktı" : "MP3/WAV çıktı");

  let thumb = "";
  if (!safeSrc) {
    thumb = `<div class="out-thumb out-thumb--empty">${item.status === "queued" ? "İşleniyor..." : "Dosya yok"}</div>`;
  } else if (item.type === "video") {
    thumb = `<video class="out-thumb" muted playsinline preload="metadata" src="${safeSrc}"></video>`;
  } else {
    // ✅ AUDIO: player yok
    thumb = `<div class="out-thumb out-thumb--audio" aria-label="Müzik">🎵</div>`;
  }

  const disabled = !safeSrc || item.status !== "ready" ? "is-disabled" : "";

  return `
    <div class="out-card" data-out-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}">
      <div class="out-badge ${badgeCls(item.status)}">${escapeHtml(badgeText(item.status))}</div>
      ${thumb}
      ${item.type === "video" && safeSrc ? `<div class="out-play"><span>▶</span></div>` : ``}
      <div class="out-meta">
        <div style="min-width:0;flex:1;">
          <div class="out-title">${escapeHtml(item.title || "Çıktı")}</div>
          <div class="out-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="out-actions">
          <button class="out-btn ${disabled}" data-action="open" title="Aç">⤢</button>
          <button class="out-btn ${disabled}" data-action="download" title="İndir">⤓</button>
          <button class="out-btn ${disabled}" data-action="share" title="Paylaş">↗</button>
          <button class="out-btn ${disabled}" data-action="copy" title="Link">⛓</button>
          <button class="out-btn is-danger" data-action="delete" title="Sil">🗑</button>
        </div>
      </div>
    </div>
  `;
}

/* 2) openPreview(item) — sadece VIDEO */
function openPreview(item) {
  const m = ensureModal();
  const media = document.getElementById("aivoPrevMedia");
  if (!media) return;

  media.innerHTML = "";

  const v = document.createElement("video");
  v.controls = true;
  v.playsInline = true;
  v.preload = "metadata";
  v.src = item.src || "";
  v.style.width = "100%";
  v.style.borderRadius = "14px";
  media.appendChild(v);
  setTimeout(() => { try { v.play(); } catch {} }, 50);

  m.hidden = false;
}

/* 3) Click handler — 2 yerde audio openPreview yerine AIVO_MUSIC.play */

// (A) action === "open" içinde:
if (action === "open") {
  if (!src) return;
  if (item.type === "video") return openRightPanelVideo(src, item.title || "Video");
  if (window.AIVO_MUSIC?.play) return window.AIVO_MUSIC.play(item);
  return;
}

// (B) Kart tıklaması (btn yokken) içinde:
if (!src) return;
if (item.type === "video") return openRightPanelVideo(src, item.title || "Video");
if (window.AIVO_MUSIC?.play) return window.AIVO_MUSIC.play(item);
return;
