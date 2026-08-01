/* AIVO AI Reklam Filmi — single owner for hybrid Seedance + avatar startup */
(function AIVO_AD_FILM_HYBRID_CONTROLLER(){
  "use strict";
  if(window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V4__)return;
  window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V4__=true;

  var starting=false;
  function clean(v){return String(v==null?"":v).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||project()&&project().id)}
  function choice(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return clean(button&&button.dataset.value)||fallback}
  function enabled(scope){var toggle=scope&&scope.querySelector('[data-avatar-enabled]');return toggle?!!toggle.checked:project()&&project().avatar&&project().avatar.enabled===true}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:5000});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  async function request(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}
  function setBusy(button,on){if(!button)return;button.disabled=!!on;button.classList.toggle('is-loading',!!on);if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy')}
  function setStage(scope,title,detail){var status=scope&&scope.querySelector('[data-adfilm-engine-status]');if(!status){var action=scope&&scope.querySelector('.adfilm-actionbar'),button=action&&action.querySelector('[data-adfilm-build]');if(action){status=document.createElement('div');status.className='adfilm-engine-status is-visible is-busy';status.setAttribute('data-adfilm-engine-status','');status.innerHTML='<span></span><div><b></b><small></small></div>';if(button)action.insertBefore(status,button);else action.appendChild(status)}}if(status){status.className='adfilm-engine-status is-visible is-busy';var b=status.querySelector('b'),s=status.querySelector('small');if(b)b.textContent=title||'';if(s)s.textContent=detail||''}}
  function normalizeDuration(value){value=clean(value);return value==='5'||value==='10'||value==='15'?value:''}
  function normalizeRatio(value){value=clean(value);return value==='4:5'?'3:4':value}
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
  function startSeedance(lock){
    if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error('seedance_engine_not_ready');
    window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock;
    var original=window.confirm;window.confirm=function(){return true};
    try{window.AIVOAdFilmSeedanceEngine.generate(lock)}finally{window.confirm=original}
  }
  async function waitForNewSeedance(id,previous){
    for(var i=0;i<120;i++){
      await sleep(i<12?500:1000);
      var data=await request('/api/ad-film/seedance/status?projectId='+encodeURIComponent(id),{method:'GET'});
      var next=clean(data&&data.generation&&data.generation.requestId);
      if(next&&next!==previous)return data;
      if(data.status==='FAILED')throw new Error(clean(data.generation&&data.generation.error)||'seedance_failed');
    }
    throw new Error('seedance_start_timeout');
  }
  async function startAvatar(id,lock){
    return request('/api/ad-film/avatar/pipeline/create-native-fixed',{method:'POST',body:JSON.stringify({
      projectId:id,
      duration:lock.duration,
      aspect_ratio:lock.apiAspectRatio,
      quality:lock.quality,
      production_id:lock.id
    })});
  }

  async function start(scope,button){
    if(starting)return;
    scope=scope||root();button=button||scope&&scope.querySelector('[data-adfilm-build]');
    if(!scope||!enabled(scope))return;
    starting=true;setBusy(button,true);
    var requested=captureLock(scope);
    try{
      var id=requested.projectId;if(!id)throw new Error('project_not_ready');
      var previous=clean(project()&&project().generation&&project().generation.requestId);
      setStage(scope,text('Ürün filmi başlatılıyor','Starting product film'),text('Süre, kalite, format ve üretim kimliği tek kilit altında hazırlanıyor.','Duration, quality, format and production identity are being prepared under one lock.'));
      startSeedance(requested);
      var created=await waitForNewSeedance(id,previous);
      var lock=acceptedLock(requested,created);
      window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock;
      setStage(scope,text('Oyunculu sahne başlatılıyor','Starting presenter scene'),text('Kling, Seedance tarafından kabul edilen aynı süre ve üretim kilidiyle başlıyor.','Kling is starting with the exact duration and production lock accepted by Seedance.'));
      var avatar=await startAvatar(id,lock);
      if(avatar&&avatar.project){window.AIVOAdFilmActiveProject=avatar.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:avatar.project,projectId:id,media:avatar.project.media||{}}}))}
      setStage(scope,text('İki motor birlikte çalışıyor','Both engines are running'),text('Ürün filmi ve oyunculu sahne tamamlanınca hibrit reklam kurgulanacak.','The hybrid commercial will be edited when both jobs finish.'));
    }catch(error){
      setBusy(button,false);
      console.error('[ADFILM] hybrid controller',error,error&&error.data||'');
      notify(text('Hibrit reklam üretimi başlatılamadı: ','Hybrid production could not start: ')+clean(error&&error.message),'error');
      throw error;
    }finally{
      starting=false;
      window.__AIVO_AD_FILM_PRODUCTION_LOCK__=null;
    }
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    if(!enabled(scope))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(starting||button.disabled)return;
    start(scope,button).catch(function(){});
  },true);

  window.AIVOAdFilmHybridController={start:start,enabled:enabled,isStarting:function(){return starting},captureLock:captureLock};
})();
