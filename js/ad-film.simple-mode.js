/* =========================================================
   AIVO — AI REKLAM FILMI / SIMPLE MODE
   Keeps the main flow intentionally short and moves optional
   controls into a single collapsed Advanced Settings section.
   ========================================================= */
(function AIVO_AD_FILM_SIMPLE_MODE(){
  "use strict";
  if(window.__AIVO_AD_FILM_SIMPLE_MODE__) return;
  window.__AIVO_AD_FILM_SIMPLE_MODE__=true;

  var activeRoot=null;
  var STORAGE_KEY="aivo_adfilm_advanced_open_v1";
  var COPY={
    tr:{
      advanced:"Gelişmiş Ayarlar",
      advancedSub:"İsteğe bağlı: görsel stil, kalite, müzik ve sahne planı.",
      optional:"İsteğe bağlı",
      automatic:"AIVO gerisini otomatik hazırlayacak",
      automaticSub:"Görsel stil, sahne planı, müzik dengesi ve geçişler ürün bilgilerine göre ayarlanır.",
      visualStyle:"Görsel Stil",
      visualStyleSub:"Varsayılan: Otomatik / Premium ürün görünümü.",
      outputDetails:"Ek Çıkış Ayarları",
      outputDetailsSub:"Kalite, altyazı, müzik ve ses efektlerini özelleştir.",
      scenePlan:"Sahne Planı",
      scenePlanSub:"Yalnız ayrıntılı kontrol gerektiğinde görüntüle veya yenile.",
      videoSettingsSub:"Yalnız süreyi ve yayın formatını seç.",
      optionalEyebrow:"İSTEĞE BAĞLI"
    },
    en:{
      advanced:"Advanced Settings",
      advancedSub:"Optional: visual style, quality, music and scene plan.",
      optional:"Optional",
      automatic:"AIVO will prepare the rest automatically",
      automaticSub:"Visual style, scene plan, music balance and transitions are set from the product brief.",
      visualStyle:"Visual Style",
      visualStyleSub:"Default: Automatic / premium product look.",
      outputDetails:"Additional Output Settings",
      outputDetailsSub:"Customize quality, subtitles, music and sound effects.",
      scenePlan:"Scene Plan",
      scenePlanSub:"Open or refresh only when detailed control is needed.",
      videoSettingsSub:"Choose only the duration and publishing format.",
      optionalEyebrow:"OPTIONAL"
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return (COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}

  function icon(name){
    if(name==="auto")return '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 1.8 4.8L19 9.5l-4.1 3.2 1.4 5.3-4.3-2.8L7.7 18l1.4-5.3L5 9.5l5.2-1.7L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 3.5v4M16.5 5.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(name==="advanced")return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="6" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="12" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="18" r="2" stroke="currentColor" stroke-width="1.8"/></svg>';
    if(name==="output")return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="12" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="14" cy="17" r="2" stroke="currentColor" stroke-width="1.7"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none"><path d="m8 10 4 4 4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function heading(card,title,sub,eyebrow){
    if(!card)return;
    var head=card.querySelector(".adfilm-card__heading");
    if(!head)return;
    var eye=head.querySelector(".adfilm-card__eyebrow"),h2=head.querySelector("h2"),p=head.querySelector("p");
    if(eye){eye.removeAttribute("data-adfilm-i18n");eye.textContent=eyebrow||t("optionalEyebrow")}
    if(h2){h2.removeAttribute("data-adfilm-i18n");h2.textContent=title}
    if(p){p.removeAttribute("data-adfilm-i18n");p.textContent=sub}
  }

  function makeAdvancedOutput(quality,toggles){
    var article=document.createElement("article");
    article.className="adfilm-card adfilm-card--advanced-output adfilm-card--optional";
    article.innerHTML='<div class="adfilm-card__head"><span class="adfilm-card__icon" aria-hidden="true">'+icon("output")+'</span><div class="adfilm-card__heading"><span class="adfilm-card__eyebrow">'+t("optionalEyebrow")+'</span><h2 data-simple-copy="outputDetails">'+t("outputDetails")+'</h2><p data-simple-copy="outputDetailsSub">'+t("outputDetailsSub")+'</p></div></div><div class="adfilm-advanced-output__body"></div>';
    var body=article.querySelector(".adfilm-advanced-output__body");
    if(quality)body.appendChild(quality);
    if(toggles)body.appendChild(toggles);
    return article;
  }

  function setup(scope){
    if(!scope||scope.__adfilmSimpleModeBound)return;
    var workspace=scope.querySelector(".adfilm-workspace"),styleCard=scope.querySelector(".adfilm-card--style"),settingsCard=scope.querySelector(".adfilm-card--settings"),storyboardCard=scope.querySelector(".adfilm-card--storyboard"),actionbar=scope.querySelector(".adfilm-actionbar");
    if(!workspace||!styleCard||!settingsCard||!storyboardCard||!actionbar)return;

    scope.__adfilmSimpleModeBound=true;
    activeRoot=scope;
    scope.classList.add("is-simplified-basic");

    var settingsEye=settingsCard.querySelector(".adfilm-card__eyebrow");
    if(settingsEye)settingsEye.textContent="04";
    var settingsSub=settingsCard.querySelector(".adfilm-card__heading p");
    if(settingsSub){settingsSub.removeAttribute("data-adfilm-i18n");settingsSub.setAttribute("data-simple-copy","videoSettingsSub");settingsSub.textContent=t("videoSettingsSub")}

    var quality=Array.from(settingsCard.querySelectorAll(".adfilm-setting-block")).find(function(block){return !!block.querySelector('[data-adfilm-i18n="quality"]')});
    var toggles=settingsCard.querySelector(".adfilm-toggle-grid");

    styleCard.classList.add("adfilm-card--optional");
    heading(styleCard,t("visualStyle"),t("visualStyleSub"));
    storyboardCard.classList.add("adfilm-card--optional");
    heading(storyboardCard,t("scenePlan"),t("scenePlanSub"));

    var details=document.createElement("details");
    details.className="adfilm-simple-advanced";
    details.setAttribute("data-adfilm-advanced","");
    try{details.open=localStorage.getItem(STORAGE_KEY)==="1"}catch(_){}
    details.innerHTML='<summary><span class="adfilm-simple-advanced__icon" aria-hidden="true">'+icon("advanced")+'</span><span class="adfilm-simple-advanced__copy"><b data-simple-copy="advanced">'+t("advanced")+'</b><small data-simple-copy="advancedSub">'+t("advancedSub")+'</small></span><em data-simple-copy="optional">'+t("optional")+'</em><span class="adfilm-simple-advanced__chevron" aria-hidden="true">'+icon("chevron")+'</span></summary><div class="adfilm-simple-advanced__body"></div>';
    var advancedBody=details.querySelector(".adfilm-simple-advanced__body");
    advancedBody.appendChild(styleCard);
    advancedBody.appendChild(makeAdvancedOutput(quality,toggles));
    advancedBody.appendChild(storyboardCard);

    var auto=document.createElement("div");
    auto.className="adfilm-simple-auto";
    auto.setAttribute("data-adfilm-simple-auto","");
    auto.innerHTML='<span class="adfilm-simple-auto__icon" aria-hidden="true">'+icon("auto")+'</span><div><b data-simple-copy="automatic">'+t("automatic")+'</b><small data-simple-copy="automaticSub">'+t("automaticSub")+'</small></div><span class="adfilm-simple-auto__check">✓</span>';

    workspace.insertBefore(auto,actionbar);
    workspace.insertBefore(details,actionbar);

    details.addEventListener("toggle",function(){try{localStorage.setItem(STORAGE_KEY,details.open?"1":"0")}catch(_){};});
  }

  function refreshLanguage(){
    if(!activeRoot)return;
    activeRoot.querySelectorAll("[data-simple-copy]").forEach(function(node){var key=node.getAttribute("data-simple-copy");node.textContent=t(key)});
    var style=activeRoot.querySelector(".adfilm-card--style");
    var storyboard=activeRoot.querySelector(".adfilm-card--storyboard");
    heading(style,t("visualStyle"),t("visualStyleSub"));
    heading(storyboard,t("scenePlan"),t("scenePlanSub"));
    var output=activeRoot.querySelector(".adfilm-card--advanced-output");
    heading(output,t("outputDetails"),t("outputDetailsSub"));
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){setup(event.detail.root)},70)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))setTimeout(refreshLanguage,60)});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmSimpleModeBound)setTimeout(function(){setup(scope)},40)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setup(root())},{once:true});else setup(root());
})();

