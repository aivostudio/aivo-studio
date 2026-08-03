/* AIVO AI Reklam Filmi — keep one elapsed clock across music, upload, generation and finalization */
(function AIVO_AD_FILM_ELAPSED_CONTINUITY(){
  "use strict";
  if(window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V1__)return;
  window.__AIVO_AD_FILM_ELAPSED_CONTINUITY_V1__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var clock=null;
  var runStartedAt=0;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function latchStartedAt(){
    var latch=window[LATCH_KEY];
    var value=Date.parse(latch&&latch.startedAt||"");
    return Number.isFinite(value)&&value>0?value:0;
  }
  function effectiveStartedAt(){
    var values=[runStartedAt,latchStartedAt()].filter(function(value){return Number.isFinite(value)&&value>0});
    return values.length?Math.min.apply(Math,values):0;
  }
  function latchActive(){
    var latch=window[LATCH_KEY];
    return Boolean(latch&&typeof latch==="object"&&Number(latch.until||0)>Date.now());
  }
  function statusBusy(){
    var scope=root(),status=scope&&scope.querySelector('[data-adfilm-engine-status]'),button=scope&&scope.querySelector('[data-adfilm-build]');
    return Boolean(
      latchActive()||
      status&&status.classList.contains("is-busy")||
      button&&(button.classList.contains("is-generating")||button.classList.contains("is-music-preparing")||button.getAttribute("aria-busy")==="true")
    );
  }
  function formatElapsed(started){
    var total=Math.max(0,Math.floor((Date.now()-started)/1000));
    return Math.floor(total/60)+" "+(english()?"min":"dk")+" "+String(total%60).padStart(2,"0")+" "+(english()?"sec":"sn");
  }
  function render(){
    var scope=root(),started=effectiveStartedAt();
    if(!scope||!started){stopIfIdle();return}
    var target=scope.querySelector('[data-adfilm-stage-time]');
    if(target){
      var value=(english()?"Total elapsed: ":"Toplam geçen süre: ")+formatElapsed(started);
      if(target.textContent!==value)target.textContent=value;
    }
    stopIfIdle();
  }
  function start(){
    if(!runStartedAt)runStartedAt=latchStartedAt()||Date.now();
    if(clock)return render();
    render();
    clock=setInterval(render,500);
  }
  function stopIfIdle(){
    if(statusBusy())return;
    if(clock){clearInterval(clock);clock=null}
    runStartedAt=0;
  }
  function captureBuild(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    runStartedAt=Date.now();
    setTimeout(start,0);
  }

  document.addEventListener("click",captureBuild,true);
  document.addEventListener("aivo:adfilm-project-sync",function(){if(latchActive()||statusBusy())start()});
  document.addEventListener("aivo:adfilm-finalization-pending",function(){if(latchActive()||statusBusy())start()});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){if(latchActive()||statusBusy())start()},100)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(function(){if(latchActive()||statusBusy())start()},50)});
  window.addEventListener("pagehide",function(){if(clock)clearInterval(clock)});
})();
