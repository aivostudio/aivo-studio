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

  function q(root,selector){return root&&root.querySelector(selector)}
  function qa(root,selector){return root?Array.from(root.querySelectorAll(selector)):[]}
  function clean(value){return String(value==null?'':value).trim()}
  function notify(message,type){try{var fn=window.toastSafe||window.showToast||window.toastMsg;if(typeof fn==='function')fn(message,type||'info')}catch(_){} }
  function projectId(root){return clean(root&&root.dataset.radioAdProjectId||window.AIVORadioAdActiveProject&&window.AIVORadioAdActiveProject.id||localStorage.getItem(PROJECT_KEY))}
  function selected(panel,name,fallback){var b=q(panel,'[data-radio-choice="'+name+'"] .is-active[data-value]');return b?b.dataset.value:fallback}
  function request(url,options){return fetch(url,Object.assign({credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}},options||{})).then(async function(response){var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||('HTTP '+response.status));error.status=response.status;error.data=data;throw error}return data})}
  function pad(value){return String(value).padStart(2,'0')}
  function elapsed(){var total=Math.max(0,Math.floor((Date.now()-startedAt)/1000));return Math.floor(total/60)+' dk '+pad(total%60)+' sn'}
  function stageNodes(panel){return{box:q(panel,'[data-radio-production]'),count:q(panel,'[data-radio-stage-count]'),title:q(panel,'[data-radio-stage-title]'),description:q(panel,'[data-radio-stage-description]'),time:q(panel,'[data-radio-stage-time]'),steps:qa(panel,'[data-radio-stage-steps] span'),button:q(panel,'[data-radio-build]')}}
  function setStage(panel,index,title,description){var n=stageNodes(panel);if(n.box)n.box.hidden=false;if(n.count)n.count.textContent='AŞAMA '+(index+1)+'/3';if(n.title)n.title.textContent=title;if(n.description)n.description.textContent=description;n.steps.forEach(function(item,i){item.classList.toggle('is-active',i===index)});if(n.time)n.time.textContent='Toplam geçen süre: '+elapsed()}
  function startTimer(panel){clearInterval(timer);startedAt=Date.now();var n=stageNodes(panel);if(n.time)n.time.textContent='Toplam geçen süre: 0 dk 00 sn';timer=setInterval(function(){var current=stageNodes(panel).time;if(current)current.textContent='Toplam geçen süre: '+elapsed()},1000)}
  function stopTimer(){clearInterval(timer);timer=null}
  function setBusy(panel,busy){var button=q(panel,'[data-radio-build]');if(!button)return;button.disabled=!!busy;button.textContent=busy?'Radyo Reklamı Oluşturuluyor...':'▶ Radyo Reklamını Oluştur'}
  function errorMessage(error){var code=clean(error&&error.data&&error.data.error||error&&error.message);if(code==='narration_approval_required'||code==='approved_narration_required')return 'Önce seslendirmeyi oluşturup onayla.';if(code==='music_audio_missing')return 'Reklam müziği hazırlanamadı.';if(code==='uploaded_music_missing')return 'Yüklenen müzik dosyası bulunamadı.';if(code==='missing_fal_key')return 'Müzik motoru anahtarı sunucuda tanımlı değil.';return 'Radyo reklamı oluşturulamadı: '+code}
  function updateProject(project,id){if(!project)return;window.AIVORadioAdActiveProject=project;document.dispatchEvent(new CustomEvent('aivo:radioad-project-sync',{detail:{project:project,projectId:id}}))}

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
    if(download){download.disabled=false;download.onclick=function(){var link=document.createElement('a');link.href='/api/radio-ad/final/download?projectId='+encodeURIComponent(id);link.style.display='none';document.body.appendChild(link);link.click();setTimeout(function(){link.remove()},0)}}
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
      if(clean(finalData.status).toUpperCase()!=='COMPLETED'){
        finalData=await request('/api/radio-ad/final/status?projectId='+encodeURIComponent(id),{method:'GET'});
      }
      if(clean(finalData.status).toUpperCase()!=='COMPLETED'||!finalData.final)throw new Error(finalData.error||'final_mix_not_completed');
      mountFinal(panel,id,finalData.final);
      var n=stageNodes(panel);if(n.title)n.title.textContent='Radyo reklamı hazır';if(n.description)n.description.textContent='Final ses dosyan hazırlandı.';if(n.count)n.count.textContent='TAMAMLANDI';n.steps.forEach(function(item){item.classList.add('is-active')});if(n.time)n.time.textContent='Toplam geçen süre: '+elapsed();
      notify('Radyo reklamın hazır.','success');
    }catch(error){
      console.error('[RADIOAD] final production',error);
      notify(errorMessage(error),'error');
      var nodes=stageNodes(panel);if(nodes.title)nodes.title.textContent='Üretim tamamlanamadı';if(nodes.description)nodes.description.textContent=errorMessage(error);
    }finally{
      stopTimer();
      running=false;
      setBusy(panel,false);
    }
  }

  function ensureStyle(){
    if(document.getElementById('aivo-radio-production-engine-style'))return;
    var style=document.createElement('style');
    style.id='aivo-radio-production-engine-style';
    style.textContent='.adfilm-radio-production__stage{text-align:center;justify-items:center}.adfilm-radio-production__stage p{text-align:center!important}.adfilm-radio-production__body{grid-template-columns:58px minmax(0,1fr)}';
    document.head.appendChild(style);
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest(PANEL+' [data-radio-build]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    var panel=button.closest(PANEL),root=button.closest(ROOT);
    run(panel,root);
  },true);

  document.addEventListener('aivo:radioad-project-sync',function(event){
    var project=event&&event.detail&&event.detail.project;
    var panel=document.querySelector(ROOT+' '+PANEL);
    var id=event&&event.detail&&event.detail.projectId||project&&project.id;
    if(panel&&project&&project.final&&project.final.url)mountFinal(panel,id,project.final);
  });

  ensureStyle();
})();
