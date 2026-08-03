/* AIVO AI Reklam Filmi — final runtime behavior fixes */
(function AIVO_AD_FILM_FINAL_RUNTIME_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_RUNTIME_FIX_V1__)return;
  window.__AIVO_AD_FILM_FINAL_RUNTIME_FIX_V1__=true;

  var sessionRun=false;
  var originalConfirm=window.confirm.bind(window);
  var FAL_CONFIRM_RE=/(Bu test gerçek Fal\.ai üretimi başlatır|This test starts a real Fal\.ai generation)/i;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function status(scope){return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function button(scope){return scope&&scope.querySelector('[data-adfilm-build]')}
  function summary(scope){return scope&&scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]')}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function idleTitle(){return english()?"Advertising project will be prepared":"Reklam projesi hazırlanacak"}

  function hideStaleCompleted(scope){
    if(!scope||sessionRun)return;
    var node=status(scope);if(!node)return;
    if(!node.classList.contains("is-success"))return;
    node.className="adfilm-engine-status";
    node.setAttribute("data-adfilm-idle-hidden","1");
    node.removeAttribute("data-stage");
    node.style.removeProperty("display");
    node.style.removeProperty("visibility");
    node.style.removeProperty("opacity");
    var action=scope.querySelector('.adfilm-actionbar');
    if(action){action.classList.remove('is-engine-active');action.removeAttribute('data-adfilm-progress-lock')}
    var build=button(scope);
    if(build){
      build.classList.remove('is-generating','is-loading','is-music-preparing');
      build.removeAttribute('aria-busy');
      build.disabled=build.dataset.narrationGuard==="blocked";
    }
    var title=summary(scope);if(title)title.textContent=idleTitle();
  }

  window.confirm=function(message){
    if(FAL_CONFIRM_RE.test(String(message||"")))return true;
    return originalConfirm(message);
  };

  document.addEventListener("click",function(event){
    var build=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(build)sessionRun=true;
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(!event||!event.detail||event.detail.key!=="adfilm")return;
    sessionRun=false;
    var scope=event.detail.root||root();
    [0,250,700,1100,1600].forEach(function(delay){setTimeout(function(){hideStaleCompleted(scope)},delay)});
  });

  document.addEventListener("aivo:adfilm-project-sync",function(){
    if(sessionRun)return;
    setTimeout(function(){hideStaleCompleted(root())},0);
  });

  var observer=new MutationObserver(function(){
    if(sessionRun)return;
    hideStaleCompleted(root());
  });
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:["class"]});
  window.addEventListener("pagehide",function(){observer.disconnect()});
})();
