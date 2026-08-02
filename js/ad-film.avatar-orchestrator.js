/* AIVO AI Reklam Filmi — avatar pipeline observer and status bridge */
(function AIVO_AD_FILM_AVATAR_ORCHESTRATOR(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V12__)return;
  window.__AIVO_AD_FILM_AVATAR_ORCHESTRATOR_V12__=true;

  var running=false;
  var pollTimer=null;
  var currentProjectId="";
  var POLL_MS=3500;
  var MAX_POLLS=700;
  var nativeFetch=window.fetch.bind(window);
  var terminalFailures=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function choice(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.dataset.value:fallback}
  function avatarEnabled(scope){var toggle=scope&&scope.querySelector('[data-avatar-enabled]');return toggle?!!toggle.checked:project()&&project().avatar&&project().avatar.enabled===true}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:5600});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function bodyOf(init){try{return JSON.parse(init&&typeof init.body==="string"?init.body:"{}")||{}}catch(_){return{}}}
  function cloneInit(init,body){var next=Object.assign({},init||{});next.headers=Object.assign({"Content-Type":"application/json"},next.headers||{});next.body=JSON.stringify(body||{});return next}
  function jsonResponse(payload,status){return new Response(JSON.stringify(payload),{status:status||409,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
  async function responseJson(response){try{return await response.clone().json()}catch(_){return{}}}
  async function jsonRequest(url,options){var response=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var data=await response.json().catch(function(){return{}});if(!response.ok){var error=new Error(data.message||data.error||"request_failed");error.status=response.status;error.data=data;throw error}return data}
  function terminalCode(code){return[
    "seedance_source_too_short","production_duration_mismatch","production_lock_mismatch",
    "production_aspect_ratio_mismatch","production_quality_mismatch","avatar_provider_timeout",
    "product_identity_conflict","narration_too_long_for_avatar_window","narration_audio_approval_required",
    "music_audio_required","timeline_empty","timeline_gap_or_overlap","timeline_invalid_segment",
    "timeline_duration_mismatch","avatar_pipeline_failed"
  ].indexOf(clean(code))>=0}
  function finalizeKey(init){var body=bodyOf(init);return clean(body.projectId)+"|"+clean(body.outputId)}

  function durationButton(value){return '<button type="button" data-value="'+value+'"><span>'+value+' sn</span></button>'}
  function updateAvatarDurations(scope){
    scope=scope||root();if(!scope)return;
    var group=scope.querySelector('[data-adfilm-choice="duration"]');if(!group)return;
    var enabled=avatarEnabled(scope);
    var selected=choice(scope,"duration","10");
    var mode=enabled?"avatar":"standard";
    if(group.dataset.avatarDurationMode===mode)return;
    group.dataset.avatarDurationMode=mode;
    if(enabled){
      if(selected!=="5"&&selected!=="10"&&selected!=="15")selected="10";
      group.innerHTML=durationButton("5")+durationButton("10")+durationButton("15");
      group.classList.add("adfilm-options--avatar-duration");
      var note=group.closest('.adfilm-setting-block')&&group.closest('.adfilm-setting-block').querySelector('[data-adfilm-duration-note]');
      if(note){if(!note.dataset.avatarOriginalCopy)note.dataset.avatarOriginalCopy=note.textContent||"";note.textContent=text("Avatar ile 5, 10 veya 15 saniye kullanılabilir. En iyi final kalite için 10 veya 15 saniye önerilir.","Presenter productions can use 5, 10 or 15 seconds. Use 10 or 15 seconds for the best final quality.")}
    }else{
      if(selected!=="5"&&selected!=="10"&&selected!=="15"&&selected!=="20")selected="10";
      group.innerHTML=durationButton("5")+durationButton("10")+durationButton("15")+'<button type="button" data-value="20"><span>20 sn</span><em class="adfilm-duration-tag">'+text("Uyumlu motor","Compatible engine")+'</em></button>';
      group.classList.remove("adfilm-options--avatar-duration");
      var standardNote=group.closest('.adfilm-setting-block')&&group.closest('.adfilm-setting-block').querySelector('[data-adfilm-duration-note]');
      if(standardNote&&standardNote.dataset.avatarOriginalCopy)standardNote.textContent=standardNote.dataset.avatarOriginalCopy;
    }
    var target=group.querySelector('button[data-value="'+selected+'"]')||group.querySelector('button[data-value="10"]');
    if(target){target.classList.add("is-selected");target.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}))}
  }

  function setStage(scope,title,detail){
    var status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    if(!status){
      var action=scope&&scope.querySelector('.adfilm-actionbar');
      var button=action&&action.querySelector('[data-adfilm-build]');
      if(action){status=document.createElement("div");status.className="adfilm-engine-status is-visible is-busy";status.setAttribute("data-adfilm-engine-status","");status.innerHTML="<span></span><div><b></b><small></small></div>";if(button)action.insertBefore(status,button);else action.appendChild(status)}
    }
    if(status){status.className="adfilm-engine-status is-visible is-busy";var strong=status.querySelector("b"),small=status.querySelector("small");if(strong)strong.textContent=title||"";if(small)small.textContent=detail||""}
  }
  function stageText(stage){
    if(stage==="lipsync")return{text:text("Oyuncunun konuşması hazırlanıyor","Synchronizing presenter speech"),detail:text("Dudak, yüz ve konuşma zamanlaması gerçek sahne videosuna uygulanıyor.","Applying lip, face and speech timing to the native scene video.")};
    if(stage==="rendering")return{text:text("Reklam filminin final montajı hazırlanıyor","Preparing the final commercial edit"),detail:text("Ürün filmi, oyunculu sahne, konuşma, müzik ve logo tek final videoda birleştiriliyor.","Combining the product film, presenter scene, narration, music and logo into one final video.")};
    return{text:text("Oyuncu gerçek reklam sahnesine yerleştiriliyor","Integrating presenter into the real ad scene"),detail:text("Oyuncu, ürün, zemin, ışık, gölge ve kamera aynı sahne içinde birlikte üretiliyor.","Generating presenter, product, floor, lighting, shadows and camera inside one coherent scene.")};
  }
  function holdGeneration(next){
    var avatar=next&&next.avatar,pipeline=avatar&&avatar.pipeline,generation=next&&next.generation;
    if(!avatar||avatar.enabled!==true||!pipeline||pipeline.status==="completed"||pipeline.status==="failed"||!generation)return next;
    if(String(generation.status)==="completed"&&(generation.videoUrl||generation.sourceVideoUrl)){
      next.generation=Object.assign({},generation,{status:"processing",avatarWaiting:true});
      next.status="processing";
    }
    return next;
  }
  function syncProject(next,id){
    if(!next)return;
    next=holdGeneration(next);
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||id||"",media:next.media||{}}}));
  }
  function release(){running=false;currentProjectId="";clearTimeout(pollTimer)}
  function errorMessage(error){
    var code=clean(error&&error.message||error);
    if(code==="avatar_provider_timeout")return text("Oyuncu motoru izin verilen süre içinde tamamlanmadı.","The presenter engine did not finish within the allowed time.");
    if(code==="production_lock_mismatch")return text("Ürün filmi ile oyuncu motorunun üretim kilidi eşleşmedi.","The product-film and presenter production locks did not match.");
    return text("Oyunculu reklam aşaması tamamlanamadı.","The presenter production stage could not be completed.");
  }

  window.fetch=async function(input,init){
    var url=urlOf(input);
    var nextInit=init;
    var lock=window.__AIVO_AD_FILM_PRODUCTION_LOCK__||null;
    var isSeedanceCreate=url.indexOf("/api/ad-film/seedance/create")>=0;
    var isFinalize=url.indexOf("/api/ad-film/seedance/finalize")>=0;
    if(isSeedanceCreate&&lock){
      var createBody=bodyOf(init);
      createBody.duration=lock.duration;
      createBody.resolution=lock.quality;
      createBody.aspect_ratio=lock.apiAspectRatio;
      createBody.production_id=lock.id;
      nextInit=cloneInit(init,createBody);
    }
    var key=isFinalize?finalizeKey(nextInit):"";
    if(isFinalize&&key&&terminalFailures.has(key))return terminalFailures.get(key).clone();
    var response=await nativeFetch(input,nextInit);
    try{
      if(isFinalize){
        var payload=await responseJson(response);
        if(terminalCode(payload.error)){
          var terminal=jsonResponse(payload,response.status||409);
          if(key)terminalFailures.set(key,terminal.clone());
          return terminal;
        }
        if(response.ok&&key)terminalFailures.delete(key);
      }
      if(url.indexOf("/api/ad-film/seedance/status")<0||!response.ok)return response;
      var current=project(),avatar=current&&current.avatar,pipeline=avatar&&avatar.pipeline;
      if(!avatar||avatar.enabled!==true||!pipeline)return response;
      var data=await responseJson(response);if(!data)return response;
      if(pipeline.status==="failed"){
        data.status="FAILED";data.video_url=null;data.generation=Object.assign({},data.generation||{},{error:pipeline.error||"avatar_pipeline_failed"});
      }else if(pipeline.status!=="completed"||!pipeline.videoUrl){
        data.status="RUNNING";
      }
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
    }catch(_){return response}
  };

  async function poll(scope,id,count){
    clearTimeout(pollTimer);
    if(count>=MAX_POLLS){release();notify(text("Oyuncu aşaması zaman aşımına uğradı.","The presenter stage timed out."),"warning");return}
    try{
      var data=await jsonRequest('/api/ad-film/avatar/pipeline/status-native?projectId='+encodeURIComponent(id),{method:"GET"});
      if(data.project)syncProject(data.project,id);
      if(data.status==="COMPLETED"){
        release();
        document.dispatchEvent(new CustomEvent("aivo:adfilm-avatar-ready",{detail:data}));
        return;
      }
      if(data.status==="FAILED"){
        release();
        notify(errorMessage(data.error||data.pipeline&&data.pipeline.error||"avatar_pipeline_failed"),"error");
        document.dispatchEvent(new CustomEvent("aivo:adfilm-avatar-failed",{detail:data}));
        return;
      }
      var copy=stageText(data.stage);setStage(scope,copy.text,copy.detail);
      pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);
    }catch(error){
      if(count<8&&!terminalCode(error&&error.message)){pollTimer=setTimeout(function(){poll(scope,id,count+1)},POLL_MS);return}
      release();
      console.error("[ADFILM] native avatar pipeline poll",error);
      notify(errorMessage(error),terminalCode(error&&error.message)?"error":"warning");
    }
  }

  function resume(scope,next){
    next=holdGeneration(next);if(next)window.AIVOAdFilmActiveProject=next;
    var pipeline=next&&next.avatar&&next.avatar.pipeline;
    if(!pipeline||pipeline.status==="completed"||pipeline.status==="failed"||!next.id)return;
    if(running&&currentProjectId===next.id)return;
    running=true;currentProjectId=next.id;
    var copy=stageText(pipeline.stage);setStage(scope,copy.text,copy.detail);
    poll(scope,next.id,0);
  }

  document.addEventListener("change",function(event){if(event.target&&event.target.matches&&event.target.matches('[data-module-root][data-module="adfilm"] [data-avatar-enabled]'))setTimeout(function(){updateAvatarDurations(root())},0)},true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){var scope=event.detail.root||root();updateAvatarDurations(scope);resume(scope,project())},120)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var scope=root(),next=event&&event.detail&&event.detail.project;if(scope&&next){event.detail.project=holdGeneration(next);updateAvatarDurations(scope);resume(scope,event.detail.project)}});
  window.addEventListener("pagehide",release);

  window.AIVOAdFilmAvatarObserver={resume:resume,isRunning:function(){return running},projectId:function(){return currentProjectId}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){updateAvatarDurations(root())},180)},{once:true});else setTimeout(function(){updateAvatarDurations(root())},180);
})();