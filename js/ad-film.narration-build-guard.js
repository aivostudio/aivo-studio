/* AIVO AI Reklam Filmi — narration approval guidance and hard production gate */
(function AIVO_AD_FILM_NARRATION_BUILD_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_BUILD_GUARD_V4__)return;
  window.__AIVO_AD_FILM_NARRATION_BUILD_GUARD_V4__=true;

  function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);return input?(input.type==="checkbox"?!!input.checked:input.value):fallback}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function notify(message){try{var fn=window.toast&&window.toast.warning;if(typeof fn==="function")return fn({message:message,duration:4600});if(typeof window.showToast==="function")return window.showToast(message,"warning")}catch(_){} }

  function state(scope){
    var source=project()||{};
    var enabled=!!value(scope,"voiceEnabled",true);
    if(!enabled)return{ready:true,reason:"",code:"off"};
    var currentText=clean(value(scope,"narrationText",""));
    var audio=source.narration&&source.narration.audio;
    var generation=source.narrationGeneration||{};
    var input=generation.input||{};
    if(!audio||!clean(audio.url))return{ready:false,code:"missing",reason:text("Önce reklam sesini oluştur, dinle ve onayla.","Generate, preview and approve the narration first.")};
    if(audio.mastered!==true)return{ready:false,code:"mastering",reason:text("Ses profesyonel olarak işleniyor. Tamamlanmasını bekle.","The narration is being professionally mastered. Wait for it to finish.")};
    if(audio.approved!==true)return{ready:false,code:"approval",reason:text("Reklam filmini oluşturmadan önce sesi dinleyip onayla.","Preview and approve the narration before creating the advertising film.")};
    var approvedText=clean(audio.approvedText||input.text||"");
    if(approvedText&&approvedText!==currentText)return{ready:false,code:"changed",reason:text("Onaylanan ses eski metne ait. Güncel metin için sesi yeniden üretip onayla.","The approved voice belongs to the previous script. Generate and approve it again for the current script.")};
    return{ready:true,reason:"",code:"ready"};
  }

  function setButtonGuidance(button,check){
    if(!button)return;
    var meta=button.querySelector("em");
    if(meta&&!button.dataset.narrationDefaultMeta)button.dataset.narrationDefaultMeta=meta.textContent||"";
    button.dataset.audioApprovalGuard=check.ready?"ready":"blocked";
    button.classList.toggle("is-narration-pending",!check.ready);
    button.title=check.ready?"":check.reason;
    if(meta)meta.textContent=check.ready?(button.dataset.narrationDefaultMeta||meta.textContent):check.code==="changed"?text("Güncel sesi yeniden üret","Regenerate the current voice"):text("Önce sesi onayla","Approve the voice first");
  }

  function sync(scope){
    scope=scope||root();if(!scope)return;
    var button=scope.querySelector('[data-adfilm-build]');if(!button)return;
    var check=state(scope);
    setButtonGuidance(button,check);
    var hint=scope.querySelector('[data-adfilm-build-reason]');
    if(hint&&!check.ready){
      hint.classList.remove("is-ready");
      hint.classList.add("is-narration-warning");
      var label=hint.querySelector("b");if(label)label.textContent=check.reason;
    }else if(hint){hint.classList.remove("is-narration-warning")}
  }

  function guideToNarration(scope,check){
    var panel=scope&&scope.querySelector('[data-adfilm-narration-engine]');
    var card=panel&&panel.closest('.adfilm-card--voice')||scope&&scope.querySelector('.adfilm-card--voice');
    var target=check.code==="approval"?scope.querySelector('[data-narration-audio-approve]'):scope.querySelector('[data-narration-create]');
    if(card){
      card.classList.remove("is-approval-attention");
      void card.offsetWidth;
      card.classList.add("is-approval-attention");
      try{card.scrollIntoView({behavior:"smooth",block:"center"})}catch(_){card.scrollIntoView()}
      setTimeout(function(){card.classList.remove("is-approval-attention")},2400);
    }
    if(target&&!target.disabled)setTimeout(function(){try{target.focus({preventScroll:true})}catch(_){target.focus()}},500);
  }

  function guideToNarrationText(scope){
    var card=scope&&scope.querySelector('.adfilm-card--voice');
    var target=field(scope,"narrationText");
    if(card){
      card.classList.remove("is-approval-attention");
      void card.offsetWidth;
      card.classList.add("is-approval-attention");
      try{card.scrollIntoView({behavior:"smooth",block:"center"})}catch(_){card.scrollIntoView()}
      setTimeout(function(){card.classList.remove("is-approval-attention")},2400);
    }
    if(target)setTimeout(function(){try{target.focus({preventScroll:true})}catch(_){target.focus()}},500);
  }

  function restoreOverLimitWarning(scope,hint){
    var message=text("Seslendirme metni seçilen video süresinden uzun.","The narration is longer than the selected video duration.");
    setTimeout(function(){
      if(!scope||!scope.isConnected||scope.dataset.adfilmNarrationFit!=="over")return;
      var currentHint=hint&&hint.isConnected?hint:scope.querySelector('[data-adfilm-build-reason]');
      if(currentHint){
        currentHint.classList.remove("is-ready");
        currentHint.classList.add("is-narration-warning");
        var label=currentHint.querySelector("b");if(label)label.textContent=message;
      }
      var button=scope.querySelector('[data-adfilm-build]');
      if(button){
        button.disabled=true;
        button.classList.remove("is-ready");
        button.dataset.narrationGuard="blocked";
      }
    },0);
  }

  document.addEventListener("click",function(event){
    var moduleScope=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"]');
    var warning=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build-reason]');
    if(warning){
      var warningScope=warning.closest('[data-module-root][data-module="adfilm"]')||root();
      if(warningScope&&warningScope.dataset.adfilmNarrationFit==="over"){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        guideToNarrationText(warningScope);
        restoreOverLimitWarning(warningScope,warning);
        return;
      }
      var warningCheck=state(warningScope);
      if(warningScope&&!warningCheck.ready){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        guideToNarration(warningScope,warningCheck);
        schedule(warningScope);
        return;
      }
    }

    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button){if(moduleScope)schedule(moduleScope);return}
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var check=state(scope);
    if(check.ready)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    notify(check.reason);guideToNarration(scope,check);sync(scope);
  },true);

  function schedule(scope){[0,50,140,360,800].forEach(function(delay){setTimeout(function(){sync(scope||root())},delay)})}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule(root())});
  document.addEventListener("input",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input]'))schedule(root())},true);
  document.addEventListener("change",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input]'))schedule(root())},true);
  window.AIVOAdFilmNarrationBuildGuard={state:function(){return state(root())},sync:function(){sync(root())}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
