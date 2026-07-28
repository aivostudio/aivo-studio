/* =========================================================
   AIVO — AI REKLAM FILMI / ROLE UPLOAD HOTFIX
   - Keeps previously selected product-angle and scene files when the
     user opens the picker again.
   - Marks synthetic legacy product-image changes so the cloud sync can
     ignore them without blocking the live-preview listener.
   ========================================================= */
(function AIVO_AD_FILM_ROLE_UPLOAD_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROLE_UPLOAD_FIX__)return;
  window.__AIVO_AD_FILM_ROLE_UPLOAD_FIX__=true;

  var cache=new WeakMap();
  var LIMITS={hero:1,angles:3,scenes:5};

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function files(field){return field?Array.from(field.files||[]):[]}
  function identity(file){return[file&&file.name||"",Number(file&&file.size||0),file&&file.type||"",Number(file&&file.lastModified||0)].join("|")}

  function assign(field,next){
    if(!field)return;
    var transfer=new DataTransfer();
    next.forEach(function(file){transfer.items.add(file)});
    field.files=transfer.files;
    cache.set(field,next.slice());
  }

  function merge(previous,incoming,limit){
    var result=[],seen=new Set();
    previous.concat(incoming).forEach(function(file){
      if(!file||result.length>=limit)return;
      var key=identity(file);
      if(seen.has(key))return;
      seen.add(key);result.push(file);
    });
    return result;
  }

  function syncCache(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-adfilm-role-file]").forEach(function(field){cache.set(field,files(field))});
  }

  /* Capture runs before creative-plan's direct change listener. */
  document.addEventListener("change",function(event){
    var field=event.target&&event.target.closest&&event.target.closest("[data-adfilm-role-file]");
    if(field){
      var key=field.getAttribute("data-adfilm-role-file"),limit=LIMITS[key];
      if(limit){
        var incoming=files(field),previous=cache.get(field)||[];
        var next=key==="hero"?incoming.slice(0,1):merge(previous,incoming,limit);
        assign(field,next);
      }
      return;
    }

    /*
     * creative-plan mirrors @Image1 into the former productImages input.
     * Do not stop propagation: the skeleton preview must receive this
     * event so it can show or clear the right-side image. Cloud sync reads
     * this short-lived marker and skips only the obsolete upload action.
     */
    var legacy=event.target&&event.target.closest&&event.target.closest('[data-adfilm-file="productImages"]');
    if(legacy&&legacy.closest(".adfilm-role-media")&&event.isTrusted===false){
      legacy.dataset.adfilmSkipCloudUpload="1";
      setTimeout(function(){if(legacy)delete legacy.dataset.adfilmSkipCloudUpload},0);
    }
  },true);

  document.addEventListener("click",function(event){
    if(event.target&&event.target.closest&&event.target.closest("[data-role-remove],[data-adfilm-draft-reset]")){
      setTimeout(function(){syncCache(root())},100);
    }
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(!event||!event.detail||event.detail.key!=="adfilm")return;
    [120,520,1100,1800].forEach(function(delay){setTimeout(function(){syncCache(event.detail.root||root())},delay)});
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){[300,900,1600].forEach(function(delay){setTimeout(function(){syncCache(root())},delay)})},{once:true});
  else [120,600,1400].forEach(function(delay){setTimeout(function(){syncCache(root())},delay)});
})();