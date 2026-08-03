/* AIVO AI Reklam Filmi — single manual narration script workflow */
(function AIVO_AD_FILM_NARRATION_MANUAL(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_MANUAL__)return;
  window.__AIVO_AD_FILM_NARRATION_MANUAL__=true;

  var COPY={
    tr:{tab:"Reklam Seslendirme Metni",label:"Reklam Seslendirme Metni",placeholder:"Reklam filminde okunacak metni yaz..."},
    en:{tab:"Advertising Voice-over Script",label:"Advertising Voice-over Script",placeholder:"Write the script that will be spoken in the advertising film..."}
  };

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function t(key){var copy=english()?COPY.en:COPY.tr;return copy[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function activate(scope){
    scope=scope||root();if(!scope||!scope.isConnected)return false;
    var card=scope.querySelector('.adfilm-card--voice');if(!card)return false;
    var segmented=card.querySelector('[data-adfilm-choice="scriptMode"]');if(!segmented)return false;
    var ai=segmented.querySelector('button[data-value="ai"]');
    var manual=segmented.querySelector('button[data-value="manual"]');
    if(ai)ai.remove();
    if(manual){
      manual.classList.add('is-selected');
      manual.removeAttribute('data-adfilm-i18n');
      manual.removeAttribute('data-narration-copy');
      manual.textContent=t('tab');
    }
    segmented.classList.add('is-single-manual-mode');
    var hidden=field(scope,'scriptMode');if(hidden)hidden.value='manual';
    var textarea=field(scope,'narrationText');
    if(textarea){
      textarea.removeAttribute('data-adfilm-placeholder');
      textarea.setAttribute('placeholder',t('placeholder'));
      var control=textarea.closest('[data-adfilm-script-control]')||textarea.parentElement;
      if(control){
        var label=control.querySelector(':scope>span, :scope>label, .adfilm-control__label');
        if(label)label.textContent=t('label');
      }
    }
    var aiPanel=card.querySelector('[data-narration-ai]');if(aiPanel)aiPanel.remove();
    return true;
  }
  function schedule(scope){[0,50,150,350,700].forEach(function(delay){setTimeout(function(){activate(scope||root())},delay)})}

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')schedule(event.detail.root)});
  document.addEventListener('aivo:adfilm-assets-ready',function(){schedule(root())});
  document.addEventListener('aivo:adfilm-project-sync',function(){schedule(root())});
  window.addEventListener('storage',function(event){if(event&&(event.key==='aivo_language'||event.key==='aivo_lang'))schedule(root())});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(root())},{once:true});else schedule(root());
})();
