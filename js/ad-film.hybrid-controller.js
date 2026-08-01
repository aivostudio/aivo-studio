/* AIVO AI Reklam Filmi — single owner for hybrid Seedance + avatar startup */
(function AIVO_AD_FILM_HYBRID_CONTROLLER(){
  "use strict";
  if(window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V3__)return;
  window.__AIVO_AD_FILM_HYBRID_CONTROLLER_V3__=true;

  var starting=false;
  function clean(v){return String(v==null?"":v).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||project()&&project().id)}
  function choice(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.dataset.value:fallback}
  function enabled(scope){var toggle=scope&&scope.querySelector('[data-avatar-enabled]');return toggle?!!toggle.checked:project()&&project().avatar&&project().avatar.enabled===true}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:5000});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  async function request(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}
  function setBusy(button,on){if(!button)return;button.disabled=!!on;button.classList.toggle('is-loading',!!on);if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy')}
  function setStage(scope,title,detail){var status=scope&&scope.querySelector('[data-adfilm-engine-status]');if(!status){var action=scope&&scope.querySelector('.adfilm-actionbar'),button=action&&action.querySelector('[data-adfilm-build]');if(action){status=document.createElement('div');status.className='adfilm-engine-status is-visible is-busy';status.setAttribute('data-adfilm-engine-status','');status.innerHTML='<span></span><div><b></b><small></small></div>';if(button)action.insertBefore(status,button);else action.appendChild(status)}}if(status){status.className='adfilm-engine-status is-visible is-busy';var b=status.querySelector('b'),s=status.querySelector('small');if(b)b.textContent=title||'';if(s)s.textContent=detail||''}}
  function startSeedance(){if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error('seedance_engine_not_ready');var original=window.confirm;window.confirm=function(){return true};try{window.AIVOAdFilmSeedanceEngine.generate()}finally{window.confirm=original}}
  async function waitForNewSeedance(id,previous){for(var i=0;i<120;i++){await sleep(i<12?500:1000);var data=await request('/api/ad-film/seedance/status?projectId='+encodeURIComponent(id),{method:'GET'});var next=clean(data&&data.generation&&data.generation.requestId);if(next&&next!==previous)return data;if(data.status==='FAILED')throw new Error(clean(data.generation&&data.generation.error)||'seedance_failed')}throw new Error('seedance_start_timeout')}
  async function startAvatar(scope,id){var ratio=choice(scope,'aspectRatio','16:9');return request('/api/ad-film/avatar/pipeline/create-native',{method:'POST',body:JSON.stringify({projectId:id,duration:choice(scope,'duration','10')==='15'?'15':'10',aspect_ratio:ratio==='4:5'?'3:4':ratio,quality:choice(scope,'quality','1080p')})})}

  async function start(scope,button){
    if(starting)return;
    scope=scope||root();button=button||scope&&scope.querySelector('[data-adfilm-build]');
    if(!scope||!enabled(scope))return;
    starting=true;setBusy(button,true);
    try{
      var id=projectId(scope);if(!id)throw new Error('project_not_ready');
      var previous=clean(project()&&project().generation&&project().generation.requestId);
      setStage(scope,text('Ürün filmi başlatılıyor','Starting product film'),text('Seedance referansları ve yönetmen planı hazırlanıyor.','Preparing Seedance references and director plan.'));
      startSeedance();
      await waitForNewSeedance(id,previous);
      setStage(scope,text('Oyunculu sahne başlatılıyor','Starting presenter scene'),text('Kling aynı ürün, ölçek ve zaman çizelgesiyle hazırlanıyor.','Kling is starting with the same product, scale and timeline.'));
      var avatar=await startAvatar(scope,id);
      if(avatar&&avatar.project){window.AIVOAdFilmActiveProject=avatar.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:avatar.project,projectId:id,media:avatar.project.media||{}}}))}
      setStage(scope,text('İki motor birlikte çalışıyor','Both engines are running'),text('Ürün filmi ve oyunculu sahne tamamlanınca hibrit reklam kurgulanacak.','The hybrid commercial will be edited when both jobs finish.'));
    }catch(error){setBusy(button,false);console.error('[ADFILM] hybrid controller',error);notify(text('Hibrit reklam üretimi başlatılamadı: ','Hybrid production could not start: ')+clean(error&&error.message),'error');throw error}
    finally{starting=false}
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

  window.AIVOAdFilmHybridController={start:start,enabled:enabled,isStarting:function(){return starting}};
})();
