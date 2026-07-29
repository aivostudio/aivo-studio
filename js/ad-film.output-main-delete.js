/* AIVO AI Reklam Filmi — make main player delete version-aware */
(function AIVO_AD_FILM_OUTPUT_MAIN_DELETE(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_MAIN_DELETE__)return;
  window.__AIVO_AD_FILM_OUTPUT_MAIN_DELETE__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputs(source){return Array.isArray(source&&source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[]}
  function active(source){
    var list=outputs(source),id=clean(source&&source.activeOutputId||window.AIVOAdFilmActiveOutputId);
    return list.find(function(item){return item.id===id})||list[0]||null;
  }
  function message(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"Delete this advertising version?":"Bu reklam sürümünü silmek istiyor musun?"}
  function failed(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"The advertising version could not be deleted.":"Reklam sürümü silinemedi."}
  function toast(text){try{if(window.toast&&typeof window.toast.error==="function")window.toast.error(text);else if(window.showToast)window.showToast(text,"error")}catch(_){} }

  document.addEventListener("click",async function(event){
    var button=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-result-toolbar [data-result-action="remove"]');
    if(!button)return;
    var source=project(),item=active(source);if(!source||!item)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!window.confirm(message()))return;
    try{
      var response=await fetch("/api/ad-film/seedance/result?projectId="+encodeURIComponent(source.id)+"&outputId="+encodeURIComponent(item.id),{method:"DELETE",credentials:"include"});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"remove_failed");
      var next=data.project||source;window.AIVOAdFilmActiveProject=next;
      var nextItem=active(next);
      window.AIVOAdFilmGeneratedVideo=nextItem&&nextItem.videoUrl||"";
      window.AIVOAdFilmGeneratedLogo=nextItem&&nextItem.logoUrl||"";
      window.AIVOAdFilmActiveOutputId=nextItem&&nextItem.id||"";
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||"",media:next.media||{}}}));
      if(nextItem&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.mount(nextItem.videoUrl,nextItem.logoUrl||"");
      else{
        var frame=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame]');
        if(frame){frame.querySelectorAll('video[data-adfilm-result-video],[data-adfilm-result-toolbar],[data-adfilm-result-logo]').forEach(function(node){node.remove()});frame.classList.remove("has-result-video")}
      }
      if(window.AIVOAdFilmOutputGallery)window.AIVOAdFilmOutputGallery.render(next);
    }catch(error){console.error("[ADFILM] active output delete",error);toast(failed())}
  },true);
})();