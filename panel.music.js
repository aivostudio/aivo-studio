// panel.music.js (kart markup fix — CSS v1 ile %100 uyum)
// Sadece render HTML kısmını bununla değiştir / adapte et.

(function () {
  if (!window.RightPanel) return;

  // Eğer zaten register ettiysen double-register olmasın
  if (window.RightPanel.has && window.RightPanel.has("music")) return;

  function iconPlay() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5v14l11-7-11-7z" fill="currentColor"></path>
      </svg>`;
  }
  function iconDownload() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 17v3h16v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }
  function iconTrash() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M10 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M9 7V4h6v3" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>`;
  }
  function iconAccent() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function tagHTML({ text, cls }) {
    return `<span class="aivo-tag ${cls || ""}">${esc(text)}</span>`;
  }

  // Demo/test data — sonra gerçek outputs/job’lardan doldurursun
  function getItems() {
    return [
      {
        title: "Test Track",
        sub: "Console inject",
        lang: "Türkçe",
        duration: "1:40",
        date: new Date().toLocaleString("tr-TR"),
        status: "ready", // ready | loading
        bonus: false,
        src: "", // gerçek mp3 url gelince buraya
        jobId: "test_job",
        outputId: "test_out",
        progress: 0, // 0..100
      },
    ];
  }

  function renderCard(item) {
    const isLoading = item.status === "loading";
    const cardStateClass = isLoading ? "is-loadingState" : "is-ready";

    const tags = [
      item.bonus ? tagHTML({ text: "Bonus", cls: "is-bonus" }) : "",
      item.status === "ready"
        ? tagHTML({ text: "Hazır", cls: "is-ready" })
        : tagHTML({ text: "İşleniyor", cls: "is-loading" }),
      item.lang ? tagHTML({ text: item.lang, cls: "" }) : "",
    ].filter(Boolean).join("");

    const left = isLoading
      ? `<div class="aivo-player-left"><div class="aivo-player-spinner" title="Yükleniyor"></div></div>`
      : `
        <div class="aivo-player-left">
          <button class="aivo-player-btn" data-action="toggle-play" aria-label="Oynat" title="Oynat">
            ${iconPlay()}
          </button>
        </div>`;

    return `
      <div class="aivo-player-card ${cardStateClass}"
           data-src="${esc(item.src || "")}"
           data-job-id="${esc(item.jobId || "")}"
           data-output-id="${esc(item.outputId || "")}">

        ${left}

        <div class="aivo-player-mid">
          <div class="aivo-player-titleRow">
            <div class="aivo-player-title" title="${esc(item.title)}">${esc(item.title)}</div>
            <div class="aivo-player-tags">${tags}</div>
          </div>

          <div class="aivo-player-sub" title="${esc(item.sub)}">${esc(item.sub)}</div>

          <div class="aivo-player-meta">
            <span>${esc(item.duration || "")}</span>
            <span class="aivo-player-dot"></span>
            <span>${esc(item.date || "")}</span>
          </div>

          <div class="aivo-player-controls">
            <div class="aivo-progress" data-action="seek" title="İlerleme">
              <i style="width:${Math.max(0, Math.min(100, Number(item.progress || 0)))}%"></i>
            </div>
          </div>
        </div>

        <div class="aivo-player-actions">
          <button class="aivo-action is-blue" data-action="download" title="İndir" aria-label="İndir">
            ${iconDownload()}
          </button>
          <button class="aivo-action is-accent" data-action="share" title="Paylaş" aria-label="Paylaş">
            ${iconAccent()}
          </button>
          <button class="aivo-action is-danger" data-action="delete" title="Sil" aria-label="Sil">
            ${iconTrash()}
          </button>
        </div>
      </div>
    `;
  }

  function render(host) {
    const items = getItems();
    host.innerHTML = `
      <div class="aivo-player-list">
        ${items.map(renderCard).join("")}
      </div>
    `;
  }

  window.RightPanel.register("music", {
    mount(host) { render(host); },
    destroy(host) { if (host) host.innerHTML = ""; }
  });
})();
