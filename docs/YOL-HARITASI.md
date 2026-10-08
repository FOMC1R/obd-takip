# OBD Takip — Yol haritası

Bu belge, Eylül 2026'da yapılan beş araştırmanın (kod denetimi, rakip uygulamalar, platform sınırları,
yaygın markalar, elektrikli araçlar) sonucudur. İş bittikçe kutu işaretlenir, **Durum** satırı güncellenir.

İşaretler: `[ ]` yapılmadı · `[~]` sürüyor / kısmen · `[x]` bitti (sürüm numarasıyla)

İlke: **Uygulama yalnızca okur.** Araca yazan komutlar (silme hariç kullanıcı onaylı mod 04) eklenmez.

---

## Bölüm 1 — Önce kapatılacaklar (güvenlik ve veri kaybı)

- [x] **1.1 İçe aktarılan PID listesiyle zararlı kod (XSS)** — ✅ 1.18 (CSV/addGauge ayıklama + escHtml + CSP + Leaflet SRI; test/security.test.js)
  - Kanıt: `features/ev.js` CSV adını yalnızca 40 karaktere kırpıyor; ad `addGauge` ile gösterge adı olup
    `index.html` (gösterge kutusu, ayar tablosu) ve `features/layout.js`'te `innerHTML` ile yazılıyor.
    Kötü bir liste `settings.aiKey`'i (Claude API anahtarı) okuyup dışarı yollayabilir.
  - Yapılacak: çekirdeğe tek `esc()`; gösterge adı/birimi her yerde kaçışlı. CSV içe aktarırken ad/birim
    güvenli karakterlere sınırlanır. Sayfaya Content-Security-Policy; Leaflet'e `integrity` (SRI).
- [x] **1.2 Güncelleme kontrolü önbelleği şişiriyor** — ✅ 1.18 (sorgusuz tek adres; test/sw.test.js (20 kontrol → 1 kayıt))
  - Kanıt: `features/update.js` her kontrolde `index.html?surum=<zaman>` istiyor; `sw.js` her cevabı adresiyle
    önbelleğe koyuyor → her kontrol ~125 KB yeni kayıt.
  - Yapılacak: sorgu (`?…`) içeren istekler önbelleğe yazılmaz; sayfa istekleri tek adrese yazılır.
- [x] **1.3 Kopma / arka plan / çökmede kaydın sonu kayboluyor** — ✅ 1.18 (gizlenince/kapanırken yaz, hata tamponu, kopmada koru, çökme kurtarma; test/recovery.test.js)
  - Kanıt: satırlar 5 sn'de bir yazılıyor; `visibilitychange`/`pagehide`'da yazma yok; yeniden bağlanmada
    `features/background.js` bekleyen satırları siliyor (`REC.buf=[]`); çökmede `tripEnd` hiç çalışmıyor.
  - Yapılacak: gizlenince ve kapanırken hemen yaz; yeniden bağlanmada silme, yaz; açılışta sonu kapanmamış
    sürüşü bul ve kapat. Yazma hatası görünür uyarı olsun.
- [x] **1.4 Arıza taraması ile başka beyin okuması çakışıyor** — ✅ 1.18 (çekirdek kilit Elm.prototype.exclusive; test/lock.test.js eski kodda çakışmayı yakalıyor)
  - Kanıt: `scanDtc` ATAR/ATCRA'yı `EVA.withHeader` sırasına girmeden değiştiriyor; `features/systems.js`
    okuması araya girerse 07/0A yalnızca motordan cevap alır, kaybolan kod `S.known`'da kaldığı için
    uyarı bir daha gelmez.
  - Yapılacak: cihaza giden başlık değiştiren her iş tek sırada (çekirdek kilit); `scanDtc` de bu sırada.
    Uyarı kalkınca kod `S.known`'dan da silinir.

## Bölüm 2 — Büyük fırsatlar (değer / emek sırasıyla)

- [x] **2.A Tam yedek ve geri yükleme** (emek: küçük) — ✅ 1.19 (gzip JSON, birleştir / tamamen geri yükle, 30 gün hatırlatma; test/backup.test.js. Drive otomatik yedek: sonraya)
  - Tüm ayarlar + araçlar + bakım + masraf + sürüşler + ölçüm satırları tek JSON dosyası; paylaş menüsü
    (Drive/WhatsApp) ya da indir. Geri yükleme: birleştir ya da değiştir. "Son yedek X gün önce" hatırlatması.
  - İleride: kullanıcının kendi Google Drive'ına (appDataFolder, yalnız bu uygulamanın gördüğü klasör)
    otomatik yedek — sunucu gerekmez, OAuth onay ekranı gerekir. Supabase ücretsiz planı 7 gün hareketsizlikte
    durduğu için uygun değil; kendi sunucumuzu kurmuyoruz.
