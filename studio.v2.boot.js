(function(){
  function wireLeftMenu(){
    document.querySelectorAll('#leftMenu [data-route]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-route') || "music";

        // ✅ Router varsa onu kullan (CSS + module + panel akışı)
        if(window.StudioRouter && typeof window.StudioRouter.go === "function"){
          window.StudioRouter.go(key);
          return;
        }

        // fallback
        location.hash = key;
      });
    });
  }

  function tryMountTopbarPartial(){ return; }

  function setFakeCredits(){
    const el = document.getElementById("creditCount");
    if(el) el.textContent = "211";
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    tryMountTopbarPartial();
    wireLeftMenu();
    setFakeCredits();

    if(!location.hash) location.hash = "music";
  });
})();
