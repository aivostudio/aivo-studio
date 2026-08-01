/* AIVO AI Reklam Filmi — native-scene avatar orchestration */
(function AIVO_AD_FILM_AVATAR_ORCHESTRATOR(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V11__)return;
  window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V11__=true;

  var running=false,pollTimer=null,currentLock=null,seedanceGate=null;
  var terminalFailures=new Map();
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
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:5600});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function urlOf(input){return typeof input==='string'?input:input&&input.url||''}
  function bodyOf(init){try{return JSON.parse(init&&typeof init.body==='string'?init.body:'{}')||{}}catch(_){return{}}}
  function cloneInit(init,body){var next=Object.assign({},init||{});next.headers=Object.assign({'Content-Type':'application/json'},next.headers||{});next.body=JSON.stringify(body||{});return next}
  function jsonResponse(payload,status){return new Response(JSON.stringify(payload),{status:status||409,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
  async function responseJson(response){try{return await response.clone().json()}catch(_){return{}}}
  function normalizedDuration(value){value=clean(value);return value==='5'||value==='10'||value==='15'?value:''}
  function normalizedRatio(value){value=clean(value);return value==='4:5'?'3:4':value}
  function terminalCode(code){return[
    'seedance_source_too_short','seedance_generation_not_ready','production_duration_mismatch','production_lock_mismatch',
    'production_aspect_ratio_mismatch','production_quality_mismatch','avatar_provider_timeout',
    'product_identity_conflict','narration_too_long_for_avatar_window','narration_audio_approval_required',
    'music_audio_required','timeline_empty','timeline_gap_or_overlap','timeline_invalid_segment',
    'timeline_duration_mismatch','avatar_pipeline_failed'
  ].indexOf(clean(code))>=0}
  function finalizeKey(init){var body=bodyOf(init);return clean(body.projectId)+'|'+clean(body.outputId)}
  async function jsonRequest(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}

  function durationButton(value){return '<button type="button" data-value="'+value+'"><span>'+value+' sn</span></button>'}
  function updateAvatarDurations(scope){
    scope=scope||root();if(!scope)return;
    var group=scope.querySelector('[data-adfilm-choice="duration"]');if(!group)return;
    var enabled=avatarEnabled(scope);
    var selected=choice(scope,'duration','10');
    var mode=enabled?'avatar':'standard';
    if(group.dataset.avatarDurationMode===mode)return;
    group.dataset.avatarDurationMode=mode;

    if(enabled){
      if(selected!=="5"&&selected!=="10"&&selected!=="15")selected="10";
      group.innerHTML=durationButton("5")+durationButton("10")+durationButton("15");
      group.classList.add('adfilm-options--avatar-duration');
      var note=group.closest('.adfilm-setting-block')&&group.closest('.adfilm-setting-block').querySelector('[data-adfilm-duration-note]');
      if(note){if(!note.dataset.avatarOriginalCopy)note.dataset.avatarOriginalCopy=note.textContent||'';note.textContent=text('Test üretimlerinde avatar ile 5, 10 veya 15 saniye kullanılabilir. En iyi final kalite için 10 veya 15 saniye önerilir.','Presenter tests can use 5, 10 or 15 seconds. Use 10 or 15 seconds for the best final quality.')}
    }else{
      if(selected!=="5"&&selected!=="10"&&selected!=="15"&&selected!=="20")selected="10";
      group.innerHTML=durationButton("5")+durationButton("10")+durationButton("15")+'<button type="button" data-value="20"><span>20 sn</span><em class="adfilm-duration-tag">'+text('Uyumlu motor','Compatible engine')+'</em></button>';
      group.classList.remove('adfilm-options--avatar-duration');
      var standardNote=group.closest('.adfilm-setting-block')&&group.closest('.adfilm-setting-block').querySelector('[data-adfilm-duration-note]');
      if(standardNote&&standardNote.dataset.avatarOriginalCopy)standardNote.textContent=standardNote.dataset.avatarOriginalCopy;
    }

    var target=group.querySelector('button[data-value="'+selected+'"]')||group.querySelector('button[data-value="10"]');
    if(target){target.classList.add('is-selected');target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))}
  }

  function captureSettings(scope){
    var selectedDuration=choice(scope,'duration','10');
    var duration=selectedDuration==='5'?'5':selectedDuration==='15'?'15':'10';
    var ratio=choice(scope,'aspectRatio','16:9');
    var quality=choice(scope,'quality','1080p');
    return Object.freeze({
      id:'adfilm-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),
      projectId:projectId(scope),
      duration:duration,
      aspectRatio:ratio,
      apiAspectRatio:normalizedRatio(ratio),
      quality:quality,
      capturedAt:new Date().toISOString()
    });
  }

  function acceptedProductionLock(requested,created){
    var generation=created&&created.generation||{};
    var input=generation.input||{};
    var plan=created&&created.director_plan||{};
    var acceptedDuration=normalizedDuration(input.duration||plan.duration||requested.duration);
    var acceptedId=clean(created&&created.production_id||generation.productionId||input.productionId||requested.id);
    var acceptedRatio=normalizedRatio(input.aspectRatio||input.aspect_ratio||plan.aspectRatio||requested.apiAspectRatio);
    var acceptedQuality=clean(input.resolution||plan.quality||requested.quality).toLowerCase();
    if(!acceptedDuration||acceptedDuration!==requested.duration)throw new Error('production_duration_mismatch');
    if(!acceptedId||acceptedId!==requested.id)throw new Error('production_lock_mismatch');
    if(acceptedRatio!==normalizedRatio(requested.apiAspectRatio))throw new Error('production_aspect_ratio_mismatch');
    if(acceptedQuality!==clean(requested.quality).toLowerCase())throw new Error('production_quality_mismatch');
    return Object.freeze({
      id:acceptedId,
      projectId:requested.projectId,
      duration:acceptedDuration,
      aspectRatio:requested.aspectRatio,
      apiAspectRatio:acceptedRatio,
      quality:acceptedQuality,
      requestId:clean(created&&created.request_id||generation.requestId),
      capturedAt:requested.capturedAt,
      acceptedAt:new Date().toISOString()
    });
  }

  function setBuildBusy(button,busy){
    if(!button)return;
    var label=button.querySelector('[data-adfilm-i18n="createButton"]')||button.querySelector('span:not(.adfilm-create__icon)');
    if(busy){
      if(label&&!label.dataset.originalText)label.dataset.originalText=label.textContent||'';
      if(label)label.textContent=text('Üretim başlatılıyor…','Starting production…');
      button.disabled=true;button.classList.add('is-loading');button.setAttribute('aria-busy','true');
    }else{
      if(label&&label.dataset.originalText)label.textContent=label.dataset.originalText;
      button.disabled=false;button.classList.remove('is-loading');button.removeAttribute('aria-busy');
    }
  }

  function release(scope){
    running=false;currentLock=null;window.__AIVO_AD_FILM_PRODUCTION_LOCK__=null;
    var button=scope&&scope.querySelector('[data-adfilm-build]');if(button)setBuildBusy(button,false);
  }

  function setStage(scope,title,detail){
    var status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    if(!status){
      var action=scope&&scope.querySelector('.adfilm-actionbar');var button=action&&action.querySelector('[data-adfilm-build]');
      if(action){status=document.createElement('div');status.className='adfilm-engine-status is-visible is-busy';status.setAttribute('data-adfilm-engine-status','');status.innerHTML='<span></span><div><b></b><small></small></div>';if(button)action.insertBefore(status,button);else action.appendChild(status)}
    }
    if(status){status.className='adfilm-engine-status is-visible is-busy';var strong=status.querySelector('b'),small=status.querySelector('small');if(strong)strong.textContent=title||'';if(small)small.textContent=detail||''}
  }
  function stageText(stage){
    if(stage==='lipsync')return{text:text('Oyuncunun konuşması hazırlanıyor','Synchronizing presenter speech'),detail:text('Dudak, yüz ve konuşma zamanlaması gerçek sahne videosuna uygulanıyor.','Applying lip, face and speech timing to the native scene video.')};
    return{text:text('Oyuncu gerçek reklam sahnesine yerleştiriliyor','Integrating presenter into the real ad scene'),detail:text('Oyuncu, ürün, zemin, ışık, gölge ve kamera aynı sahne içinde birlikte üretiliyor.','Generating presenter, product, floor, lighting, shadows and camera inside one coherent scene.')};
  }
  function holdGeneration(next){
    var avatar=next&&next.avatar,pipeline=avatar&&avatar.pipeline,generation=next&&next.generation;
    if(!avatar||avatar.enabled!==true||!pipeline||pipeline.status==='completed'||pipeline.status==='failed'||!generation)return next;
    if(String(generation.status)==='completed'&&(generation.videoUrl||generation.sourceVideoUrl)){
      next.generation=Object.assign({},generation,{status:'processing',avatarWaiting:true});
      next.status='processing';
    }
    return next;
  }

  function createSeedanceGate(){
    var resolveGate,rejectGate;
    var promise=new Promise(function(resolve,reject){resolveGate=resolve;rejectGate=reject});
    var timer=setTimeout(function(){rejectGate(new Error('seedance_start_timeout'))},90000);
    return{
      promise:promise.finally(function(){clearTimeout(timer)}),
      resolve:function(value){resolveGate(value)},
      reject:function(error){rejectGate(error)}
    };
  }

  window.fetch=async function(input,init){
    var url=urlOf(input);
    var nextInit=init;
    var lock=window.__AIVO_AD_FILM_PRODUCTION_LOCK__||currentLock;
    var isSeedanceCreate=url.indexOf('/api/ad-film/seedance/create')>=0;
    var isFinalize=url.indexOf('/api/ad-film/seedance/finalize')>=0;

    if(isSeedanceCreate&&lock){
      var createBody=bodyOf(init);
      createBody.duration=lock.duration;
      createBody.resolution=lock.quality;
      createBody.aspect_ratio=lock.apiAspectRatio;
      createBody.production_id=lock.id;
      nextInit=cloneInit(init,createBody);
    }

    var key=isFinalize?finalizeKey(nextInit):'';
    if(isFinalize&&key&&terminalFailures.has(key))return terminalFailures.get(key).clone();

    var response=await nativeFetch(input,nextInit);
    try{
      if(isSeedanceCreate){
        var created=await responseJson(response);
        if(response.ok){if(seedanceGate)seedanceGate.resolve(created)}
        else if(seedanceGate){var createError=new Error(created.message||created.error||'seedance_start_failed');createError.status=response.status;createError.data=created;seedanceGate.reject(createError)}
      }

      if(isFinalize){
        var finalizedPayload=await responseJson(response);
        if(terminalCode(finalizedPayload.error)){
          var terminal=jsonResponse(finalizedPayload,response.status||409);
          if(key)terminalFailures.set(key,terminal.clone());
          return terminal;
        }
        if(response.ok&&key)terminalFailures.delete(key);
      }

      if(url.indexOf('/api/ad-film/seedance/status')<0||!response.ok)return response;
      var current=project(),avatar=current&&current.avatar,pipeline=avatar&&avatar.pipeline;
      if(!avatar||avatar.enabled!==true||!pipeline)return response;
      var data=await responseJson(response);if(!data)return response;
      if(pipeline.status==='failed'){
        data.status='FAILED';data.video_url=null;data.generation=Object.assign({},data.generation||{},{error:pipeline.error||'avatar_pipeline_failed'});
      }else if(pipeline.status!=='completed'||!pipeline.videoUrl){data.status='RUNNING'}
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch(error){
      if(isSeedanceCreate&&seedanceGate)seedanceGate.reject(error);
      return response;
    }
  };

  async function poll(scope,id,count){
    clearTimeout(pollTimer);
    if(count>=MAX_POLLS){release(scope);return}
    try{
      var data=await jsonRequest('/api/ad-film/avatar/pipeline/status-native?projectId='+encodeURIComponent(id),{method:'GET'});
      if(data.project){data.project=holdGeneration(data.project);window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||id,media:data.project.media||{}}}))}
      if(data.status==='COMPLETED'){release(scope);document.dispatchEvent(new CustomEvent('aivo:adfilm-avatar-ready',{detail:data}));return}
      if(data.status==='FAILED'){
        release(scope);notify(errorMessage({message:data.error||data.pipeline&&data.pipeline.error||'avatar_pipeline_failed'}),'error');document.dispatchEvent(new CustomEvent('aivo:adfilm-avatar-failed',{detail:data}));return;
      }
      var copy=stageText(data.stage);setStage(scope,copy.text,copy.detail);
      pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);
    }catch(error){
      if(count<8&&!terminalCode(error&&error.message)){pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);return}
      release(scope);console.error('[ADFILM] native avatar pipeline poll',error);notify(errorMessage(error),terminalCode(error&&error.message)?'error':'warning');
    }
  }

  async function start(scope,lock){
    var id=lock&&lock.projectId||projectId(scope);if(!id)throw new Error('project_not_ready');
    if(!avatarImage())throw new Error('avatar_image_required');
    if(!lock||!lock.id||!lock.duration)throw new Error('production_lock_mismatch');
    var data=await jsonRequest('/api/ad-film/avatar/pipeline/create-native-fixed',{method:'POST',body:JSON.stringify({projectId:id,duration:lock.duration,aspect_ratio:lock.apiAspectRatio,quality:lock.quality,production_id:lock.id})});
    if(data.project){data.project=holdGeneration(data.project);window.AIVOAdFilmActiveProject=data.project;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:data.project,projectId:data.project.id||id,media:data.project.media||{}}}))}
    running=true;poll(scope,id,0);return data;
  }

  function invokeSeedance(lock){
    if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error('seedance_engine_not_ready');
    window.__AIVO_AD_FILM_PRODUCTION_LOCK__=lock||null;
    var originalConfirm=window.confirm;window.confirm=function(){return true};
    try{return window.AIVOAdFilmSeedanceEngine.generate(lock||undefined)}finally{window.confirm=originalConfirm}
  }

  function errorMessage(error){
    var code=clean(error&&error.message);
    if(code==='avatar_image_required')return text('Avatar açıkken önce bir avatar seç veya yükle.','Select or upload an avatar while the avatar feature is enabled.');
    if(code==='narration_audio_approval_required')return text('Konuşan oyuncu için sesi oluşturup onayla.','Generate and approve the voice for the talking presenter.');
    if(code==='narration_too_long_for_avatar_window')return text('Onaylı ses seçilen kısa videodaki oyuncu süresine sığmıyor. Metni kısaltıp sesi yeniden oluştur veya 10–15 saniye seç.','The approved voice does not fit the presenter window. Shorten and regenerate it or choose 10–15 seconds.');
    if(code==='product_identity_conflict')return text('Ürün adı, açıklama ve seslendirme farklı ürünleri tarif ediyor. Ürün bilgilerini düzelt veya yeni proje oluştur.','The product name, description and narration describe different products. Correct the project or create a new one.');
    if(code==='seedance_source_too_short'||code==='seedance_generation_not_ready'||code==='production_duration_mismatch'||code==='production_lock_mismatch'||code==='production_aspect_ratio_mismatch'||code==='production_quality_mismatch')return text('Ürün filmi ile oyuncu motorunun üretim kilidi eşleşmedi. Hiçbir ek oyuncu üretimi başlatılmadan işlem durduruldu.','The product-film and presenter production locks did not match. The process stopped before any additional presenter generation was started.');
    if(code==='avatar_provider_timeout')return text('Oyuncu motoru izin verilen süre içinde tamamlanmadı. Takılı üretim kapatıldı; yeniden deneyebilirsin.','The presenter engine did not finish within the allowed time. The stuck generation was closed; you can retry.');
    if(code==='seedance_start_timeout')return text('Ürün filmi motoru zamanında başlatılamadı. Oyuncu motoru çalıştırılmadı.','The product-film engine did not start in time. The presenter engine was not started.');
    if(code==='product_reference_required')return text('Ana ürün referansı bulunamadı. Ürün görsellerini yeniden seçip tekrar dene.','The hero product reference is missing. Select the product images again and retry.');
    if(code==='background_removal_failed'||code==='background_removal_missing_output')return text('Oyuncu görseli hazırlanamadı. Üretim başlatılmadı.','The presenter image could not be prepared. Production was not started.');
    if(code==='project_not_ready')return text('Proje bulut bağlantısı henüz hazır değil.','The project cloud connection is not ready yet.');
    return text('Oyunculu reklam motorları başlatılamadı. Tekrar dene.','Presenter ad engines could not be started. Try again.');
  }

  document.addEventListener('change',function(event){if(event.target&&event.target.matches&&event.target.matches('[data-module-root][data-module="adfilm"] [data-avatar-enabled]'))setTimeout(function(){updateAvatarDurations(root())},0)},true);

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    if(!avatarEnabled(scope))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(running||button.disabled)return;
    var requestedLock=captureSettings(scope);
    currentLock=requestedLock;
    if(!requestedLock.projectId){notify(errorMessage({message:'project_not_ready'}),'error');return}
    terminalFailures.clear();
    running=true;setBuildBusy(button,true);
    setStage(scope,text('Üretim başlatıldı','Production started'),text('Süre ve çıktı ayarları kilitlendi; ürün filmi onaylandıktan sonra aynı kilitle oyuncu motoru başlayacak.','Duration and output settings are locked; the presenter starts with the same accepted lock after the product-film request is accepted.'));
    (async function(){
      try{
        seedanceGate=createSeedanceGate();
        invokeSeedance(requestedLock);
        var created=await seedanceGate.promise;
        seedanceGate=null;
        var acceptedLock=acceptedProductionLock(requestedLock,created);
        currentLock=acceptedLock;
        window.__AIVO_AD_FILM_PRODUCTION_LOCK__=acceptedLock;
        await start(scope,acceptedLock);
      }catch(error){
        seedanceGate=null;release(scope);console.error('[ADFILM] native avatar orchestrator',error);notify(errorMessage(error),'error')
      }
    })();
  },true);

  function resume(scope,next){
    next=holdGeneration(next);if(next)window.AIVOAdFilmActiveProject=next;
    var pipeline=next&&next.avatar&&next.avatar.pipeline;
    if(!pipeline||pipeline.status==='completed'||pipeline.status==='failed'||!next.id)return;
    if(running)return;running=true;var copy=stageText(pipeline.stage);setStage(scope,copy.text,copy.detail);poll(scope,next.id,0);
  }
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(function(){var scope=event.detail.root||root();var next=holdGeneration(project());if(next)window.AIVOAdFilmActiveProject=next;updateAvatarDurations(scope);resume(scope,next)},120)});
  document.addEventListener('aivo:adfilm-project-sync',function(event){var scope=root(),next=event&&event.detail&&event.detail.project;if(scope&&next){next=holdGeneration(next);event.detail.project=next;window.AIVOAdFilmActiveProject=next;updateAvatarDurations(scope);resume(scope,next)}});
  window.addEventListener('pagehide',function(){clearTimeout(pollTimer)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){updateAvatarDurations(root())},180)},{once:true});else setTimeout(function(){updateAvatarDurations(root())},180);
})();
