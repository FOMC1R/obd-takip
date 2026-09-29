# OBD Takip — Yol haritası

Bu belge, Eylül 2026'da yapılan beş araştırmanın (kod denetimi, rakip uygulamalar, platform sınırları,
yaygın markalar, elektrikli araçlar) sonucudur. İş bittikçe kutu işaretlenir, **Durum** satırı güncellenir.

İşaretler: `[ ]` yapılmadı · `[~]` sürüyor / kısmen · `[x]` bitti (sürüm numarasıyla)

İlke: **Uygulama yalnızca okur.** Araca yazan komutlar (silme hariç kullanıcı onaylı mod 04) eklenmez.

---

## Bölüm 1 — Önce kapatılacaklar (güvenlik ve veri kaybı)

- [ ] **1.1 İçe aktarılan PID listesiyle zararlı kod (XSS)**
  - Kanıt: `features/ev.js` CSV adını yalnızca 40 karaktere kırpıyor; ad `addGauge` ile gösterge adı olup
    `index.html` (gösterge kutusu, ayar tablosu) ve `features/layout.js`'te `innerHTML` ile yazılıyor.
    Kötü bir liste `settings.aiKey`'i (Claude API anahtarı) okuyup dışarı yollayabilir.
  - Yapılacak: çekirdeğe tek `esc()`; gösterge adı/birimi her yerde kaçışlı. CSV içe aktarırken ad/birim
    güvenli karakterlere sınırlanır. Sayfaya Content-Security-Policy; Leaflet'e `integrity` (SRI).
- [ ] **1.2 Güncelleme kontrolü önbelleği şişiriyor**
  - Kanıt: `features/update.js` her kontrolde `index.html?surum=<zaman>` istiyor; `sw.js` her cevabı adresiyle
    önbelleğe koyuyor → her kontrol ~125 KB yeni kayıt.
  - Yapılacak: sorgu (`?…`) içeren istekler önbelleğe yazılmaz; sayfa istekleri tek adrese yazılır.
- [ ] **1.3 Kopma / arka plan / çökmede kaydın sonu kayboluyor**
  - Kanıt: satırlar 5 sn'de bir yazılıyor; `visibilitychange`/`pagehide`'da yazma yok; yeniden bağlanmada
    `features/background.js` bekleyen satırları siliyor (`REC.buf=[]`); çökmede `tripEnd` hiç çalışmıyor.
  - Yapılacak: gizlenince ve kapanırken hemen yaz; yeniden bağlanmada silme, yaz; açılışta sonu kapanmamış
    sürüşü bul ve kapat. Yazma hatası görünür uyarı olsun.
- [ ] **1.4 Arıza taraması ile başka beyin okuması çakışıyor**
  - Kanıt: `scanDtc` ATAR/ATCRA'yı `EVA.withHeader` sırasına girmeden değiştiriyor; `features/systems.js`
    okuması araya girerse 07/0A yalnızca motordan cevap alır, kaybolan kod `S.known`'da kaldığı için
    uyarı bir daha gelmez.
  - Yapılacak: cihaza giden başlık değiştiren her iş tek sırada (çekirdek kilit); `scanDtc` de bu sırada.
    Uyarı kalkınca kod `S.known`'dan da silinir.

## Bölüm 2 — Büyük fırsatlar (değer / emek sırasıyla)

- [ ] **2.A Tam yedek ve geri yükleme** (emek: küçük)
  - Tüm ayarlar + araçlar + bakım + masraf + sürüşler + ölçüm satırları tek JSON dosyası; paylaş menüsü
    (Drive/WhatsApp) ya da indir. Geri yükleme: birleştir ya da değiştir. "Son yedek X gün önce" hatırlatması.
  - İleride: kullanıcının kendi Google Drive'ına (appDataFolder, yalnız bu uygulamanın gördüğü klasör)
    otomatik yedek — sunucu gerekmez, OAuth onay ekranı gerekir. Supabase ücretsiz planı 7 gün hareketsizlikte
    durduğu için uygun değil; kendi sunucumuzu kurmuyoruz.
- [ ] **2.B OBDb çevirici + elektrikli araç batarya raporu** (emek: orta)
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
- [ ] **2.C ABS / hava yastığı / kaporta arıza kodu okuma — salt okuma** (emek: orta)
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
- [ ] **2.D Aracın kendi test sonuçları — Mode 06** (emek: küçük)
  - Standart, salt okunur. Katalizör, oksijen sensörü, tekleme testleri; sınırlar ve geçti/kaldı.
    Muayene hazırlığı ekranının yanına. İsteğe bağlı: IUPR (mod 09, testlerin çalışma sıklığı).
- [ ] **2.E Markaya özel canlı veriler (deneysel)** (emek: orta)
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
- [ ] **2.F Kaliteli adaptör (STN çipi) desteği** (emek: küçük)
  - `STI` ile algıla; varsa `STPX` (başlık + veri tek satırda) — çok beyinli taramada hızlı. Yoksa ATSH/ATCRA.
  - Öneri cihaz: OBDLink MX+ (klasik Bluetooth), CX (BLE). Ucuz "v2.1" klonlarda BUFFER FULL ve CR/LF sorunları.

## Bölüm 3 — Ekran kapalıyken çalışma (emek: büyük, sonra)

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
