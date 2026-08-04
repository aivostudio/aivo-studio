/* AIVO AI Reklam Filmi — live duration and quality credit pricing */
(function AIVO_AD_FILM_CREDIT_PRICING(){
  "use strict";
  if(window.__AIVO_AD_FILM_CREDIT_PRICING_V2__) return;
  window.__AIVO_AD_FILM_CREDIT_PRICING_V2__=true;
  window.__AIVO_AD_FILM_CREDIT_PRICING_V1__=true;

  var BASE_CREDITS={"720p":145,"1080p":290,"4k":575};
  var DEFAULT_DURATION="5";
  var userChangedDuration=false;
  var mountedRoot=null;
  var observer=null;
  var syncTimer=null;
  var lastEventKey="";

  function clean(value){return String(value==null?"":value).trim()}
  function english(){
    var html=String(document.documentElement.lang||"").toLowerCase();
    var stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0;
  }
  function root(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }
  function normalizeDuration(value){
    var duration=Math.round(Number(value)||Number(DEFAULT_DURATION));
    if(duration<5)duration=5;
    if(duration>15)duration=15;
    return duration;
  }
  function normalizeQuality(value){
    value=clean(value).toLowerCase();
    if(value==="720p"||value==="4k")return value;
    return"1080p";
  }
  function calculate(quality,duration){
    var normalizedQuality=normalizeQuality(quality);
    var normalizedDuration=normalizeDuration(duration);
    var base=Number(BASE_CREDITS[normalizedQuality]||BASE_CREDITS["1080p"]);
    return Math.ceil((base*normalizedDuration/15)/5)*5;
  }
  function durationGroup(scope){return scope&&scope.querySelector('[data-adfilm-choice="duration"]')}
  function durationSelect(scope){return scope&&scope.querySelector('[data-adfilm-seedance-duration-select]')}
  function currentDuration(scope){
    var select=durationSelect(scope);
    if(select&&select.value)return normalizeDuration(select.value);
    var selected=durationGroup(scope)&&durationGroup(scope).querySelector('.is-selected[data-value]');
    return normalizeDuration(selected&&selected.getAttribute("data-value"));
  }
  function visibleQualityGroup(scope){
    return scope&&scope.querySelector('.adfilm-card--advanced-output [data-adfilm-choice="quality"]')||scope&&scope.querySelector('[data-adfilm-choice="quality"]');
  }
  function currentQuality(scope){
    var group=visibleQualityGroup(scope);
    var selected=group&&group.querySelector('.is-selected[data-value]');
    return normalizeQuality(selected&&selected.getAttribute("data-value"));
  }
  function creditText(amount){return String(amount)+" "+(english()?"Credits":"Kredi")}
  function createText(amount){return (english()?"Create Advertising Film":"Reklam Filmini Oluştur")+" ("+creditText(amount)+")"}

  function forceDefaultDuration(scope){
    if(!scope||userChangedDuration)return;
    var group=durationGroup(scope);
    var button=group&&group.querySelector('button[data-value="'+DEFAULT_DURATION+'"]');
    if(button&&!button.classList.contains("is-selected")){
      group.querySelectorAll('button[data-value]').forEach(function(item){item.classList.toggle("is-selected",item===button)});
      try{button.click()}catch(_){}
    }
    var select=durationSelect(scope);
    if(select&&select.value!==DEFAULT_DURATION){
      select.value=DEFAULT_DURATION;
      try{select.dispatchEvent(new Event("change",{bubbles:true}))}catch(_){}
    }
  }

  function ensureQualityOption(group,button,amount){
    if(!group||!button)return;
    var option=button.parentElement&&button.parentElement.classList.contains("adfilm-quality-option")?button.parentElement:null;
    if(!option){
      option=document.createElement("div");
      option.className="adfilm-quality-option";
      group.insertBefore(option,button);
      option.appendChild(button);
    }
    var node=option.querySelector('[data-adfilm-quality-credit]');
    if(!node){
      node=document.createElement("div");
      node.className="adfilm-quality-credit";
      node.setAttribute("data-adfilm-quality-credit","");
      option.appendChild(node);
    }
    var text=creditText(amount);
    if(node.textContent!==text)node.textContent=text;
    option.classList.toggle("is-selected",button.classList.contains("is-selected"));
    option.setAttribute("data-quality",normalizeQuality(button.getAttribute("data-value")));
    button.setAttribute("data-credit-cost",String(amount));
    var mainLabel=button.querySelector("span");
    if(mainLabel)button.setAttribute("aria-label",clean(mainLabel.textContent)+" "+text);
  }

  function syncQualityButtons(scope,duration){
    scope.querySelectorAll('[data-adfilm-choice="quality"]').forEach(function(group){
      group.classList.add("adfilm-quality-pricing-grid");
      Array.from(group.querySelectorAll('button[data-value]')).forEach(function(button){
        var quality=normalizeQuality(button.getAttribute("data-value"));
        ensureQualityOption(group,button,calculate(quality,duration));
      });
    });
  }

  function syncCreateButton(scope,quality,duration,total){
    var button=scope.querySelector('[data-adfilm-build]');
    if(!button)return;
    var label=button.querySelector('[data-adfilm-credit-label]')||button.querySelector('span[data-adfilm-i18n="createButton"]')||button.querySelector("span:not(.adfilm-create__icon)");
    button.querySelectorAll('em[data-adfilm-i18n="creditLater"],em[data-adfilm-credit-total]').forEach(function(node){node.remove()});
    if(label){
      label.removeAttribute("data-adfilm-i18n");
      label.setAttribute("data-adfilm-credit-label","");
      var busy=button.classList.contains("is-generating")||button.classList.contains("is-loading")||button.getAttribute("aria-busy")==="true";
      var text=createText(total);
      if(!busy&&label.textContent!==text)label.textContent=text;
    }
    button.setAttribute("data-credit-cost",String(total));
    button.setAttribute("data-credit-quality",quality);
    button.setAttribute("data-credit-duration",String(duration));
  }

  function dispatchChange(scope,quality,duration,total){
    var key=[quality,duration,total,english()?"en":"tr"].join("|");
    if(key===lastEventKey)return;
    lastEventKey=key;
    try{
      window.dispatchEvent(new CustomEvent("aivo:adfilm-credit-change",{
        detail:{quality:quality,duration:duration,credits:total}
      }));
    }catch(_){}
  }

  function sync(scope){
    scope=root(scope);
    if(!scope||!scope.isConnected)return null;
    var duration=currentDuration(scope);
    var quality=currentQuality(scope);
    var total=calculate(quality,duration);
    syncQualityButtons(scope,duration);
    syncCreateButton(scope,quality,duration,total);
    scope.setAttribute("data-adfilm-credit-cost",String(total));
    scope.setAttribute("data-adfilm-credit-quality",quality);
    scope.setAttribute("data-adfilm-credit-duration",String(duration));
    dispatchChange(scope,quality,duration,total);
    return{quality:quality,duration:duration,credits:total};
  }

  function scheduleSync(scope,includeDefault){
    scope=root(scope);
    if(!scope)return;
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){
      if(includeDefault)forceDefaultDuration(scope);
      sync(scope);
    },0);
  }

  function bind(scope){
    scope=root(scope);
    if(!scope)return;
    mountedRoot=scope;
    if(!scope.__adfilmCreditPricingBound){
      scope.__adfilmCreditPricingBound=true;
      scope.addEventListener("change",function(event){
        if(event.target&&event.target.matches&&event.target.matches('[data-adfilm-seedance-duration-select]')){
          if(event.isTrusted)userChangedDuration=true;
          setTimeout(function(){sync(scope)},0);
        }
      },true);
      scope.addEventListener("click",function(event){
        var durationButton=event.target&&event.target.closest&&event.target.closest('[data-adfilm-choice="duration"] button[data-value]');
        if(durationButton&&event.isTrusted)userChangedDuration=true;
        var qualityButton=event.target&&event.target.closest&&event.target.closest('[data-adfilm-choice="quality"] button[data-value]');
        if(durationButton||qualityButton)setTimeout(function(){sync(scope)},0);
      },true);
    }
    if(observer)observer.disconnect();
    observer=new MutationObserver(function(){scheduleSync(scope,false)});
    observer.observe(scope,{childList:true,subtree:true});
    [0,60,180,450,900,1600,2600].forEach(function(delay){
      setTimeout(function(){
        if(scope&&scope.isConnected){forceDefaultDuration(scope);sync(scope)}
      },delay);
    });
  }

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")bind(event.detail.root);
  });
  document.addEventListener("aivo:adfilm-assets-ready",function(){bind(root())});
  document.addEventListener("aivo:adfilm-project-sync",function(){
    var scope=root();
    if(scope){forceDefaultDuration(scope);sync(scope)}
  });
  document.addEventListener("click",function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-aivo-language]'))setTimeout(function(){sync(root())},40);
  },true);
  window.addEventListener("storage",function(event){
    if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))setTimeout(function(){sync(root())},40);
  });
  window.addEventListener("pagehide",function(){if(observer)observer.disconnect()});

  window.AIVOAdFilmCreditPricing={
    baseCredits:Object.assign({},BASE_CREDITS),
    calculate:calculate,
    current:function(){return sync(root())},
    sync:function(){return sync(root())}
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind(root())},{once:true});else bind(root());
})();
