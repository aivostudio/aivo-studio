// studio.music.generate.js
// Wire "Müzik Üret" button to job create

(function () {
  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    const btn = document.getElementById('musicGenerateBtn');
    if (!btn) {
      console.warn('[music-generate] button not found');
      return;
    }

    // double bind guard
    if (btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';

    async function postJson(url, body){
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch(e){}
      return { ok: r.ok, status: r.status, data, raw: text };
    }

    btn.addEventListener('click', async () => {
      console.log('[music-generate] clicked');

      btn.disabled = true;
      btn.classList.add('is-loading');

      try {
        const payload = {
          type: 'music',
          source: 'studio',
        };

        // primary endpoint
        let res = await postJson('/api/music/generate', payload);

        // fallback
        if (res.status === 404) {
          res = await postJson('/api/jobs/create', payload);
        }

        console.log('[music-generate] response:', res);

        if (!res.ok) {
          alert('Generate failed');
          return;
        }

        const jobId =
          res.data?.job_id ||
          res.data?.jobId ||
          res.data?.job?.id ||
          res.data?.job?.job_id;

        if (!jobId) {
          console.error('job_id not found in response');
          return;
        }

        const job = { job_id: jobId, type: 'music' };

        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert(job);
          console.log('[AIVO_JOBS.upsert]', job);
        } else {
          console.warn('AIVO_JOBS.upsert not available', job);
        }

        // ensure right panel
        window.RightPanel?.force?.('audio');

      } catch (e) {
        console.error('[music-generate] error', e);
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  });
})();
