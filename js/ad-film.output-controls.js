/* =========================================================
   AIVO — AI REKLAM FILMI / DURATION POLICY
   Keeps Basic Mode aligned with realistic engine limits until
   the final generation providers are selected.
   ========================================================= */
(function AIVO_AD_FILM_DURATION_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_DURATION_POLICY__) return;
  window.__AIVO_AD_FILM_DURATION_POLICY__=true;

  var ALLOWED=["5","10","15","20"];
  var DEFAULT_DURATION="10";
  var DRAFT_KEYS=["aivo_adfilm_basic_draft_v2","aivo_adfilm_basic_draft_v1"];

  var COPY={
    tr:{compatible:"Uyumlu motor",note:"20 sn seçeneği yalnız destekleyen üretim motorlarında kullanılacak."},
    en:{compatible:"Compatible engine",note:"The 20 sec option will only use generation engines that support it."}
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}

  function normalize(value){
    value=String(value||"");
    if(value==="30")return"20";
    return ALLOWED.indexOf(value)>=0?value:DEFAULT_DURATION;
  }

  function storedDuration(){
    for(var i=0;i<DRAFT_KEYS.length;i++){
      try{
        var raw=localStorage.getItem(DRAFT_KEYS[i])||sessionStorage.getItem(DRAFT_KEYS[i]);
        if(!raw)continue;
        var draft=JSON.parse(raw);
        if(draft&&draft.duration)return normalize(draft.duration);
      }catch(_){}
    }
    return"";
  }

  function button(value,label,tag){
    return '<button type="button" data-value="'+value+'"><span>'+label+'</span>'+(tag?'<em class="adfilm-duration-tag">'+tag+'</em>':'')+'</button>';
  }

  function updateStoredDrafts(){
    DRAFT_KEYS.forEach(function(key){
      [localStorage,sessionStorage].forEach(function(storage){
        try{
          var raw=storage.getItem(key);if(!raw)return;
          var draft=JSON.parse(raw);if(!draft||!draft.duration)return;
          var next=normalize(draft.duration);
          if(next!==String(draft.duration)){draft.duration=next;storage.setItem(key,JSON.stringify(draft))}
        }catch(_){}
      });
    });
  }

  function updateStoryboard(scope,duration){
    var d=Number(duration)||10;
    var cuts=d===5?[0,1,2,4,5]:d===10?[0,2,5,8,10]:d===15?[0,3,8,12,15]:[0,3,9,15,20];
    scope.querySelectorAll(".adfilm-scene__thumb span").forEach(function(el,index){
      var start=String(cuts[index]||0).padStart(2,"0");
      var end=String(cuts[index+1]||d).padStart(2,"0");
      el.textContent="00:"+start+"–00:"+end;
    });
    var plan=window.AIVOAdFilmStoryboardState;
    if(plan&&Array.isArray(plan.scenes)){
      plan.settings=plan.settings||{};plan.settings.duration=String(duration);
      plan.scenes.forEach(function(scene,index){
        scene.start=cuts[index]||0;scene.end=cuts[index+1]||d;
        scene.time="00:"+String(scene.start).padStart(2,"0")+"–00:"+String(scene.end).padStart(2,"0");
      });
    }
  }

  function ensureNote(group){
    var block=group.closest(".adfilm-setting-block");if(!block)return;
    var note=block.querySelector("[data-adfilm-duration-note]");
    if(!note){note=document.createElement("small");note.className="adfilm-duration-note";note.setAttribute("data-adfilm-duration-note","");block.appendChild(note)}
    note.textContent=t("note");
  }

  function setup(scope){
    if(!scope)return;
    var group=scope.querySelector('[data-adfilm-choice="duration"]');
    if(!group)return;

    updateStoredDrafts();
    var saved=storedDuration();
    var current=group.querySelector(".is-selected[data-value]");
    var target=saved||normalize(current&&current.getAttribute("data-value"));
    if(!saved&&current&&current.getAttribute("data-value")==="15")target=DEFAULT_DURATION;

    group.innerHTML=button("5","5 sn")+button("10","10 sn")+button("15","15 sn")+button("20","20 sn",t("compatible"));
    group.classList.add("adfilm-options--duration-v2");
    ensureNote(group);

    var targetButton=group.querySelector('button[data-value="'+normalize(target)+'"]')||group.querySelector('button[data-value="'+DEFAULT_DURATION+'"]');
    if(targetButton)targetButton.click();
    updateStoryboard(scope,normalize(target));

    if(!group.__durationPolicyBound){
      group.__durationPolicyBound=true;
      group.addEventListener("click",function(event){
        var selected=event.target.closest("button[data-value]");
        if(!selected)return;
        setTimeout(function(){updateStoryboard(scope,selected.getAttribute("data-value"))},0);
      });
    }
    scope.__adfilmDurationPolicyReady=true;
  }

  function schedule(scope){setTimeout(function(){setup(scope||root())},120)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))schedule(root())});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmDurationPolicyReady)schedule(scope)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
