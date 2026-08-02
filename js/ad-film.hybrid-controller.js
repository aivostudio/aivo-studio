/* AIVO AI Reklam Filmi — Seedance-first hybrid production controller */
(function AIVO_AD_FILM_HYBRID_CONTROLLER(){
  "use strict";
  if(window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V6__)return;
  window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V6__=true;

  var starting=false;
  var resumeKey="";

  function clean(v){return String(v==null?"":v).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||project()&&project().id)}
  function choice(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return clean(button&&button.dataset.value)||fallback}
  function enabled(scope){var toggle=scope&&scope.querySelector('[data-avatar-enabled]');return toggle?!!toggle.checked:project()&&project().avatar&&project().avatar.enabled===true}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:6000});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function musicReady(source){source=source||{};var mode=source.music&&source.music.mode||"auto";if(mode==="off")return true;if(mode==="upload")return!!clean(source.media&&source.media.musicTrack&&source.media.musicTrack.url);return!!clean(source.music&&source.music.audio&&source.music.audio.url)}
  async function request(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}
  function setBusy(button,on){if(!button)return;button.disabled=!!on;button.classList.toggle('is-loading',!!on);if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy')}
  function setStage(scope,title,detail){var status=scope&&scope.querySelector('[data-adfilm-engine-status]');if(!status){var action=scope&&scope.querySelector('.adfilm-actionbar'),button=action&&action.querySelector('[data-adfilm-build]');if(action){status=document.createElement('div');status.className='adfilm-engine-status is-visible is-busy';status.setAttribute('data-adfilm-engine-status','');status.innerHTML='<span></span><div><b></b><small></small></div>';if(button)action.insertBefore(status,button);else action.appendChild(status)}}if(status){status.className='adfilm-engine-status is-visible is-busy';var b=status.querySelector('b'),s=status.querySelector('small');if(b)b.textContent=title||'';if(s)s.textContent=detail||''}}
  function syncProject(next,id){if(!next)return;window.AIVOAdFilmActiveProject=next;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:next,projectId:next.id||id||'',media:next.media||{}}}))}
  function normalizeDuration(value){value=clean(value);return value==='5'||value==='10'||value==='15'?value:''}
  function normalizeRatio(value){value=clean(value);return value==='4:5'?'3:4':value}
  function sourceUrl(source){return clean(source&&source.generation&&source.generation.sourceVideoUrl||source&&source.generation&&source.generation.videoUrl)}
  function recoverableAvatarStart(source){
    if(!source||!source.avatar||source.avatar.enabled!==true||!sourceUrl(source))return false;
    var pipeline=source.avatar.pipeline;
    if(pipeline&&['motion_queued','motion_processing','lipsync_queued','lipsync_processing','rendering','completed'].indexOf(clean(pipeline.status))>=0)return false;
    return true;
  }

  function captureLock(scope){
    var duration=normalizeDuration(choice(scope,'duration','10'))||'10';
    var ratio=choice(scope,'aspectRatio','16:9');
    return Object.freeze({
      id:'adfilm-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),
      projectId:projectId(scope),
      duration:duration,
      aspectRatio:ratio,
      apiAspectRatio:normalizeRatio(ratio),
      quality:clean(choice(scope,'quality','1080p')).toLowerCase(),
      capturedAt:new Date().toISOString()
    });
  }

  function acceptedLock(requested,data){
    var generation=data&&data.generation||{};
    var input=generation.input||{};
    var duration=normalizeDuration(input.duration||data&&data.director_plan&&data.director_plan.duration||requested.duration);
    var productionId=clean(generation.productionId||input.productionId||data&&data.production_id||requested.id);
    var ratio=normalizeRatio(input.aspectRatio||input.aspect_ratio||requested.apiAspectRatio);
    var quality=clean(input.resolution||requested.quality).toLowerCase();
    if(duration!==requested.duration)throw new Error('production_duration_mismatch');
    if(productionId!==requested.id)throw new Error('production_lock_mismatch');
    if(ratio!==requested.apiAspectRatio)throw new Error('production_aspect_ratio_mismatch');
    if(quality!==requested.quality)throw new Error('production_quality_mismatch');
    return Object.freeze({
      id:productionId,
      projectId:requested.projectId,
      duration:duration,
      aspectRatio:requested.aspectRatio,
      apiAspectRatio:ratio,
      quality:quality,
      requestId:clean(generation.requestId||data&&data.request_id),
      capturedAt:requested.capturedAt,
      acceptedAt:new Date().toISOString()
    });
  }

  function lockFromProject(source){
    var generation=source&&source.generation||{};
    var input=generation.input||{};
    var pipeline=source&&source.avatar&&source.avatar.pipeline||{};
    var id=clean(pipeline.productionId||generation.productionId||input.productionId||source&&source.productionPlan&&source.productionPlan.productionId);
    if(!id)return null;
    var duration=normalizeDuration(pipeline.duration||input.duration||source&&source.output&&source.output.duration)||'10';
    var ratio=clean(pipeline.aspectRatio||input.aspectRatio||source&&source.output&&source.output.aspectRatio||'16:9');
    return Object.freeze({id:id,projectId:clean(source.id),duration:duration,aspectRatio:ratio,apiAspectRatio:normalizeRatio(ratio),quality:clean(pipeline.quality||input.resolution||source&&source.output&&source.output.quality||'1080p').toLowerCase(),requestId:clean(generation.requestId),capturedAt:pipeline.startedAt||generation.startedAt||new Date().toISOString()});
  }

  function startSeedance(lock){
    if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error('seedance_engine_not_ready');
    window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock;
    var original=window.confirm;window.confirm=function(){return true};
    try{window.AIVOAdFilmSeedanceEngine.generate(lock)}finally{window.confirm=original}
  }

  async function waitForNewSeedance(id,previous){
    for(var i=0;i<180;i++){
      await sleep(i<12?500:1000);
      var data=await request('/api/ad-film/seedance/status?projectId='+encodeURIComponent(id),{method:'GET'});
      var next=clean(data&&data.generation&&data.generation.requestId);
      if(next&&next!==previous)return data;
      if(data.status==='FAILED')throw new Error(clean(data.generation&&data.generation.error)||'seedance_failed');
    }
    throw new Error('seedance_start_timeout');
  }

  async function prepareAvatar(id,lock){
    return request('/api/ad-film/avatar/pipeline/prepare',{method:'POST',body:JSON.stringify({projectId:id,duration:lock.duration,aspect_ratio:lock.apiAspectRatio,quality:lock.quality,production_id:lock.id})});
  }

  async function waitForSeedanceSource(scope,id){
    for(var i=0;i<700;i++){
      var data=await request('/api/ad-film/seedance/status?projectId='+encodeURIComponent(id),{method:'GET'});
      var source=clean(data.source_video_url||data.generation&&data.generation.sourceVideoUrl);
      if(source&&(data.source_ready===true||clean(data.error||data.generation&&data.generation.error)==='avatar_pipeline_not_started'))return data;
      if(data.status==='FAILED')throw new Error(clean(data.error||data.generation&&data.generation.error)||'seedance_failed');
      setStage(scope,text('Önce sinematik ürün filmi hazırlanıyor','Creating the cinematic product film first'),text('Seedance tüm sahne, efekt ve geçişleri tamamlıyor. Oyuncu motoru kaynak film hazır olmadan başlamayacak.','Seedance is completing the scenes, effects and transitions. The presenter engine will not start before the source film is ready.'));
      await sleep(3000);
    }
    throw new Error('seedance_provider_timeout');
  }

  async function startAvatar(id,lock){
    return request('/api/ad-film/avatar/pipeline/create-native-fixed',{method:'POST',body:JSON.stringify({projectId:id,duration:lock.duration,aspect_ratio:lock.apiAspectRatio,quality:lock.quality,production_id:lock.id})});
  }

  async function continueAfterSeedance(scope,button,id,lock){
    setStage(scope,text('Sinematik ürün filmi hazırlanıyor','Creating the cinematic product film'),text('Avatar beklemede. Önce Seedance filmin görsel dilini, efektlerini ve geçişlerini tamamlayacak.','The presenter is waiting. Seedance will first complete the film’s visual language, effects and transitions.'));
    await waitForSeedanceSource(scope,id);
    setStage(scope,text('Ürün filmi hazır, oyunculu sahne başlıyor','Product film ready, presenter scene starting'),text('Oyuncu motoru artık tamamlanmış Seedance filmiyle aynı üretim kilidi altında başlatılıyor.','The presenter engine is now starting under the same production lock after the Seedance film has completed.'));
    var avatar=await startAvatar(id,lock);
    if(avatar&&avatar.project)syncProject(avatar.project,id);
    setStage(scope,text('Oyunculu sahne hazırlanıyor','Preparing the presenter scene'),text('Seedance filmi korunuyor; yalnızca planlanan konuşma bölümü için oyunculu sahne üretiliyor.','The Seedance film is preserved; only the planned speaking segment is being generated.'));
    return avatar;
  }

  async function recoverExisting(scope,button,source){
    var lock=lockFromProject(source);if(!lock||!sourceUrl(source))return false;
    window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock;
    setStage(scope,text('Hazır ürün filmi kurtarılıyor','Recovering the completed product film'),text('Seedance videosu yeniden üretilmeden bekleyen avatar sahnesi başlatılıyor.','The waiting presenter scene is starting without regenerating the completed Seedance video.'));
    var prepared=await prepareAvatar(lock.projectId,lock);
    if(prepared&&prepared.project)syncProject(prepared.project,lock.projectId);
    await continueAfterSeedance(scope,button,lock.projectId,lock);
    return true;
  }

  async function start(scope,button){
    if(starting)return;
    scope=scope||root();button=button||scope&&scope.querySelector('[data-adfilm-build]');
    if(!scope||!enabled(scope))return;
    starting=true;setBusy(button,true);
    try{
      var current=project();
      if(recoverableAvatarStart(current)&&await recoverExisting(scope,button,current))return;
      var requested=captureLock(scope);
      var id=requested.projectId;if(!id)throw new Error('project_not_ready');
      var previous=clean(project()&&project().generation&&project().generation.requestId);
      setStage(scope,text('Ürün filmi başlatılıyor','Starting product film'),text('Seedance önce 15 saniyelik ana reklam filmini tek parça olarak kuracak.','Seedance will first build the main advertising film as one coherent piece.'));
      startSeedance(requested);
      var created=await waitForNewSeedance(id,previous);
      var lock=acceptedLock(requested,created);
      window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock;
      var prepared=await prepareAvatar(id,lock);
      if(prepared&&prepared.project)syncProject(prepared.project,id);
      await continueAfterSeedance(scope,button,id,lock);
    }catch(error){
      setBusy(button,false);
      console.error('[ADFILM] Seedance-first hybrid controller',error,error&&error.data||'');
      notify(text('Hibrit reklam üretimi başlatılamadı: ','Hybrid production could not start: ')+clean(error&&error.message),'error');
      throw error;
    }finally{
      starting=false;
      window.__AIVO_AD_FILM_PRODUCTION_LOCK__=null;
    }
  }

  async function resume(scope,source){
    source=source||project();
    if(!scope||starting)return;
    var pipeline=source&&source.avatar&&source.avatar.pipeline;
    var shouldResume=pipeline&&pipeline.status==='waiting_for_seedance'||recoverableAvatarStart(source);
    if(!shouldResume)return;
    var lock=lockFromProject(source);if(!lock)return;
    var key=lock.projectId+'|'+lock.id;if(resumeKey===key)return;resumeKey=key;
    starting=true;
    try{
      if(recoverableAvatarStart(source))await recoverExisting(scope,scope.querySelector('[data-adfilm-build]'),source);
      else await continueAfterSeedance(scope,scope.querySelector('[data-adfilm-build]'),lock.projectId,lock);
    }
    catch(error){console.error('[ADFILM] Seedance-first resume',error);notify(text('Bekleyen oyunculu sahne devam ettirilemedi: ','The waiting presenter scene could not resume: ')+clean(error&&error.message),'warning')}
    finally{starting=false;resumeKey=""}
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    if(!enabled(scope)||!musicReady(project()))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(starting||button.disabled)return;
    start(scope,button).catch(function(){});
  },true);

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(function(){resume(event.detail.root||root(),project())},500)});
  document.addEventListener('aivo:adfilm-project-sync',function(event){var scope=root(),source=event&&event.detail&&event.detail.project;if(scope&&source)setTimeout(function(){resume(scope,source)},80)});

  window.AIVOAdFilmHybridController={start:start,enabled:enabled,isStarting:function(){return starting},captureLock:captureLock,resume:resume};
})();
