# OBD Takip — proje talimatları

Genel kurallar (dil, commit disiplini) kullanıcının global `CLAUDE.md`'sinde. Burada yalnız bu projeye özgü olanlar.
Ayrıntılı geliştirici notları: `CONTRIBUTING.md`. Yapılacaklar ve ilerleme: `docs/YOL-HARITASI.md`.

## Her yayında (atlanmaz)

Kullanıcıya görünen bir değişiklik yayınlanacaksa, sırayla:

1. **Sürüm:** `index.html` → `APP_VERSION` "1.N" ve `sw.js` → `CACHE` "obd-takip-vN" birlikte bir artar.
2. **Yenilikler:** `features/whatsnew.js` → `CHANGES` listesinin **başına** yeni sürümün maddeleri eklenir
   (3–5 madde, sade Türkçe, kullanıcının göreceği fark; teknik ayrıntı yok).
3. **Yol haritası:** biten madde `docs/YOL-HARITASI.md`'de `[x]` + `— ✅ 1.N (not)`; ertelenen alt işler nota yazılır.
4. **README:** yeni ekran/özellik ilgili bölüme eklenir.
5. **Testler:** `node test/run.js` hepsi geçmeli. 1. ve 2. adımı `test/integrity.test.js` ve `test/whatsnew.test.js` denetler.
6. **Yayın:** dalı `main`'e `--ff-only` birleştir → `git fetch` → `git rebase origin/main` → push →
   `curl` ile yayındaki `APP_VERSION`'ı doğrula (GitHub Pages 1–2 dk gecikir).

## Değişmez ilkeler

- **Uygulama araca yalnız okur.** Yazan/silen servisler (14, 2E, 3B, 31, 27, 11, 28/85, 2F, 34–37) hiçbir dosyada
  gönderilmez; araca özel komut gönderen her eklentide izin listesi (`safe()`) ve bunu denetleyen test olur.
- API anahtarı tanılama paketine hiç, yedeğe yalnız kullanıcı isterse girer.
- Yeni dış adres → `index.html` CSP satırı güncellenir (`test/security.test.js` denetler).
- Yeni eklenti dosyası → `index.html` script sırası + `sw.js` SHELL listesi.
- Gerçek araçta denenmemiş değerler arayüzde "deneysel" / "denenmemiş" diye işaretlenir.
