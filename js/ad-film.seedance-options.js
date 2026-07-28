/* =========================================================
   AIVO — AI REKLAM FILMI / SEEDANCE OUTPUT OPTIONS
   Seedance 2.0 compatible duration, ratio and quality controls.
   Loaded only while the Ad Film module is active.
   ========================================================= */
(function AIVO_AD_FILM_SEEDANCE_OPTIONS(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_OPTIONS__) return;
  window.__AIVO_AD_FILM_SEEDANCE_OPTIONS__=true;

  var DURATIONS=["4","5","6","7","8","9","10","11","12","13","14","15"];
  var RATIOS=["9:16","1:1","16:9","4:5","3:4","4:3","21:9"];
  var QUALITIES=["480p","720p","1080p","4k"];

  var COPY={
    tr:{
      durationNote:"Seedance 2.0: 4–15 saniye arası gerçek üretim süresi.",
      ratioNote:"4:5 seçildiğinde final video güvenli kadrajla hazırlanır.",
      qualityNote:"480p hızlı ön izleme, 720p standart, 1080p kaliteli final, 4K premium.",
      premium:"Premium"
    },
    en:{
      durationNote:"Seedance 2.0: real generation duration from 4 to 15 seconds.",
      ratioNote:"When 4:5 is selected, the final video is prepared with a crop-safe frame.",
      qualityNote:"480p fast preview, 720p standard, 1080p quality final, 4K premium.",
      premium:"Premium"
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }

  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function values(group){return Array.from(group.querySelectorAll("button[data-value]")).map(function(button){return button.getAttribute("data-value")}).join("|")}
  function selected(group){var button=group&&group.querySelector(".is-selected[data-value]");return button?button.getAttribute("data-value"):""}

  function normalizeDuration(value){
    value=String(value||"");
    if(value==="20"||value==="30"||value==="auto")return"15";
    return DURATIONS.indexOf(value)>=0?value:"10";
  }

  function normalizeRatio(value){
    value=String(value||"");
    return RATIOS.indexOf(value)>=0?value:"9:16";
  }

  function normalizeQuality(value){
    value=String(value||"").toLowerCase();
    if(value==="2k")return"1080p";
    return QUALITIES.indexOf(value)>=0?value:"1080p";
  }

  function durationMarkup(){
    return DURATIONS.map(function(value){
      return '<button type="button" data-value="'+value+'"><span>'+value+'</span><small>sn</small></button>';
    }).join("");
  }

  function ratioIcon(value){
    if(value==="1:1")return"square";
    if(value==="4:5")return"post";
    if(value==="9:16"||value==="3:4")return"portrait";
    return"wide";
  }

  function ratioMarkup(){
    return RATIOS.map(function(value){
      return '<button type="button" data-value="'+value+'"><i class="ratio ratio--'+ratioIcon(value)+'"></i><span>'+value+'</span></button>';
    }).join("");
  }

  function qualityMarkup(){
    return QUALITIES.map(function(value){
      var label=value==="4k"?"4K":value;
      var tag=value==="4k"?'<em class="adfilm-seedance-tag">'+t("premium")+'</em>':"";
      return '<button type="button" data-value="'+value+'"><span>'+label+'</span>'+tag+'</button>';
    }).join("");
  }

  function ensureNote(group,key,text){
    var block=group&&group.closest(".adfilm-setting-block");if(!block)return;
    var note=block.querySelector('[data-adfilm-seedance-note="'+key+'"]');
    if(!note){
      note=document.createElement("small");
      note.className="adfilm-seedance-note";
      note.setAttribute("data-adfilm-seedance-note",key);
      block.appendChild(note);
    }
    note.textContent=text;
  }

  function choose(group,value){
    var button=group.querySelector('button[data-value="'+value+'"]')||group.querySelector("button[data-value]");
    if(button&&!button.classList.contains("is-selected"))button.click();
    else if(button)button.classList.add("is-selected");
  }

  function setupDuration(scope){
    var group=scope.querySelector('[data-adfilm-choice="duration"]');if(!group)return;
    var target=normalizeDuration(selected(group));
    if(values(group)!==DURATIONS.join("|")){
      group.innerHTML=durationMarkup();
      group.classList.remove("adfilm-options--duration-v2");
      group.classList.add("adfilm-options--seedance-duration");
      group.setAttribute("data-seedance-options","duration");
      choose(group,target);
    }
    var legacy=group.closest(".adfilm-setting-block")&&group.closest(".adfilm-setting-block").querySelector("[data-adfilm-duration-note]");
    if(legacy)legacy.hidden=true;
    ensureNote(group,"duration",t("durationNote"));
  }

  function setupRatios(scope){
    var group=scope.querySelector('[data-adfilm-choice="aspectRatio"]');if(!group)return;
    var target=normalizeRatio(selected(group));
    if(values(group)!==RATIOS.join("|")){
      group.innerHTML=ratioMarkup();
      group.classList.add("adfilm-options--seedance-ratio");
      group.setAttribute("data-seedance-options","ratio");
      choose(group,target);
    }
    ensureNote(group,"ratio",t("ratioNote"));
  }

  function setupQualities(scope){
    var group=scope.querySelector('[data-adfilm-choice="quality"]');if(!group)return;
    var target=normalizeQuality(selected(group));
    if(values(group)!==QUALITIES.join("|")){
      group.innerHTML=qualityMarkup();
      group.classList.add("adfilm-options--seedance-quality");
      group.setAttribute("data-seedance-options","quality");
      choose(group,target);
    }else{
      var tag=group.querySelector(".adfilm-seedance-tag");if(tag)tag.textContent=t("premium");
    }
    ensureNote(group,"quality",t("qualityNote"));
  }

  function ratioClass(value){
    if(value==="1:1")return"is-square";
    if(value==="4:5")return"is-post";
    if(value==="16:9"||value==="4:3"||value==="21:9")return"is-wide";
    return"is-portrait";
  }

  function syncPreview(scope){
    var ratioGroup=scope.querySelector('[data-adfilm-choice="aspectRatio"]');
    var value=normalizeRatio(selected(ratioGroup));
    document.querySelectorAll("[data-panel-frame]").forEach(function(frame){
      frame.classList.remove("is-portrait","is-square","is-wide","is-post");
      frame.classList.add(ratioClass(value));
      frame.setAttribute("data-seedance-ratio",value);
    });
  }

  function syncTimeline(scope){
    var group=scope.querySelector('[data-adfilm-choice="duration"]');
    var duration=Number(normalizeDuration(selected(group)))||10;
    var cuts=[
      0,
      Math.max(1,Math.round(duration*.2)),
      Math.max(2,Math.round(duration*.5)),
      Math.max(3,Math.round(duration*.8)),
      duration
    ];
    for(var i=1;i<cuts.length;i++)if(cuts[i]<=cuts[i-1])cuts[i]=Math.min(duration,cuts[i-1]+1);
    cuts[cuts.length-1]=duration;
    scope.querySelectorAll(".adfilm-scene__thumb span").forEach(function(el,index){
      var start=String(cuts[index]||0).padStart(2,"0");
      var end=String(cuts[index+1]||duration).padStart(2,"0");
      el.textContent="00:"+start+"–00:"+end;
    });
  }

  function bind(scope){
    if(scope.__adfilmSeedanceOptionsBound)return;
    scope.__adfilmSeedanceOptionsBound=true;
    scope.addEventListener("click",function(event){
      var button=event.target.closest('[data-adfilm-choice="duration"] button[data-value],[data-adfilm-choice="aspectRatio"] button[data-value]');
      if(!button)return;
      setTimeout(function(){syncPreview(scope);syncTimeline(scope)},0);
    });
  }

  function setup(scope){
    if(!scope||!scope.isConnected)return;
    setupDuration(scope);
    setupRatios(scope);
    setupQualities(scope);
    bind(scope);
    syncPreview(scope);
    syncTimeline(scope);
  }

  function schedule(scope){
    [80,240,620,1100].forEach(function(delay){setTimeout(function(){setup(scope||root())},delay)});
  }

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root);
  });

  window.addEventListener("storage",function(event){
    if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))schedule(root());
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});
  else schedule(root());
})();