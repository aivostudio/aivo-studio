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
// --- studio.music.generate.js (router sonrası yeniden bind) ---
(function musicGenerateAutoBind(){
  function wire(){
    const btn = document.getElementById('musicGenerateBtn');
    if (!btn) return false;

    // double-bind olmasın
    if (btn.dataset.wired === '1') return true;
    btn.dataset.wired = '1';

    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;

        // 1) önce music/generate dene, yoksa jobs/create fallback
        const payload = {}; // TODO: music.module.js'den form data toplayacağız (sonraki adım)
        let r = await fetch('/api/music/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          r = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'music', ...payload }),
          });
        }

        const data = await r.json();
        console.log('[music-generate] response:', data);

        // job objesi / job_id yakala
        const job = data.job || data;
        const job_id = job.job_id || job.id || data.job_id;

        if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === 'function') {
          window.AIVO_JOBS.upsert(job_id ? { ...job, job_id } : job);
          console.log('[music-generate] upsert ok:', job_id);
        } else {
          console.warn('[music-generate] AIVO_JOBS.upsert yok, job_id:', job_id);
        }
      } catch (e) {
        console.error('[music-generate] failed:', e);
      } finally {
        btn.disabled = false;
      }
    });

    console.log('[music-generate] wired ✅');
    return true;
  }

  // İlk deneme (sayfa music’te açılırsa)
  if (wire()) return;

  // Router/modül DOM’u sonradan gelince yakala
  const obs = new MutationObserver(() => {
    if (wire()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[music-generate] waiting for #musicGenerateBtn...');
})();
