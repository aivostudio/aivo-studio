/* AIVO AI Reklam Filmi — Safari download without leaving the studio page */
(function AIVO_AD_FILM_SAFARI_DOWNLOAD_FRAME(){
  "use strict";
  if(window.__AIVO_AD_FILM_SAFARI_DOWNLOAD_FRAME_V1__)return;
  window.__AIVO_AD_FILM_SAFARI_DOWNLOAD_FRAME_V1__=true;

  var ua=String(navigator.userAgent||"");
  var vendor=String(navigator.vendor||"");
  var isSafari=/Safari/i.test(ua)&&/Apple Computer/i.test(vendor)&&!/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Edg/i.test(ua);
  if(!isSafari)return;

  var busy=false;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function")return window.toast[type||"info"](message);
      if(typeof window.showToast==="function")return window.showToast(message,type||"info");
    }catch(_){}
  }

  function contextFor(button){
    var card=button.closest("[data-output-id]");
    if(card){
      return{
        projectId:clean(card.dataset.outputProjectId||project()&&project().id),
        outputId:clean(card.dataset.outputId),
        version:Number(card.dataset.outputVersion)||1
      };
    }

    var api=window.AIVOAdFilmResultControls;
    var context=api&&typeof api.context==="function"?api.context():null;
    return{
      projectId:clean(context&&context.projectId||project()&&project().id),
      outputId:clean(context&&context.outputId),
      version:Number(context&&context.version)||1
    };
  }

  function hiddenInput(name,value){
    var input=document.createElement("input");
    input.type="hidden";
    input.name=name;
    input.value=value;
    return input;
  }

  function submitDownload(context){
    if(busy)return;
    if(!context||!clean(context.projectId)){
      toast(text("Video indirilemedi.","The video could not be downloaded."),"error");
      return;
    }

    busy=true;

    var token="aivo_adfilm_download_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    var frame=document.createElement("iframe");
    frame.name=token;
    frame.title="";
    frame.setAttribute("aria-hidden","true");
    frame.tabIndex=-1;
    frame.style.position="fixed";
    frame.style.width="1px";
    frame.style.height="1px";
    frame.style.opacity="0";
    frame.style.pointerEvents="none";
    frame.style.border="0";
    frame.style.left="-9999px";

    var form=document.createElement("form");
    form.method="GET";
    form.action="/api/ad-film/seedance/download";
    form.target=token;
    form.style.display="none";
    form.appendChild(hiddenInput("projectId",clean(context.projectId)));
    if(clean(context.outputId))form.appendChild(hiddenInput("outputId",clean(context.outputId)));

    document.body.appendChild(frame);
    document.body.appendChild(form);

    try{
      form.submit();
      toast(text("İndirme başlatıldı.","Download started."),"success");
    }catch(error){
      console.error("[ADFILM] Safari framed download failed",error);
      toast(text("Video indirilemedi.","The video could not be downloaded."),"error");
    }

    setTimeout(function(){
      try{form.remove()}catch(_){}
      busy=false;
    },1200);

    setTimeout(function(){
      try{frame.remove()}catch(_){}
    },60000);
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest(
      '.rpPanelWrap[data-panel-key="adfilm"] [data-result-action="download"],'+
      '.rpPanelWrap[data-panel-key="adfilm"] [data-adfilm-output-gallery] [data-output-action="download"]'
    );
    if(!button)return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submitDownload(contextFor(button));
  },true);
})();
