(function AIVO_MOBILE_RADIO_AD_PRODUCTION(){
  "use strict";
  if (window.__AIVO_MOBILE_RADIO_AD_PRODUCTION_V1__) return;
  window.__AIVO_MOBILE_RADIO_AD_PRODUCTION_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  const view = root && root.querySelector('[data-mobile-adfilm-view="radio"]');
  const action = view && view.querySelector('[data-mobile-radio-action]');
  const buildButton = action && action.querySelector('.mobile-adfilm-create-button');
  const finalCard = view && view.querySelector('[data-mobile-radio-card="final"]');
  const finalEmpty = finalCard && finalCard.querySelector('[data-mobile-radio-final-empty]');
  if (!root || !view || !action || !buildButton || !finalCard) return;

  const CREDIT_APP = "radioad";
  const CREDIT_ACTION = "studio_radio_ad_generate";
  const CREDIT_PRICES = {
    mp3: { 10:10, 15:12, 30:20, 45:28, 60:36 },
    wav: { 10:13, 15:15, 30:25, 45:35, 60:45 }
  };

  let running = false;
  let currentRun = null;
  let timer = null;
  let startedAt = 0;
  let galleryAudio = null;
  let galleryPlayingId = "";

  const production = document.createElement("section");
  production.hidden = true;
  production.setAttribute("data-mobile-radio-production", "");
  production.innerHTML = `
    <div class="mobile-radio-production-top">
      <strong>Radyo reklamınız hazırlanıyor</strong>
      <span>Üretim akışı</span>
    </div>
    <div class="mobile-radio-production-body">
      <div class="mobile-radio-production-spinner" aria-hidden="true"></div>
      <div class="mobile-radio-production-copy">
        <span class="mobile-radio-production-stage" data-mobile-radio-stage-count>AŞAMA 1/3</span>
        <h4 data-mobile-radio-stage-title>Seslendirme doğrulanıyor</h4>
        <p data-mobile-radio-stage-description>Onaylanan seslendirme ve reklam süresi kontrol ediliyor.</p>
        <small data-mobile-radio-stage-time>Toplam geçen süre: 0 dk 00 sn</small>
      </div>
    </div>
    <div class="mobile-radio-production-steps" data-mobile-radio-stage-steps>
      <span>Seslendirme</span>
      <span>Müzik</span>
      <span>Final ses</span>
    </div>
  `;
  action.parentNode.insertBefore(production, action);

  const nodes = {
    topTitle: production.querySelector('.mobile-radio-production-top strong'),
    topBadge: production.querySelector('.mobile-radio-production-top span'),
    count: production.querySelector('[data-mobile-radio-stage-count]'),
    title: production.querySelector('[data-mobile-radio-stage-title]'),
    description: production.querySelector('[data-mobile-radio-stage-description]'),
    time: production.querySelector('[data-mobile-radio-stage-time]'),
    steps: Array.from(production.querySelectorAll('[data-mobile-radio-stage-steps] span'))
  };

  function clean(value){ return String(value == null ? "" : value).trim(); }
  function delay(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function currentLocale(){
    const language = String(
      window.AIVO_LANG ||
      localStorage.getItem("aivo_mobile_language") ||
      document.documentElement.lang ||
      "tr"
    ).toLowerCase();
    return language.startsWith("en") ? "en-US" : "tr-TR";
  }

  function notify(message, type){
    try{
      const fn = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof fn === "function") fn(message, type || "info");
    }catch(_){ }
  }

  function syncController(){ return window.AIVOMobileRadioAdProjectSync || null; }
  function getProject(){
    const sync = syncController();
    return sync && typeof sync.getProject === "function" ? sync.getProject() : window.AIVOMobileRadioAdProject || null;
  }
  function getProjectId(){
    const sync = syncController();
    return clean(sync && typeof sync.getProjectId === "function" ? sync.getProjectId() : root.dataset.radioAdProjectId);
  }
  function applyProject(project){
    if (!project) return;
    const sync = syncController();
    if (sync && typeof sync.applyProject === "function") sync.applyProject(project);
    else window.AIVOMobileRadioAdProject = project;
  }

  async function request(url, options){
    const response = await fetch(url, Object.assign({
      credentials:"include",
      cache:"no-store",
      headers:{"Content-Type":"application/json",Accept:"application/json"}
    }, options || {}));
    const data = await response.json().catch(function(){ return {}; });
    if (!response.ok){
      const error = new Error(data.message || data.error || ("HTTP " + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function duration(){
    const value = Number(view.querySelector('#mobileRadioDuration')?.value || 30);
    return [10,15,30,45,60].includes(value) ? value : 30;
  }
  function format(){ return clean(view.querySelector('#mobileRadioOutputFormat')?.value).toLowerCase() === 'wav' ? 'wav' : 'mp3'; }
  function musicMode(){
    const value = clean(view.querySelector('#mobileRadioMusicMode')?.value);
    return value === 'upload' || value === 'off' ? value : 'ai';
  }
  function creditCost(){ return Number(CREDIT_PRICES[format()][duration()] || 0); }

  function pad(value){ return String(value).padStart(2,'0'); }
  function elapsed(){
    const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return Math.floor(total / 60) + ' dk ' + pad(total % 60) + ' sn';
  }
  function startTimer(){
    clearInterval(timer);
    startedAt = Date.now();
    if (nodes.time) nodes.time.textContent = 'Toplam geçen süre: 0 dk 00 sn';
    timer = setInterval(function(){ if (nodes.time) nodes.time.textContent = 'Toplam geçen süre: ' + elapsed(); }, 1000);
  }
  function stopTimer(){ clearInterval(timer); timer = null; }

  function resetProduction(){
    production.classList.remove('is-complete','is-failed');
    if (nodes.topTitle) nodes.topTitle.textContent = 'Radyo reklamınız hazırlanıyor';
    if (nodes.topBadge) nodes.topBadge.textContent = 'Üretim akışı';
  }
  function setStage(index, title, description){
    production.hidden = false;
    if (nodes.count) nodes.count.textContent = 'AŞAMA ' + (index + 1) + '/3';
    if (nodes.title) nodes.title.textContent = title;
    if (nodes.description) nodes.description.textContent = description;
    nodes.steps.forEach(function(item, i){ item.classList.toggle('is-active', i === index); });
    if (nodes.time) nodes.time.textContent = 'Toplam geçen süre: ' + elapsed();
  }
  function completeProduction(){
    production.classList.remove('is-failed');
    production.classList.add('is-complete');
    if (nodes.topTitle) nodes.topTitle.textContent = 'Radyo reklamınız hazır';
    if (nodes.topBadge) nodes.topBadge.textContent = 'Tamamlandı';
    if (nodes.count) nodes.count.textContent = 'AŞAMA 3/3';
    if (nodes.title) nodes.title.textContent = 'Üretim tamamlandı';
    if (nodes.description) nodes.description.textContent = 'Final radyo reklamınız hazır. Aşağıdan dinleyebilir veya indirebilirsiniz.';
    nodes.steps.forEach(function(item){ item.classList.add('is-active'); });
  }
  function failProduction(error){
    production.hidden = false;
    production.classList.remove('is-complete');
    production.classList.add('is-failed');
    if (nodes.topTitle) nodes.topTitle.textContent = 'Radyo reklamı tamamlanamadı';
    if (nodes.topBadge) nodes.topBadge.textContent = 'Hata';
    if (nodes.count) nodes.count.textContent = 'AŞAMA 3/3';
    if (nodes.title) nodes.title.textContent = 'Üretim tamamlanamadı';
    if (nodes.description) nodes.description.textContent = errorMessage(error);
  }

  async function refreshCredits(fallback){
    const apply = function(value){
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      const top = document.getElementById('topCreditCount');
      if (top) top.textContent = String(value);
      document.querySelectorAll('[data-mobile-credit-balance]').forEach(function(node){ node.textContent = String(value); });
      try{ if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === 'function') window.AIVO_STORE_V1.setCredits(value); }catch(_){ }
    };
    apply(fallback);
    try{
      const response = await fetch('/api/credits/get',{credentials:'include',cache:'no-store',headers:{accept:'application/json'}});
      const data = await response.json().catch(function(){ return null; });
      const value = data && (data.credits ?? data.balance ?? data.credit);
      if (data && data.ok && typeof value === 'number') apply(value);
    }catch(_){ }
    try{ if (typeof window.syncCreditsUI === 'function') window.syncCreditsUI({force:true}); }catch(_){ }
  }

  async function consumeCredit(id){
    const amount = creditCost();
    if (!amount) throw new Error('invalid_credit_amount');
    const requestId = 'radioad:' + id + ':' + Date.now() + ':' + Math.random().toString(36).slice(2,8);
    const response = await fetch('/api/credits/consume-ledger',{
      method:'POST', credentials:'include', cache:'no-store',
      headers:{'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({app:CREDIT_APP,action:CREDIT_ACTION,cost:amount,request_id:requestId,job_id:id,reason:CREDIT_ACTION})
    });
    const data = await response.json().catch(function(){ return {ok:false,error:'non_json_response'}; });
    if (!response.ok || !data || !data.ok){
      const error = new Error(clean(data && data.error) || 'credit_consume_failed');
      error.data = data || {};
      throw error;
    }
    const transactionId = clean(data.transaction_id || data.transaction && data.transaction.id);
    if (!transactionId) throw new Error('credit_transaction_missing');
    currentRun.creditConsumed = true;
    currentRun.creditAmount = amount;
    currentRun.creditRequestId = requestId;
    currentRun.creditTransactionId = transactionId;
    await refreshCredits(typeof data.credits === 'number' ? data.credits : null);
    return amount;
  }

  async function refundCredit(error){
    const run = currentRun;
    if (!run || !run.creditConsumed || run.creditRefunded || !run.creditTransactionId) return;
    try{
      const response = await fetch('/api/credits/refund',{
        method:'POST',credentials:'include',cache:'no-store',
        headers:{'content-type':'application/json',accept:'application/json'},
        body:JSON.stringify({
          app:CREDIT_APP, action:CREDIT_ACTION, amount:Number(run.creditAmount),
          request_id:run.creditRequestId, job_id:run.projectId,
          related_transaction_id:run.creditTransactionId,
          reason:'radio_ad_production_failed',
          meta:{source:'mobile.radio-ad.production',project_id:run.projectId,duration:duration(),format:format(),music_mode:musicMode(),error:clean(error && error.message)}
        })
      });
      const data = await response.json().catch(function(){ return null; });
      if (response.ok && data && data.ok){
        run.creditRefunded = true;
        await refreshCredits(typeof data.credits === 'number' ? data.credits : null);
      }
    }catch(refundError){ console.error('[MOBILE RADIO AD] credit refund', refundError); }
  }

  async function pollMusic(id){
    for (let attempt = 0; attempt < 450; attempt += 1){
      const data = await request('/api/radio-ad/music/status?projectId=' + encodeURIComponent(id),{method:'GET'});
      if (data.project) applyProject(data.project);
      const status = clean(data.status).toUpperCase();
      if (status === 'COMPLETED' || status === 'DISABLED') return data;
      if (status === 'FAILED') throw new Error(data.error || 'music_generation_failed');
      await delay(2000);
    }
    throw new Error('music_generation_timeout');
  }

  async function finalStatus(id){
    for (let attempt = 0; attempt < 90; attempt += 1){
      const data = await request('/api/radio-ad/final/status?projectId=' + encodeURIComponent(id),{method:'GET'});
      if (data.project) applyProject(data.project);
      const status = clean(data.status).toUpperCase();
      if (status === 'COMPLETED') return data;
      if (status === 'FAILED') throw new Error(data.error || 'final_mix_failed');
      if (status === 'IDLE') throw new Error('final_mix_failed');
      await delay(1200);
    }
    throw new Error('final_mix_timeout');
  }

  function archiveItems(project){
    const list = Array.isArray(project && project.finalHistory) ? project.finalHistory.slice() : [];
    if (project && project.final && project.final.url && !list.some(function(item){ return clean(item && item.id) === clean(project.final.id); })) list.unshift(project.final);
    return list.filter(function(item){ return item && item.url; }).slice(0,24);
  }

  function downloadIcon(){ return '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>'; }
  function deleteIcon(){ return '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6"/></svg>'; }
  function formatDate(value){
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(currentLocale(),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date);
  }

  function stopGalleryAudio(){
    if (!galleryAudio) return;
    galleryAudio.pause();
    try{ galleryAudio.currentTime = 0; }catch(_){ }
    galleryAudio = null;
    galleryPlayingId = '';
    finalCard.querySelectorAll('.mobile-radio-final-play').forEach(function(button){ button.classList.remove('is-playing'); });
  }

  async function downloadFinal(projectId, finalId, finalFormat){
    const response = await fetch('/api/radio-ad/final/download?projectId=' + encodeURIComponent(projectId) + '&finalId=' + encodeURIComponent(finalId),{credentials:'include',cache:'no-store'});
    if (!response.ok) throw new Error('final_download_failed');

    const blob = await response.blob();
    const extension = clean(finalFormat).toLowerCase() === 'wav' ? 'wav' : 'mp3';
    const filename = 'AIVO-Radyo-Reklami.' + extension;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && typeof File === 'function' && navigator.share){
      const file = new File([blob], filename, {
        type: blob.type || (extension === 'wav' ? 'audio/wav' : 'audio/mpeg')
      });
      const canShareFile = !navigator.canShare || navigator.canShare({ files:[file] });

      if (canShareFile){
        await navigator.share({
          files:[file],
          title:'AIVO Radyo Reklamı'
        });
        return;
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){ URL.revokeObjectURL(objectUrl); link.remove(); },1200);
  }

  function renderArchive(project){
    const items = archiveItems(project);
    const status = finalEmpty && finalEmpty.querySelector('.mobile-adfilm-voice-preview-status');
    if (status) status.textContent = items.length + ' kayıt';

    let list = finalCard.querySelector('[data-mobile-radio-final-list]');
    if (!list){
      list = document.createElement('div');
      list.className = 'mobile-radio-final-list';
      list.setAttribute('data-mobile-radio-final-list','');
      if (finalEmpty) finalEmpty.insertAdjacentElement('afterend',list);
      else finalCard.appendChild(list);
    }

    if (finalEmpty){
      const emptyTip = finalEmpty.querySelector('.mobile-adfilm-tip');
      if (emptyTip) emptyTip.hidden = items.length > 0;
    }

    if (!items.length){ list.innerHTML = ''; return; }
    list.innerHTML = items.map(function(item,index){
      const id = clean(item.id || ('final-' + index));
      const fmt = clean(item.format || 'mp3').toUpperCase();
      const sec = Number(item.duration || 0);
      return '<article class="mobile-radio-final-item" data-mobile-radio-final-id="' + id.replace(/"/g,'&quot;') + '">' +
        '<div class="mobile-radio-final-meta"><b>Sürüm ' + (items.length - index) + '</b><em>' + fmt + '</em></div>' +
        '<button class="mobile-radio-final-play" type="button" data-mobile-radio-final-play aria-label="Radyo reklamını oynat"></button>' +
        '<h5>Radyo Reklamı</h5><small>' + sec + ' sn · ' + fmt + ' · ' + formatDate(item.createdAt) + '</small>' +
        '<div class="mobile-radio-final-actions">' +
          '<button type="button" data-mobile-radio-final-download aria-label="İndir">' + downloadIcon() + '</button>' +
          '<button type="button" data-mobile-radio-final-delete aria-label="Sil">' + deleteIcon() + '</button>' +
        '</div></article>';
    }).join('');

    list.querySelectorAll('[data-mobile-radio-final-play]').forEach(function(button){
      button.addEventListener('click',function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && card.getAttribute('data-mobile-radio-final-id');
        const item = items.find(function(entry){ return clean(entry.id) === clean(id); });
        if (!item || !item.url) return;
        if (galleryPlayingId === id && galleryAudio && !galleryAudio.paused){ stopGalleryAudio(); return; }
        stopGalleryAudio();
        galleryAudio = new Audio(item.url);
        galleryPlayingId = id;
        button.classList.add('is-playing');
        galleryAudio.addEventListener('ended',stopGalleryAudio,{once:true});
        galleryAudio.play().catch(function(){ stopGalleryAudio(); notify('Radyo reklamı oynatılamadı.','error'); });
      });
    });

    list.querySelectorAll('[data-mobile-radio-final-download]').forEach(function(button){
      button.addEventListener('click',async function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && card.getAttribute('data-mobile-radio-final-id');
        const item = items.find(function(entry){ return clean(entry.id) === clean(id); });
        if (!item) return;
        try{ await downloadFinal(getProjectId(),id,item.format); }
        catch(_){ notify('Dosya indirilemedi.','error'); }
      });
    });

    list.querySelectorAll('[data-mobile-radio-final-delete]').forEach(function(button){
      button.addEventListener('click',async function(){
        const card = button.closest('[data-mobile-radio-final-id]');
        const id = card && card.getAttribute('data-mobile-radio-final-id');
        if (!id) return;
        try{
          const data = await request('/api/radio-ad/final/delete?projectId=' + encodeURIComponent(getProjectId()) + '&finalId=' + encodeURIComponent(id),{method:'DELETE'});
          if (data.project) applyProject(data.project);
          stopGalleryAudio();
          renderArchive(data.project || getProject());
          notify('Radyo reklamı silindi.','success');
        }catch(_){ notify('Radyo reklamı silinemedi.','error'); }
      });
    });
  }

  function errorMessage(error){
    const code = clean(error && error.data && error.data.error || error && error.message);
    if (code.indexOf('insufficient') >= 0) return 'Bu üretim için yeterli krediniz bulunmuyor.';
    if (code === 'credit_transaction_missing' || code === 'credit_consume_failed' || code === 'non_json_response') return 'Kredi kontrolü tamamlanamadı. Üretim başlatılmadı.';
    if (code === 'narration_approval_required' || code === 'approved_narration_required') return 'Önce seslendirmeyi oluşturup onayla.';
    if (code === 'music_audio_missing') return 'Reklam müziği hazırlanamadı.';
    if (code === 'uploaded_music_missing') return 'Yüklenen müzik dosyası bulunamadı.';
    if (code === 'missing_fal_key') return 'Müzik motoru sunucuda hazır değil.';
    if (code === 'final_mix_failed') return 'Final ses birleştirilemedi. Tekrar deneyebilirsin.';
    return 'Radyo reklamı oluşturulamadı: ' + (code || 'Bilinmeyen hata');
  }

  function approved(project){ return !!(project && project.narration && project.narration.audio && project.narration.audio.approved === true); }
  function syncButton(project){
    const amount = creditCost();
    buildButton.textContent = 'Radyo Reklamını Oluştur (' + amount + ' Kredi)';
    buildButton.setAttribute('data-credit-cost',String(amount));
    buildButton.disabled = running || !approved(project || getProject());
    if (!running){
      const status = action.querySelector('.mobile-adfilm-action-status');
      if (status) status.textContent = approved(project || getProject()) ? 'Proje buluta bağlı · üretime hazır.' : 'Üretim için önce seslendirmeyi oluşturup onayla.';
    }
  }

  async function run(){
    if (running) return;
    const id = getProjectId();
    if (!id){ notify('Radyo taslağı hazır değil. Sayfayı yenile.','warning'); return; }

    const sync = syncController();
    if (sync && typeof sync.save === 'function') await sync.save();
    let project = getProject();
    if (!approved(project)){ notify('Önce seslendirmeyi oluşturup onayla.','warning'); syncButton(project); return; }

    running = true;
    currentRun = {projectId:id,creditConsumed:false,creditRefunded:false};
    resetProduction();
    production.hidden = false;
    startTimer();
    syncButton(project);
    production.scrollIntoView({behavior:'smooth',block:'center'});

    try{
      const amount = await consumeCredit(id);
      notify(amount + ' kredi kullanıldı. Radyo reklamınız hazırlanıyor.','success');

      setStage(0,'Seslendirme doğrulanıyor','Onaylanan seslendirme ve reklam süresi kontrol ediliyor.');
      await delay(250);

      const mode = musicMode();
      setStage(1,mode === 'off' ? 'Müziksiz final hazırlanıyor' : 'Reklam müziği hazırlanıyor',
        mode === 'ai' ? 'Seçilen stile ve toplam reklam süresine uygun arka plan müziği hazırlanıyor.' :
        mode === 'upload' ? 'Yüklediğin müzik final miks için hazırlanıyor.' :
        'Seslendirme doğrudan final çıkışa hazırlanıyor.');

      let music = await request('/api/radio-ad/music/create',{method:'POST',body:JSON.stringify({projectId:id})});
      if (music.project) applyProject(music.project);
      if (!['COMPLETED','DISABLED'].includes(clean(music.status).toUpperCase())) music = await pollMusic(id);

      setStage(2,'Final ses birleştiriliyor','Seslendirme ve reklam müziği birleştirilerek seçilen çıktı formatı hazırlanıyor.');
      let finalData = await request('/api/radio-ad/final/create',{method:'POST',body:JSON.stringify({projectId:id})});
      if (finalData.project) applyProject(finalData.project);
      if (clean(finalData.status).toUpperCase() !== 'COMPLETED') finalData = await finalStatus(id);

      stopTimer();
      if (finalData.project) applyProject(finalData.project);
      project = finalData.project || getProject();
      completeProduction();
      renderArchive(project);
      notify('Radyo reklamınız hazır.','success');
    }catch(error){
      console.error('[MOBILE RADIO AD] production',error,error && error.data || '');
      stopTimer();
      await refundCredit(error);
      failProduction(error);
      notify(errorMessage(error),'error');
    }finally{
      running = false;
      syncButton(getProject());
      await refreshCredits(null);
    }
  }

  buildButton.addEventListener('click',run);
  document.addEventListener('aivo:mobile-radioad-project-sync',function(event){
    const project = event && event.detail && event.detail.project;
    if (!project) return;
    syncButton(project);
    renderArchive(project);
  });

  window.addEventListener('pagehide',function(){ stopTimer(); stopGalleryAudio(); },{once:true});

  window.AIVOMobileRadioAdProduction = { run:run, renderArchive:renderArchive, syncButton:syncButton };
  syncButton(getProject());
  renderArchive(getProject());
})();