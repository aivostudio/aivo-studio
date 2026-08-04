/* AIVO AI Reklam Filmi — narration readiness state without click ownership */
(function AIVO_AD_FILM_NARRATION_STATE(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_STATE_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_STATE_V1__=true;

  function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);return input?(input.type==="checkbox"?!!input.checked:input.value):fallback}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}

  function state(scope){
    scope=scope||root();
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

  function sync(scope){
    scope=scope||root();if(!scope)return;
    var button=scope.querySelector('[data-adfilm-build]');if(!button)return;
    var check=state(scope);
    var meta=button.querySelector("em");
    if(meta&&!button.dataset.narrationDefaultMeta)button.dataset.narrationDefaultMeta=meta.textContent||"";
    button.dataset.audioApprovalGuard=check.ready?"ready":"blocked";
    button.classList.toggle("is-narration-pending",!check.ready);
    button.title=check.ready?"":check.reason;
    if(meta)meta.textContent=check.ready?(button.dataset.narrationDefaultMeta||meta.textContent):check.code==="changed"?text("Güncel sesi yeniden üret","Regenerate the current voice"):text("Önce sesi onayla","Approve the voice first");
  }

  function schedule(scope){[0,50,140,360,800].forEach(function(delay){setTimeout(function(){sync(scope||root())},delay)})}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule(root())});
  document.addEventListener("input",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="narrationText"]'))schedule(root())},true);
  document.addEventListener("change",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module="adfilm"] [data-adfilm-input="voiceEnabled"]'))schedule(root())},true);

  window.AIVOAdFilmNarrationState={state:function(){return state(root())},sync:function(){sync(root())}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