- [x] **2.B OBDb çevirici + elektrikli araç batarya raporu** (emek: orta) — ✅ 1.20 (features/obdb.js 15 araç kataloğu + features/evreport.js batarya raporu; test/obdb, test/evreport. ABRP ve şarj oturumu günlüğü: sonraya. BYD / Togg: açık veri yok)
  - OBDb (github.com/OBDb, **CC-BY-SA 4.0**: kaynak gösterilir, türetilen veri dosyası aynı lisansla açık
    kalır; uygulama kodu ayrı eser). Dosya: `signalsets/v3/default.json` — `hdr` (kime), `cmd` (ne),
    `bix/len/div/add` (nasıl çözülür), `suggestedMetric` (stateOfCharge, stateOfHealth, starterBatteryVoltage…).
    Önce model dosyası, boşsa marka dosyası.
  - Türkiye'de en çok satan EV'ler (ODMD 2025): Tesla Model Y, Togg T10X, Togg T10F, MINI Countryman,
    KGM Torres EVX, Kia EV3, BYD Atto 3, Opel Frontera, BYD Seal U, Hyundai Ioniq 5.
    2026 ilk çeyrek: Togg önde; BYD Sealion 7 / Atto 2, Volvo EX30, BMW X1 yükselişte.
  - Kapsam: Hyundai/Kia E-GMP (Ioniq 5: 398 sinyal, SoH `7E4 22 0105`; hücre voltajları) → Stellantis marka
    dosyası (Frontera, e-2008, ë-C4, Mokka-e) → MINI/BMW → VW MEB, Volvo. BYD: WiCAN (GPL-3) PID olguları
    kendimiz yazılarak (`7E7 22 1FFC` SoC, `22 0008` voltaj, `22 0032` sıcaklık; SoH/hücre yok).
  - **Togg:** açık kaynakta tanım yok — bir Togg sahibinden keşif kaydı gerekir. **Tesla:** kapsam dışı
    (standart OBD soketi yok, ELM327 paket kaçırıyor).
  - Ürün: **"İkinci el batarya raporu"** (SoH, hücre dengesizliği = en yüksek − en düşük hücre voltajı,
    12V akü, km, paylaşılabilir PDF). Aynı model/km'de SoH farkı %13,5'e kadar çıkabiliyor (otorapor.com,
    istanbulticaretgazetesi.com). Sonra: şarj oturumu kaydı, ABRP canlı veri
    (`POST https://api.iternio.com/1/tlm/send`, kullanıcı anahtarı).
