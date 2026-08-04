/* AIVO AI Reklam Filmi — professional output quality policy */
(function AIVO_AD_FILM_QUALITY_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_POLICY_V8__)return;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V8__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V7__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V6__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V5__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V4__=true;

  var timeoutTimer=null;
  var timeoutClosingKey="";
  var staleRecoveryKeys=new Set();
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
  function qualityMarkup(){
    return '<button type="button" data-value="720p"><span>720p</span></button>'+
      '<button type="button" class="is-selected" data-value="1080p"><span>1080p</span></button>'+
      '<button type="button" data-value="4k"><span>4K</span><em class="adfilm-seedance-tag">Premium</em></button>';
  }
  function enforceQuality(scope){
    var group=qualityGroup(scope);if(!group)return false;
    var selected=group.querySelector('.is-selected[data-value]');
    var selectedValue=valueOf(selected);
    if(selectedValue!=='720p'&&selectedValue!=='1080p'&&selectedValue!=='4k')selectedValue='1080p';
    var values=Array.from(group.querySelectorAll('[data-value]')).map(valueOf).join('|');
    if(values!=='720p|1080p|4k')group.innerHTML=qualityMarkup();
    var allowed=Array.from(group.querySelectorAll('[data-value]')).filter(function(node){var value=valueOf(node);return value==='720p'||value==='1080p'||value==='4k'});
    allowed.forEach(function(node){node.classList.toggle('is-selected',valueOf(node)===selectedValue)});
    if(!allowed.some(function(node){return node.classList.contains('is-selected')})){
      var button1080=allowed.find(function(node){return valueOf(node)==='1080p'});
      if(button1080)button1080.classList.add('is-selected');
    }
    group.removeAttribute('data-professional-quality-only');
    group.setAttribute('data-quality-layout','three');
    group.classList.add('adfilm-options--seedance-quality');
    return true;
  }
  function rewriteCopy(scope){
    if(!scope)return;
    var sub=scope.querySelector('[data-adfilm-i18n="outputQualitySub"],.adfilm-card--advanced-output .adfilm-card__heading p');
    if(sub){sub.removeAttribute('data-adfilm-i18n');sub.removeAttribute('data-simple-copy');sub.textContent=english()?'Choose 720p economical, 1080p professional or 4K premium quality.':'720p ekonomik, 1080p profesyonel veya 4K premium kaliteyi seç.'}
    var note=scope.querySelector('[data-adfilm-i18n="qualityNote"],[data-adfilm-seedance-note="quality"]');
    if(note){note.removeAttribute('data-adfilm-i18n');note.textContent=english()?'720p economical, 1080p professional final, 4K premium.':'720p ekonomik, 1080p profesyonel final, 4K premium.'}
  }
  function apply(scope){
    scope=root(scope);if(!scope)return false;
    var changed=enforceQuality(scope);rewriteCopy(scope);return changed;
  }
  function applyBurst(scope){[0,40,120,300,700,1400,2400].forEach(function(delay){setTimeout(function(){apply(scope)},delay)})}
  function loadElapsedOwner(){
    if(window.__AIVO_AD_FILM_ELAPSED_OWNER_V1__)return;
    if(document.querySelector('script[src^="/js/ad-film.elapsed-owner.js"]'))return;
    var script=document.createElement('script');
    script.src='/js/ad-film.elapsed-owner.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  }

  function requestUrl(input){return typeof input==='string'?input:input&&input.url||''}
  function requestMethod(input,init){return clean(init&&init.method||input&&input.method||'GET').toUpperCase()}
  function requestProjectId(init){
    try{
      var parsed=JSON.parse(String(init&&init.body||'{}'));
      return clean(parsed&&parsed.projectId);
    }catch(_){return''}
  }
  function generationAge(generation){
    var started=Date.parse(generation&&generation.startedAt||'');
    return Number.isFinite(started)?Date.now()-started:0;
  }
  function installStaleCreateRecovery(){
    if(window.__AIVO_AD_FILM_STALE_CREATE_RECOVERY_V1__)return;
    window.__AIVO_AD_FILM_STALE_CREATE_RECOVERY_V1__=true;
    var originalFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      var response=await originalFetch(input,init);
      var url=requestUrl(input);
      if(requestMethod(input,init)!=='POST'||url.indexOf('/api/ad-film/seedance/create')<0||response.status!==409)return response;
      var data=await response.clone().json().catch(function(){return{}});
      if(data&&data.error!=='generation_in_progress')return response;
      var generation=data.generation||{};
      var ageMs=generationAge(generation);
      var projectId=requestProjectId(init);
      var key=projectId+'|'+clean(generation.requestId||generation.outputId);
      if(!projectId||ageMs<MAX_TOTAL_MS||staleRecoveryKeys.has(key))return response;
      staleRecoveryKeys.add(key);
      console.warn('[ADFILM FLOW] stale-generation-recovery-start',{projectId:projectId,requestId:generation.requestId||generation.outputId,ageMs:ageMs});
      try{
        var abandon=await originalFetch('/api/ad-film/seedance/abandon',{
          method:'POST',
          credentials:'include',
          cache:'no-store',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({projectId:projectId})
        });
        var abandonData=await abandon.clone().json().catch(function(){return{}});
        if(!abandon.ok)throw new Error(abandonData.error||abandonData.message||('HTTP '+abandon.status));
        console.warn('[ADFILM FLOW] stale-generation-recovered',{projectId:projectId,requestId:generation.requestId||generation.outputId});
        return originalFetch(input,init);
      }catch(error){
        staleRecoveryKeys.delete(key);
        console.error('[ADFILM FLOW] stale-generation-recovery-failed',error);
        return response;
      }
    };
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

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm'){applyBurst(event.detail.root);loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()}});
  document.addEventListener('aivo:adfilm-assets-ready',function(){applyBurst();loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()});
  document.addEventListener('aivo:adfilm-project-sync',function(){applyBurst();loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()});
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-adfilm-open],[data-aivo-language],summary')){applyBurst();loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()}
  },true);

  window.addEventListener('pagehide',function(){if(timeoutTimer)clearInterval(timeoutTimer)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){applyBurst();loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()},{once:true});else{applyBurst();loadElapsedOwner();installStaleCreateRecovery();startTimeoutMonitor()}
  window.AIVOAdFilmQualityPolicy={apply:apply};
})();