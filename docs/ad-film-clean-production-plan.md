# AIVO Reklam Filmi — Temiz Üretim Akışı Planı

Tarih: 2026-08-04
Dal: `fix/adfilm-clean-production-v2`

## Hedef

Güncel avatarsız arayüz korunacak. Reklam üretimi tek bir sahibi olan sade bir akışa indirilecek:

`Buton -> doğrulama -> müzik -> dosya yükleme -> Seedance create -> status -> finalize -> hazır`

Canlı `main` dalına, preview ortamında 1080p ve 4K testleri tamamlanmadan değişiklik gönderilmeyecek.

## Tespit edilen çakışmalar

### 1. Birden fazla fetch sahibi

Aşağıdaki aktif dosyalar `window.fetch` fonksiyonunu yeniden sarıyor:

- `js/ad-film.production-id-adapter.js`
- `js/ad-film.reset-safety.js`
- `js/ad-film.quality-policy.js`

Hedef: Üretim API çağrıları yalnızca production controller tarafından yapılacak. Reset ve kalite dosyaları fetch çağrılarını değiştirmeyecek.

### 2. Birden fazla üret butonu sahibi

- Root `toast.compat.js` asset yüklenmeden önce tıklamayı yakalıyor.
- `js/ad-film.narration-build-guard.js` capture aşamasında tıklamayı durdurabiliyor.
- `js/ad-film.production-controller.js` üretimi başlatıyor.

Hedef: Loader yalnızca asset yüklenmemişse tıklamayı bir kez bekletecek. Assetler hazır olduktan sonra üret butonunun tek sahibi production controller olacak. Narration guard yalnızca `state()` doğrulaması sağlayacak.

### 3. Birden fazla sayaç sahibi

- `js/ad-film.production-controller.js` kendi elapsed timer'ını çalıştırıyor.
- `js/ad-film.elapsed-owner.js` aynı alanı tekrar yazıyor.

Hedef: Sayaç yalnızca production controller içinde çalışacak.

### 4. Tutarsız timeout

- `api/ad-film/seedance/create.js` aktif üretimi 30 dakikaya kadar engelliyor.
- `api/ad-film/seedance/abandon.js` üretimi 20 dakikada stale kabul ediyor.

Hedef: Tek toplam süre sınırı kullanılacak. İlk aşamada 20 dakika. Süre aşılırsa gerçek Fal cancel endpoint'i çağrılacak. Provider iptali doğrulanmadan yeni ücretli üretim açılmayacak.

### 5. Artık kullanılmayan avatar ve audio fallback dalları

`api/ad-film/seedance/status.js` içinde avatarsız güncel sistem için artık gerekmeyen avatar final bekleme ve audio safety retry dalları bulunuyor. Seedance çağrıları zaten `generate_audio:false` kullanıyor.

Hedef: İlk temiz üretim testi tamamlandıktan sonra status endpoint'i yalnızca Seedance video durumuna indirilecek. Final ses, müzik ve logo işlemleri finalize endpoint'inde kalacak.

### 6. Birden fazla finalizasyon kalıntısı

Repoda hem `finalize.js`, hem `finalize-v2.js`, hem de eski frontend finalize yardımcıları bulunuyor.

Hedef: Aktif üretim yalnızca `/api/ad-film/seedance/finalize` kullanacak. Preview testleri sonrasında kullanılmayan finalize-v2 ve eski frontend yardımcıları silinecek.

## Dosya sınıflandırması

### Kalacak

- `js/ad-film.project-sync.js`
- `js/ad-film.production-controller.js` — temiz V2 olarak yeniden yazılacak
- `js/ad-film.music-profile.js`
- `js/ad-film.media-normalization.js`
- upload ve reference dosyaları
- narration engine/master/player dosyaları
- `js/ad-film.logo-finalize.js`
- result controls, gallery ve output dosyaları
- `/api/ad-film/seedance/create`
- `/api/ad-film/seedance/status`
- `/api/ad-film/seedance/cancel`
- `/api/ad-film/seedance/finalize`

### Loader'dan çıkarılacak veya görevi daraltılacak

- `js/ad-film.production-id-adapter.js` — production_id controller içine taşınacak
- `js/ad-film.elapsed-owner.js` — controller sayacı kullanacak
- `js/ad-film.quality-policy.js` — yalnızca 1080p/4K arayüz politikası kalacak
- `js/ad-film.reset-safety.js` — yalnızca taslak sıfırlama kalacak
- `js/ad-film.narration-build-guard.js` — click listener kaldırılacak, yalnızca state doğrulaması kalacak

### Testlerden sonra silinecek adaylar

- eski `ad-film.seedance-engine.js`
- eski `ad-film.music-preflight.js`
- `ad-film.progress-lock.js`
- `ad-film.progress-stability.js`
- `ad-film.production-save-guard.js`
- `ad-film.active-run-event-guard.js`
- `ad-film.stale-success-guard.js`
- `ad-film.completed-state-guard.js`
- `ad-film.finalize-wait.js`
- `ad-film.finalize-output.js`
- `api/ad-film/seedance/finalize-v2.js`

Bu dosyalar önce loader dışı bırakılacak. Gerçek testler geçmeden fiziksel silme yapılmayacak.

## Uygulama sırası

### Aşama 1 — Backend üretim kilidi

1. Tek `STALE_AFTER_MS = 20 dakika` sabiti.
2. Yeni create öncesinde mevcut generation kontrolü.
3. Eski generation varsa Fal status kontrolü.
4. Gerçekten sürüyorsa kullanıcıya mevcut üretimi göster; ikinci üretim açma.
5. Süre aşılmışsa Fal `/cancel` çağrısı yap.
6. Cancel başarılı olmadan yeni ücretli create çağrısı yapma.

### Aşama 2 — Tek frontend controller

1. Tek click listener.
2. Narration doğrulaması controller içinde.
3. production_id controller tarafından oluşturulur.
4. Tek elapsed timer.
5. Tek 20 dakika watchdog.
6. 409 cevabı doğrudan kullanıcı mesajına çevrilir; global fetch wrapper kullanılmaz.
7. Project sync yalnızca controller'ın aldığı güncel proje ile yapılır.

### Aşama 3 — Tek UI sahibi

1. Idle, processing, failed ve completed ekranlarını controller yazar.
2. Başka hiçbir dosya production paneline `is-success` veya `is-error` yazmaz.
3. Eski tamamlanmış video yalnızca galeri/diğer sürümler alanında kalır.

### Aşama 4 — Test

1. Ücretsiz mock akış: create -> polling -> finalize.
2. Preview ortamında 1080p 15 saniye gerçek test.
3. Sayfa yenileme sırasında aktif üretimi devam ettirme testi.
4. 409 aktif üretim testi.
5. Timeout/cancel testi.
6. 4K 15 saniye gerçek test.
7. Logo, ses ve müzik final kontrolü.

## Main'e geçiş şartları

- Üret butonuna bir kez basınca yalnızca bir create isteği oluşmalı.
- Aynı proje için ikinci ücretli request açılamamalı.
- Sayaç geri gitmemeli.
- Sayfa yenilendiğinde aktif request devam etmeli.
- 20 dakika aşımında Fal cancel denenmeli; cancel başarısızsa yeni request açılmamalı.
- Final video galeriye tek kez eklenmeli.
- Eski video orta üretim panelini etkilememeli.
