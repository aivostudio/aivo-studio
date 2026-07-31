/* AIVO AI Reklam Filmi — one-click avatar motion orchestration */
(function AIVO_AD_FILM_AVATAR_ORCHESTRATOR(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V4__)return;
  window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V4__=true;

  var running=false,pollTimer=null;
  var POLL_MS=3500,MAX_POLLS=700;
  var nativeFetch=window.fetch.bind(window);

  function clean(value){return String(value==null?"":value).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||project()&&project().id)}
  function choice(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.dataset.value:fallback}
  function avatarEnabled(scope){var toggle=scope&&scope.querySelector('[data-avatar-enabled]');return toggle?!!toggle.checked:project()&&project().avatar&&project().avatar.enabled===true}
  function avatarImage(){return project()&&project().avatar&&project().avatar.image&&project().avatar.image.url}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:4200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  async function jsonRequest(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}
  function setStage(scope,title,detail){
    var status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    if(!status){
      var action=scope&&scope.querySelector('.adfilm-actionbar');var button=action&&action.querySelector('[data-adfilm-build]');
      if(action){status=document.createElement('div');status.className='adfilm-engine-status is-visible is-busy';status.setAttribute('data-adfilm-engine-status','');status.innerHTML='<span></span><div><b></b><small></small></div>';if(button)action.insertBefore(status,button);else action.appendChild(status)}
    }
    if(status){status.className='adfilm-engine-status is-visible is-busy';var strong=status.querySelector('b'),small=status.querySelector('small');if(strong)strong.textContent=title||'';if(small)small.textContent=detail||''}
  }
  function stageText(stage){
    if(stage==='lipsync')return{text:text('Avatar konuşmaya uyarlanıyor','Synchronizing avatar speech'),detail:text('Dudak, yüz ve konuşma zamanlaması hazırlanıyor.','Preparing lip, face and speech timing.')};
    if(stage==='matting')return{text:text('Avatar transparanlaştırılıyor','Removing avatar background'),detail:text('Saç, kıyafet ve beden kenarları reklam sahnesine yerleştirilmek üzere işleniyor.','Refining hair, clothing and body edges for compositing into the ad scene.')};
    return{text:text('Sinematik avatar performansı hazırlanıyor','Preparing cinematic avatar performance'),detail:text('Beden hareketi, yürüyüş ve kamera koreografisi oluşturuluyor.','Generating body motion, walking and camera choreography.')};
  }
  function holdGeneration(next){
    var avatar=next&&next.avatar,pipeline=avatar&&avatar.pipeline,generation=next&&next.generation;
    if(!avatar||avatar.enabled!==true||!pipeline||pipeline.status==='completed'||pipeline.status==='failed'||!generation)return next;
    if(String(generation.status)==='completed'&&generation.videoUrl){
      next.generation=Object.assign({},generation,{status:'processing',avatarWaiting:true});
      next.status='processing';
    }
    return next;
  }

  window.fetch=async function(input,init){
    var response=await nativeFetch(input,init);
    try{
      var url=typeof input==='string'?input:input&&input.url||'';
      if(url.indexOf('/api/ad-film/seedance/status')<0||!response.ok)return response;
      var current=project(),avatar=current&&current.avatar,pipeline=avatar&&avatar.pipeline;
      if(!avatar||avatar.enabled!==true||!pipeline)return response;
      var data=await response.clone().json().catch(function(){return null});if(!data)return response;
      if(pipeline.status==='failed'){
        data.status='FAILED';
        data.video_url=null;
        data.generation=Object.assign({},data.generation||{},{error:pipeline.error||'avatar_pipeline_failed'});
      }else if(pipeline.status!=='completed'||!pipeline.transparentVideoUrl){
        data.status='RUNNING';
      }
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch(_){return response}
  };

  async function poll(scope,id,count){
    clearTimeout(pollTimer);
    if(count>=MAX_POLLS){running=false;return}
    try{
      var data=await jsonRequest('/api/ad-film/avatar/pipeline/status?projectId='+encodeURIComponent(id),{method:'GET'});
      if(data.project){data.project=holdGeneration(data.project);window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||id,media:data.project.media||{}}}))}
      if(data.status==='COMPLETED'){running=false;document.dispatchEvent(new CustomEvent('aivo:adfilm-avatar-ready',{detail:data}));return}
      if(data.status==='FAILED'){
        running=false;
        notify(text('Avatar performansı hazırlanamadı. Üretim durduruldu.','Avatar performance could not be prepared. Production was stopped.'),'error');
        document.dispatchEvent(new CustomEvent('aivo:adfilm-avatar-failed',{detail:data}));return;
      }
      var copy=stageText(data.stage);setStage(scope,copy.text,copy.detail);
      pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);
    }catch(error){
      if(count<8){pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);return}
      running=false;console.error('[ADFILM] avatar pipeline poll',error);notify(text('Avatar motoru takip edilemedi. Sayfayı yenileyerek devam edebilirsin.','Avatar engine could not be monitored. Reload the page to continue.'),'warning');
    }
  }
  async function start(scope){
    var id=projectId(scope);if(!id)throw new Error('project_not_ready');
    if(!avatarImage())throw new Error('avatar_image_required');
    var duration=choice(scope,'duration','10'),ratio=choice(scope,'aspectRatio','16:9');
    var data=await jsonRequest('/api/ad-film/avatar/pipeline/create',{method:'POST',body:JSON.stringify({projectId:id,duration:duration,aspect_ratio:ratio==='4:5'?'3:4':ratio})});
    if(data.project){data.project=holdGeneration(data.project);window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||id,media:data.project.media||{}}}))}
    running=true;poll(scope,id,0);return data;
  }
  function invokeSeedance(){
    if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error('seedance_engine_not_ready');
    var originalConfirm=window.confirm;
    window.confirm=function(){return true};
    try{window.AIVOAdFilmSeedanceEngine.generate()}finally{window.confirm=originalConfirm}
  }
  function errorMessage(error){
    var code=clean(error&&error.message);
    if(code==='avatar_image_required')return text('Avatar açıkken önce bir avatar seç veya yükle.','Select or upload an avatar while the avatar feature is enabled.');
    if(code==='narration_audio_approval_required')return text('Konuşan avatar için sesi oluşturup onayla.','Generate and approve the voice for the talking avatar.');
    if(code==='avatar_image_background_removal_failed'||code==='avatar_image_background_removal_missing_output')return text('Avatar görselinin arka planı kaldırılamadı. Üretim başlatılmadı.','The avatar image background could not be removed. Production was not started.');
    if(code==='project_not_ready')return text('Proje bulut bağlantısı henüz hazır değil.','The project cloud connection is not ready yet.');
    return text('Avatar motorları başlatılamadı. Tekrar dene.','Avatar engines could not be started. Try again.');
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    if(!avatarEnabled(scope))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(running||button.disabled)return;
    if(!window.confirm(text('Bu üretim ürün videosu, sinematik avatar hareketi, dudak senkronu ve transparanlaştırma motorlarını çalıştırır. Fal.ai bakiyesinden ücret düşebilir. Devam edilsin mi?','This production runs product video, cinematic avatar motion, lip-sync and background-removal engines and may use Fal.ai balance. Continue?')))return;
    (async function(){
      try{
        setStage(scope,text('Avatar motorları başlatılıyor','Starting avatar engines'),text('AIVO tüm üretim zincirini tek akışta hazırlıyor.','AIVO is preparing the complete production chain.'));
        await start(scope);
        invokeSeedance();
      }catch(error){running=false;console.error('[ADFILM] avatar orchestrator',error);notify(errorMessage(error),'error')}
    })();
  },true);

  function resume(scope,next){
    next=holdGeneration(next);
    if(next)window.AIVOAdFilmActiveProject=next;
    var pipeline=next&&next.avatar&&next.avatar.pipeline;
    if(!pipeline||pipeline.status==='completed'||pipeline.status==='failed'||!next.id)return;
    if(running)return;running=true;var copy=stageText(pipeline.stage);setStage(scope,copy.text,copy.detail);poll(scope,next.id,0);
  }
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(function(){var next=holdGeneration(project());if(next)window.AIVOAdFilmActiveProject=next;resume(event.detail.root||root(),next)},700)});
  document.addEventListener('aivo:adfilm-project-sync',function(event){var scope=root(),next=event&&event.detail&&event.detail.project;if(scope&&next){next=holdGeneration(next);event.detail.project=next;window.AIVOAdFilmActiveProject=next;resume(scope,next)}});
  window.addEventListener('pagehide',function(){clearTimeout(pollTimer)});
})();
