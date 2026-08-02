/* AIVO AI Reklam Filmi — stable customer-facing production progress */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_STABILITY_V8__)return;
  window.__AIVO_AD_FILM_PROGRESS_STABILITY_V8__=true;

  var timer=null;
  var visibleStage=null;
  var pendingStage=null;
  var visibleStageAt=0;
  var MIN_STAGE_MS=4000;
  var LAUNCH_LATCH_MS=120000;
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function buildButton(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value==null?"":value).trim()}
  function setText(node,value){value=String(value==null?"":value);if(node&&node.textContent!==value)node.textContent=value}
  function setClass(node,value){if(node&&node.className!==value)node.className=value}
  function pipeline(source){return source&&source.avatar&&source.avatar.pipeline||{}}
  function generation(source){return source&&source.generation||{}}
  function finalization(source){var gen=generation(source);return source&&source.finalization||gen.finalization||{}}
  function statusValue(value){return clean(value).toLowerCase()}
  function isOneOf(value,list){return list.indexOf(statusValue(value))>=0}
  function currentProjectId(){var source=project(),scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function formatElapsed(total){var minutes=Math.floor(total/60),seconds=total%60;return minutes+" "+(english()?"min":"dk")+" "+String(seconds).padStart(2,"0")+" "+(english()?"sec":"sn")}
  function elapsedFrom(value){var started=Date.parse(value||"");if(!Number.isFinite(started))return"";return formatElapsed(Math.max(0,Math.floor((Date.now()-started)/1000)))}
  function productionStartedAt(source){
    var gen=generation(source),current=pipeline(source),latch=window[LATCH_KEY]||{};
    return gen.startedAt||gen.createdAt||current.productionStartedAt||current.originalStartedAt||current.startedAt||latch.startedAt||current.updatedAt||"";
  }
  function pipelineActive(source){return isOneOf(pipeline(source).status,["waiting_for_seedance","motion_queued","motion_processing","lipsync_queued","lipsync_processing","rendering"])}
  function generationActive(source){
    var gen=generation(source),state=statusValue(gen.status),projectState=statusValue(source&&source.status);
    return ["queued","processing","running","in_queue"].indexOf(state)>=0||["queued","processing","running","in_queue"].indexOf(projectState)>=0||gen.awaitingFinalComposite===true||gen.avatarWaiting===true||gen.finalizing===true;
  }
  function generating(){
    var button=buildButton();
    return Boolean(button&&(button.classList.contains("is-generating")||button.classList.contains("is-loading")||button.getAttribute("aria-busy")==="true"));
  }
  function latch(){return window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:null}
  function latchActive(){
    var value=latch();if(!value)return false;
    if(Number(value.until||0)<=Date.now()){clearLatch();return false}
    var pid=currentProjectId();
    return !value.projectId||!pid||clean(value.projectId)===pid;
  }
  function setLatch(){
    var now=Date.now();
    window[LATCH_KEY]={projectId:currentProjectId(),startedAt:new Date(now).toISOString(),until:now+LAUNCH_LATCH_MS};
  }
  function clearLatch(){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}}
  function terminalState(source){
    var values=[
      source&&source.status,
      generation(source).status,
      pipeline(source).status,
      finalization(source).status
    ].map(statusValue);
    if(values.some(function(value){return value==="cancelled"||value==="canceled"}))return"cancelled";
    if(values.some(function(value){return value==="failed"||value==="error"}))return"failed";
    return"";
  }
  function productionActive(source){return Boolean(source&&!terminalState(source)&&(latchActive()||pipelineActive(source)||generationActive(source)||generating()))}
  function finalReady(source){
    if(!source||pipelineActive(source)||terminalState(source))return false;
    var gen=generation(source),finish=finalization(source),current=pipeline(source);
    if(gen.awaitingFinalComposite===true||gen.avatarWaiting===true||gen.sourceOnly===true||gen.finalizing===true)return false;
    if(statusValue(finish.status)==="completed"&&clean(gen.videoUrl))return true;
    if(Number(gen.mixVersion||0)>=4&&clean(gen.videoUrl))return true;
    if(statusValue(gen.status)==="completed"&&clean(gen.videoUrl))return true;
    return statusValue(current.status)==="completed"&&clean(current.videoUrl)&&clean(gen.videoUrl);
  }
  function stage(id,title,description){return{id:id,title:title,description:description}}
  function stageFor(source){
    var gen=generation(source),current=pipeline(source),finish=finalization(source);
    var genState=statusValue(gen.status),pipeState=statusValue(current.status),finishState=statusValue(finish.status);
    var sourceReady=Boolean(clean(gen.sourceVideoUrl)||gen.sourceReady===true);
    var avatarEnabled=Boolean(source&&source.avatar&&source.avatar.enabled===true);

    if(latchActive()&&!clean(gen.requestId)&&!sourceReady)return stage(1,text("Hazırlık yapılıyor","Preparing production"),text("Seçimleriniz kontrol ediliyor ve üretim planı oluşturuluyor.","Your selections are being checked and the production plan is being created."));
    if(!clean(gen.requestId)&&!sourceReady)return stage(1,text("Hazırlık yapılıyor","Preparing production"),text("Seçimleriniz kontrol ediliyor ve üretim planı oluşturuluyor.","Your selections are being checked and the production plan is being created."));

    if(pipeState==="waiting_for_seedance"||(!sourceReady&&["queued","processing","running","in_queue"].indexOf(genState)>=0)){
      return stage(2,text("Sahneler hazırlanıyor","Preparing scenes"),text("Geçişler, efektler ve görsel akış oluşturuluyor.","Transitions, effects and the visual flow are being created."));
    }

    if(avatarEnabled&&["motion_queued","motion_processing","lipsync_queued","lipsync_processing"].indexOf(pipeState)>=0){
      return stage(3,text("Oyuncu sahneye yerleştiriliyor","Placing the presenter into the scene"),text("Oyuncu, konuşma ve sahne uyumu hazırlanıyor.","The presenter, speech and scene timing are being aligned."));
    }

    if((avatarEnabled&&pipeState==="completed"&&gen.awaitingFinalComposite===true)||gen.avatarWaiting===false&&gen.awaitingFinalComposite===true&&!gen.finalizing){
      return stage(4,text("Müzik ve ses düzenleniyor","Arranging music and sound"),text("Konuşma, müzik ve ses seviyeleri dengeleniyor.","Narration, music and sound levels are being balanced."));
    }

    if(["queued","processing","running","rendering"].indexOf(finishState)>=0||pipeState==="rendering"){
      return stage(5,text("Son rötuşlar yapılıyor","Applying final touches"),text("Görüntü, ses, logo ve sahne geçişleri son kez kontrol ediliyor.","Video, sound, logo and scene transitions are receiving a final review."));
    }

    if(gen.finalizing===true||sourceReady&&gen.awaitingFinalComposite===true){
      return stage(6,text("Video dışa aktarılıyor","Exporting video"),text("Reklam filminiz izlemeye hazır hale getiriliyor.","Your advertising film is being prepared for playback."));
    }

    return stage(2,text("Sahneler hazırlanıyor","Preparing scenes"),text("Geçişler, efektler ve görsel akış oluşturuluyor.","Transitions, effects and the visual flow are being created."));
  }
  function stableStage(next){
    var now=Date.now();
    if(!visibleStage){visibleStage=next;visibleStageAt=now;pendingStage=null;return visibleStage}
    if(next.id===visibleStage.id){pendingStage=null;return visibleStage}
    if(now-visibleStageAt>=MIN_STAGE_MS){visibleStage=next;visibleStageAt=now;pendingStage=null;return visibleStage}
    pendingStage=next;
    return visibleStage;
  }
  function maybeAdvancePending(){
    if(pendingStage&&Date.now()-visibleStageAt>=MIN_STAGE_MS){visibleStage=pendingStage;pendingStage=null;visibleStageAt=Date.now()}
  }
  function ensureLayout(node){
    if(!node)return null;
    var small=node.querySelector("small");
    if(!small)return null;
    if(!small.querySelector("[data-adfilm-stage-wrap]")){
      small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
    }
    return{
      count:small.querySelector("[data-adfilm-stage-count]"),
      title:small.querySelector("[data-adfilm-stage-title]"),
      description:small.querySelector("[data-adfilm-stage-description]"),
      time:small.querySelector("[data-adfilm-stage-time]")
    };
  }
  function activateButtonState(active){
    var button=buildButton(),action=root()&&root().querySelector(".adfilm-actionbar");
    if(button){
      button.disabled=Boolean(active);
      button.classList.toggle("is-generating",Boolean(active));
      if(active)button.setAttribute("aria-busy","true");else{button.classList.remove("is-loading","is-music-preparing");button.removeAttribute("aria-busy")}
    }
    if(action)action.classList.toggle("is-engine-active",Boolean(active));
  }
  function renderActive(source){
    var node=status();if(!node||!productionActive(source)||finalReady(source)||terminalState(source))return false;
    maybeAdvancePending();
    var current=stableStage(stageFor(source)),layout=ensureLayout(node);
    setClass(node,"adfilm-engine-status is-visible is-busy");
    node.removeAttribute("data-adfilm-idle-hidden");
    node.setAttribute("data-stage",String(current.id));
    setText(node.querySelector("b"),text("Reklam filminiz hazırlanıyor","Your advertising film is being prepared"));
    if(layout){
      setText(layout.count,text("Aşama ","Stage ")+current.id+"/6");
      setText(layout.title,current.title);
      setText(layout.description,current.description);
      var elapsed=elapsedFrom(productionStartedAt(source));
      setText(layout.time,elapsed?text("Toplam geçen süre: ","Total elapsed: ")+elapsed:"");
    }
    activateButtonState(true);
    return true;
  }
  function completedDetail(source){
    var gen=generation(source),input=gen.input||{};
    var output=(Array.isArray(source&&source.outputs)?source.outputs:[]).find(function(item){return clean(item&&item.id)===clean(source&&source.activeOutputId)})||{};
    var parts=[text("Tamamlandı","Completed")];
    var duration=clean(output.duration||input.duration||source&&source.output&&source.output.duration);if(duration)parts.push(duration+" "+text("sn","sec"));
    var quality=clean(output.resolution||input.resolution||source&&source.output&&source.output.quality);if(quality)parts.push(quality);
    var count=Number(input.imageCount||input.image_count||0);if(count)parts.push(count+" "+text("referans","references"));
    var total=elapsedFrom(productionStartedAt(source));if(total)parts.push(text("Toplam ","Total ")+total);
    return parts.join(" · ");
  }
  function renderCompleted(source){
    var node=status();if(!node||!finalReady(source))return false;
    clearLatch();
    setClass(node,"adfilm-engine-status is-visible is-success");
    node.removeAttribute("data-stage");
    setText(node.querySelector("b"),text("Reklam filmi hazır","Advertising film ready"));
    var small=node.querySelector("small");if(small)setText(small,completedDetail(source));
    activateButtonState(false);
    visibleStage=null;pendingStage=null;visibleStageAt=0;
    return true;
  }
  function renderTerminal(source){
    var terminal=terminalState(source),node=status();if(!node||!terminal)return false;
    clearLatch();
    setClass(node,"adfilm-engine-status is-visible is-error");
    node.removeAttribute("data-stage");
    setText(node.querySelector("b"),terminal==="cancelled"?text("Üretim durduruldu","Production stopped"):text("Üretim tamamlanamadı","Production could not be completed"));
    var small=node.querySelector("small");
    if(small)setText(small,terminal==="cancelled"?text("Azami üretim süresi aşıldığı için işlem güvenli şekilde durduruldu.","The production was safely stopped after exceeding the maximum processing time."):text("Oyunculu sahne tamamlanamadı. Tamamlanmamış kaynak video hazır video olarak gösterilmedi.","The presenter scene could not be completed. The unfinished source video was not shown as a ready video."));
    activateButtonState(false);
    visibleStage=null;pendingStage=null;visibleStageAt=0;
    return true;
  }
  function releaseStaleLatch(source){
    var node=status();
    if(!latchActive()||generationActive(source)||pipelineActive(source)||generating())return;
    if(node&&node.classList.contains("is-error"))clearLatch();
  }
  function render(){
    var source=project();if(!source)return;
    releaseStaleLatch(source);
    if(renderTerminal(source))return;
    if(renderCompleted(source))return;
    renderActive(source);
  }
  function start(){clearInterval(timer);render();timer=setInterval(render,500)}
  function beginLaunch(){
    setLatch();
    visibleStage=null;pendingStage=null;visibleStageAt=0;
    var source=project();
    activateButtonState(true);
    setTimeout(function(){renderActive(source||project())},0);
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-build]');
    if(!button||button.disabled)return;
    beginLaunch();
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(start,200)});
  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(render,20)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(start,50)});
  window.addEventListener("pagehide",function(){clearInterval(timer)});
  window.AIVOAdFilmProgressUI={begin:beginLaunch,release:clearLatch,render:render,isLatched:latchActive};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,300)},{once:true});else setTimeout(start,300);
})();