/* Additive product-image picker: selecting again appends instead of replacing. */
(function AIVO_AD_FILM_APPEND_PRODUCT_IMAGES(){
  "use strict";
  if(window.__AIVO_AD_FILM_APPEND_PRODUCT_IMAGES__) return;
  window.__AIVO_AD_FILM_APPEND_PRODUCT_IMAGES__=true;

  var MAX=6;
  var previousByInput=new WeakMap();
  var redispatching=new WeakSet();

  function imageInput(target){return target&&target.closest?target.closest('[data-adfilm-file="productImages"]'):null}
  function list(input){return input?Array.from(input.files||[]):[]}
  function id(file){return [file.name||"",file.size||0,file.type||"",file.lastModified||0].join("|")}
  function toast(message,type){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function"){fn({message:message,duration:2600});return}
      if(typeof window.showToast==="function"){window.showToast(message,type||"info");return}
    }catch(_){}
  }
  function setFiles(input,files){
    var dt=new DataTransfer();
    files.forEach(function(file){dt.items.add(file)});
    redispatching.add(input);
    input.files=dt.files;
    input.dispatchEvent(new Event("change",{bubbles:true}));
  }
  function isEnglish(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}

  document.addEventListener("click",function(event){
    var input=imageInput(event.target);
    if(input)previousByInput.set(input,list(input));
  },true);

  document.addEventListener("change",function(event){
    var input=imageInput(event.target);
    if(!input)return;
    if(redispatching.has(input)){redispatching.delete(input);return}

    var previous=previousByInput.get(input);
    if(!previous)return;
    previousByInput.delete(input);

    var selected=list(input),known=new Set(previous.map(id)),added=[],duplicates=0;
    selected.forEach(function(file){var key=id(file);if(known.has(key)){duplicates++;return}known.add(key);added.push(file)});

    var room=Math.max(0,MAX-previous.length),accepted=added.slice(0,room),merged=previous.concat(accepted).slice(0,MAX);
    event.stopImmediatePropagation();
    setFiles(input,merged);

    if(accepted.length){
      toast(isEnglish()?(accepted.length+" new image"+(accepted.length>1?"s were":" was")+" added."):(accepted.length+" yeni görsel eklendi."),"success");
    }
    if(duplicates){
      toast(isEnglish()?"Duplicate images were not added again.":"Aynı görsel tekrar eklenmedi.","info");
    }
    if(added.length>accepted.length||(!accepted.length&&!duplicates&&previous.length>=MAX)){
      toast(isEnglish()?"You can add up to 6 product images.":"En fazla 6 ürün görseli ekleyebilirsin.","warning");
    }
  },true);
})();
