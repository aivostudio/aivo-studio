/* AIVO AI Reklam Filmi — hard narration approval gate */
(function AIVO_AD_FILM_NARRATION_BUILD_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_BUILD_GUARD_V2__)return;
  window.__AIVO_AD_FILM_NARRATION_BUILD_GUARD_V2__=true;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);return input?(input.type==="checkbox"?!!input.checked:input.value):fallback}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function notify(message){try{var fn=window.toast&&window.toast.warning;if(typeof fn==="function")return fn({message:message,duration:4200});if(typeof window.showToast==="function")return window.showToast(message,"warning")}catch(_){} }

  function state(scope){
    var source=project()||{};
    var enabled=!!value(scope,"voiceEnabled",true);
    if(!enabled)return{ready:true,reason:""};
    var currentText=clean(value(scope,"narrationText",""));
    var audio=source.narration&&source.narration.audio;
    var generation=source.narrationGeneration||{};
    var input=generation.input||{};
    if(!audio||!clean(audio.url))return{ready:false,reason:text("Önce reklam sesini oluştur, dinle ve onayla.","Generate, preview and approve the narration first.")};
    if(audio.mastered!==true)return{ready:false,reason:text("Ses profesyonel olarak işleniyor. Tamamlanmasını bekle.","The narration is being professionally mastered. Wait for it to finish.")};
    if(audio.approved!==true)return{ready:false,reason:text("Reklam filmini oluşturmadan önce sesi dinleyip onayla.","Preview and approve the narration before creating the advertising film.")};
    var approvedText=clean(audio.approvedText||input.text||"");
    if(approvedText&&approvedText!==currentText)return{ready:false,reason:text("Seslendirme metni değişti. Sesi yeniden üretip onayla.","The narration script changed. Generate and approve the voice again.")};
    return{ready:true,reason:""};
  }

  function sync(scope){
    scope=scope||root();if(!scope)return;
    var button=scope.querySelector('[data-adfilm-build]');if(!button)return;
    var check=state(scope);
    button.dataset.audioApprovalGuard=check.ready?"ready":"blocked";
    if(check.ready){
      if(!button.classList.contains("is-generating")&&button.dataset.narrationGuard!=="blocked")button.disabled=false;
    }else{
      button.disabled=true;
      button.classList.remove("is-ready");
    }
    var hint=scope.querySelector('[data-adfilm-build-reason]');
    if(hint){
      var label=hint.querySelector("b");
      if(!check.ready){hint.classList.remove("is-ready");if(label)label.textContent=check.reason}
    }
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button)return;
    var scope=button.closest('[data-module-root][data-module="adfilm"]')||root();
    var check=state(scope);
    if(check.ready)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    notify(check.reason);sync(scope);
  },true);

  function schedule(scope){[0,50,140,360,800].forEach(function(delay){setTimeout(function(){sync(scope||root())},delay)})}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule(root())});
  document.addEventListener("input",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="narrationText"]'))schedule(root())},true);
  document.addEventListener("change",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="voiceEnabled"]'))schedule(root())},true);
  window.AIVOAdFilmNarrationBuildGuard={state:function(){return state(root())},sync:function(){sync(root())}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
