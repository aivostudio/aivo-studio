/* AIVO Radio Ad — real music + final production controller */
(function AIVO_RADIO_PRODUCTION_ENGINE(){
  "use strict";
  if(window.__AIVO_RADIO_PRODUCTION_ENGINE_V1__)return;
  window.__AIVO_RADIO_PRODUCTION_ENGINE_V1__=true;

  var ROOT='[data-module-root][data-module="adfilm"]';
  var PANEL='[data-adfilm-radio-panel]';
  var PROJECT_KEY='aivo_radioad_active_project_id_v1';
  var CREDIT_APP='radioad';
  var CREDIT_ACTION='studio_radio_ad_generate';
  var CREDIT_PRICES={
    mp3:{10:10,15:12,30:20,45:28,60:36},
    wav:{10:13,15:15,30:25,45:35,60:45}
  };
  var running=false;
  var currentRun=null;
  var timer=null;
  var startedAt=0;
  var finalAudio=null;
  var galleryAudio=null;
  var galleryPlayingId='';

  function q(root,selector){return root&&root.querySelector(selector)}
  function qa(root,selector){return root?Array.from(root.querySelectorAll(selector)):[]}
  function clean(value){return String(value==null?'':value).trim()}
  function escapeHtml(value){return clean(value).replace(/[&<>'"]/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]})}
  function notify(message,type){try{var fn=window.toastSafe||window.showToast||window.toastMsg;if(typeof fn==='function')fn(message,type||'info')}catch(_){} }
  function projectId(root){return clean(root&&root.dataset.radioAdProjectId||window.AIVORadioAdActiveProject&&window.AIVORadioAdActiveProject.id||localStorage.getItem(PROJECT_KEY))}
  function selected(panel,name,fallback){var b=q(panel,'[data-radio-choice="'+name+'"] .is-active[data-value]');return b?b.dataset.value:fallback}
  function request(url,options){return fetch(url,Object.assign({credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}},options||{})).then(async function(response){var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||('HTTP '+response.status));error.status=response.status;error.data=data;throw error}return data})}
  function pad(value){return String(value).padStart(2,'0')}
  function elapsed(){var total=Math.max(0,Math.floor((Date.now()-startedAt)/1000));return Math.floor(total/60)+' dk '+pad(total%60)+' sn'}
  function dateLabel(value){var date=new Date(value);if(Number.isNaN(date.getTime()))return'';return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date)}
  function stageNodes(panel){return{box:q(panel,'[data-radio-production]'),count:q(panel,'[data-radio-stage-count]'),title:q(panel,'[data-radio-stage-title]'),description:q(panel,'[data-radio-stage-description]'),time:q(panel,'[data-radio-stage-time]'),steps:qa(panel,'[data-radio-stage-steps] span'),button:q(panel,'[data-radio-build]')}}
  function placeFinalAfterProduction(panel){var production=q(panel,'[data-radio-production]');var final=q(panel,'.adfilm-radio-final');var card=final&&final.closest('.adfilm-radio-card');if(!production||!card||production.nextElementSibling===card)return;production.insertAdjacentElement('afterend',card)}
  function removePreviewDownload(panel){var preview=q(panel,'.radio-preview');if(!preview)return;var buttons=qa(preview,'.radio-preview__player .radio-icon-btn:not(.is-danger)');if(buttons.length>1)buttons[1].remove()}
  function normalizeDuration(value){var duration=Number(value)||10;return[10,15,30,45,60].indexOf(duration)>=0?duration:10}
  function normalizeFormat(value){return clean(value).toLowerCase()==='wav'?'wav':'mp3'}
  function creditAmount(duration,format){var normalizedDuration=normalizeDuration(duration);var normalizedFormat=normalizeFormat(format);return Number(CREDIT_PRICES[normalizedFormat][normalizedDuration]||0)}
  function creditQuote(panel){var duration=normalizeDuration(selected(panel,'duration','10'));var format=normalizeFormat(selected(panel,'outputFormat','mp3'));return{duration:duration,format:format,amount:creditAmount(duration,format)}}
  function syncPricing(panel){
    if(!panel||!panel.isConnected)return null;
    var quote=creditQuote(panel);
    qa(panel,'[data-radio-choice="outputFormat"] button[data-value]').forEach(function(button){
      var format=normalizeFormat(button.dataset.value);
      var node=q(button,'[data-radio-credit-price]');
      if(!node){node=document.createElement('em');node.setAttribute('data-radio-credit-price','');button.appendChild(node)}
      node.textContent=creditAmount(quote.duration,format)+' Kredi';
      button.setAttribute('data-credit-cost',String(creditAmount(quote.duration,format)));
    });
    var build=q(panel,'[data-radio-build]');
    if(build){
      build.setAttribute('data-credit-cost',String(quote.amount));
      build.setAttribute('data-credit-duration',String(quote.duration));
      build.setAttribute('data-credit-format',quote.format);
      if(!running)build.textContent='▶ Radyo Reklamını Oluştur ('+quote.amount+' Kredi)';
    }
    panel.setAttribute('data-radio-credit-cost',String(quote.amount));
    panel.setAttribute('data-radio-credit-duration',String(quote.duration));
    panel.setAttribute('data-radio-credit-format',quote.format);
    try{window.dispatchEvent(new CustomEvent('aivo:radioad-credit-change',{detail:{duration:quote.duration,format:quote.format,credits:quote.amount}}))}catch(_){}
    return quote;
  }
  function showVideoDefault(root){
    if(!root)return;
    var video=q(root,'[data-adfilm-kind="video"]');
    var radioButton=q(root,'[data-adfilm-kind="radio"]');
    var modebar=q(root,'.adfilm-modebar');
    var layout=q(root,'.adfilm-layout');
    var radioPanel=q(root,PANEL);
    if(video){video.classList.add('is-active');video.setAttribute('aria-selected','true')}
    if(radioButton){radioButton.classList.remove('is-active');radioButton.setAttribute('aria-selected','false')}
    if(modebar)modebar.hidden=false;
    if(layout)layout.hidden=false;
    if(radioPanel)radioPanel.hidden=true;
  }
  function resetProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.classList.remove('is-complete','is-failed');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamınız hazırlanıyor';if(badge)badge.textContent='Üretim akışı'}
  function completeProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.classList.remove('is-failed');box.classList.add('is-complete');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamınız hazır';if(badge)badge.textContent='Tamamlandı'}
  function failProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.hidden=false;box.classList.remove('is-complete');box.classList.add('is-failed');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamı tamamlanamadı';if(badge)badge.textContent='Hata'}
  function setStage(panel,index,title,description){var n=stageNodes(panel);if(n.box)n.box.hidden=false;if(n.count)n.count.textContent='AŞAMA '+(index+1)+'/3';if(n.title)n.title.textContent=title;if(n.description)n.description.textContent=description;n.steps.forEach(function(item,i){item.classList.toggle('is-active',i===index)});if(n.time)n.time.textContent='Toplam geçen süre: '+elapsed()}
  function startTimer(panel){clearInterval(timer);startedAt=Date.now();var n=stageNodes(panel);if(n.time)n.time.textContent='Toplam geçen süre: 0 dk 00 sn';timer=setInterval(function(){var current=stageNodes(panel).time;if(current)current.textContent='Toplam geçen süre: '+elapsed()},1000)}
  function stopTimer(){clearInterval(timer);timer=null}
  function setBusy(panel,busy){var button=q(panel,'[data-radio-build]');if(!button)return;button.disabled=!!busy;if(busy)button.textContent='Radyo Reklamı Oluşturuluyor...';else syncPricing(panel)}
  function errorMessage(error){var code=clean(error&&error.data&&error.data.error||error&&error.message);if(code.indexOf('insufficient')>=0)return 'Bu üretim için yeterli krediniz bulunmuyor.';if(code==='credit_transaction_missing'||code==='credit_consume_failed'||code==='non_json_response')return 'Kredi kontrolü tamamlanamadı. Üretim başlatılmadı.';if(code==='narration_approval_required'||code==='approved_narration_required')return 'Önce seslendirmeyi oluşturup onayla.';if(code==='music_audio_missing')return 'Reklam müziği hazırlanamadı.';if(code==='uploaded_music_missing')return 'Yüklenen müzik dosyası bulunamadı.';if(code==='missing_fal_key')return 'Müzik motoru anahtarı sunucuda tanımlı değil.';return 'Radyo reklamı oluşturulamadı: '+code}
  function updateProject(project,id){if(!project)return;window.AIVORadioAdActiveProject=project;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:project,projectId:id}}))}
  function applyCredits(value){
    if(typeof value!=='number'||!Number.isFinite(value))return;
    var node=document.getElementById('topCreditCount');if(node)node.textContent=String(value);
    try{if(window.AIVO_STORE_V1&&typeof window.AIVO_STORE_V1.setCredits==='function')window.AIVO_STORE_V1.setCredits(value)}catch(_){}
  }
  async function refreshCredits(fallback){
    if(typeof fallback==='number'&&Number.isFinite(fallback))applyCredits(fallback);
    try{var response=await fetch('/api/credits/get',{credentials:'include',cache:'no-store',headers:{accept:'application/json'}});var data=await response.json().catch(function(){return null});if(data&&data.ok&&typeof data.credits==='number')applyCredits(data.credits)}catch(_){}
    try{window.syncCreditsUI&&window.syncCreditsUI({force:true})}catch(_){}
  }
  async function consumeCredit(panel,id){
    var quote=creditQuote(panel);
    if(!quote.amount)throw new Error('invalid_credit_amount');
    var requestId='radioad:'+id+':'+Date.now()+':'+Math.random().toString(36).slice(2,8);
    var response=await fetch('/api/credits/consume-ledger',{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({app:CREDIT_APP,action:CREDIT_ACTION,cost:quote.amount,request_id:requestId,job_id:id,reason:CREDIT_ACTION})});
    var data=await response.json().catch(function(){return{ok:false,error:'non_json_response'}});
    if(!response.ok||!data||!data.ok){var error=new Error(clean(data&&data.error)||'credit_consume_failed');error.status=response.status;error.data=data||{};error.creditConsumeFailed=true;error.creditAmount=quote.amount;throw error}
    var transactionId=clean(data.transaction_id||data.transaction&&data.transaction.id);
    if(!transactionId){var missing=new Error('credit_transaction_missing');missing.creditConsumeFailed=true;missing.creditAmount=quote.amount;throw missing}
    currentRun.creditConsumed=true;
    currentRun.creditAmount=quote.amount;
    currentRun.creditRequestId=requestId;
    currentRun.creditTransactionId=transactionId;
    currentRun.creditStatus='consumed';
    currentRun.duration=quote.duration;
    currentRun.format=quote.format;
    window.__AIVO_RADIO_AD_LAST_CONSUME_REQUEST_ID__=requestId;
    window.__AIVO_RADIO_AD_LAST_TRANSACTION_ID__=transactionId;
    window.__AIVO_RADIO_AD_LAST_CREDIT_COST__=quote.amount;
    await refreshCredits(typeof data.credits==='number'?data.credits:null);
    notify(quote.amount+' kredi kullanıldı. Radyo reklamınız hazırlanıyor.','success');
    return quote;
  }
  async function refundCredit(run,error){
    if(!run||!run.creditConsumed||run.creditRefunded||!clean(run.creditTransactionId)||!Number(run.creditAmount))return{ok:false,skipped:true};
    run.creditRefundPending=true;
    var reason=clean(error&&error.message)||'radio_ad_production_failed';
    try{
      var response=await fetch('/api/credits/refund',{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({app:CREDIT_APP,action:CREDIT_ACTION,amount:Number(run.creditAmount),request_id:run.creditRequestId,job_id:run.projectId,provider_job_id:null,related_transaction_id:run.creditTransactionId,reason:'radio_ad_production_failed',meta:{source:'ad-film.radio-production-engine',project_id:run.projectId,duration:run.duration,format:run.format,music_mode:run.musicMode||'',error:reason}})});
      var data=await response.json().catch(function(){return null});
      if(response.ok&&data&&data.ok&&(data.refunded||data.deduped||data.skipped)){run.creditRefunded=true;run.creditRefundPending=false;run.creditStatus='refunded';await refreshCredits(typeof data.credits==='number'?data.credits:null);return{ok:true,data:data}}
      run.creditStatus='refund_pending';return{ok:false,data:data};
    }catch(refundError){run.creditStatus='refund_pending';console.error('[RADIOAD] credit refund',refundError);return{ok:false,error:refundError}}
  }
  function downloadIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>'}
  function deleteIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6"/></svg>'}

  async function downloadFinal(activeProject,finalId,format){
    var url='/api/radio-ad/final/download?projectId='+encodeURIComponent(activeProject)+'&finalId='+encodeURIComponent(finalId);
    var response=await fetch(url,{method:'GET',credentials:'include',cache:'no-store'});
    if(!response.ok)throw new Error('final_download_failed');
    var blob=await response.blob();
    var objectUrl=URL.createObjectURL(blob);
    var link=document.createElement('a');
    link.href=objectUrl;
    link.download='AIVO-Radyo-Reklami.'+(clean(format).toLowerCase()==='wav'?'wav':'mp3');
    link.rel='noopener';
    link.style.display='none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){URL.revokeObjectURL(objectUrl);link.remove()},1200);
  }

  function archiveItems(project){
    var list=Array.isArray(project&&project.finalHistory)?project.finalHistory.slice():[];
    if(project&&project.final&&project.final.url&&!list.some(function(item){return clean(item&&item.id)===clean(project.final.id)||clean(item&&item.url)===clean(project.final.url)}))list.unshift(project.final);
    return list.filter(function(item){return item&&item.url}).slice(0,24);
  }

  function ensureGallery(panel){
    var final=q(panel,'.adfilm-radio-final');
    if(!final)return null;
    final.hidden=true;
    final.setAttribute('aria-hidden','true');
    var card=final.closest('.adfilm-radio-card');
    if(!card)return null;
    var gallery=q(card,'[data-radio-final-gallery]');
    if(gallery)return gallery;
    gallery=document.createElement('section');
    gallery.className='radio-final-gallery';
    gallery.setAttribute('data-radio-final-gallery','');
    gallery.innerHTML='<div class="radio-final-gallery__head"><div><span>ARŞİV</span><strong>Radyo Reklamlarım</strong><p>Final reklamlarını dinle, indir veya arşivden kaldır.</p></div><em data-radio-final-count>0 kayıt</em></div><div class="radio-final-gallery__rail" data-radio-final-rail></div>';
    final.insertAdjacentElement('afterend',gallery);
    return gallery;
  }

  function renderGallery(panel,id,project){
    var gallery=ensureGallery(panel);if(!gallery)return;
    var rail=q(gallery,'[data-radio-final-rail]');var count=q(gallery,'[data-radio-final-count]');
    var items=archiveItems(project);
    if(count)count.textContent=items.length+' kayıt';
    if(!rail)return;
    if(!items.length){rail.innerHTML='<div class="radio-final-gallery__empty"><b>Henüz arşivlenmiş final yok</b><span>İlk radyo reklamını oluşturduğunda burada görünecek.</span></div>';return}
    rail.innerHTML=items.map(function(item,index){
      var itemId=escapeHtml(item.id||item.url);
      var format=clean(item.format).toUpperCase()||'MP3';
      var title=escapeHtml(item.title||'Radyo Reklamı');
      var duration=Number(item.duration||0);
      var active=project&&project.final&&(clean(project.final.id)===clean(item.id)||clean(project.final.url)===clean(item.url));
      return '<article class="radio-final-tile'+(active?' is-current':'')+'" data-radio-final-id="'+itemId+'" data-radio-final-url="'+escapeHtml(item.url)+'" data-radio-final-format="'+escapeHtml(format)+'">'
        +'<div class="radio-final-tile__glow"></div>'
        +'<div class="radio-final-tile__top"><span>'+(active?'AKTİF':'SÜRÜM '+(items.length-index))+'</span><em>'+format+'</em></div>'
        +'<button type="button" class="radio-final-tile__play" data-radio-gallery-play aria-label="Oynat">▶</button>'
        +'<div class="radio-final-tile__wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'
        +'<strong>'+title+'</strong>'
        +'<small>'+duration+' sn · '+format+' · '+escapeHtml(dateLabel(item.createdAt))+'</small>'
        +'<div class="radio-final-tile__actions"><button type="button" data-radio-gallery-download title="İndir" aria-label="İndir">'+downloadIcon()+'</button><button type="button" class="is-danger" data-radio-gallery-delete title="Sil" aria-label="Sil">'+deleteIcon()+'</button></div>'
        +'</article>';
    }).join('');
  }

  async function pollMusic(panel,id){
    for(var attempt=0;attempt<180;attempt++){
      var data=await request('/api/radio-ad/music/status?projectId='+encodeURIComponent(id),{method:'GET'});
      updateProject(data.project,id);
      var status=clean(data.status).toUpperCase();
      if(status==='COMPLETED'||status==='DISABLED')return data;
      if(status==='FAILED')throw Object.assign(new Error(data.error||'music_generation_failed'),{data:data});
      await new Promise(function(resolve){setTimeout(resolve,1800)});
    }
    throw new Error('music_generation_timeout');
  }

  function mountFinal(panel,id,final){
    if(!final||!final.url)return;
    var card=q(panel,'.adfilm-radio-final');
    if(!card)return;
    card.hidden=true;
    card.setAttribute('aria-hidden','true');
    var play=q(card,'button:first-child');
    var title=q(card,'strong');
    var summary=q(card,'span');
    var download=q(card,'button:last-child');
    if(finalAudio){finalAudio.pause();finalAudio.src=''}
    finalAudio=new Audio(final.url);
    finalAudio.preload='metadata';
    if(title)title.textContent='Final radyo reklamı hazır';
    if(summary)summary.textContent=Number(final.duration||0)+' sn · '+(final.format==='wav'?'WAV Kayıpsız':'MP3 320 kbps')+' · '+(final.musicMode==='off'?'Yalnız seslendirme':'Müzik + seslendirme');
    if(play){play.disabled=false;play.textContent='▶';play.onclick=function(){if(finalAudio.paused){finalAudio.play().catch(function(){});play.textContent='❚❚'}else{finalAudio.pause();play.textContent='▶'}}}
    finalAudio.addEventListener('ended',function(){if(play)play.textContent='▶'});
    if(download){download.disabled=false;download.onclick=async function(event){event.preventDefault();event.stopPropagation();try{await downloadFinal(id,final.id||'',final.format)}catch(_){notify('Dosya indirilemedi.','error')}}}
  }

  async function run(panel,root){
    if(running)return;
    var id=projectId(root);
    if(!id){notify('Radyo taslağı hazır değil. Sayfayı yenile.','warning');return}
    var project=window.AIVORadioAdActiveProject||{};
    if(!(project.narration&&project.narration.audio&&project.narration.audio.approved===true)){
      notify('Önce seslendirmeyi oluşturup onayla.','warning');
      return;
    }
    currentRun={projectId:id,creditConsumed:false,creditRefunded:false,creditRefundPending:false,creditStatus:'pending'};
    window.__AIVO_RADIO_AD_CURRENT_RUN__=currentRun;
    running=true;
    placeFinalAfterProduction(panel);
    removePreviewDownload(panel);
    resetProductionState(panel);
    setBusy(panel,true);
    try{
      var quote=await consumeCredit(panel,id);
      currentRun.musicMode=selected(panel,'music','ai');
      startTimer(panel);
      var box=q(panel,'[data-radio-production]');
      if(box){box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'center'})}
      setStage(panel,0,'Seslendirme doğrulanıyor','Onaylanan seslendirme ve reklam süresi kontrol ediliyor.');
      await new Promise(function(resolve){setTimeout(resolve,250)});

      var musicMode=currentRun.musicMode;
      setStage(panel,1,musicMode==='off'?'Müziksiz final hazırlanıyor':'Reklam müziği hazırlanıyor',musicMode==='ai'?'Seçilen stile ve toplam reklam süresine uygun arka plan müziği hazırlanıyor.':musicMode==='upload'?'Yüklediğin müzik final miks için hazırlanıyor.':'Seslendirme doğrudan final çıkışa hazırlanıyor.');
      var createMusic=await request('/api/radio-ad/music/create',{method:'POST',body:JSON.stringify({projectId:id})});
      updateProject(createMusic.project,id);
      if(!['COMPLETED','DISABLED'].includes(clean(createMusic.status).toUpperCase()))await pollMusic(panel,id);

      setStage(panel,2,'Final ses birleştiriliyor','Seslendirme ve reklam müziği birleştirilerek seçilen çıktı formatı hazırlanıyor.');
      var finalData=await request('/api/radio-ad/final/create',{method:'POST',body:JSON.stringify({projectId:id})});
      updateProject(finalData.project,id);
      if(clean(finalData.status).toUpperCase()!=='COMPLETED')finalData=await request('/api/radio-ad/final/status?projectId='+encodeURIComponent(id),{method:'GET'});
      if(clean(finalData.status).toUpperCase()!=='COMPLETED'||!finalData.final)throw new Error(finalData.error||'final_mix_not_completed');
      mountFinal(panel,id,finalData.final);
      renderGallery(panel,id,finalData.project||window.AIVORadioAdActiveProject||{});
      var n=stageNodes(panel);if(n.title)n.title.textContent='Radyo reklamı hazır';if(n.description)n.description.textContent='Final ses dosyan hazırlandı.';if(n.count)n.count.textContent='TAMAMLANDI';n.steps.forEach(function(item){item.classList.add('is-active')});if(n.time)n.time.textContent='Toplam geçen süre: '+elapsed();
      currentRun.creditStatus='completed';
      completeProductionState(panel);
      placeFinalAfterProduction(panel);
      notify('Radyo reklamın hazır.','success');
    }catch(error){
      console.error('[RADIOAD] final production',error);
      var failedRun=currentRun;
      failProductionState(panel);
      var nodes=stageNodes(panel);
      if(!failedRun||!failedRun.creditConsumed){
        var creditText=errorMessage(error);
        if(nodes.title)nodes.title.textContent='Üretim başlatılamadı';
        if(nodes.description)nodes.description.textContent=creditText;
        notify(creditText,clean(error&&error.data&&error.data.error||error&&error.message).indexOf('insufficient')>=0?'warning':'error');
      }else{
        var refund=await refundCredit(failedRun,error);
        if(nodes.title)nodes.title.textContent='Üretim tamamlanamadı';
        if(refund.ok){
          var refunded='Kullanılan '+failedRun.creditAmount+' kredi hesabınıza iade edildi.';
          if(nodes.description)nodes.description.textContent=refunded;
          notify('Üretim tamamlanamadı. '+refunded,'error');
        }else{
          if(nodes.description)nodes.description.textContent='Kredi iadesi kontrol ediliyor.';
          notify('Üretim tamamlanamadı. Kredi iadesi kontrol ediliyor.','error');
        }
      }
    }finally{
      stopTimer();running=false;setBusy(panel,false);currentRun=null;window.__AIVO_RADIO_AD_CURRENT_RUN__=null;
    }
  }

  function ensureStyle(){
    if(document.getElementById('aivo-radio-production-engine-style'))return;
    var style=document.createElement('style');
    style.id='aivo-radio-production-engine-style';
    style.textContent='.adfilm-radio-production__stage{text-align:center;justify-items:center}.adfilm-radio-production__stage p{text-align:center!important}.adfilm-radio-production__body{grid-template-columns:58px minmax(0,1fr)}.adfilm-radio-production.is-complete .adfilm-radio-production__spinner,.adfilm-radio-production.is-failed .adfilm-radio-production__spinner{display:none}.adfilm-radio-production.is-complete .adfilm-radio-production__body,.adfilm-radio-production.is-failed .adfilm-radio-production__body{grid-template-columns:1fr}.adfilm-radio-production.is-complete .adfilm-radio-production__top span{background:rgba(20,111,92,.22);color:#75e5c0}.adfilm-radio-production.is-failed .adfilm-radio-production__top span{background:rgba(126,24,55,.28);color:#ff86aa}.radio-output-options button{position:relative}.radio-output-options [data-radio-credit-price]{display:block;margin-top:4px;color:#9cebd6;font-size:10px;font-style:normal;font-weight:900;letter-spacing:.02em}.radio-output-options button.is-active [data-radio-credit-price]{color:#fff}.adfilm-radio-final[hidden]{display:none!important}.radio-final-gallery{margin-top:4px;padding:14px;border:1px solid rgba(141,99,221,.32);border-radius:16px;background:radial-gradient(circle at 15% 0,rgba(127,73,224,.14),transparent 34%),rgba(8,11,29,.72);overflow:hidden}.radio-final-gallery__head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:11px}.radio-final-gallery__head span{display:block;margin-bottom:2px;color:#9cebd6;font-size:8px;font-weight:900;letter-spacing:.22em}.radio-final-gallery__head strong{display:block;color:#fff;font-size:16px}.radio-final-gallery__head p{margin:3px 0 0;color:#938ca4;font-size:10px}.radio-final-gallery__head em{padding:5px 8px;border:1px solid rgba(147,98,221,.35);border-radius:999px;background:rgba(91,49,161,.2);color:#d7c4ff;font-size:9px;font-style:normal;font-weight:800;white-space:nowrap}.radio-final-gallery__rail{display:flex;gap:10px;overflow-x:auto;padding:1px 1px 7px;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:rgba(185,92,226,.55) rgba(31,28,59,.35)}.radio-final-gallery__rail::-webkit-scrollbar{height:6px}.radio-final-gallery__rail::-webkit-scrollbar-track{border-radius:99px;background:rgba(31,28,59,.35)}.radio-final-gallery__rail::-webkit-scrollbar-thumb{border-radius:99px;background:linear-gradient(90deg,#7948f4,#ed58ae)}.radio-final-tile{position:relative;flex:0 0 168px;min-height:174px;padding:11px;border:1px solid rgba(121,88,190,.38);border-radius:14px;background:linear-gradient(160deg,rgba(29,27,61,.98),rgba(10,13,33,.98));box-shadow:0 12px 24px rgba(4,4,18,.22);overflow:hidden;scroll-snap-align:start}.radio-final-tile.is-current{border-color:rgba(232,88,185,.58);box-shadow:0 0 0 1px rgba(139,70,235,.18),0 14px 28px rgba(86,32,141,.22)}.radio-final-tile__glow{position:absolute;inset:-72px -50px auto;height:112px;background:radial-gradient(circle,rgba(223,71,189,.24),transparent 66%);pointer-events:none}.radio-final-tile__top{position:relative;display:flex;justify-content:space-between;gap:8px}.radio-final-tile__top span,.radio-final-tile__top em{font-size:8px;font-style:normal;font-weight:900;letter-spacing:.08em}.radio-final-tile__top span{color:#cbb4fa}.radio-final-tile__top em{color:#83e5c7}.radio-final-tile__play{position:relative;display:grid;place-items:center;width:46px;height:46px;margin:13px auto 7px;border:1px solid rgba(255,255,255,.23);border-radius:50%;background:linear-gradient(145deg,#7449f5,#d34fc9,#ef5a9e);color:#fff;font-size:15px;box-shadow:0 10px 24px rgba(171,66,211,.28);cursor:pointer}.radio-final-tile.is-playing .radio-final-tile__play{box-shadow:0 0 0 5px rgba(212,78,197,.12),0 10px 24px rgba(171,66,211,.3)}.radio-final-tile__wave{display:flex;align-items:center;justify-content:center;gap:2px;height:18px;margin-bottom:6px}.radio-final-tile__wave i{width:2px;border-radius:99px;background:linear-gradient(#8e5bff,#ee5bb3);animation:radioWave 1.2s ease-in-out infinite alternate;animation-play-state:paused}.radio-final-tile.is-playing .radio-final-tile__wave i{animation-play-state:running}.radio-final-tile__wave i:nth-child(3n){height:15px}.radio-final-tile__wave i:nth-child(3n+1){height:7px}.radio-final-tile__wave i:nth-child(3n+2){height:11px}.radio-final-tile strong{display:block;overflow:hidden;color:#f8f5ff;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.radio-final-tile small{display:block;margin-top:3px;color:#8f899e;font-size:8px}.radio-final-tile__actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}.radio-final-tile__actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid rgba(126,93,196,.42);border-radius:8px;background:rgba(36,32,73,.8);color:#ddd4ee;cursor:pointer}.radio-final-tile__actions button:hover{transform:translateY(-1px);border-color:rgba(217,100,225,.58)}.radio-final-tile__actions button:disabled{cursor:wait;opacity:.55}.radio-final-tile__actions svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.radio-final-tile__actions .is-danger{border-color:rgba(230,62,112,.42);background:rgba(88,18,43,.38);color:#ff7ca2}.radio-final-gallery__empty{display:grid;gap:3px;min-width:100%;padding:14px;border:1px dashed rgba(126,94,195,.35);border-radius:12px;color:#9992aa;text-align:center}.radio-final-gallery__empty b{color:#d9d1e6;font-size:11px}.radio-final-gallery__empty span{font-size:9px}@keyframes radioWave{from{transform:scaleY(.62);opacity:.55}to{transform:scaleY(1);opacity:1}}';
    document.head.appendChild(style);
  }

  document.addEventListener('click',async function(event){
    var pricingChoice=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-choice="duration"] button[data-value],'+PANEL+' [data-radio-choice="outputFormat"] button[data-value]');
    if(pricingChoice){var pricingPanel=pricingChoice.closest(PANEL);setTimeout(function(){syncPricing(pricingPanel)},0)}

    var build=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-build]');
    if(build){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var panel=build.closest(PANEL),root=build.closest(ROOT);placeFinalAfterProduction(panel);removePreviewDownload(panel);run(panel,root);return}

    var play=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-play]');
    if(play){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var tile=play.closest('[data-radio-final-id]');var url=clean(tile&&tile.dataset.radioFinalUrl);var itemId=clean(tile&&tile.dataset.radioFinalId);if(!url)return;if(galleryAudio&&galleryPlayingId===itemId&&!galleryAudio.paused){galleryAudio.pause();play.textContent='▶';tile.classList.remove('is-playing');return}if(galleryAudio){galleryAudio.pause()}qa(document,'[data-radio-gallery-play]').forEach(function(button){button.textContent='▶';var other=button.closest('[data-radio-final-id]');if(other)other.classList.remove('is-playing')});galleryAudio=new Audio(url);galleryPlayingId=itemId;galleryAudio.play().then(function(){play.textContent='❚❚';tile.classList.add('is-playing')}).catch(function(){notify('Ses oynatılamadı.','error')});galleryAudio.addEventListener('ended',function(){play.textContent='▶';tile.classList.remove('is-playing');galleryPlayingId=''});return}

    var download=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-download]');
    if(download){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var downTile=download.closest('[data-radio-final-id]');var downId=clean(downTile&&downTile.dataset.radioFinalId);var downFormat=clean(downTile&&downTile.dataset.radioFinalFormat);var activeProject=projectId(document.querySelector(ROOT));if(!activeProject||!downId)return;download.disabled=true;try{await downloadFinal(activeProject,downId,downFormat);notify('İndirme başlatıldı.','success')}catch(error){notify('Dosya indirilemedi.','error')}finally{download.disabled=false}return}

    var remove=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-delete]');
    if(remove){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var removeTile=remove.closest('[data-radio-final-id]');var removeId=clean(removeTile&&removeTile.dataset.radioFinalId);var removeProject=projectId(document.querySelector(ROOT));if(!removeProject||!removeId)return;if(!window.confirm('Bu radyo reklamını arşivden silmek istiyor musun?'))return;remove.disabled=true;try{var data=await request('/api/radio-ad/final/delete?projectId='+encodeURIComponent(removeProject)+'&finalId='+encodeURIComponent(removeId),{method:'DELETE'});updateProject(data.project,removeProject);var activePanel=document.querySelector(ROOT+' '+PANEL);renderGallery(activePanel,removeProject,data.project||{});if(data.final)mountFinal(activePanel,removeProject,data.final);notify('Radyo reklamı silindi.','success')}catch(error){remove.disabled=false;notify('Radyo reklamı silinemedi.','error')}return}
  },true);

  document.addEventListener('aivo:radioad-project-sync',function(event){
    var project=event&&event.detail&&event.detail.project;
    var panel=document.querySelector(ROOT+' '+PANEL);
    var id=event&&event.detail&&event.detail.projectId||project&&project.id;
    placeFinalAfterProduction(panel);removePreviewDownload(panel);ensureGallery(panel);renderGallery(panel,id,project||{});syncPricing(panel);
    if(panel&&project&&project.final&&project.final.url){mountFinal(panel,id,project.final);if(!running)completeProductionState(panel)}
  });

  document.addEventListener('aivo:module-mounted',function(event){
    if(!(event&&event.detail&&event.detail.key==='adfilm'))return;
    var root=event.detail.root||document.querySelector(ROOT);var panel=q(root,PANEL);showVideoDefault(root);placeFinalAfterProduction(panel);removePreviewDownload(panel);ensureGallery(panel);renderGallery(panel,projectId(root),window.AIVORadioAdActiveProject||{});syncPricing(panel);
  });

  document.addEventListener('aivo:adfilm-assets-ready',function(){setTimeout(function(){var root=document.querySelector(ROOT);syncPricing(q(root,PANEL))},80)});
  window.addEventListener('pageshow',function(){setTimeout(function(){var root=document.querySelector(ROOT);showVideoDefault(root);syncPricing(q(root,PANEL))},0)});

  window.AIVORadioAdCreditPricing={prices:{mp3:Object.assign({},CREDIT_PRICES.mp3),wav:Object.assign({},CREDIT_PRICES.wav)},calculate:creditAmount,current:function(){var root=document.querySelector(ROOT);return syncPricing(q(root,PANEL))},sync:function(){var root=document.querySelector(ROOT);return syncPricing(q(root,PANEL))}};

  ensureStyle();
  var initialRoot=document.querySelector(ROOT);
  var initialPanel=q(initialRoot,PANEL);
  showVideoDefault(initialRoot);placeFinalAfterProduction(initialPanel);removePreviewDownload(initialPanel);ensureGallery(initialPanel);renderGallery(initialPanel,projectId(initialRoot),window.AIVORadioAdActiveProject||{});syncPricing(initialPanel);
  [120,400,900,1800].forEach(function(delay){setTimeout(function(){var root=document.querySelector(ROOT);syncPricing(q(root,PANEL))},delay)});
})();
