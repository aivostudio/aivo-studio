/* AIVO AI Reklam Filmi — stable narration on/off controller */
(function AIVO_AD_FILM_VOICE_TOGGLE_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_VOICE_TOGGLE_FIX_V1__)return;
  window.__AIVO_AD_FILM_VOICE_TOGGLE_FIX_V1__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function isEnglish(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}

  function structuralControls(card){
    return card.querySelectorAll([
      'select[data-adfilm-input]',
      'textarea[data-adfilm-input="narrationText"]',
      '[data-adfilm-choice="scriptMode"] button[data-value]',
      'button[data-voice-control="speed"]',
      'button[data-voice-control="flow"]'
    ].join(','));
  }

  function sync(scope){
    scope=scope||root();
    if(!scope||!scope.isConnected)return;

    var card=scope.querySelector('.adfilm-card--voice');
    var toggle=scope.querySelector('[data-adfilm-input="voiceEnabled"]');
    if(!card||!toggle)return;

    var enabled=!!toggle.checked;
    card.classList.toggle('is-voice-off',!enabled);
    card.classList.toggle('is-voice-on',enabled);
    card.dataset.voiceEnabled=enabled?'1':'0';
    toggle.setAttribute('aria-checked',enabled?'true':'false');

    structuralControls(card).forEach(function(control){
      control.disabled=!enabled;
      control.setAttribute('aria-disabled',enabled?'false':'true');
    });

    var label=card.querySelector('.adfilm-switch b');
    if(label)label.textContent=enabled?(isEnglish()?'On':'Açık'):(isEnglish()?'Off':'Kapalı');

    var note=card.querySelector('[data-adfilm-voice-note]');
    if(note)note.hidden=enabled;

    document.dispatchEvent(new CustomEvent('aivo:adfilm-voice-state',{detail:{enabled:enabled,scope:scope}}));
  }

  function schedule(scope,delay){setTimeout(function(){sync(scope||root())},delay==null?0:delay)}

  document.addEventListener('change',function(event){
    var toggle=event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="voiceEnabled"]');
    if(!toggle)return;
    schedule(toggle.closest('[data-module-root][data-module="adfilm"]'),0);
    schedule(toggle.closest('[data-module-root][data-module="adfilm"]'),80);
  },true);

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm'){
      schedule(event.detail.root,40);
      schedule(event.detail.root,280);
    }
  });

  document.addEventListener('aivo:adfilm-project-sync',function(){schedule(root(),40)});
  window.addEventListener('pageshow',function(){schedule(root(),80)});

  var observer=new MutationObserver(function(){
    var scope=root();
    if(scope&&!scope.dataset.voiceToggleFixReady){
      scope.dataset.voiceToggleFixReady='1';
      schedule(scope,30);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.AIVOAdFilmVoiceToggle={sync:function(){sync(root())}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(root(),60)},{once:true});else schedule(root(),60);
})();
