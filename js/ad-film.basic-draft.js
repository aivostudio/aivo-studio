/* =========================================================
   AIVO — AI REKLAM FILMI / BASIC MODE DRAFT
   Local draft persistence for text and settings only.
   Media files are intentionally not persisted.
   ========================================================= */
(function AIVO_AD_FILM_BASIC_DRAFT(){
  "use strict";
  if(window.__AIVO_AD_FILM_BASIC_DRAFT__) return;
  window.__AIVO_AD_FILM_BASIC_DRAFT__=true;

  var STORAGE_KEY="aivo_adfilm_basic_draft_v1";
  var saveTimer=null;
  var restoring=false;
  var mountedRoot=null;

  var COPY={
    tr:{
      saved:"Taslak kaydedildi",saving:"Taslak kaydediliyor...",restored:"Taslak geri yüklendi",reset:"Taslağı sıfırla",resetConfirm:"Bu taslaktaki metin ve ayarlar silinsin mi?",resetDone:"Taslak sıfırlandı",filesNote:"Güvenlik nedeniyle yüklenen dosyalar yeniden seçilmelidir.",showMissing:"Eksik alana git"
    },
    en:{
      saved:"Draft saved",saving:"Saving draft...",restored:"Draft restored",reset:"Reset draft",resetConfirm:"Clear the text and settings in this draft?",resetDone:"Draft reset",filesNote:"Uploaded files must be selected again for security reasons.",showMissing:"Go to missing field"
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return COPY[lang()][key]||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function"){window.toast[type||"info"](message);return}
      if(typeof window.showToast==="function"){window.showToast(message,type||"info");return}
    }catch(_){}
    console.info("[ADFILM]",message);
  }

  function selected(scope,key){var button=scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.getAttribute("data-value"):""}
  function value(scope,key){var input=scope.querySelector('[data-adfilm-input="'+key+'"]');if(!input)return null;return input.type==="checkbox"?!!input.checked:input.value}

  function collect(scope){
    return{
      version:1,savedAt:new Date().toISOString(),
      productName:value(scope,"productName")||"",brandName:value(scope,"brandName")||"",description:value(scope,"description")||"",targetAudience:value(scope,"targetAudience")||"",cta:value(scope,"cta")||"",
      language:value(scope,"language")||"tr",voiceStyle:value(scope,"voiceStyle")||"warm",voiceEnabled:!!value(scope,"voiceEnabled"),narrationText:value(scope,"narrationText")||"",
      subtitles:!!value(scope,"subtitles"),music:!!value(scope,"music"),soundEffects:!!value(scope,"soundEffects"),
      scriptMode:selected(scope,"scriptMode")||"ai",sceneStyle:selected(scope,"sceneStyle")||"premium",duration:selected(scope,"duration")||"15",aspectRatio:selected(scope,"aspectRatio")||"9:16",quality:selected(scope,"quality")||"1080p"
    };
  }

  function readDraft(){try{var raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null}catch(_){return null}}
  function writeDraft(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}catch(_){return false}}
  function clearDraft(){try{localStorage.removeItem(STORAGE_KEY)}catch(_){}}

  function ensureTools(scope){
    var actionbar=scope.querySelector(".adfilm-actionbar");if(!actionbar)return null;
    var tools=actionbar.querySelector("[data-adfilm-draft-tools]");
    if(!tools){
      tools=document.createElement("div");tools.className="adfilm-draft-tools";tools.setAttribute("data-adfilm-draft-tools","");
      tools.innerHTML='<div class="adfilm-draft-status" data-adfilm-draft-status><span></span><b>'+t("saved")+'</b><small></small></div><button type="button" class="adfilm-draft-reset" data-adfilm-draft-reset title="'+t("reset")+'"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>'+t("reset")+'</span></button>';
      var create=actionbar.querySelector("[data-adfilm-build]");if(create)actionbar.insertBefore(tools,create);else actionbar.appendChild(tools);
    }
    return tools;
  }

  function formatTime(iso){
    try{return new Intl.DateTimeFormat(lang()==="en"?"en-US":"tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}catch(_){return""}
  }

  function setStatus(scope,mode,stamp){
    var tools=ensureTools(scope),status=tools&&tools.querySelector("[data-adfilm-draft-status]");if(!status)return;
    status.classList.toggle("is-saving",mode==="saving");status.classList.toggle("is-restored",mode==="restored");
    var label=status.querySelector("b"),small=status.querySelector("small");if(label)label.textContent=t(mode==="saving"?"saving":mode==="restored"?"restored":"saved");if(small)small.textContent=stamp?formatTime(stamp):"";
    var reset=tools.querySelector("[data-adfilm-draft-reset] span");if(reset)reset.textContent=t("reset");
  }

  function save(scope){
    if(!scope||restoring)return;
    var data=collect(scope);if(writeDraft(data))setStatus(scope,"saved",data.savedAt);
  }
  function scheduleSave(scope){
    if(restoring)return;
    setStatus(scope,"saving");clearTimeout(saveTimer);saveTimer=setTimeout(function(){save(scope)},450);
  }

  function dispatch(input){input.dispatchEvent(new Event(input.tagName==="SELECT"||input.type==="checkbox"?"change":"input",{bubbles:true}))}
  function setInput(scope,key,next){var input=scope.querySelector('[data-adfilm-input="'+key+'"]');if(!input)return;if(input.type==="checkbox")input.checked=!!next;else input.value=next==null?"":String(next);dispatch(input)}
  function setChoice(scope,key,next){var button=scope.querySelector('[data-adfilm-choice="'+key+'"] [data-value="'+CSS.escape(String(next||""))+'"]');if(button&&!button.classList.contains("is-selected"))button.click()}

  function restore(scope){
    var draft=readDraft();ensureTools(scope);
    if(!draft){setStatus(scope,"saved");return}
    restoring=true;
    ["productName","brandName","description","targetAudience","cta","language","voiceStyle","voiceEnabled","narrationText","subtitles","music","soundEffects"].forEach(function(key){if(Object.prototype.hasOwnProperty.call(draft,key))setInput(scope,key,draft[key])});
    ["scriptMode","sceneStyle","duration","aspectRatio","quality"].forEach(function(key){if(draft[key])setChoice(scope,key,draft[key])});
    setTimeout(function(){restoring=false;setStatus(scope,"restored",draft.savedAt);if(draft.productName||draft.description)toast(t("restored")+". "+t("filesNote"),"info")},80);
  }

  function reset(scope){
    var approved=true;
    try{approved=window.confirm(t("resetConfirm"))}catch(_){approved=true}
    if(!approved)return;
    restoring=true;clearDraft();
    ["productName","brandName","description","targetAudience","cta","narrationText"].forEach(function(key){setInput(scope,key,"")});
    setInput(scope,"language","tr");setInput(scope,"voiceStyle","warm");setInput(scope,"voiceEnabled",true);setInput(scope,"subtitles",true);setInput(scope,"music",true);setInput(scope,"soundEffects",false);
    setChoice(scope,"scriptMode","ai");setChoice(scope,"sceneStyle","premium");setChoice(scope,"duration","15");setChoice(scope,"aspectRatio","9:16");setChoice(scope,"quality","1080p");
    scope.querySelectorAll("[data-adfilm-file]").forEach(function(input){try{input.value="";input.dispatchEvent(new Event("change",{bubbles:true}))}catch(_){}});
    setTimeout(function(){restoring=false;setStatus(scope,"saved");toast(t("resetDone"),"success");scope.scrollIntoView({behavior:"smooth",block:"start"})},100);
  }

  function firstMissing(scope){
    var order=["productName","description","productImages","narrationText"];
    for(var i=0;i<order.length;i++){
      var key=order[i],target=key==="productImages"?scope.querySelector('[data-adfilm-file="productImages"]')&&scope.querySelector('[data-adfilm-file="productImages"]').closest(".adfilm-upload-zone"):scope.querySelector('[data-adfilm-input="'+key+'"]');
      if(target&&(target.getAttribute("aria-invalid")==="true"||target.classList.contains("has-error")||target.closest(".has-error")))return target;
    }
    return null;
  }

  function bind(scope){
    if(!scope||scope.__adfilmDraftBound)return;scope.__adfilmDraftBound=true;mountedRoot=scope;restore(scope);
    scope.addEventListener("input",function(event){if(event.target.closest("[data-adfilm-input]"))scheduleSave(scope)},true);
    scope.addEventListener("change",function(event){if(event.target.closest("[data-adfilm-input]"))scheduleSave(scope)},true);
    scope.addEventListener("click",function(event){
      if(event.target.closest("[data-adfilm-draft-reset]")){event.preventDefault();reset(scope);return}
      if(event.target.closest("[data-adfilm-choice] button[data-value]"))scheduleSave(scope);
      var reason=event.target.closest("[data-adfilm-build-reason]");if(reason&&!reason.classList.contains("is-ready")){var target=firstMissing(scope);if(target){target.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(function(){if(typeof target.focus==="function")target.focus({preventScroll:true})},350)}}
    },true);
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root)},80)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang")&&mountedRoot)setTimeout(function(){setStatus(mountedRoot,"saved",(readDraft()||{}).savedAt)},50)});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmDraftBound)setTimeout(function(){bind(scope)},50)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind(root())},{once:true});else bind(root());
})();
