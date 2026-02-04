// studio.music.generate.js
// SINGLE SOURCE OF TRUTH — music generate binder

(function musicGenerateAutoBind(){
  function wire(){
    const btn = document.getElementById('musicGenerateBtn');
    if (!btn) return false;

    // double bind guard
    if (btn.dataset.wired === '1') return true;
    btn.dataset.wired = '1';

    btn.addEventListener('click', async () => {
      console.log('[music-generate] clicked');

      btn.disabled = true;
      btn.classList.add('is-loading');

      try {
        const payload = {
          type: 'music',
          source: 'studio',
          // TODO: sonraki adımda music.module.js’den form data eklenecek
        };

        // 1) primary endpoint
        let r = await fetch('/api/music/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // 2) fallback
        if (!r.ok) {
          r = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        const text = await r.text();
        let data = null;
        try { data = JSON.parse(text); } catch(e){}

        console.log('[music-generate] response:', data || text);

        const job_id =
          data?.job_id ||
          data?.jobId ||
          data?.job?.job_id ||
          data?.job?.id;

        if (!job_id) {
          console.error('[music-generate] job_id not found');
          return;
        }

        const job = { job_id, type: 'music' };

        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert(job);
          console.log('[AIVO_JOBS.upsert]', job);
        } else {
          console.warn('[music-generate] AIVO_JOBS.upsert not available');
        }

        // right panel’i garantiye al
        window.RightPanel?.force?.('audio');

      } catch (e) {
        console.error('[music-generate] error', e);
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });

    console.log('[music-generate] wired ✅');
    return true;
  }

  // sayfa music ile açıldıysa
  if (wire()) return;

  // router / DOM sonradan gelirse
  const obs = new MutationObserver(() => {
    if (wire()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[music-generate] waiting for #musicGenerateBtn...');
})();
