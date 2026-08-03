/* AIVO AI Reklam Filmi — professional output quality policy */
(function AIVO_AD_FILM_QUALITY_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_POLICY_V6__)return;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V6__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V5__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V4__=true;

  var timeoutTimer=null;
  var timeoutClosingKey="";
  var MAX_TOTAL_MS=20*60*1000;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function root(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }
  function qualityGroup(scope){return scope&&scope.querySelector('[data-adfilm-choice="quality"]')}
  function valueOf(node){return String(node&&node.getAttribute&&node.getAttribute('data-value')||node&&node.textContent||'').trim().toLowerCase()}
  function clean(value){return String(value==null?'':value).trim()}
  function text(tr,en){return english()?en:tr}
  function removeLowQuality(scope){
    var group=qualityGroup(scope);if(!group)return false;
    group.querySelectorAll('[data-value="480p"],[data-value="720p"]').forEach(function(node){node.remove()});
    var allowed=Array.from(group.querySelectorAll('[data-value]')).filter(function(node){return valueOf(node)==='1080p'||valueOf(node)==='4k'});
    var selected=group.querySelector('.is-selected[data-value]');
    if(!selected||allowed.indexOf(selected)<0){
      allowed.forEach(function(node){node.classList.remove('is-selected')});
      var button1080=allowed.find(function(node){return valueOf(node)==='1080p'});
      if(button1080){button1080.classList.add('is-selected');button1080.click()}
    }
    group.setAttribute('data-professional-quality-only','1');
    return true;
  }
  function rewriteCopy(scope){
    if(!scope)return;
    var sub=scope.querySelector('[data-adfilm-i18n="outputQualitySub"]');
    if(sub){sub.removeAttribute('data-adfilm-i18n');sub.textContent=english()?'Choose 1080p professional quality or 4K premium quality.':'1080p profesyonel kalite veya 4K premium kaliteyi seç.'}
    var note=scope.querySelector('[data-adfilm-i18n="qualityNote"]');
    if(note){note.removeAttribute('data-adfilm-i18n');note.textContent=english()?'1080p professional final, 4K premium.':'1080p profesyonel final, 4K premium.'}
  }
  function apply(scope){
    scope=root(scope);if(!scope)return false;
    var changed=removeLowQuality(scope);rewriteCopy(scope);return changed;
  }
  function applyBurst(scope){[0,40,120,300,700,1400].forEach(function(delay){setTimeout(function(){apply(scope)},delay)})}
  function loadElapsedOwner(){
    if(window.__AIVO_AD_FILM_ELAPSED_OWNER_V1__)return;
    if(document.querySelector('script[src^="/js/ad-film.elapsed-owner.js"]'))return;
    var script=document.createElement('script');
    script.src='/js/ad-film.elapsed-owner.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  }

  function productionController(){return window.AIVOAdFilmProductionController}
  function productionState(){var api=productionController();return api&&typeof api.state==='function'?api.state():null}
  function productionActive(){var api=productionController();return !!(api&&typeof api.active==='function'&&api.active())}
  function timeoutKey(run){return clean(run&&run.projectId)+'|'+clean(run&&run.requestId)+'|'+String(run&&run.startedAt||'')}
  function showTimeoutClosing(){
    var scope=root();if(!scope)return;
    var title=scope.querySelector('[data-adfilm-stage-title]');
    var detail=scope.querySelector('[data-adfilm-stage-description]');
    if(title)title.textContent=text('Üretim güvenli şekilde durduruluyor','Stopping production safely');
    if(detail)detail.textContent=text('20 dakikalık toplam süre sınırı aşıldı. Yeni ücretli üretim başlatılmadı.','The 20-minute total time limit was exceeded. No new paid generation was started.');
  }
  async function abandonTimedOutRun(run){
    var key=timeoutKey(run);if(!key||timeoutClosingKey===key)return;
    timeoutClosingKey=key;
    showTimeoutClosing();
    try{
      var response=await fetch('/api/ad-film/seedance/abandon',{
        method:'POST',
        credentials:'include',
        cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:clean(run.projectId)})
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok)throw new Error(data.error||data.message||('HTTP '+response.status));
      console.warn('[ADFILM FLOW] total-timeout-abandoned',{projectId:run.projectId,requestId:run.requestId,totalMs:Date.now()-Number(run.startedAt||0)});
    }catch(error){
      timeoutClosingKey='';
      console.error('[ADFILM FLOW] total-timeout-abandon-failed',error);
    }
  }
  function checkTotalTimeout(){
    if(!productionActive())return;
    var run=productionState();
    var started=Number(run&&run.startedAt||0);
    if(!started||Date.now()-started<MAX_TOTAL_MS)return;
    abandonTimedOutRun(run);
  }
  function startTimeoutMonitor(){
    if(timeoutTimer)return;
    checkTotalTimeout();
    timeoutTimer=setInterval(checkTotalTimeout,1000);
  }

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm'){applyBurst(event.detail.root);loadElapsedOwner();startTimeoutMonitor()}});
  document.addEventListener('aivo:adfilm-assets-ready',function(){applyBurst();loadElapsedOwner();startTimeoutMonitor()});
  document.addEventListener('aivo:adfilm-project-sync',function(){applyBurst();loadElapsedOwner();startTimeoutMonitor()});
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-adfilm-open],[data-aivo-language]')){applyBurst();loadElapsedOwner();startTimeoutMonitor()}
  },true);

  window.addEventListener('pagehide',function(){if(timeoutTimer)clearInterval(timeoutTimer)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){applyBurst();loadElapsedOwner();startTimeoutMonitor()},{once:true});else{applyBurst();loadElapsedOwner();startTimeoutMonitor()}
  window.AIVOAdFilmQualityPolicy={apply:apply};
})();
