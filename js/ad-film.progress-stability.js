/* AIVO AI Reklam Filmi — canonical single-owner production progress */
(function AIVO_AD_FILM_PROGRESS_STABILITY(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_STABILITY_V13__)return;
  window.__AIVO_AD_FILM_PROGRESS_STABILITY_V13__=true;

  var timer=null;
  var completionTimer=null;
  var lastSignature="";

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function runGuard(){return window.AIVOAdFilmRunGuard||null}
  function runState(){var guard=runGuard();return guard&&typeof guard.state==="function"?guard.state():window.__AIVO_AD_FILM_ACTIVE_RUN__||null}
  function runActive(){var guard=runGuard();return !!(guard&&typeof guard.active==="function"&&guard.active())}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value==null?"":value).trim()}
  function setText(node,value){value=String(value||"");if(node&&node.textContent!==value)node.textContent=value}

  function hideLegacy(){
    var scope=root();if(!scope)return;
    scope.querySelectorAll('[data-adfilm-engine-status]').forEach(function(node){
      node.setAttribute('data-adfilm-legacy-status','1');
      node.setAttribute('aria-hidden','true');
      node.style.setProperty('display','none','important');
      node.style.setProperty('visibility','hidden','important');
      node.style.setProperty('opacity','0','important');
      node.style.setProperty('pointer-events','none','important');
    });
  }

  function canonical(){
    var scope=root(),bar=action(),build=button();if(!scope||!bar)return null;
    var node=bar.querySelector('[data-adfilm-progress-canonical]');
    if(!node){
      node=document.createElement('div');
      node.className='adfilm-engine-status adfilm-progress-canonical';
      node.setAttribute('data-adfilm-progress-canonical','');
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      node.innerHTML='<span aria-hidden="true"></span><div><b data-adfilm-progress-heading></b><small><span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span></small></div>';
      if(build)bar.insertBefore(node,build);else bar.appendChild(node);
    }
    return node;
  }

  function elapsed(startedAt){
    var started=Date.parse(startedAt||'');
    if(!Number.isFinite(started))return '0 '+text('dk','min')+' 00 '+text('sn','sec');
    var total=Math.max(0,Math.floor((Date.now()-started)/1000));
    return Math.floor(total/60)+' '+text('dk','min')+' '+String(total%60).padStart(2,'0')+' '+text('sn','sec');
  }

  function stageFromRun(run){
    var phase=clean(run&&run.phase).toLowerCase();
    if(phase==='finalizing'||phase==='mixing'||phase==='audio')return{n:3,title:text('Ses ve müzik düzenleniyor','Arranging sound and music'),detail:text('Seslendirme, müzik, logo ve video seviyeleri birleştiriliyor.','Narration, music, logo and video levels are being combined.')};
    if(phase==='exporting'||phase==='compositing')return{n:4,title:text('Video dışa aktarılıyor','Exporting video'),detail:text('Reklam filminiz izlemeye hazır hâle getiriliyor.','Your advertising film is being prepared for playback.')};
    if(phase==='queued'||phase==='processing'||phase==='running'||phase==='in_queue')return{n:2,title:text('Sahneler hazırlanıyor','Preparing scenes'),detail:text('Ürün görüntüleri, geçişler ve görsel akış oluşturuluyor.','Product visuals, transitions and visual flow are being created.')};
    return{n:1,title:text('Hazırlık yapılıyor','Preparing production'),detail:text('Referanslar, seslendirme ve üretim ayarları kontrol ediliyor.','References, narration and production settings are being checked.')};
  }

  function setBusyUi(on){
    var build=button(),bar=action();
    if(build){
      build.classList.toggle('is-generating',!!on);
      build.disabled=!!on;
      if(on)build.setAttribute('aria-busy','true');else build.removeAttribute('aria-busy');
    }
    if(bar){
      bar.classList.toggle('is-engine-active',!!on);
      if(on)bar.setAttribute('data-adfilm-progress-lock','1');else bar.removeAttribute('data-adfilm-progress-lock');
    }
  }

  function renderActive(force){
    if(!runActive())return false;
    hideLegacy();
    var node=canonical(),run=runState()||{},stage=stageFromRun(run);if(!node)return false;
    var signature=['active',stage.n,stage.title,stage.detail].join('|');
    if(force||signature!==lastSignature){
      node.className='adfilm-engine-status adfilm-progress-canonical is-visible is-busy';
      node.setAttribute('data-stage',String(stage.n));
      node.removeAttribute('hidden');
      node.removeAttribute('aria-hidden');
      setText(node.querySelector('[data-adfilm-progress-heading]'),text('Reklam filminiz hazırlanıyor','Your advertising film is being prepared'));
      setText(node.querySelector('[data-adfilm-stage-count]'),text('Aşama ','Stage ')+stage.n+'/4');
      setText(node.querySelector('[data-adfilm-stage-title]'),stage.title);
      setText(node.querySelector('[data-adfilm-stage-description]'),stage.detail);
      lastSignature=signature;
    }
    setText(node.querySelector('[data-adfilm-stage-time]'),text('Toplam geçen süre: ','Total elapsed: ')+elapsed(run.startedAt));
    setBusyUi(true);
    var summary=root()&&root().querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    setText(summary,text('Reklam filmi hazırlanıyor','Advertising film is being prepared'));
    return true;
  }

  function renderIdle(){
    hideLegacy();
    var node=canonical();if(node){
      node.className='adfilm-engine-status adfilm-progress-canonical';
      node.setAttribute('hidden','');
      node.setAttribute('aria-hidden','true');
      node.removeAttribute('data-stage');
    }
    setBusyUi(false);
    lastSignature='idle';
  }

  function renderCompleted(){
    clearTimeout(completionTimer);
    hideLegacy();
    var node=canonical();if(!node)return;
    node.className='adfilm-engine-status adfilm-progress-canonical is-visible is-success';
    node.removeAttribute('hidden');
    node.removeAttribute('aria-hidden');
    node.removeAttribute('data-stage');
    setText(node.querySelector('[data-adfilm-progress-heading]'),text('Reklam filmi hazır','Advertising film ready'));
    setText(node.querySelector('[data-adfilm-stage-count]'),'');
    setText(node.querySelector('[data-adfilm-stage-title]'),text('Üretim tamamlandı','Production completed'));
    setText(node.querySelector('[data-adfilm-stage-description]'),text('Video sağ panelde izlemeye hazır.','The video is ready to watch in the right panel.'));
    setText(node.querySelector('[data-adfilm-stage-time]'),'');
    setBusyUi(false);
    lastSignature='completed';
    completionTimer=setTimeout(renderIdle,5000);
  }

  function renderFailed(){
    clearTimeout(completionTimer);
    hideLegacy();
    var node=canonical();if(!node)return;
    node.className='adfilm-engine-status adfilm-progress-canonical is-visible is-error';
    node.removeAttribute('hidden');
    node.removeAttribute('aria-hidden');
    node.removeAttribute('data-stage');
    setText(node.querySelector('[data-adfilm-progress-heading]'),text('Üretim tamamlanamadı','Production could not be completed'));
    setText(node.querySelector('[data-adfilm-stage-count]'),'');
    setText(node.querySelector('[data-adfilm-stage-title]'),text('İşlem durduruldu','Process stopped'));
    setText(node.querySelector('[data-adfilm-stage-description]'),text('Yeni ücretli üretim otomatik başlatılmadı.','No new paid generation was started automatically.'));
    setText(node.querySelector('[data-adfilm-stage-time]'),'');
    setBusyUi(false);
    lastSignature='failed';
  }

  function render(){if(!renderActive(false)&&lastSignature!=='completed'&&lastSignature!=='failed')renderIdle()}
  function start(){clearInterval(timer);render();timer=setInterval(function(){if(runActive())renderActive(false)},1000)}

  document.addEventListener('aivo:adfilm-run-started',function(){clearTimeout(completionTimer);lastSignature='';setTimeout(function(){renderActive(true)},0)});
  document.addEventListener('aivo:adfilm-run-finished',function(event){
    var reason=clean(event&&event.detail&&event.detail.reason).toLowerCase();
    if(reason==='completed')renderCompleted();else if(reason==='cancelled')renderIdle();else renderFailed();
  });
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(start,120)});
  document.addEventListener('aivo:adfilm-assets-ready',function(){setTimeout(start,40)});
  window.addEventListener('pagehide',function(){clearInterval(timer);clearTimeout(completionTimer)});
  window.AIVOAdFilmProgressUI={render:render,renderActive:renderActive,release:renderIdle,canonical:canonical};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,250)},{once:true});else setTimeout(start,250);
})();
