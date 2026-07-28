/* =========================================================
   AIVO — AI REKLAM FILMI / BASIC MODE MEDIA CACHE
   Stores selected preview media in IndexedDB on this device.
   Production should upload files to object storage instead.
   ========================================================= */
(function AIVO_AD_FILM_BASIC_MEDIA_CACHE(){
  "use strict";
  if(window.__AIVO_AD_FILM_BASIC_MEDIA_CACHE__) return;
  window.__AIVO_AD_FILM_BASIC_MEDIA_CACHE__=true;

  var DB_NAME="aivo_adfilm_preview";
  var DB_VERSION=1;
  var STORE_NAME="mediaDrafts";
  var RECORD_KEY="basic-mode";
  var restoring=false;
  var mountedRoot=null;
  var writeTimer=null;

  var COPY={
    tr:{restored:"Ürün görselleri ve logo bu cihazdan geri yüklendi.",saveError:"Görseller tarayıcıya kaydedilemedi.",restoreError:"Kaydedilmiş görseller geri yüklenemedi."},
    en:{restored:"Product images and logo were restored on this device.",saveError:"Media could not be saved in this browser.",restoreError:"Saved media could not be restored."}
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

  function openDb(){
    return new Promise(function(resolve,reject){
      if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return}
      var request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(){
        var db=request.result;
        if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"id"});
      };
      request.onsuccess=function(){resolve(request.result)};
      request.onerror=function(){reject(request.error||new Error("IndexedDB open failed"))};
    });
  }

  function tx(mode,handler){
    return openDb().then(function(db){
      return new Promise(function(resolve,reject){
        var transaction=db.transaction(STORE_NAME,mode),store=transaction.objectStore(STORE_NAME),result;
        try{result=handler(store)}catch(error){db.close();reject(error);return}
        transaction.oncomplete=function(){db.close();resolve(result)};
        transaction.onerror=function(){db.close();reject(transaction.error||new Error("IndexedDB transaction failed"))};
        transaction.onabort=function(){db.close();reject(transaction.error||new Error("IndexedDB transaction aborted"))};
      });
    });
  }

  function getRecord(){
    return openDb().then(function(db){
      return new Promise(function(resolve,reject){
        var transaction=db.transaction(STORE_NAME,"readonly"),request=transaction.objectStore(STORE_NAME).get(RECORD_KEY);
        request.onsuccess=function(){db.close();resolve(request.result||null)};
        request.onerror=function(){db.close();reject(request.error||new Error("IndexedDB read failed"))};
      });
    });
  }

  function deleteRecord(){return tx("readwrite",function(store){store.delete(RECORD_KEY)})}

  function input(scope,key){return scope&&scope.querySelector('[data-adfilm-file="'+key+'"]')}
  function fileList(scope,key){var field=input(scope,key);return field?Array.from(field.files||[]):[]}

  function cloneFile(file){
    return{
      name:file.name||"media",
      type:file.type||"application/octet-stream",
      lastModified:file.lastModified||Date.now(),
      blob:file.slice(0,file.size,file.type||"application/octet-stream")
    };
  }

  function collect(scope){
    return{
      id:RECORD_KEY,
      updatedAt:new Date().toISOString(),
      productImages:fileList(scope,"productImages").map(cloneFile),
      logo:fileList(scope,"logo").map(cloneFile),
      extraMedia:fileList(scope,"extraMedia").map(cloneFile)
    };
  }

  function hasMedia(record){return !!(record&&((record.productImages&&record.productImages.length)||(record.logo&&record.logo.length)||(record.extraMedia&&record.extraMedia.length)))}

  function saveNow(scope){
    if(!scope||restoring)return Promise.resolve(false);
    var record=collect(scope);
    if(!hasMedia(record))return deleteRecord().then(function(){return true}).catch(function(){return false});
    return tx("readwrite",function(store){store.put(record)}).then(function(){window.AIVOAdFilmMediaCacheDebug={saved:true,record:record};return true}).catch(function(error){console.error("[ADFILM] media cache save failed",error);toast(t("saveError"),"warning");return false});
  }

  function scheduleSave(scope){clearTimeout(writeTimer);writeTimer=setTimeout(function(){saveNow(scope)},80)}

  function toFiles(items){
    return (items||[]).map(function(item){
      try{return new File([item.blob],item.name||"media",{type:item.type||item.blob.type||"application/octet-stream",lastModified:item.lastModified||Date.now()})}
      catch(_){var blob=item.blob;blob.name=item.name||"media";blob.lastModified=item.lastModified||Date.now();return blob}
    });
  }

  function setFiles(field,files){
    if(!field)return;
    var transfer=new DataTransfer();
    files.forEach(function(file){transfer.items.add(file)});
    field.files=transfer.files;
    field.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function restore(scope){
    if(!scope)return Promise.resolve(false);
    restoring=true;
    return getRecord().then(function(record){
      if(!hasMedia(record)){restoring=false;return false}
      setFiles(input(scope,"productImages"),toFiles(record.productImages));
      setFiles(input(scope,"logo"),toFiles(record.logo));
      setFiles(input(scope,"extraMedia"),toFiles(record.extraMedia));
      setTimeout(function(){restoring=false;toast(t("restored"),"info")},120);
      window.AIVOAdFilmMediaCacheDebug={restored:true,record:record};
      return true;
    }).catch(function(error){restoring=false;console.error("[ADFILM] media cache restore failed",error);toast(t("restoreError"),"warning");return false});
  }

  function bind(scope){
    if(!scope||scope.__adfilmMediaCacheBound)return;
    scope.__adfilmMediaCacheBound=true;mountedRoot=scope;
    setTimeout(function(){restore(scope)},220);
    scope.addEventListener("change",function(event){if(event.target&&event.target.closest("[data-adfilm-file]"))scheduleSave(scope)},true);
    scope.addEventListener("click",function(event){
      if(event.target.closest("[data-adfilm-draft-reset]")){deleteRecord().catch(function(){});return}
      if(event.target.closest("[data-media-action],[data-clear-file]"))setTimeout(function(){scheduleSave(scope)},60);
    },true);
  }

  function finalSave(){if(mountedRoot&&mountedRoot.isConnected)saveNow(mountedRoot)}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root)},100)});
  window.addEventListener("pagehide",finalSave);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")finalSave()});

  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmMediaCacheBound)setTimeout(function(){bind(scope)},80)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind(root())},{once:true});else bind(root());
})();
