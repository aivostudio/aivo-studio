// Simple tilt for [data-tilt]
(function(){
  const cards = () => Array.from(document.querySelectorAll('[data-tilt]'));
  function onMove(e){
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * 8;   // tilt strength
    const ry = (x - 0.5) * 10;
    el.style.transform = `translateY(-4px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }
  function onLeave(e){
    const el = e.currentTarget;
    el.style.transform = "";
  }
  document.addEventListener("DOMContentLoaded", () => {
    cards().forEach(el=>{
      el.style.transformStyle = "preserve-3d";
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    });
  });
})();
