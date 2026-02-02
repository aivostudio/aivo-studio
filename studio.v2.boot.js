(function(){
  function wireLeftMenu(){
    document.querySelectorAll('#leftMenu [data-route]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-route');
        location.hash = key;
      });
    });
  }

  function tryMountTopbarPartial(){
    // Senin include.partials.js mevcutsa burada kullan
    // Örn: window.IncludePartials?.mount?.("#topbarMount", "/partials/topbar.html");
    // Şimdilik fallback topbar HTML'i zaten var.
    return;
  }

  function setFakeCredits(){
    const el = document.getElementById("creditCount");
    if(el) el.textContent = "211";
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    tryMountTopbarPartial();
    wireLeftMenu();
    setFakeCredits();

    // İlk açılış
    if(!location.hash) location.hash = "music";
  });
})();
