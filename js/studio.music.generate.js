// job_id aldıktan hemen sonra:
const jobId = res.job_id;

const cardHTML = `
  <div class="aivo-player-card is-loadingState" data-job-id="${jobId}" data-output-id="">
    <div class="aivo-left">
      <button class="aivo-play" data-action="toggle-play" aria-label="Oynat" title="Oynat"></button>
      <div class="aivo-meta">
        <div class="aivo-title">Yeni Müzik (hazırlanıyor)</div>
        <div class="aivo-sub">${jobId}</div>
      </div>
    </div>

    <div class="aivo-progress"><i style="width:0%"></i></div>
    <div class="aivo-time" data-bind="time">0:00</div>

    <div class="aivo-actions">
      <button class="aivo-action" data-action="download">İndir</button>
    </div>
  </div>
`;

window.AIVO_PLAYER.add(cardHTML);
