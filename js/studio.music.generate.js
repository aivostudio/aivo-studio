// /js/studio.music.generate.js
// Wire "Müzik Üret" button to job create (router-safe, re-render safe)

(function musicGenerateAutoBind(){
  async function postJson(url, body){
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch(e) {}
    return { ok: r.ok, status: r.status, data, raw: text };
  }

  async function onClick(btn){
    console.log('[music-generate] clicked');

    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      const payload = { type: 'music', source: 'studio' };

      let res = await postJson('/api/music/generate', payload);
      if (res.status === 404) res = await postJson('/api/jobs/create', payload);

      console.log('[music-generate] response:', res);
      if (!res.ok) return alert('Generate failed');

      const jobId =
        res.data?.job_id ||
        res.data?.jobId ||
        res.data?.job?.id ||
        res.data?.job?.job_id;

      if (!jobId) return console.error('[music-generate] job_id not found');

      const job = { job_id: jobId, type: 'music' };

      if (window.AIVO_JOBS?.upsert) {
        window.AIVO_JOBS.upsert(job);
        console.log('[AIVO_JOBS.upsert]', job);
      } else {
        console.warn('[music-generate] AIVO_JOBS.upsert not available');
      }

    } catch (e) {
      console.error('[music-generate] error', e);
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  function wire(){
    const btn = document.getElementById('musicGenerateBtn');
    if (!btn) return false;

    // aynı DOM node'a iki kez bağlama
    if (btn.dataset.wired === '1') return true;
    btn.dataset.wired = '1';

    btn.addEventListener('click', () => onClick(btn));

    console.log('[music-generate] wired ✅');
    return true;
  }

  // ilk dene
  wire();

  // router/re-render için: observer'ı KAPATMA, sürekli dene (dataset double-bind korur)
  const obs = new MutationObserver(() => wire());
  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[music-generate] watching for #musicGenerateBtn...');
})();