- [x] **2.C ABS / hava yastığı / kaporta arıza kodu okuma — salt okuma** (emek: orta) — ✅ 1.20 (features/modules.js; Renault/Dacia, VW grubu, Hyundai/Kia, PSA, Ford, Toyota; yalnız okuma izin listesi; test/modules. Fiat 29 bit: sonraya)
  - Genel tarayıcı + marka adres tablosu. İzinli komutlar (kodda yalnız bunlar): `10 01`, `10 03`, `19`, `22`,
    `21`, `3E`, `09`, KWP `17FF00` / `18 02 FF 00`. **Asla:** `14` (silme), `2E/3B` (yazma), `31` (rutin),
    `27` (güvenlik), `11` (yeniden başlatma), `28/85`, `2F`, `34–37`.
  - Akış: adrese `3E 00` → cevap yoksa atla → `19 02 FF` (UDS) → olmazsa `18 02 FF 00` (KWP).
    `7F xx 78` (meşgul) gelirse bekle. Beyinler arası 50–100 ms. Uzun cevap için `ATFCSH` + `ATFCSD300000`.
  - Kod adlandırma: 3 baytlık UDS kodu; ilk iki bayt harf/sayı (P/C/B/U), 2. hane 0/2 = SAE genel,
    1/3 = üreticiye özel. 3. bayt arıza türü (FTB, SAE J2012: 0x11 şaseye kısa, 0x13 kopuk…). Durum baytı:
    etkin / kayıtlı / lamba.
  - Adresler (gönder → cevap):
    - Renault/Dacia (PyRen): motor 7E0, şanzıman 7E1, ABS 740/760, gösterge 743/763, UCH 745/765, airbag 752/772.
      Oturum `10C0`. PyRen lisansı bulunamadı; DDT4All GPL-3 (kopyalanmaz, başvuru).
    - VW grubu (OBDb Golf): 713 fren/ABS, 714 gösterge, 710, 70E, 746, 7E1 şanzıman. Airbag 715 (doğrulanmadı).
      SFD kilidi okumayı engellemiyor.
    - Hyundai/Kia (OBDb): 7A0, 7C6, 7D1, 7D4, 7E1, 7E4 (dosyadan doğrulanmalı).
    - Stellantis PSA (arduino-psa-diag, GPL-3 — olgu olarak): ABS 6AD→68D, airbag 744→644, BSI 752→652,
      gösterge 75F→65F, şanzıman 6A9→689, motor 6A8→688. SGW okumaya izin veriyor.
    - Ford (OBDb Focus): 720 gösterge, 726 gövde, 760 ABS, 7E1 şanzıman.
    - Toyota (OBDb): 7B0 ABS (`21 03/05/06`), 7C0, 700/701, 750 (genişletilmiş adresleme), 780 kemer, 7E2/7E3 hibrit.
    - Fiat/Tofaş: 29-bit (`ATCP 18`, `18DA10F1` motor, `DA18` şanzıman). Egea'da bazı modüller ara kablo ister.
  - Sıra: Renault/Dacia → VW → Hyundai/Kia → Stellantis → Ford → Toyota → Fiat.
  - Türkiye trafiği (2024, ikinciyeni.com): Renault 1., Fiat 2. (~2,37 M), VW 3. (~1,30 M), Opel 4. (~1,0 M),
    Hyundai 5. (~0,9 M), Ford 6. (~0,9 M), Toyota 7. (~0,86 M), Peugeot 8. (~0,54 M), Dacia 10. (~0,44 M).
- [x] **2.D Aracın kendi test sonuçları — Mode 06** (emek: küçük) — ✅ 1.19 (features/monitors.js; test/monitors.test.js. IUPR: sonraya)
  - Standart, salt okunur. Katalizör, oksijen sensörü, tekleme testleri; sınırlar ve geçti/kaldı.
    Muayene hazırlığı ekranının yanına. İsteğe bağlı: IUPR (mod 09, testlerin çalışma sıklığı).
- [x] **2.E Markaya özel canlı veriler (deneysel)** (emek: orta) — ✅ 1.20 (features/brandlive.js; şanzıman yağı, DPF is/yakma, Renault yağ sıcaklığı; OBDb formülleri; test/brandlive. Hibrit batarya: sonraya)
  - Değer sırası: otomatik şanzıman yağ sıcaklığı, dizel DPF kurum/rejenerasyon, hibrit batarya doluluğu.
  - Aday komutlar (araştırmadan; **araçta doğrulanmadan "deneysel"**):
    - VW dizel: `7E0 22 114E` kurum kütlesi, `22 1153` kül, `22 1347` rejenerasyon; Golf `22 1044` DPF sıcaklığı.
    - Stellantis/Fiat: `7E0 21 4D` kurum yükü, `21 57`, `21 48` rejenerasyon; şanzıman `21 3A`/`21 CA`, `22 04FE`.
      Yeni PSA: `22 18E4` kurum, `22 18E2` fark basıncı, `22 3807` rejenerasyondan beri km.
    - Hyundai/Kia: şanzıman `7E0 22 21A0`; DPF `7E0 21 03`; hibrit `7D4 22 0101`.
    - Ford: şanzıman `7E0 22 1E1C`, `7E1 22 1674`; 12V akü `726 22 4028`.
    - Toyota: şanzıman `701 22 1627` (16 bit ÷256 −40), Corolla `7E0 21 82`; Prius 2 `7E3 21 CE`.
    - Renault: tahmini yağ sıcaklığı `22 2007`. DP0 şanzıman ve K4M özel verileri doğrulanmış kaynakta **yok**
      (başka araca ait "2182 @7E1" formülü kullanılmamalı).
  - Her değer yalnız araç cevap verirse gösterilir.
