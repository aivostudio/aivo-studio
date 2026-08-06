/* AIVO AI Reklam Filmi — Safari-safe download without page navigation */
(function AIVO_AD_FILM_SAFARI_DOWNLOAD(){
  "use strict";
  if(window.__AIVO_AD_FILM_SAFARI_DOWNLOAD_V1__)return;
  window.__AIVO_AD_FILM_SAFARI_DOWNLOAD_V1__=true;

  var ua=String(navigator.userAgent||"");
  var vendor=String(navigator.vendor||"");
  var isSafari=/Safari/i.test(ua)&&/Apple Computer/i.test(vendor)&&!/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Edg/i.test(ua);
  if(!isSafari)return;

  var busy=false;

  function clean(value){return String(value||"").trim()}
  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }
  function currentContext(){
    var api=window.AIVOAdFilmResultControls;
    return api&&typeof api.context==="function"?api.context():null;
  }
  function filename(version){return "aivo-reklam-v"+(Number(version)||1)+".mp4"}

  async function downloadOutput(id,version,requestedProjectId){
    if(busy)return;
    var context=currentContext()||{};
    var pid=clean(requestedProjectId||context.projectId);
    if(!pid){toast(lang()==="en"?"The video could not be downloaded.":"Video indirilemedi.","error");return}

    busy=true;
    var objectUrl="",anchor=null;
    try{
      var url="/api/ad-film/seedance/download?projectId="+encodeURIComponent(pid);
      if(clean(id))url+="&outputId="+encodeURIComponent(clean(id));

      var response=await fetch(url,{method:"GET",credentials:"include",cache:"no-store"});
      if(!response.ok)throw new Error("download_http_"+response.status);

      var blob=await response.blob();
      if(!blob||!blob.size)throw new Error("empty_download");

      objectUrl=URL.createObjectURL(blob);
      anchor=document.createElement("a");
      anchor.href=objectUrl;
      anchor.download=filename(version);
      anchor.rel="noopener";
      anchor.style.display="none";
      document.body.appendChild(anchor);
      anchor.click();

      toast(lang()==="en"?"Download started.":"İndirme başlatıldı.","success");
    }catch(error){
      console.error("[ADFILM] Safari download failed",error);
      toast(lang()==="en"?"The video could not be downloaded.":"Video indirilemedi.","error");
    }finally{
      busy=false;
      if(anchor)setTimeout(function(){anchor.remove()},1200);
      if(objectUrl)setTimeout(function(){URL.revokeObjectURL(objectUrl)},60000);
    }
  }

  function installApiOverride(){
    var api=window.AIVOAdFilmResultControls;
    if(!api||typeof api.context!=="function")return false;
    if(api.__safariDownloadOverride===true)return true;
    api.__safariDownloadOverride=true;
    api.downloadOutput=downloadOutput;
    api.download=function(){
      var context=currentContext()||{};
      return downloadOutput(context.outputId,context.version,context.projectId);
    };
    return true;
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] [data-result-action="download"]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    var context=currentContext()||{};
    downloadOutput(context.outputId,context.version,context.projectId);
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")installApiOverride();
  });

  if(!installApiOverride()){
    var tries=0,timer=setInterval(function(){
      tries++;
      if(installApiOverride()||tries>100)clearInterval(timer);
    },100);
  }
})();
