/* AIVO AI Reklam Filmi — authoritative monotonic elapsed timer owner */
(function AIVO_AD_FILM_ELAPSED_OWNER(){
  "use strict";
  if(window.__AIVO_AD_FILM_ELAPSED_OWNER_V1__)return;
  window.__AIVO_AD_FILM_ELAPSED_OWNER_V1__=true;
  window.__AIVO_AD_FILM_SINGLE_OWNER_ACTIVE__=true;

  var timer=null;
  var observer=null;
  var observedNode=null;
  var writing=false;
  var lastSeconds=0;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function controller(){return window.AIVOAdFilmProductionController}
  function state(){var api=controller();return api&&typeof api.state==="function"?api.state():null}
  function active(){var api=controller();return !!(api&&typeof api.active==="function"&&api.active())}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function target(){var scope=root();return scope&&scope.querySelector('[data-adfilm-stage-time]')}
  function seconds(){
    var current=state(),started=Number(current&&current.startedAt||0);
    if(!started)return lastSeconds;
    var value=Math.max(0,Math.floor((Date.now()-started)/1000));
    if(value<lastSeconds)value=lastSeconds;
    lastSeconds=value;
    return value;
  }
  function format(value){
    return Math.floor(value/60)+" "+(english()?"min":"dk")+" "+String(value%60).padStart(2,"0")+" "+(english()?"sec":"sn");
  }
  function expected(){return (english()?"Total elapsed: ":"Toplam geçen süre: ")+format(seconds())}
  function write(){
    if(!active())return;
    var node=target();if(!node)return;
    observe(node);
    var value=expected();
    if(node.textContent===value)return;
    writing=true;
    node.textContent=value;
    writing=false;
  }
  function observe(node){
    if(observedNode===node&&observer)return;
    if(observer)observer.disconnect();
    observedNode=node;
    observer=new MutationObserver(function(){
      if(writing||!active())return;
      queueMicrotask(write);
    });
    observer.observe(node,{childList:true,characterData:true,subtree:true});
  }
  function start(){
    if(timer)return write();
    write();
    timer=setInterval(write,200);
  }
  function stop(){
    if(timer){clearInterval(timer);timer=null}
    if(observer){observer.disconnect();observer=null;observedNode=null}
    lastSeconds=0;
  }
  function sync(){if(active())start();else stop()}

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(button){lastSeconds=0;setTimeout(sync,0);setTimeout(sync,100)}
  },true);
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(sync,50)});
  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(sync,0)});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(sync,150)});
  window.addEventListener("pagehide",stop);
  setInterval(sync,1000);
})();
