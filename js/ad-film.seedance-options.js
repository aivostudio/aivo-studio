/* =========================================================
   AIVO — AI REKLAM FILMI / SEEDANCE OUTPUT OPTIONS
   Seedance 2.0 compatible duration, ratio and quality controls.
   Loaded only while the Ad Film module is active.
   ========================================================= */
(function AIVO_AD_FILM_SEEDANCE_OPTIONS(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_OPTIONS__) return;
  window.__AIVO_AD_FILM_SEEDANCE_OPTIONS__=true;

  var DURATIONS=["5","6","7","8","9","10","11","12","13","14","15"];
  var RATIOS=["9:16","1:1","16:9","4:5","3:4","4:3","21:9"];
  var QUALITIES=["720p","1080p","4k"];

  var COPY={
    tr:{ratioNote:"4:5 seçildiğinde final video güvenli kadrajla hazırlanır.",qualityNote:"720p ekonomik, 1080p profesyonel final, 4K premium.",outputDetailsSub:"720p ekonomik, 1080p profesyonel veya 4K premium kaliteyi seç.",premium:"Premium",seconds:"sn",durationLabel:"Video süresi"},
    en:{ratioNote:"When 4:5 is selected, the final video is prepared with a crop-safe frame.",qualityNote:"720p economical, 1080p professional final, 4K premium.",outputDetailsSub:"Choose 720p economical, 1080p professional or 4K premium quality.",premium:"Premium",seconds:"sec",durationLabel:"Video duration"}
  };

  function language(){var html=String(document.documentElement.lang||"").toLowerCase(),stored="";try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}return stored==="en"||html.indexOf("en")===0?"en":"tr"}
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function values(group){return Array.from(group.querySelectorAll("button[data-value]")).map(function(button){return button.getAttribute("data-value")}).join("|")}
  function selected(group){var button=group&&group.querySelector(".is-selected[data-value]");return button?button.getAttribute("data-value"):""}
  function normalizeDuration(value){var number=Math.round(Number(value)||10);if(number<5)return"5";if(number>15)return"15";return String(number)}
  function normalizeRatio(value){value=String(value||"");return RATIOS.indexOf(value)>=0?value:"9:16"}
  function normalizeQuality(value){value=String(value||"").toLowerCase();if(value==="480p"||value==="2k")return"1080p";return QUALITIES.indexOf(value)>=0?value:"1080p"}
  function durationSourceMarkup(){return DURATIONS.map(function(value){return '<button type="button" data-value="'+value+'">'+value+'</button>'}).join("")}
  function durationSelectMarkup(){return DURATIONS.map(function(value){return '<option value="'+value+'">'+value+' '+t("seconds")+'</option>'}).join("")}
  function ratioMarkup(){return RATIOS.map(function(value){return '<button type="button" data-value="'+value+'"><i class="ratio ratio--'+value.replace(":","x")+'"></i><span>'+value+'</span></button>'}).join("")}
  function qualityMarkup(){return QUALITIES.map(function(value){var label=value==="4k"?"4K":value;var tag=value==="4k"?'<em class="adfilm-seedance-tag">'+t("premium")+'</em>':"";return '<button type="button" data-value="'+value+'"><span>'+label+'</span>'+tag+'</button>'}).join("")}

  function ensureNote(group,key,text){var block=group&&group.closest(".adfilm-setting-block");if(!block)return;var note=block.querySelector('[data-adfilm-seedance-note="'+key+'"]');if(!note){note=document.createElement("small");note.className="adfilm-seedance-note";note.setAttribute("data-adfilm-seedance-note",key);block.appendChild(note)}note.textContent=text}
  function removeNote(group,key){var block=group&&group.closest(".adfilm-setting-block");var note=block&&block.querySelector('[data-adfilm-seedance-note="'+key+'"]');if(note)note.remove()}
  function choose(group,value){var button=group.querySelector('button[data-value="'+value+'"]')||group.querySelector("button[data-value]");if(button&&!button.classList.contains("is-selected"))button.click();else if(button)button.classList.add("is-selected")}
  function syncDurationSelect(group){var block=group.closest(".adfilm-setting-block");var select=block&&block.querySelector("[data-adfilm-seedance-duration-select]");if(select)select.value=normalizeDuration(selected(group))}

  function bindDurationSelect(select,group){select.addEventListener("change",function(){choose(group,normalizeDuration(select.value));syncTimeline(group.closest('[data-module-root][data-module="adfilm"]'))})}
  function ensureDurationSelect(group,target){
    var block=group.closest(".adfilm-setting-block");if(!block)return;
    var wrap=block.querySelector("[data-adfilm-seedance-duration-control]");
    if(!wrap){wrap=document.createElement("label");wrap.className="adfilm-seedance-duration-control";wrap.setAttribute("data-adfilm-seedance-duration-control","");block.insertBefore(wrap,group)}
    var current=wrap.querySelector("select");var value=current&&current.value||target;
    wrap.innerHTML='<select data-adfilm-seedance-duration-select aria-label="'+t("durationLabel")+'">'+durationSelectMarkup()+'</select><span class="adfilm-seedance-duration-chevron" aria-hidden="true"></span>';
    var select=wrap.querySelector("select");select.value=normalizeDuration(value);bindDurationSelect(select,group);
    group.hidden=true;group.setAttribute("aria-hidden","true");syncDurationSelect(group)
  }

  function setupDuration(scope){
    var group=scope.querySelector('[data-adfilm-choice="duration"]');if(!group)return;
    var target=normalizeDuration(selected(group));
    if(values(group)!==DURATIONS.join("|")){group.innerHTML=durationSourceMarkup();group.classList.remove("adfilm-options--duration-v2","adfilm-options--seedance-duration");group.classList.add("adfilm-seedance-duration-source");group.setAttribute("data-seedance-options","duration");choose(group,target)}
    if(!group.__seedanceDurationBound){group.__seedanceDurationBound=true;group.addEventListener("click",function(){setTimeout(function(){syncDurationSelect(group)},0)})}
    ensureDurationSelect(group,target);
    var legacy=group.closest(".adfilm-setting-block")&&group.closest(".adfilm-setting-block").querySelector("[data-adfilm-duration-note]");if(legacy)legacy.hidden=true;
    removeNote(group,"duration")
  }

  function setupRatios(scope){
    var group=scope.querySelector('[data-adfilm-choice="aspectRatio"]');if(!group)return;
    var target=normalizeRatio(selected(group));
    if(values(group)!==RATIOS.join("|")){group.innerHTML=ratioMarkup();group.classList.add("adfilm-options--seedance-ratio");group.setAttribute("data-seedance-options","ratio");choose(group,target)}
    ensureNote(group,"ratio",t("ratioNote"))
  }

  function setupQualities(scope){
    var group=scope.querySelector('[data-adfilm-choice="quality"]');if(!group)return;
    var target=normalizeQuality(selected(group));
    if(values(group)!==QUALITIES.join("|")){group.innerHTML=qualityMarkup();group.classList.add("adfilm-options--seedance-quality");group.setAttribute("data-seedance-options","quality");choose(group,target)}else{var tag=group.querySelector(".adfilm-seedance-tag");if(tag)tag.textContent=t("premium")}
    var outputSub=scope.querySelector(".adfilm-card--advanced-output .adfilm-card__heading p");if(outputSub){outputSub.removeAttribute("data-simple-copy");outputSub.textContent=t("outputDetailsSub")}
    ensureNote(group,"quality",t("qualityNote"))
  }

  function ratioClass(value){return"is-seedance-"+value.replace(":","x")}
  function syncPreview(scope){if(!scope)return;var ratioGroup=scope.querySelector('[data-adfilm-choice="aspectRatio"]');var value=normalizeRatio(selected(ratioGroup));document.querySelectorAll("[data-panel-frame]").forEach(function(frame){Array.from(frame.classList).forEach(function(name){if(name.indexOf("is-seedance-")===0)frame.classList.remove(name)});frame.classList.remove("is-portrait","is-square","is-wide","is-post");frame.classList.add(ratioClass(value));frame.setAttribute("data-seedance-ratio",value)})}
  function syncTimeline(scope){if(!scope)return;var group=scope.querySelector('[data-adfilm-choice="duration"]');var duration=Number(normalizeDuration(selected(group)))||10;var cuts=[0,Math.max(1,Math.round(duration*.2)),Math.max(2,Math.round(duration*.5)),Math.max(3,Math.round(duration*.8)),duration];for(var i=1;i<cuts.length;i++)if(cuts[i]<=cuts[i-1])cuts[i]=Math.min(duration,cuts[i-1]+1);cuts[cuts.length-1]=duration;scope.querySelectorAll(".adfilm-scene__thumb span").forEach(function(el,index){var start=String(cuts[index]||0).padStart(2,"0");var end=String(cuts[index+1]||duration).padStart(2,"0");el.textContent="00:"+start+"–00:"+end})}
  function bind(scope){if(scope.__adfilmSeedanceOptionsBound)return;scope.__adfilmSeedanceOptionsBound=true;scope.addEventListener("click",function(event){var button=event.target.closest('[data-adfilm-choice="aspectRatio"] button[data-value]');if(!button)return;setTimeout(function(){syncPreview(scope)},0)})}
  function setup(scope){if(!scope||!scope.isConnected)return;setupDuration(scope);setupRatios(scope);setupQualities(scope);bind(scope);syncPreview(scope);syncTimeline(scope)}
  function schedule(scope){[0,40,120,300].forEach(function(delay){setTimeout(function(){setup(scope||root())},delay)})}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))schedule(root())});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();