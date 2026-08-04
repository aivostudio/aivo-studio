/* AIVO AI Reklam Filmi — final 720p quality control */
(function AIVO_AD_FILM_720P_QUALITY_FINAL(){
  "use strict";
  if(window.__AIVO_AD_FILM_720P_QUALITY_FINAL_V1__)return;
  window.__AIVO_AD_FILM_720P_QUALITY_FINAL_V1__=true;

  function english(){
    return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
  }

  function root(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }

  function installStyle(){
    if(document.getElementById("aivo-adfilm-720p-quality-final-style"))return;
    var style=document.createElement("style");
    style.id="aivo-adfilm-720p-quality-final-style";
    style.textContent='\
[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"]{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important}\
[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"] button{position:relative;display:flex!important;align-items:center;justify-content:center;min-width:0!important}\
[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"] [data-value="720p"]{display:flex!important}\
[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"] [data-value="480p"],\
[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"] [data-value="2k"]{display:none!important}\
@media(max-width:680px){[data-module-root][data-module="adfilm"] [data-adfilm-choice="quality"]{grid-template-columns:1fr!important}}';
    document.head.appendChild(style);
  }

  function markup(){
    return '<button type="button" data-value="720p"><span>720p</span></button>'+ 
      '<button type="button" class="is-selected" data-value="1080p"><span>1080p</span></button>'+ 
      '<button type="button" data-value="4k"><span>4K</span><em class="adfilm-seedance-tag">Premium</em></button>';
  }

  function bind(group){
    if(group.__aivo720pFinalBound)return;
    group.__aivo720pFinalBound=true;
    group.addEventListener("click",function(event){
      var button=event.target&&event.target.closest&&event.target.closest('button[data-value]');
      if(!button||!group.contains(button))return;
      group.querySelectorAll('button[data-value]').forEach(function(node){node.classList.remove('is-selected')});
      button.classList.add('is-selected');
      group.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function apply(scope){
    scope=root(scope);if(!scope)return false;
    installStyle();
    var group=scope.querySelector('[data-adfilm-choice="quality"]');
    if(!group)return false;

    var selected=group.querySelector('.is-selected[data-value]');
    var value=String(selected&&selected.getAttribute('data-value')||'1080p').toLowerCase();
    if(value!=='720p'&&value!=='1080p'&&value!=='4k')value='1080p';

    var values=Array.from(group.querySelectorAll('button[data-value]')).map(function(node){return String(node.getAttribute('data-value')||'').toLowerCase()}).join('|');
    if(values!=='720p|1080p|4k')group.innerHTML=markup();

    group.classList.add('adfilm-options--seedance-quality');
    group.removeAttribute('data-professional-quality-only');
    group.setAttribute('data-quality-layout','three');
    group.querySelectorAll('button[data-value]').forEach(function(node){
      node.classList.toggle('is-selected',String(node.getAttribute('data-value')||'').toLowerCase()===value);
    });
    bind(group);

    var heading=scope.querySelector('.adfilm-card--advanced-output .adfilm-card__heading p');
    if(heading){
      heading.removeAttribute('data-adfilm-i18n');
      heading.removeAttribute('data-simple-copy');
      heading.textContent=english()?'Choose 720p economical, 1080p professional or 4K premium quality.':'720p ekonomik, 1080p profesyonel veya 4K premium kaliteyi seç.';
    }

    var note=scope.querySelector('[data-adfilm-seedance-note="quality"],[data-adfilm-i18n="qualityNote"]');
    if(note){
      note.removeAttribute('data-adfilm-i18n');
      note.textContent=english()?'720p economical, 1080p professional final, 4K premium.':'720p ekonomik, 1080p profesyonel final, 4K premium.';
    }
    return true;
  }

  function burst(scope){
    [0,60,160,400,900,1800,3200].forEach(function(delay){
      setTimeout(function(){apply(scope)},delay);
    });
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')burst(event.detail.root);
  });
  document.addEventListener('aivo:adfilm-assets-ready',function(){burst()});
  document.addEventListener('aivo:adfilm-project-sync',function(){burst()});
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-adfilm-open],[data-aivo-language]'))burst();
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){burst()},{once:true});
  else burst();

  window.AIVOAdFilm720pQualityFinal={apply:apply};
})();
