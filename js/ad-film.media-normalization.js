/* AIVO AI Reklam Filmi — backend image normalization bridge */
(function AIVO_AD_FILM_MEDIA_NORMALIZATION(){
  "use strict";
  if(window.__AIVO_AD_FILM_MEDIA_NORMALIZATION_V1__)return;
  window.__AIVO_AD_FILM_MEDIA_NORMALIZATION_V1__=true;

  function clean(value){return String(value==null?"":value).trim()}
  function normalizable(kind){return kind==="logo"||kind==="product-image"}
  async function finalize(projectId,kind,item){
    var response=await fetch("/api/ad-film/finalize-upload",{
      method:"POST",
      credentials:"include",
      cache:"no-store",
      headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({projectId:projectId,kind:kind,item:item})
    });
    var data=await response.json().catch(function(){return{}});
    if(!response.ok||!data.item){
      var error=new Error(clean(data.message||data.error)||"media_normalization_failed");
      error.status=response.status;
      error.data=data;
      throw error;
    }
    return data.item;
  }
  function install(){
    var api=window.AIVOAdFilmProjects;
    if(!api||typeof api.uploadFile!=="function")return false;
    if(api.uploadFile.__aivoNormalizedUpload===true)return true;
    var original=api.uploadFile.bind(api);
    var wrapped=async function(projectId,file,kind){
      var uploaded=await original(projectId,file,kind);
      if(!normalizable(kind))return uploaded;
      var normalized=await finalize(projectId,kind,uploaded);
      normalized._fingerprint=uploaded._fingerprint||[file.name,file.size,file.type,file.lastModified||0].join("|");
      normalized.originalName=uploaded.name||file.name;
      normalized.originalContentType=uploaded.contentType||file.type;
      normalized.originalSize=uploaded.size||file.size;
      return normalized;
    };
    wrapped.__aivoNormalizedUpload=true;
    wrapped.__aivoOriginalUpload=original;
    api.uploadFile=wrapped;
    return true;
  }

  var attempts=0;
  function retry(){
    if(install())return;
    attempts+=1;
    if(attempts<80)setTimeout(retry,100);
  }
  retry();
  document.addEventListener("aivo:adfilm-assets-ready",retry);
})();
