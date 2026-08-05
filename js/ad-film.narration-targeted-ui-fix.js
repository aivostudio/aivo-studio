/* AIVO AI Reklam Filmi — targeted narration UI fixes */
(function AIVO_AD_FILM_NARRATION_TARGETED_UI_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_TARGETED_UI_FIX_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_TARGETED_UI_FIX_V1__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}

  function clean(scope){
    scope=scope||root();
    if(!scope)return;

    var voiceCard=scope.querySelector('.adfilm-card--voice');
    if(voiceCard){
      var duplicateSelector=voiceCard.querySelector('[data-adfilm-choice="scriptMode"]');
      if(duplicateSelector)duplicateSelector.remove();
    }

    var download=scope.querySelector('[data-narration-engine-player] [data-pa-action="download"], [data-adfilm-narration-engine-player] [data-pa-action="download"]');
    if(download)download.remove();
  }

  function goToNarration(scope){
    scope=scope||root();
    if(!scope)return;
    var card=scope.querySelector('.adfilm-card--voice');
    var target=scope.querySelector('[data-adfilm-input="narrationText"]');
    if(card){
      try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){card.scrollIntoView()}
    }
    if(target)setTimeout(function(){try{target.focus({preventScroll:true})}catch(_){target.focus()}},450);
  }

  function schedule(scope){
    [0,80,220,500,1000].forEach(function(delay){
      setTimeout(function(){clean(scope||root())},delay);
    });
  }

  document.addEventListener('click',function(event){
    var hint=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build-reason]');
    if(!hint)return;
    var scope=hint.closest('[data-module-root][data-module="adfilm"]')||root();
    var label=String(hint.textContent||'').toLowerCase();
    if(scope&&(
      scope.dataset.adfilmNarrationFit==='over' ||
      label.indexOf('seslendirme metni')!==-1 ||
      label.indexOf('narration')!==-1
    )){
      event.preventDefault();
      event.stopPropagation();
      goToNarration(scope);
    }
  },true);

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')schedule(event.detail.root);
  },true);
  document.addEventListener('aivo:adfilm-assets-ready',function(){schedule(root())},true);
  document.addEventListener('aivo:adfilm-project-sync',function(){schedule(root())},true);

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){schedule(root())},{once:true});
  }else{
    schedule(root());
  }
})();
