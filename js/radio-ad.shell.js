(function AIVO_RADIO_AD_SHELL(){
  "use strict";
  if(window.__AIVO_RADIO_AD_SHELL_READY__) return;
  window.__AIVO_RADIO_AD_SHELL_READY__=true;

  const COPY={
    tr:{
      nav:"AI Radyo Reklamı",newBadge:"YENİ",selectorLabel:"Reklam Türünü Seç",video:"Reklam Videosu",radio:"Radyo Reklamı",videoTitle:"AI Reklam Videosu Oluştur",panelTitle:"Radyo Reklamlarım",panelMeta:"Yeni modül",previewTitle:"Canlı ses önizleme",previewText:"Seslendirme, müzik ve jingle seçimleri burada özetlenecek.",emptyTitle:"İlk radyo reklamın burada görünecek",emptyText:"Üretim motoru bağlandıktan sonra hazırladığın reklamları buradan dinleyip indirebileceksin."
    },
    en:{
      nav:"AI Radio Ad",newBadge:"NEW",selectorLabel:"Choose Ad Type",video:"Video Ad",radio:"Radio Ad",videoTitle:"Create AI Video Ad",panelTitle:"My Radio Ads",panelMeta:"New module",previewTitle:"Live audio preview",previewText:"Narration, music and jingle choices will be summarized here.",emptyTitle:"Your first radio ad will appear here",emptyText:"After the production engine is connected, you will be able to listen to and download your ads here."
    }
  };

  function lang(){
    let stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    const html=String(document.documentElement.lang||"").toLowerCase();
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return COPY[lang()][key]||COPY.tr[key]||key}

  function ensureCss(){
    if(document.querySelector('link[href^="/css/radio-ad.css"]')) return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/css/radio-ad.css?v=1";
    document.head.appendChild(link);
  }

  function icon(){
    return '<span class="radio-ad-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="8" y="3" width="8" height="12" rx="4" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 7.5c-1.2 1.4-1.2 7.6 0 9M21 7.5c1.2 1.4 1.2 7.6 0 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>';
  }

  function ensureNav(){
    const card=document.querySelector("#leftMenu .navCard");
    if(!card) return;
    let btn=card.querySelector('[data-route="radioad"]');
    if(!btn){
      btn=document.createElement("button");
      btn.type="button";
      btn.className="navBtn";
      btn.dataset.route="radioad";
      const adFilm=card.querySelector("[data-adfilm-open]");
      const lipsync=card.querySelector('[data-route="lipsync"]');
      if(adFilm) adFilm.insertAdjacentElement("afterend",btn);
      else if(lipsync) lipsync.insertAdjacentElement("afterend",btn);
      else card.appendChild(btn);
    }
    btn.setAttribute("aria-label",t("nav"));
    btn.innerHTML=icon()+'<span data-radio-ad-nav-label>'+t("nav")+'</span><span class="radio-ad-nav-badge">'+t("newBadge")+'</span>';
  }

  function applyVideoNaming(root){
    const nav=document.querySelector("[data-adfilm-nav-label]");
    if(nav) nav.textContent=lang()==="en"?"AI Video Ad":"AI Reklam Videosu";
    const scope=root||document.querySelector('[data-module-root][data-module="adfilm"]');
    const title=scope&&scope.querySelector("#adfilmTitle");
    if(title) title.textContent=t("videoTitle");
  }

  function selector(active){
    const section=document.createElement("section");
    section.className="radio-ad-type-switch";
    section.dataset.radioAdTypeSwitch="1";
    section.innerHTML='<span class="radio-ad-type-switch__label">'+t("selectorLabel")+'</span><div class="radio-ad-type-switch__track" role="tablist"><button type="button" data-ad-type="video" class="'+(active==="video"?"is-active":"")+'" aria-selected="'+(active==="video")+'">'+t("video")+'</button><button type="button" data-ad-type="radio" class="'+(active==="radio"?"is-active":"")+'" aria-selected="'+(active==="radio")+'">'+t("radio")+'</button></div>';
    section.addEventListener("click",function(event){
      const button=event.target.closest("[data-ad-type]");
      if(!button) return;
      const target=button.dataset.adType==="radio"?"radioad":"adfilm";
      if(window.StudioRouter&&typeof window.StudioRouter.setHash==="function") window.StudioRouter.setHash(target);
      else location.hash="#"+target;
    });
    return section;
  }

  function ensureSelector(key,root){
    if(!root) return;
    const old=root.querySelector(':scope > [data-radio-ad-type-switch="1"]');
    if(old) old.remove();
    const anchor=key==="adfilm"?root.querySelector(".adfilm-hero"):root.querySelector(".radio-ad-hero");
    if(!anchor) return;
    anchor.insertAdjacentElement("afterend",selector(key==="adfilm"?"video":"radio"));
    if(key==="adfilm") applyVideoNaming(root);
  }

  function registerPanel(){
    if(!window.RightPanel||window.RightPanel._has&&window.RightPanel._has("radioad")) return;
    window.RightPanel.register("radioad",{
      getHeader:function(){return{title:t("panelTitle"),meta:t("panelMeta"),searchEnabled:false,resetSearch:true}},
      mount:function(wrap){
        wrap.innerHTML='<div class="radio-ad-panel"><section class="radio-ad-panel__preview"><strong>'+t("previewTitle")+'</strong><div class="radio-ad-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>'+t("previewText")+'</p><div class="radio-ad-panel__meta"><span>00:00</span><span>15 / 30 / 45 / 60 sn</span></div></section><section class="radio-ad-panel__empty"><b>'+t("emptyTitle")+'</b><span>'+t("emptyText")+'</span></section></div>';
      },
      onShow:function(_,ctx){ctx.setHeader({title:t("panelTitle"),meta:t("panelMeta"),searchEnabled:false})}
    });
  }

  function mountForEvent(event){
    const key=event&&event.detail&&event.detail.key;
    const root=event&&event.detail&&event.detail.root;
    if(key==="adfilm"||key==="radioad") ensureSelector(key,root);
  }

  function refresh(){
    ensureCss();
    ensureNav();
    applyVideoNaming();
    registerPanel();
    const active=document.getElementById("moduleHost")?.getAttribute("data-active-module");
    const root=document.querySelector('[data-module-root][data-module="'+active+'"]');
    if((active==="adfilm"||active==="radioad")&&root) ensureSelector(active,root);
  }

  ensureCss();
  registerPanel();
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",refresh,{once:true});
  else refresh();

  document.addEventListener("aivo:module-mounted",mountForEvent);
  document.addEventListener("aivo:language-changed",refresh);
  document.addEventListener("aivo:lang-changed",refresh);

  const observer=new MutationObserver(function(){ensureNav();applyVideoNaming()});
  const startObserver=function(){const left=document.getElementById("leftMenu");if(left)observer.observe(left,{childList:true,subtree:true})};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",startObserver,{once:true});
  else startObserver();
})();
