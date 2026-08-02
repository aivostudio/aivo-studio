/* AIVO AI Reklam Filmi — stable avatar-free production progress */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_STABILITY_V10__)return;
  window.__AIVO_AD_FILM_PROGRESS_STABILITY_V10__=true;

  var timer=null;
  var completionToastKey="";
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function generation(source){return source&&source.generation||{}}
  function finalization(source){var gen=generation(source);return source&&source.finalization||gen.finalization||{}}
  function setText(node,value){if(node&&node.textContent!==String(value||""))node.textContent=String(value||"")}
  function latch(){return window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:null}
  function clearLatch(){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}}
  function latchActive(){
    var value=latch();if(!value)return false;
    if(Number(value.until||0)<=Date.now()){clearLatch();return false}
    return Boolean(root());
  }
  function stateTime(source){
    var gen=generation(source),finish=finalization(source);
    var values=[gen.completedAt,finish.completedAt,gen.updatedAt,source&&source.updatedAt,gen.startedAt,gen.createdAt]
      .map(function(value){return Date.parse(value||"")}).filter(Number.isFinite);
    return values.length?Math.max.apply(Math,values):0;
  }
  function stateBelongsToCurrentLatch(source){
    var value=latch();if(!value)return true;
    var latchTime=Date.parse(value.startedAt||"");
    var gen=generation(source),requestId=clean(gen.requestId),started=Date.parse(gen.startedAt||gen.createdAt||"");
    if(requestId&&value.previousRequestId&&requestId!==clean(value.previousRequestId))return true;
    if(Number.isFinite(started)&&Number.isFinite(latchTime)&&started>=latchTime-1500)return true;
    var changedAt=stateTime(source);
    return Boolean(changedAt&&Number.isFinite(latchTime)&&changedAt>=latchTime-1500);
  }
  function staleDuringLatch(source){return latchActive()&&!stateBelongsToCurrentLatch(source)}
  function startedAt(source){
    if(staleDuringLatch(source)){var value=latch();return value&&value.startedAt||""}
    var gen=generation(source);return gen.startedAt||gen.createdAt||gen.updatedAt||latch()&&latch().startedAt||"";
  }
  function elapsed(value){
    var time=Date.parse(value||"");if(!Number.isFinite(time))return"";
    var total=Math.max(0,Math.floor((Date.now()-time)/1000));
    return Math.floor(total/60)+" "+text("dk","min")+" "+String(total%60).padStart(2,"0")+" "+text("sn","sec");
  }
  function activeOutput(source){
    var gen=generation(source),id=clean(source&&source.activeOutputId||gen.outputId||gen.requestId);
    var outputs=Array.isArray(source&&source.outputs)?source.outputs:[];
    return outputs.find(function(item){return clean(item&&item.id)===id&&/^https:\/\//i.test(clean(item&&item.videoUrl))})||null;
  }
  function finalReady(source){
    if(!source)return false;
    var gen=generation(source),finish=finalization(source),output=activeOutput(source);
    if(output)return true;
    return lower(source.status)==="completed"&&lower(gen.status)==="completed"&&/^https:\/\//i.test(clean(gen.videoUrl))&&lower(finish.status)!=="processing";
  }
  function terminal(source){
    var values=[source&&source.status,generation(source).status,finalization(source).status].map(lower);
    return values.some(function(value){return value==="failed"||value==="error"||value==="cancelled"||value==="canceled"});
  }
  function active(source){
    if(latchActive())return true;
    if(!source||finalReady(source)||terminal(source))return false;
    var gen=generation(source),finish=finalization(source);
    return ["queued","processing","running","in_queue"].indexOf(lower(source.status))>=0||
      ["queued","processing","running","in_queue"].indexOf(lower(gen.status))>=0||
      ["queued","processing","running","rendering","finalizing"].indexOf(lower(finish.status))>=0;
  }
  function ensureLayout(node){
    var small=node&&node.querySelector("small");if(!small)return null;
    if(!small.querySelector("[data-adfilm-stage-wrap]")){
      small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
    }
    return{count:small.querySelector("[data-adfilm-stage-count]"),title:small.querySelector("[data-adfilm-stage-title]"),description:small.querySelector("[data-adfilm-stage-description]"),time:small.querySelector("[data-adfilm-stage-time]")};
  }
  function forceVisibleStyle(node,on){
    if(!node)return;
    if(on){
      node.removeAttribute("data-adfilm-idle-hidden");
      node.style.setProperty("display","block","important");
      node.style.setProperty("visibility","visible","important");
      node.style.setProperty("opacity","1","important");
    }else{
      node.style.removeProperty("display");
      node.style.removeProperty("visibility");
      node.style.removeProperty("opacity");
    }
  }
  function setButtonActive(on){
    var build=button(),action=root()&&root().querySelector(".adfilm-actionbar");
    if(build){build.disabled=!!on;build.classList.toggle("is-generating",!!on);if(on)build.setAttribute("aria-busy","true");else{build.classList.remove("is-loading","is-music-preparing");build.removeAttribute("aria-busy")}}
    if(action){action.classList.toggle("is-engine-active",!!on);if(on)action.setAttribute("data-adfilm-progress-lock","1");else action.removeAttribute("data-adfilm-progress-lock")}
  }
  function stageFor(source){
    if(staleDuringLatch(source))return{n:1,title:text("Hazırlık yapılıyor","Preparing production"),detail:text("Referanslar, seslendirme ve üretim ayarları kontrol ediliyor.","References, narration and production settings are being checked.")};
    var gen=generation(source),finish=finalization(source),genState=lower(gen.status),finishState=lower(finish.status);
    if(!clean(gen.requestId))return{n:1,title:text("Hazırlık yapılıyor","Preparing production"),detail:text("Referanslar, seslendirme ve üretim ayarları kontrol ediliyor.","References, narration and production settings are being checked.")};
    if(["queued","processing","running","in_queue"].indexOf(genState)>=0&&!clean(gen.videoUrl))return{n:2,title:text("Sahneler hazırlanıyor","Preparing scenes"),detail:text("Ürün görüntüleri, geçişler ve görsel akış oluşturuluyor.","Product visuals, transitions and visual flow are being created.")};
    if(["queued","processing","running","rendering","finalizing"].indexOf(finishState)>=0||gen.finalizing===true)return{n:3,title:text("Ses ve müzik düzenleniyor","Arranging sound and music"),detail:text("Seslendirme, müzik, logo ve video seviyeleri birleştiriliyor.","Narration, music, logo and video levels are being combined.")};
    return{n:4,title:text("Video dışa aktarılıyor","Exporting video"),detail:text("Reklam filminiz izlemeye hazır hâle getiriliyor.","Your advertising film is being prepared for playback.")};
  }
  function renderActive(source){
    var node=status();if(!node||!active(source))return false;
    var stage=stageFor(source||{}),layout=ensureLayout(node);
    node.className="adfilm-engine-status is-visible is-busy";
    node.setAttribute("data-stage",String(stage.n));
    forceVisibleStyle(node,true);
    setText(node.querySelector("b"),text("Reklam filminiz hazırlanıyor","Your advertising film is being prepared"));
    if(layout){setText(layout.count,text("Aşama ","Stage ")+stage.n+"/4");setText(layout.title,stage.title);setText(layout.description,stage.detail);var total=elapsed(startedAt(source||{}));setText(layout.time,total?text("Toplam geçen süre: ","Total elapsed: ")+total:"")}
    setButtonActive(true);return true;
  }
  function showCompletionToast(source){
    var gen=generation(source),key=clean(source&&source.id)+"|"+clean(source&&source.activeOutputId||gen.outputId||gen.videoUrl);
    if(!key||key===completionToastKey)return;
    completionToastKey=key;
    try{var fn=window.toast&&window.toast.success;if(typeof fn==="function")fn({message:text("Reklam filminiz hazır.","Your advertising film is ready."),duration:4200})}catch(_){}
  }
  function renderCompleted(source){
    if(latchActive()&&!stateBelongsToCurrentLatch(source))return false;
    var node=status();if(!node||!finalReady(source))return false;
    forceVisibleStyle(node,false);
    node.className="adfilm-engine-status is-visible is-success";node.removeAttribute("data-stage");node.removeAttribute("data-adfilm-idle-hidden");
    setText(node.querySelector("b"),text("Reklam filmi hazır","Advertising film ready"));
    var small=node.querySelector("small"),gen=generation(source),input=gen.input||{},output=activeOutput(source)||{};
    var parts=[text("Tamamlandı","Completed")];
    var duration=clean(output.duration||input.duration||source&&source.output&&source.output.duration);if(duration)parts.push(duration+" "+text("sn","sec"));
    var quality=clean(output.resolution||input.resolution||source&&source.output&&source.output.quality);if(quality)parts.push(quality);
    if(small)setText(small,parts.join(" · "));
    clearLatch();setButtonActive(false);showCompletionToast(source);return true;
  }
  function renderTerminal(source){
    if(latchActive()&&!stateBelongsToCurrentLatch(source))return false;
    var node=status();if(!node||!terminal(source))return false;
    forceVisibleStyle(node,false);
    node.className="adfilm-engine-status is-visible is-error";node.removeAttribute("data-stage");node.removeAttribute("data-adfilm-idle-hidden");
    setText(node.querySelector("b"),text("Üretim tamamlanamadı","Production could not be completed"));
    var small=node.querySelector("small");if(small)setText(small,text("İşlem güvenli şekilde durduruldu. Yeni ücretli üretim otomatik başlatılmadı.","The process was stopped safely. No new paid generation was started automatically."));
    clearLatch();setButtonActive(false);return true;
  }
  function render(){
    var source=project();
    if(latchActive()&&(!source||!stateBelongsToCurrentLatch(source))){renderActive(source||{});return}
    if(!source)return;
    if(renderCompleted(source))return;
    if(renderTerminal(source))return;
    renderActive(source);
  }
  function release(){clearLatch();var node=status();forceVisibleStyle(node,false)}
  function start(){clearInterval(timer);render();timer=setInterval(render,250)}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(start,200)});
  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(render,20)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(start,50)});
  window.addEventListener("pagehide",function(){clearInterval(timer)});
  window.AIVOAdFilmProgressUI={render:render,release:release};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,300)},{once:true});else setTimeout(start,300);
})();
