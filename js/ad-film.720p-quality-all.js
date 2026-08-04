(function(){
  "use strict";
  if(window.__AIVO_ADFILM_720P_ALL__)return;
  window.__AIVO_ADFILM_720P_ALL__=true;

  function getRoot(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }

  function isEnglish(){
    return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
  }

  function buttonsHtml(){
    return '<button type="button" data-value="720p"><span>720p</span></button>'+
      '<button type="button" class="is-selected" data-value="1080p"><span>1080p</span></button>'+
      '<button type="button" data-value="4k"><span>4K</span><em class="adfilm-seedance-tag">Premium</em></button>';
  }

  function apply(scope){
    var root=getRoot(scope);
    if(!root)return false;

    var groups=root.querySelectorAll('[data-adfilm-choice="quality"]');
    if(!groups.length)return false;

    groups.forEach(function(group){
      var selected=group.querySelector('.is-selected[data-value]');
      var selectedValue=String(selected&&selected.getAttribute('data-value')||'1080p').toLowerCase();
      if(selectedValue!=='720p'&&selectedValue!=='1080p'&&selectedValue!=='4k')selectedValue='1080p';

      var current=Array.from(group.querySelectorAll('button[data-value]')).map(function(button){
        return String(button.getAttribute('data-value')||'').toLowerCase();
      }).join('|');

      if(current!=='720p|1080p|4k'){
        group.innerHTML=buttonsHtml();
        selectedValue='1080p';
      }

      group.classList.add('adfilm-options--seedance-quality');
      group.setAttribute('data-quality-layout','three');
      group.removeAttribute('data-professional-quality-only');

      group.querySelectorAll('button[data-value]').forEach(function(button){
        button.classList.toggle('is-selected',String(button.getAttribute('data-value')||'').toLowerCase()===selectedValue);
      });

      if(!group.dataset.aivo720Bound){
        group.dataset.aivo720Bound='1';
        group.addEventListener('click',function(event){
          var button=event.target.closest('button[data-value]');
          if(!button||!group.contains(button))return;
          group.querySelectorAll('button[data-value]').forEach(function(node){node.classList.remove('is-selected')});
          button.classList.add('is-selected');
        });
      }
    });

    var headingText=isEnglish()?'Choose 720p economical, 1080p professional or 4K premium quality.':'720p ekonomik, 1080p profesyonel veya 4K premium kaliteyi seç.';
    root.querySelectorAll('.adfilm-card--advanced-output .adfilm-card__heading p,[data-simple-copy="outputDetails"]').forEach(function(node){
      node.removeAttribute('data-adfilm-i18n');
      node.removeAttribute('data-simple-copy');
      node.textContent=headingText;
    });

    var noteText=isEnglish()?'720p economical, 1080p professional final, 4K premium.':'720p ekonomik, 1080p profesyonel final, 4K premium.';
    root.querySelectorAll('[data-adfilm-seedance-note="quality"],[data-adfilm-i18n="qualityNote"]').forEach(function(node){
      node.removeAttribute('data-adfilm-i18n');
      node.textContent=noteText;
    });

    return true;
  }

  function burst(scope){
    [0,80,200,500,1000,2000,4000,7000].forEach(function(delay){
      setTimeout(function(){apply(scope)},delay);
    });
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')burst(event.detail.root);
  });
  document.addEventListener('aivo:adfilm-assets-ready',function(){burst();});
  document.addEventListener('aivo:adfilm-project-sync',function(){burst();});
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('summary,[data-adfilm-open],[data-aivo-language]'))burst();
  },true);

  burst();
  window.AIVOAdFilm720pAll={apply:apply};
})();
