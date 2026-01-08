(function(){
  "use strict";
  if (window.__aivoJobsPanelBound) return;
  window.__aivoJobsPanelBound = true;

  function qs(sel, root){ return (root||document).querySelector(sel); }

  function ensureHost(){
    var host = qs("[data-jobs-panel]") || qs(".aivo-jobs-panel-root");
    return host;
  }

  function render(){
    var host = ensureHost();
    if (!host) return;
    host.innerHTML = '<div style="padding:14px; opacity:.9">Henüz çıktı yok. Yeni bir üretim başlat.</div>';
  }

  render();
  window.addEventListener("aivo:jobs:open", render);
})();
