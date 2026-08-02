/* AIVO AI Reklam Filmi — stable one-second progress UI */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_STABILITY_V3__)return;
  window.__AIVO_AD_FILM_PROGRESS_STABILITY_V3__=true;

  var timer=null;
  var baseSeconds=0;
  var baseAt=0;
  var lastBusyTitle="";
  var lastBusyDetail="";
  var applying=false;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function buildButton(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value==null?"":value).trim()}
  function generating(){var button=buildButton();return!!(button&&(button.classList.contains("is-generating")||button.classList.contains("is-loading")||button.getAttribute("aria-busy")==="true"))}
  function parseElapsed(value){var match=String(value||"").match(/(\d+)\s*(?:dk|min)\s*(\d+)\s*(?:sn|sec)/i);return match?Number(match[1])*60+Number(match[2]):null}
  function formatElapsed(total){var minutes=Math.floor(total/60),seconds=total%60;return minutes+" "+(english()?"min":"dk")+" "+String(seconds).padStart(2,"0")+" "+(english()?"sec":"sn")}
  function pipelineActive(source){
    var pipeline=source&&source.avatar&&source.avatar.pipeline||{};
    return ["waiting_for_seedance","motion_queued","motion_processing","lipsync_queued","lipsync_processing","rendering"].indexOf(clean(pipeline.status).toLowerCase())>=0;
  }
  function activeStageCopy(source){
    var pipeline=source&&source.avatar&&source.avatar.pipeline||{};
    var state=clean(pipeline.status).toLowerCase();
    if(state.indexOf("lipsync")===0)return{text:text("Oyuncunun konuşması hazırlanıyor","Synchronizing presenter speech"),detail:text("Dudak, yüz ve konuşma zamanlaması hazırlanıyor.","Lip, face and speech timing are being prepared.")};
    if(state==="rendering")return{text:text("Reklam filminin final montajı hazırlanıyor","Preparing the final commercial edit"),detail:text("Ürün filmi, oyunculu sahne, ses, müzik ve logo birleştiriliyor.","Combining product film, presenter, narration, music and logo.")};
    return{text:text("Oyuncu gerçek reklam sahnesine yerleştiriliyor","Integrating presenter into the real ad scene"),detail:text("Oyuncu videosu üretiliyor. Eski hazır video bu yeni işlem tamamlanana kadar sonuç sayılmayacak.","The presenter video is being generated. The previous completed output will not count as this new result.")};
  }
  function finalReady(source){
    if(pipelineActive(source))return false;
    var generation=source&&source.generation||{};
    var finalization=generation.finalization||source&&source.finalization||{};
    var pipeline=source&&source.avatar&&source.avatar.pipeline||{};
    if(generation.awaitingFinalComposite===true||generation.avatarWaiting===true||generation.sourceOnly===true)return false;
    if(clean(finalization.status).toLowerCase()==="completed"&&clean(generation.videoUrl))return true;
    if(Number(generation.mixVersion||0)>=4&&clean(generation.videoUrl))return true;
    if(clean(generation.status).toLowerCase()==="completed"&&clean(generation.videoUrl))return true;
    return clean(pipeline.status).toLowerCase()==="completed"&&clean(pipeline.videoUrl)&&clean(generation.videoUrl);
  }
  function completedDetail(source){
    var generation=source&&source.generation||{};
    var input=generation.input||{};
    var output=(Array.isArray(source&&source.outputs)?source.outputs:[]).find(function(item){return clean(item&&item.id)===clean(source&&source.activeOutputId)})||{};
    var parts=[text("Tamamlandı","Completed")];
    var duration=clean(output.duration||input.duration||source&&source.output&&source.output.duration);if(duration)parts.push(duration+" "+text("sn","sec"));
    var quality=clean(output.resolution||input.resolution||source&&source.output&&source.output.quality);if(quality)parts.push(quality);
    var count=Number(input.imageCount||input.image_count||0);if(count)parts.push(count+" "+text("referans","references"));
    return parts.join(" · ");
  }
  function normalizeActive(){
    var source=project(),node=status();if(!node||!pipelineActive(source))return false;
    var copy=activeStageCopy(source);
    applying=true;
    node.className="adfilm-engine-status is-visible is-busy";
    var title=node.querySelector("b"),detail=node.querySelector("small");
    if(title)title.textContent=copy.text;
    if(detail&&!parseElapsed(detail.textContent))detail.textContent=copy.detail;
    var button=buildButton();
    if(button){button.disabled=true;button.classList.add("is-generating");button.setAttribute("aria-busy","true")}
    var action=root()&&root().querySelector(".adfilm-actionbar");if(action)action.classList.add("is-engine-active");
    applying=false;
    return true;
  }
  function normalizeCompleted(){
    var source=project(),node=status();if(!node||!finalReady(source))return false;
    applying=true;
    node.className="adfilm-engine-status is-visible is-success";
    var title=node.querySelector("b"),detail=node.querySelector("small");
    if(title)title.textContent=text("Reklam filmi hazır","Advertising film ready");
    if(detail)detail.textContent=completedDetail(source);
    var button=buildButton();
    if(button){button.disabled=false;button.classList.remove("is-generating","is-loading","is-music-preparing");button.removeAttribute("aria-busy")}
    var action=root()&&root().querySelector(".adfilm-actionbar");if(action)action.classList.remove("is-engine-active");
    baseAt=0;baseSeconds=0;lastBusyTitle="";lastBusyDetail="";
    applying=false;
    return true;
  }
  function remember(){
    var node=status();if(!node)return;
    if(normalizeActive()||normalizeCompleted())return;
    var title=node.querySelector("b"),detail=node.querySelector("small");
    if(node.classList.contains("is-busy")){
      lastBusyTitle=title&&title.textContent||lastBusyTitle;
      lastBusyDetail=detail&&detail.textContent||lastBusyDetail;
      var parsed=parseElapsed(lastBusyDetail);if(parsed!=null){baseSeconds=parsed;baseAt=Date.now()}
    }
  }
  function forceBusyIfNeeded(){
    var node=status();if(!node||normalizeActive()||normalizeCompleted()||!generating()||!node.classList.contains("is-success"))return;
    applying=true;node.className="adfilm-engine-status is-visible is-busy";
    var title=node.querySelector("b"),detail=node.querySelector("small");
    if(title&&lastBusyTitle)title.textContent=lastBusyTitle;
    if(detail&&lastBusyDetail)detail.textContent=lastBusyDetail;
    applying=false;
  }
  function tick(){
    var node=status();if(!node)return;
    if(normalizeActive()||normalizeCompleted())return;
    forceBusyIfNeeded();
    if(!node.classList.contains("is-busy"))return;
    var detail=node.querySelector("small");if(!detail)return;
    var current=parseElapsed(detail.textContent);
    if(current!=null&&(!baseAt||Math.abs(current-baseSeconds)>2)){baseSeconds=current;baseAt=Date.now()}
    if(!baseAt)return;
    var total=baseSeconds+Math.floor((Date.now()-baseAt)/1000);
    detail.textContent=detail.textContent.replace(/\d+\s*(?:dk|min)\s*\d+\s*(?:sn|sec)/i,formatElapsed(total));
  }
  function start(){clearInterval(timer);remember();timer=setInterval(tick,1000)}

  var observer=new MutationObserver(function(){if(applying)return;remember();forceBusyIfNeeded()});
  function observe(){var node=status();if(node)observer.observe(node,{attributes:true,childList:true,subtree:true,characterData:true});start()}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(observe,500)});
  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(function(){normalizeActive();normalizeCompleted();remember()},80)});
  window.addEventListener("pagehide",function(){clearInterval(timer);observer.disconnect()});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(observe,700)},{once:true});else setTimeout(observe,700);
})();
