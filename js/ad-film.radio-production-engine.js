/* AIVO Radio Ad — real music + final production controller */
(function AIVO_RADIO_PRODUCTION_ENGINE(){
  "use strict";
  if(window.__AIVO_RADIO_PRODUCTION_ENGINE_V1__)return;
  window.__AIVO_RADIO_PRODUCTION_ENGINE_V1__=true;

  var ROOT='[data-module-root][data-module="adfilm"]';
  var PANEL='[data-adfilm-radio-panel]';
  var PROJECT_KEY='aivo_radioad_active_project_id_v1';
  var running=false;
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
  function resetProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.classList.remove('is-complete','is-failed');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamınız hazırlanıyor';if(badge)badge.textContent='Üretim akışı'}
  function completeProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.classList.remove('is-failed');box.classList.add('is-complete');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamınız hazır';if(badge)badge.textContent='Tamamlandı'}
  function failProductionState(panel){var box=q(panel,'[data-radio-production]');if(!box)return;box.classList.remove('is-complete');box.classList.add('is-failed');var title=q(box,'.adfilm-radio-production__top strong');var badge=q(box,'.adfilm-radio-production__top span');if(title)title.textContent='Radyo reklamı tamamlanamadı';if(badge)badge.textContent='Hata'}
  function setStage(panel,index,title,description){var n=stageNodes(panel);if(n.box)n.box.hidden=false;if(n.count)n.count.textContent='AŞAMA '+(index+1)+'/3';if(n.title)n.title.textContent=title;if(n.description)n.description.textContent=description;n.steps.forEach(function(item,i){item.classList.toggle('is-active',i===index)});if(n.time)n.time.textContent='Toplam geçen süre: '+elapsed()}
  function startTimer(panel){clearInterval(timer);startedAt=Date.now();var n=stageNodes(panel);if(n.time)n.time.textContent='Toplam geçen süre: 0 dk 00 sn';timer=setInterval(function(){var current=stageNodes(panel).time;if(current)current.textContent='Toplam geçen süre: '+elapsed()},1000)}
  function stopTimer(){clearInterval(timer);timer=null}
  function setBusy(panel,busy){var button=q(panel,'[data-radio-build]');if(!button)return;button.disabled=!!busy;button.textContent=busy?'Radyo Reklamı Oluşturuluyor...':'▶ Radyo Reklamını Oluştur'}
  function errorMessage(error){var code=clean(error&&error.data&&error.data.error||error&&error.message);if(code==='narration_approval_required'||code==='approved_narration_required')return 'Önce seslendirmeyi oluşturup onayla.';if(code==='music_audio_missing')return 'Reklam müziği hazırlanamadı.';if(code==='uploaded_music_missing')return 'Yüklenen müzik dosyası bulunamadı.';if(code==='missing_fal_key')return 'Müzik motoru anahtarı sunucuda tanımlı değil.';return 'Radyo reklamı oluşturulamadı: '+code}
  function updateProject(project,id){if(!project)return;window.AIVORadioAdActiveProject=project;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:project,projectId:id}}))}

  function archiveItems(project){
    var list=Array.isArray(project&&project.finalHistory)?project.finalHistory.slice():[];
    if(project&&project.final&&project.final.url&&!list.some(function(item){return clean(item&&item.id)===clean(project.final.id)||clean(item&&item.url)===clean(project.final.url)}))list.unshift(project.final);
    return list.filter(function(item){return item&&item.url}).slice(0,24);
  }

  function ensureGallery(panel){
    var final=q(panel,'.adfilm-radio-final');
    if(!final)return null;
    var card=final.closest('.adfilm-radio-card');
    if(!card)return null;
    var gallery=q(card,'[data-radio-final-gallery]');
    if(gallery)return gallery;
    gallery=document.createElement('section');
    gallery.className='radio-final-gallery';
    gallery.setAttribute('data-radio-final-gallery','');
    gallery.innerHTML='<div class="radio-final-gallery__head"><div><span>ARŞİV</span><strong>Radyo Reklamlarım</strong><p>Hazırladığın final reklamları dinle, indir veya arşivden kaldır.</p></div><em data-radio-final-count>0 kayıt</em></div><div class="radio-final-gallery__rail" data-radio-final-rail></div>';
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
      return '<article class="radio-final-tile'+(active?' is-current':'')+'" data-radio-final-id="'+itemId+'" data-radio-final-url="'+escapeHtml(item.url)+'">'
        +'<div class="radio-final-tile__glow"></div>'
        +'<div class="radio-final-tile__top"><span>'+(active?'AKTİF':'SÜRÜM '+(items.length-index))+'</span><em>'+format+'</em></div>'
        +'<button type="button" class="radio-final-tile__play" data-radio-gallery-play aria-label="Oynat">▶</button>'
        +'<div class="radio-final-tile__wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'
        +'<strong>'+title+'</strong>'
        +'<small>'+duration+' sn · '+format+' · '+escapeHtml(dateLabel(item.createdAt))+'</small>'
        +'<div class="radio-final-tile__actions"><button type="button" data-radio-gallery-download title="İndir">⇩</button><button type="button" class="is-danger" data-radio-gallery-delete title="Sil">⌫</button></div>'
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
    if(download){download.disabled=false;download.onclick=function(){var link=document.createElement('a');link.href='/api/radio-ad/final/download?projectId='+encodeURIComponent(id)+(final.id?'&finalId='+encodeURIComponent(final.id):'');link.style.display='none';document.body.appendChild(link);link.click();setTimeout(function(){link.remove()},0)}}
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
    running=true;
    placeFinalAfterProduction(panel);
    removePreviewDownload(panel);
    resetProductionState(panel);
    setBusy(panel,true);
    startTimer(panel);
    var box=q(panel,'[data-radio-production]');
    if(box){box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'center'})}
    try{
      setStage(panel,0,'Seslendirme doğrulanıyor','Onaylanan seslendirme ve reklam süresi kontrol ediliyor.');
      await new Promise(function(resolve){setTimeout(resolve,250)});

      var musicMode=selected(panel,'music','ai');
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
      completeProductionState(panel);
      placeFinalAfterProduction(panel);
      notify('Radyo reklamın hazır.','success');
    }catch(error){
      console.error('[RADIOAD] final production',error);
      failProductionState(panel);
      notify(errorMessage(error),'error');
      var nodes=stageNodes(panel);if(nodes.title)nodes.title.textContent='Üretim tamamlanamadı';if(nodes.description)nodes.description.textContent=errorMessage(error);
    }finally{
      stopTimer();running=false;setBusy(panel,false);
    }
  }

  function ensureStyle(){
    if(document.getElementById('aivo-radio-production-engine-style'))return;
    var style=document.createElement('style');
    style.id='aivo-radio-production-engine-style';
    style.textContent='.adfilm-radio-production__stage{text-align:center;justify-items:center}.adfilm-radio-production__stage p{text-align:center!important}.adfilm-radio-production__body{grid-template-columns:58px minmax(0,1fr)}.adfilm-radio-production.is-complete .adfilm-radio-production__spinner,.adfilm-radio-production.is-failed .adfilm-radio-production__spinner{display:none}.adfilm-radio-production.is-complete .adfilm-radio-production__body,.adfilm-radio-production.is-failed .adfilm-radio-production__body{grid-template-columns:1fr}.adfilm-radio-production.is-complete .adfilm-radio-production__top span{background:rgba(20,111,92,.22);color:#75e5c0}.adfilm-radio-production.is-failed .adfilm-radio-production__top span{background:rgba(126,24,55,.28);color:#ff86aa}.radio-final-gallery{margin-top:16px;padding:16px;border:1px solid rgba(141,99,221,.32);border-radius:18px;background:radial-gradient(circle at 15% 0,rgba(127,73,224,.16),transparent 34%),rgba(8,11,29,.72);overflow:hidden}.radio-final-gallery__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.radio-final-gallery__head span{display:block;margin-bottom:3px;color:#9cebd6;font-size:9px;font-weight:900;letter-spacing:.22em}.radio-final-gallery__head strong{display:block;color:#fff;font-size:17px}.radio-final-gallery__head p{margin:4px 0 0;color:#938ca4;font-size:11px}.radio-final-gallery__head em{padding:6px 9px;border:1px solid rgba(147,98,221,.35);border-radius:999px;background:rgba(91,49,161,.2);color:#d7c4ff;font-size:10px;font-style:normal;font-weight:800;white-space:nowrap}.radio-final-gallery__rail{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:rgba(185,92,226,.55) rgba(31,28,59,.35)}.radio-final-gallery__rail::-webkit-scrollbar{height:7px}.radio-final-gallery__rail::-webkit-scrollbar-track{border-radius:99px;background:rgba(31,28,59,.35)}.radio-final-gallery__rail::-webkit-scrollbar-thumb{border-radius:99px;background:linear-gradient(90deg,#7948f4,#ed58ae)}.radio-final-tile{position:relative;flex:0 0 190px;min-height:205px;padding:13px;border:1px solid rgba(121,88,190,.38);border-radius:16px;background:linear-gradient(160deg,rgba(29,27,61,.98),rgba(10,13,33,.98));box-shadow:0 14px 30px rgba(4,4,18,.25);overflow:hidden;scroll-snap-align:start}.radio-final-tile.is-current{border-color:rgba(232,88,185,.58);box-shadow:0 0 0 1px rgba(139,70,235,.18),0 18px 34px rgba(86,32,141,.24)}.radio-final-tile__glow{position:absolute;inset:-70px -50px auto;height:120px;background:radial-gradient(circle,rgba(223,71,189,.28),transparent 66%);pointer-events:none}.radio-final-tile__top{position:relative;display:flex;justify-content:space-between;gap:8px}.radio-final-tile__top span,.radio-final-tile__top em{font-size:9px;font-style:normal;font-weight:900;letter-spacing:.08em}.radio-final-tile__top span{color:#cbb4fa}.radio-final-tile__top em{color:#83e5c7}.radio-final-tile__play{position:relative;display:grid;place-items:center;width:54px;height:54px;margin:20px auto 12px;border:1px solid rgba(255,255,255,.23);border-radius:50%;background:linear-gradient(145deg,#7449f5,#d34fc9,#ef5a9e);color:#fff;font-size:17px;box-shadow:0 12px 30px rgba(171,66,211,.32);cursor:pointer}.radio-final-tile__wave{display:flex;align-items:center;justify-content:center;gap:3px;height:23px;margin-bottom:9px}.radio-final-tile__wave i{width:3px;border-radius:99px;background:linear-gradient(#8e5bff,#ee5bb3);animation:radioWave 1.2s ease-in-out infinite alternate}.radio-final-tile__wave i:nth-child(3n){height:18px}.radio-final-tile__wave i:nth-child(3n+1){height:9px}.radio-final-tile__wave i:nth-child(3n+2){height:14px}.radio-final-tile strong{display:block;overflow:hidden;color:#f8f5ff;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.radio-final-tile small{display:block;margin-top:4px;color:#8f899e;font-size:9px}.radio-final-tile__actions{display:flex;justify-content:flex-end;gap:7px;margin-top:11px}.radio-final-tile__actions button{display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(126,93,196,.42);border-radius:9px;background:rgba(36,32,73,.8);color:#ddd4ee;font-size:16px;cursor:pointer}.radio-final-tile__actions button:hover{transform:translateY(-1px);border-color:rgba(217,100,225,.58)}.radio-final-tile__actions .is-danger{border-color:rgba(230,62,112,.42);background:rgba(88,18,43,.38);color:#ff7ca2}.radio-final-gallery__empty{display:grid;gap:4px;min-width:100%;padding:20px;border:1px dashed rgba(126,94,195,.35);border-radius:14px;color:#9992aa;text-align:center}.radio-final-gallery__empty b{color:#d9d1e6;font-size:12px}.radio-final-gallery__empty span{font-size:10px}@keyframes radioWave{from{transform:scaleY(.62);opacity:.55}to{transform:scaleY(1);opacity:1}}';
    document.head.appendChild(style);
  }

  document.addEventListener('click',async function(event){
    var build=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-build]');
    if(build){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var panel=build.closest(PANEL),root=build.closest(ROOT);placeFinalAfterProduction(panel);removePreviewDownload(panel);run(panel,root);return}

    var play=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-play]');
    if(play){var tile=play.closest('[data-radio-final-id]');var url=clean(tile&&tile.dataset.radioFinalUrl);var itemId=clean(tile&&tile.dataset.radioFinalId);if(!url)return;if(galleryAudio&&galleryPlayingId===itemId&&!galleryAudio.paused){galleryAudio.pause();play.textContent='▶';return}if(galleryAudio){galleryAudio.pause()}qa(document,'[data-radio-gallery-play]').forEach(function(button){button.textContent='▶'});galleryAudio=new Audio(url);galleryPlayingId=itemId;galleryAudio.play().then(function(){play.textContent='❚❚'}).catch(function(){notify('Ses oynatılamadı.','error')});galleryAudio.addEventListener('ended',function(){play.textContent='▶';galleryPlayingId=''});return}

    var download=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-download]');
    if(download){var downTile=download.closest('[data-radio-final-id]');var downId=clean(downTile&&downTile.dataset.radioFinalId);var activeProject=projectId(document.querySelector(ROOT));if(!activeProject||!downId)return;var link=document.createElement('a');link.href='/api/radio-ad/final/download?projectId='+encodeURIComponent(activeProject)+'&finalId='+encodeURIComponent(downId);link.style.display='none';document.body.appendChild(link);link.click();setTimeout(function(){link.remove()},0);return}

    var remove=event.target&&event.target.closest&&event.target.closest('[data-radio-gallery-delete]');
    if(remove){var removeTile=remove.closest('[data-radio-final-id]');var removeId=clean(removeTile&&removeTile.dataset.radioFinalId);var removeProject=projectId(document.querySelector(ROOT));if(!removeProject||!removeId)return;if(!window.confirm('Bu radyo reklamını arşivden silmek istiyor musun?'))return;remove.disabled=true;try{var data=await request('/api/radio-ad/final/delete?projectId='+encodeURIComponent(removeProject)+'&finalId='+encodeURIComponent(removeId),{method:'DELETE'});updateProject(data.project,removeProject);var activePanel=document.querySelector(ROOT+' '+PANEL);renderGallery(activePanel,removeProject,data.project||{});if(data.final)mountFinal(activePanel,removeProject,data.final);notify('Radyo reklamı silindi.','success')}catch(error){remove.disabled=false;notify('Radyo reklamı silinemedi.','error')}return}
  },true);

  document.addEventListener('aivo:radioad-project-sync',function(event){
    var project=event&&event.detail&&event.detail.project;
    var panel=document.querySelector(ROOT+' '+PANEL);
    var id=event&&event.detail&&event.detail.projectId||project&&project.id;
    placeFinalAfterProduction(panel);removePreviewDownload(panel);ensureGallery(panel);renderGallery(panel,id,project||{});
    if(panel&&project&&project.final&&project.final.url){mountFinal(panel,id,project.final);if(!running)completeProductionState(panel)}
  });

  document.addEventListener('aivo:module-mounted',function(event){
    if(!(event&&event.detail&&event.detail.key==='adfilm'))return;
    var root=event.detail.root||document.querySelector(ROOT);var panel=q(root,PANEL);placeFinalAfterProduction(panel);removePreviewDownload(panel);ensureGallery(panel);renderGallery(panel,projectId(root),window.AIVORadioAdActiveProject||{});
  });

  ensureStyle();
  var initialPanel=document.querySelector(ROOT+' '+PANEL);
  placeFinalAfterProduction(initialPanel);removePreviewDownload(initialPanel);ensureGallery(initialPanel);renderGallery(initialPanel,projectId(document.querySelector(ROOT)),window.AIVORadioAdActiveProject||{});
})();
