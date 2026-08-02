/* AIVO AI Reklam Filmi — definitive completed output state guard */
(function AIVO_AD_FILM_COMPLETED_STATE_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_COMPLETED_STATE_GUARD_V2__)return;
  window.__AIVO_AD_FILM_COMPLETED_STATE_GUARD_V2__=true;

  var timer=null;
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function generation(source){return source&&source.generation||{}}
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.requestId)}
  function latch(){return window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:null}
  function clearLatch(){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}}
  function latchActive(){
    var value=latch();if(!value)return false;
    if(Number(value.until||0)<=Date.now()){clearLatch();return false}
    var source=project(),scope=root();
    var currentId=clean(source&&source.id||scope&&scope.dataset.adfilmProjectId);
    return !value.projectId||!currentId||clean(value.projectId)===currentId;
  }
  function stateTime(source){
    var gen=generation(source),finish=source&&source.finalization||gen.finalization||{};
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
  function output(source){
    var id=outputId(source),list=Array.isArray(source&&source.outputs)?source.outputs:[];
    return list.find(function(item){return clean(item&&item.id)===id})||null;
  }
  function finalUrl(source){
    var item=output(source),gen=generation(source);
    return clean(item&&item.videoUrl||gen.videoUrl);
  }
  function isFinal(source){
    if(!source)return false;
    var item=output(source),gen=generation(source),url=finalUrl(source);
    if(!/^https:\/\//i.test(url))return false;
    if(item&&(item.completedAt||item.finalizedAt||Number(item.mixVersion||0)>=4||item.hybridTimeline===true))return true;
    return lower(source.status)==="completed"||lower(gen.status)==="completed";
  }
  function stopBusyUi(source){
    if(!isFinal(source))return false;
    if(latchActive()&&!stateBelongsToCurrentLatch(source))return false;
    var scope=root();if(!scope)return false;
    var node=scope.querySelector('[data-adfilm-engine-status]');
    var button=scope.querySelector('[data-adfilm-build]');
    var action=scope.querySelector('.adfilm-actionbar');
    var item=output(source)||{},duration=clean(item.duration||source&&source.output&&source.output.duration),quality=clean(item.resolution||source&&source.output&&source.output.quality);
    if(node){
      node.className='adfilm-engine-status is-visible is-success';
      node.removeAttribute('data-stage');
      node.removeAttribute('data-adfilm-idle-hidden');
      var title=node.querySelector('b'),small=node.querySelector('small');
      if(title)title.textContent=text('Reklam filmi hazır','Advertising film ready');
      if(small)small.textContent=[text('Tamamlandı','Completed'),duration?duration+' '+text('sn','sec'):'',quality].filter(Boolean).join(' · ');
    }
    if(button){
      button.disabled=false;
      button.classList.remove('is-generating','is-loading','is-music-preparing');
      button.removeAttribute('aria-busy');
    }
    if(action)action.classList.remove('is-engine-active');
    try{if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.release==='function')window.AIVOAdFilmProgressUI.release()}catch(_){}
    clearLatch();
    return true;
  }
  function normalize(source){
    if(!isFinal(source))return source;
    var gen=Object.assign({},generation(source),{
      status:'completed',
      completedAt:generation(source).completedAt||output(source)&&output(source).completedAt||new Date().toISOString(),
      videoUrl:finalUrl(source),
      finalizing:false,
      awaitingFinalComposite:false,
      avatarWaiting:false,
      sourceOnly:false
    });
    return Object.assign({},source,{status:'completed',generation:gen});
  }
  function render(){
    var source=project();if(!source)return;
    if(latchActive()&&!stateBelongsToCurrentLatch(source))return;
    var normalized=normalize(source);
    if(normalized!==source)window.AIVOAdFilmActiveProject=normalized;
    stopBusyUi(normalized);
  }
  function start(){clearInterval(timer);render();timer=setInterval(render,400)}

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var incoming=event&&event.detail&&event.detail.project;
    if(incoming&&isFinal(incoming)&&(!latchActive()||stateBelongsToCurrentLatch(incoming)))window.AIVOAdFilmActiveProject=normalize(incoming);
    setTimeout(render,0);
  },true);
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(start,120)});
  window.addEventListener('pageshow',function(){setTimeout(start,100)});
  window.addEventListener('pagehide',function(){clearInterval(timer)});
  window.AIVOAdFilmCompletedStateGuard={render:render,isFinal:isFinal,normalize:normalize};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,250)},{once:true});else setTimeout(start,250);
})();