- [x] **2.F Kaliteli adaptör (STN çipi) desteği** (emek: küçük) — ✅ 1.19 (features/adapter.js, STPX + geri dönüş; test/adapter.test.js. Gerçek OBDLink'te doğrulanmadı)
  - `STI` ile algıla; varsa `STPX` (başlık + veri tek satırda) — çok beyinli taramada hızlı. Yoksa ATSH/ATCRA.
  - Öneri cihaz: OBDLink MX+ (klasik Bluetooth), CX (BLE). Ucuz "v2.1" klonlarda BUFFER FULL ve CR/LF sorunları.

## Bölüm 2.5 — Gerçek araç verisinden düzeltmeler (Renault Fluence 1.6 K4M, 23–29.09.2026)

Kaynak: 12 gerçek sürüş, 95 km, 11.807 ölçüm satırı + tanılama paketi (dosyalar repo dışında, `D:\FO-YEDEK\OBD-Veri`;
konum ve şase no içerdiği için GitHub'a konmaz). Doğrulananlar: okuma ~1 satır/sn (p95 1,5 sn, 3 sn üstü boşluk 2),
araç hızı / GPS = 1,008, ısınma 5–6 dk, yakıt ayarları normal (uzun −4…−5,5 %), kod yok, sürüş puanı kayıtlardan
yeniden hesaplanınca aynı (sert olay yok; GPS de doğruluyor).

- [x] **2.5.1 Motor durdu ama kontak açık** — ✅ 1.22 (ENGINE_OFF_RPM 400; eski kod dururken 0,92 L/sa sayıyordu) — K4M beyni motor dururken devri 0 değil **~232** bildiriyor; MAP ~100 kPa.
  Uygulama bunu "çalışıyor" sanıyor: 569 satırda 0,156 L sahte yakıt, rölanti yüzdesi şişiyor. Ölçüt: devir < 400
  ve hız 0 (ve MAP ≈ hava basıncı) → motor durdu: anlık yakıt 0, rölanti sayılmaz.
- [x] **2.5.2 Kontak kapatma "kopma" sayılıyor** — ✅ 1.22 (S.engineOffAt + lost(); yeniden bağlanma denenmez) — 5 sürüşün sonundaki "bağlantı koptu" olaylarının hepsinde motor
  zaten durmuştu (devir ~232, hız 0). Motor durduktan sonraki kopma → "Kontak kapatıldı, sürüş bitti" (bilgi),
  kırmızı uyarı değil; 3 dakikalık yeniden bağlanma denenmez.
- [x] **2.5.3 Kırıntı sürüş** — ✅ 1.22 (1 dk / 50 m altı, kodsuz gerçek sürüş atılır (birleştirme: sonraya)) — 30 sn / 3 satır / 0 km'lik sürüş (#6) hemen ardından gelen sürüşten ayrı kaydedildi.
  1 dakikadan kısa ve hareketsiz sürüş atılır ya da 2 dk içinde başlayan sonrakiyle birleştirilir.
- [x] **2.5.4 Emme havası sınırı yanlış alarm** — ✅ 1.22 (varsayılan 70, ayar taşıma v3) — sıcak motoru yeniden çalıştırınca (ısı birikmesi) 61 °C > 60 sınırı.
  Varsayılan 70 °C ya da ilk 5 dakika / araç dururken uyarma.
- [x] **2.5.5 Hız aşımı "kritik" seviyede** — ✅ 1.22 (gösterge lvl:"warn" (hız, emme havası)) — 51–56 km/sa için 14 kırmızı uyarı (tolerans 0 seçili). Hız uyarıları
  sarı (warn) olsun; kırmızı motor tehlikesine kalsın. Ayarlardaki tolerans seçeneği görünür yerde önerilsin.
- [x] **2.5.6 Tanılama paketi bağlı değilken boş** — ✅ 1.22 (localStorage obdTakip.sonBaglanti → paket sonBaglanti) — cihaz konuşması, desteklenen değerler, Mode 06 sonucu yok.
  Son bağlantının özeti saklanıp pakete girsin.
- [x] **2.5.7 Aracın vermediği değerler gösteriliyor** — ✅ 1.22 (bağlıyken desteklenmeyen gizli; bağlı değilken kalıcı liste: sonraya) — MAF (10), dış hava (46), yağ sıcaklığı (5C), yakıt seviyesi (2F)
  "göster" açık ama Fluence vermiyor; desteklenmeyenler kendiliğinden gizlensin (ayar silinmeden).

- [x] **2.5.12 Mode 06 "henüz yapılmadı" yanlış alarmı** — SAE J1979: tamamlanmamış testte sınırlar 0/0. Kodlar
  silindikten sonra katalizör testi her sürüş başında "sınır dışı" uyarısı veriyordu (veri 08.10.2026: değer 0, sınır 0–0,
  hazırlık "Katalizör: tamamlanmadı"). — ✅ 1.27 (judge → "notrun", uyarı yok, kartta "Henüz yapılmadı")
- [x] **2.5.11 Bağlantı çabuk vazgeçiyordu** — kontak açılınca ELM327 v1.5 iki ATZ'ye (2×5 sn) cevap vermedi, uygulama
  bıraktı; kullanıcı 2,5 dk sonra elle bağlandı (cevap 0,8 sn), sürüşün başı kaydedilmedi. — ✅ 1.27 (4 deneme ≈ 23 sn,
  "Cihaz uyanıyor… (2/4)" durum yazısı)
- [x] **2.5.10 Araç sınıfına göre hız sınırı** — ticari araçların yasal sınırı otomobilden düşük. KGM tablosu (Karayolları Trafik Yönetmeliği md. 100) `data/speedlimits.json` → `siniflar`; tabela sınıf sınırını aşarsa sınıf sınırı; ağır araçta `maxspeed:hgv`. — ✅ 1.25 (araç başına `aracSinifi`; 130/140 yalnız adı sayılan otoyollarda, otomobil için — doğrulandı)
- [x] **2.5.9 Navigasyonla kullanım tek dokunuş** — Chrome dokunuşsuz küçük pencereyi engelleyebilir; "Navigasyona geç" düğmesi (üst çubuk + ana sayfa) dokunuş izniyle küçük pencereyi açıp seçili haritaya (intent: paket, yoksa Play Store) geçer. — ✅ 1.23 (Google Haritalar varsayılan; Yandex, Waze, sor); 1.24: düğme bağlı değilken de görünür (yalnız harita); 1.25: ana sayfadaki ikinci düğme kaldırıldı
- [x] **2.5.8 Arka plan izi kayboluyordu** — küçük pencere / navigasyon davranışı da yalnız bellekteydi. — ✅ 1.23 (son bağlantı özetine `arkaPlan`)

Araç sağlığı gözlemleri (kullanıcıya bilgi, kesin teşhis değil) — **08.10.2026 düzeltmesi:** katalizör "sınır dışı"
sonucu tamamlanmamış testin 0/0 sınırından kaynaklanan yanlış alarmdı (2.5.12); arka O2 dalgalanması tek başına zayıf
kanıt. Voltaj (PID 42) bu araçta desteklenmiyor; değerler adaptörün kendi ölçümü (ATRV, soket gerilimi; ucuz ELM327'de
±0,2–0,5 V sapma olabilir) → "şarj düşük" yorumu güvenilir değil. Kodlar 5–6 Ekim arası silinmiş (sayaç: 56 km, 3 ısınma);
uygulamanın gönderdiği kayıtlı komutlarda silme yok — kullanıcıya soruldu.
Eski gözlemler:
- Şarj voltajı 13,3–13,4 V (en çok 13,6); motor kapalı 12,5 V; soğuk marşta 10,7 V. Tipik 13,8–14,4 V'un altında.
  Beynin bildirdiği voltaj akü kutbundan 0,2–0,4 V düşük olabilir → akü testi / ölçü aletiyle doğrulanmalı.
- Katalizör: Mode 06 katalizör testi 1 sonuç sınır dışı; arka oksijen sensörü dalgalı (sapma 0,26 V, ön sensörün
  geçişlerinin %27'si). Sağlam katalizörde arka sensör sabite yakın durur → verim düşüyor olabilir (henüz P0420 yok).
  1 sn'lik örnekleme kaba; sıcak motorda Mode 06 tekrar okunmalı.
- Tahmini tüketim 11,2 L/100 km (kısa şehir içi). Pompa verisi yok → Masraf'a litreli yakıt girişi ile düzeltme.

## Bölüm 3 — Ekran kapalıyken çalışma (emek: büyük) — ⏸ ERTELENDİ (29.09.2026)

> Karar: web (link ile dağıtım) ana ürün olarak kalır. Asıl ihtiyaç navigasyonla birlikte kullanım; bunu küçük pencere
> (PiP) karşılıyor. Ekran kapalı kayıt şimdilik şart değil; web güncellemeleri oturunca yeniden bakılır.
> Yapılırsa dağıtım: web uygulamasında "Android uygulamasını indir" linki (GitHub Releases), arayüz her açılışta
> siteden yüklenir → web güncellemeleri APK'ya kendiliğinden gelir; yeniden kurulum yalnız yerel Bluetooth parçası
> değişince. Play Store sonraya. Hazırlık: bilgisayarda Android Studio yok (yalnız Java 8), adaptör klasik Bluetooth.
> Önce ölç: navigasyon açıkken küçük pencerede okuma sürüyor mu? (1.23: arka plan izi son bağlantı özetinde).


- [ ] Web'de çözüm yok (Web Bluetooth arka plan kaydı açık: issuetracker 40244292; 2026'da deneme özelliği yok).
  TWA işe yaramaz (Chrome kısıtları aynı). Yol: Capacitor + kendi yazacağımız küçük Kotlin eklentisi
  (ön plan hizmeti `connectedDevice` + klasik Bluetooth soket + okuma döngüsü), APK elle yüklenir.
  `@capacitor-community/bluetooth-le` 8.x iyi; klasik Bluetooth eklentileri zayıf. HyperOS: otomatik başlatma
  ve "pil: kısıtlama yok" izni.

## Bölüm 4 — Altyapı (sürekli)

- [ ] Eklentiler çekirdeği yamalıyor (DemoLink.reply 6 kat, Elm.send, showTab, lost, startRec…): resmi kancalar.
- [ ] Sayaçlı durdurma (`pause()/resume()`) — akü testi ve performans ölçümü birbirinin işaretini kaldırmasın.
- [ ] ELM327 cevabı hangi komuta ait: zaman aşımından sonra `>` gelene dek boşalt.
- [ ] Sahte saatli testler (tam test 5 dk 40 sn sürüyor); BLE bağlantısı testi; kötü adlı CSV testi.
- [ ] Kayıt büyümesi: isteğe bağlı "X aydan eski ham satırları sil"; depo dolu uyarısı.
- [ ] Sürekli çalışan zamanlayıcılar: sürüş listesi yalnız sekme açıkken tazelensin.
- [ ] İlk açılışta dış istekler (kullanım sayacı, vPIC) için tek ekranda bilgi + onay (KVKK).
- [ ] Küçük yazılar (9–11 px) sürüşte okunaklı hâle.

## Bilerek yapılmayacaklar

- Wi-Fi adaptör, Android Auto, ana ekran widget'ı (web'de mümkün değil).
- Tesla (donanım uygun değil).
- Servis sıfırlama ve kodlama (araca yazma; ilkeye aykırı).
- Car Scanner profilleri (kapalı), DDT4All veritabanı (lisans belirsiz), WiCAN dosyaları (GPL-3) — yalnız başvuru.

## Güçlü yanlarımız (korunacak)

Ücretsiz ve kurulumsuz; Türkçe açıklama ve sesli uyarı; il/ilçe yakıt fiyatı; Türkiye hız sınırları; veri
telefonda kalıyor; teşhis + masraf + bakım + sağlık eğilimi + HUD + panel tek uygulamada; öğrenen vites tahmini,
akü marş testi, ustaya PDF rapor.

## Kaynaklar

- OBDb: https://github.com/OBDb · https://github.com/OBDb/Hyundai-Ioniq-5 · https://pelican.clutch.engineering/scanning/extended-pids/
- PyRen: https://gitlab.com/py_ren/pyren/-/blob/master/pyren/mod_elm.py · DDT4All: https://github.com/cedricp/ddt4all
- PSA adresleri: https://github.com/ludwig-v/arduino-psa-diag/blob/master/ECU_LIST.md
- Güvenlik kilitleri: https://www.alldata.com/us/en/support/diagnostics/article/fca-secure-gateway · https://www.ross-tech.com/vcds/tour/sfd.php · https://www.klavkarr.com/blog/56-understanding-secure-gateway
- WiCAN BYD: https://github.com/meatpiHQ/wican-fw/tree/main/vehicle_profiles/byd
- ABRP: https://documenter.getpostman.com/view/7396339/SWTK5a8w
- EV satışları: https://www.donanimhaber.com/2025-te-en-cok-satilan-elektrikli-otomobiller--200558
- Tesla: https://www.scanmytesla.com/adapters
- Rakipler: https://www.carscanner.info/coding/ · https://carista.com/apps/supported-cars/renault/fluence · https://www.obdautodoctor.com/features/
- Web Bluetooth arka plan: https://issuetracker.google.com/issues/40244292 · Web Serial: https://developer.chrome.com/blog/serial-over-bluetooth
- Drive appData: https://developers.google.com/workspace/drive/api/guides/appdata
- STN: https://www.scantool.net/scantool/downloads/682/obdlink_frpm_f.pdf
- Trafik payları: https://www.ikinciyeni.com/blog/oto-bellek/turkiyede-en-cok-bulunan-arac-markalari
