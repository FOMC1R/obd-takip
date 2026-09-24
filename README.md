# OBD Takip

Aracının OBD girişine taktığın ucuz bir **ELM327** cihazıyla, telefonundan:

- motorun anlık değerlerini (devir, hız, sıcaklıklar, akü voltajı, yakıt tüketimi…) görmeni,
- bir değer tehlikeli seviyeye çıkınca ya da yeni bir arıza kodu oluşunca **sesli ve titreşimli uyarı** almanı,
- her sürüşü GPS iziyle birlikte **kaydedip sonradan grafik ve haritada incelemeni**

sağlayan, kurulum gerektirmeyen bir web uygulaması.

**Aç:** https://fomc1r.github.io/obd-takip/
**Cihazsız dene:** https://fomc1r.github.io/obd-takip/#demo

> Uygulama yalnızca **okuma** yapar. Araçta ayar değiştirmez, yazılım yüklemez. Tek istisna, senin onayınla yapılan "Arıza kodlarını sil" işlemidir.

---

## Ne gerekiyor?

| | |
|---|---|
| **Telefon** | Android + **Chrome** (sürüm 138 veya üstü). Ekran düzeni Xiaomi 14T Pro boyutuna göre hazırlandı. |
| **OBD cihazı** | ELM327 uyumlu, Bluetooth'lu herhangi bir adaptör: klasik Bluetooth ya da BLE. |
| **Araç** | OBD-II girişi olan araç. Türkiye/AB'de yaklaşık 2001 sonrası benzinli ve 2004 sonrası dizel araçların çoğunda var. Giriş genelde direksiyonun altında olur. |

iPhone'da yalnızca **BLE** cihazlar, **Bluefy** tarayıcısıyla çalışır. Safari Bluetooth'a izin vermiyor.

## İlk kurulum

1. Cihazı OBD girişine tak ve kontağı aç.
2. **Cihazın türünü öğren:**
   - Telefonun **Bluetooth ayarlarında** "OBDII" ya da "V-LINK" gibi bir adla görünüyor ve şifre (1234 / 0000) istiyorsa → **klasik Bluetooth**. Bu durumda önce orada eşleştir.
   - Ayarlarda görünmüyor ama başka OBD uygulamaları içinden bağlanıyorsa → **BLE**. Ayarlardan eşleştirme yapma.
3. https://fomc1r.github.io/obd-takip/ adresini Chrome'da aç.
4. **Bağlan** → cihazının türünü seç → listeden cihazı seç.
5. İstersen **Ayarlar → Uygulama olarak yükle** ile ana ekrana ekle. Böylece tam ekran ve internetsiz açılır.

Klasik Bluetooth'ta cihaz bir kez seçildikten sonra **"Son cihaza bağlan"** ile tek dokunuşla bağlanırsın. BLE'de Chrome her seferinde listeden seçmeni istiyor.

> Başka bir OBD uygulaması (Car Scanner, Torque…) cihaza bağlıysa önce onu tamamen kapat. Cihaz aynı anda tek uygulamayla konuşur.

### Xiaomi / HyperOS için önemli ayar

HyperOS arka plandaki uygulamaları hızla durdurur. Kayıt kesilmesin diye:
**Ayarlar → Uygulamalar → Chrome → Pil tasarrufu → Kısıtlama yok**

## Ekranlar

### Canlı
- Değerler kutucuklar hâlinde görünür. Kutunun altındaki küçük eğri **son 1-10 dakikayı** gösterir.
- Bir kutuya **dokununca** tam genişliğe açılır ve grafik büyür.
- Renkler: yeşil normal, sarı sınıra yakın, kırmızı sınır aşıldı.
- **Anlık tüketim** ve **L/100 km** hesaplanan değerlerdir. Ayrıntısı için aşağıdaki "Yakıt hesabı" bölümüne bak.
- **Düzenle:** Göstergelerin sırasını değiştir, önemli olanları geniş yap, istemediklerini gizle. Hazır düzenler de var: Sürüş, Teşhis ve Tümü.
- **Ön cam (HUD):** Siyah zemin üzerinde büyük hız gösterir. Hız, uyarı sınırına yaklaşınca sarı, aşınca kırmızı olur. Üstte devir çubuğu var; vites değiştirme noktasında yanıp söner. Altta seçtiğin üç değer görünür.
  - O an süren bir tehlike varsa (örneğin su sıcaklığı sınırı aştıysa) uyarının kendisi en üstte büyük yazıyla çıkar.
  - Ekrana dokununca ayarlar çıkar: **Ön cam yansıması** (telefon torpidoda düz yatarken yazı camda düz okunsun diye yukarı-aşağı çevirir), **Sağ-sol aynala**, **Parlaklık** (Otomatik seçilirse akşam ve gece kendiliğinden kısılır), **Renk**, **Değerleri seç** ve **Sade** (yalnızca hız ve uyarılar).
  - **Stil** düğmesiyle üç görünüm arasında geçilir: **Klasik** (yukarıdaki), **Şerit** (dev hız, altında ince devir çizgisi ve tek satır değerler) ve **Sportif** (üstte yarış arabalarındaki gibi sırayla yanan vites ışıkları).
- **Gösterge paneli:** Modern araçlardaki gibi dijital kadran. Yuvarlak hız ve devir göstergeleri, ortada bilgi sayfaları (yolculuk, tüketim, motor, saat), su, yakıt ve akü göstergeleri ve arıza lambaları. Yatay tutucuda iki kadran yan yana durur. Elektrikli araçta devir yerine güç (kW) göstergesi çıkar.
  - Ekrana dokununca çıkan **Stil** düğmesiyle dört görünüm arasında geçilir: **Modern** (parlayan yay), **Klasik** (ortadan dönen ibre, krom çerçeve), **Spor** (bölmeli ışık çubuğu) ve **Sade** (ince çizgi; gece gözü yormaz). **Renk** seçeneğine turuncu eklendi.
- **Performans ölçümü:** 0-100 km/sa ve 80-120 km/sa (sollama) süresini ölçer. **Yalnızca kapalı ve güvenli bir alanda dene.**

### Arıza
- **Arıza kodları:** kayıtlı, bekleyen ve kalıcı kodlar Türkçe açıklamalarıyla gösterilir. Motoru durdurmayı gerektirebilecek kodlar "Ciddi" diye işaretlenir. Kodlar 30 saniyede bir otomatik taranır.
- **Araç:** şase numarası (VIN), üretici, tahmini model yılı, motor yazılımı ve iletişim protokolü.
- **Muayene hazırlığı:** Araç, emisyon parçalarını sürüş sırasında kendi kendine test eder. Testler tamamlanmadıysa muayenedeki egzoz ölçümünde sorun çıkabilir.
- **Donmuş kare:** Arıza kodu oluştuğu andaki devir, hız, sıcaklık gibi değerler.
- **Sayaçlar:** "Kodlar silineli gidilen yol" gibi bilgiler. İkinci el alırken kodların yakın zamanda silinip silinmediğini gösterir.
- **Akü testi:** Motor kapalıyken başlat, ekranda "Şimdi marşa bas" yazınca motoru çalıştır. Test dinlenme voltajını, marş anındaki düşüşü ve alternatörün şarjını değerlendirir.
- **Tekleme sayacı:** Her silindirde bu sürüşte ve son 10 sürüşte kaç tekleme olduğunu gösterir. Bir silindir öne çıkıyorsa buji, bobin ya da enjektör için erken uyarıdır. Bu bilgiyi her araç vermez.
- **Yapay zekâ yorumu:** Aracın durumunu (kodlar, donmuş kare, muayene durumu, canlı değerler, son sürüş) Türkçe bir metne çevirir.
  - **Claude'da aç** ve **ChatGPT'de aç** metni sohbete hazır yazılmış olarak açar. Açılan kutu boş gelirse metin panoya da kopyalanmıştır; basılı tutup yapıştır.
  - Ayarlar'a Claude API anahtarı girersen yorum doğrudan uygulamada görünür. API anahtarı, Anthropic'in hizmetini programdan kullanmak için verdiği kişisel şifredir. Anahtar yalnızca bu telefonda saklanır; her yorum birkaç sent tutar.
  - Şase numarası yalnızca kutucuğunu işaretlersen metne eklenir. Konum hiçbir zaman eklenmez.
- **Rapor oluştur (PDF):** Ustaya gösterilecek tek sayfalık rapor hazırlar. Açılan yazdırma ekranında "PDF olarak kaydet"i seç.

### Sürüşler
- Bağlandığın andan bağlantıyı kesene kadar geçen her sürüş otomatik kaydedilir: yaklaşık saniyede bir satır, izin verirsen GPS konumuyla.
- Her sürüş için şunlar görünür:
  - **Özet:** süre, mesafe, ortalama ve en yüksek hız, yakıt (litre, TL, L/100 km), uyarı sayısı.
  - **Grafik:** istediğin iki değeri üst üste gösterir. Uyarı anları kırmızı çizgiyle işaretlidir. Grafiğe dokununca o anki değerler yazılır.
  - **Harita:** yol hıza göre renklenir; uyarıların geldiği yerler işaretlidir.
  - **CSV paylaş / indir:** Excel'de doğrudan açılan tablo. WhatsApp, e-posta ya da Drive'a gönderilebilir.
  - **Sürüş puanı:** Sert fren, sert hızlanma, hız aşımı ve yüksek devir sayılır; 10 km başına 100 üzerinden bir puan hesaplanır. Olayların yerleri haritada işaretlenir.
- **Bakım hatırlatıcı:** Yağ, filtreler, buji, triger, fren hidroliği, antifriz, muayene ve sigorta. Kilometre sayacını bir kez gir; sürüşlerle birlikte kendiliğinden artar. Yaklaşan ya da geçen bakımda uyarı verir.
  - **Triger aralığı araca göre değişir.** Varsayılan 90.000 km / 5 yıl, K4M için temkinli bir değerdir. Kendi servis kitapçığına bak: triger kopması bu motorda supaplara zarar verir.
- **Masraf defteri:** Yakıt, bakım, sigorta gibi harcamalar. Aylık ve yıllık toplam, km başına maliyet. Depoyu tam doldurduğunda litreyi girersen **gerçek tüketimi** hesaplar ve uygulamanın tahmini tutmuyorsa düzeltme oranını önerir.

### İstatistik
- **Özet:** Seçilen dönemin (bu hafta, bu ay, son 3 ay, bu yıl, tümü) toplam km, süre, yakıt, maliyet ve ortalama tüketimi; önceki döneme göre artış ve azalışı.
- **Grafikler:** Km, sürüş başına tüketim, günün saatlerine göre sürüş ve sürüş uzunluğu.
- **Araç sağlığı eğilimleri:** Her sürüşteki şarj voltajı, uzun süreli yakıt ayarı, en yüksek su sıcaklığı, ısınma süresi ve rölantide geçen süre.
  - Son sürüşlerde yavaş bir bozulma varsa sade bir cümleyle söyler. Örneğin: "Son 10 sürüşte şarj voltajı ortalama 0,3 V düştü — akü/alternatör kontrolü önerilir."
  - Yorum için en az 5 gerçek sürüş gerekir.
- **Rekorlar ve arıza geçmişi.**
- Deneme kayıtları istatistiğe katılmaz.

### Ayarlar
- Her değer için **alt/üst uyarı sınırı** belirlenebilir ve istenmeyen değerler gizlenebilir.
- **Yakıt:** yakıt türü, litre fiyatı, motor hacmi ve düzeltme oranı.
- Sesli uyarı, titreşim, ekranı açık tutma, kayıt ve GPS tercihleri.
- **Araçlarım:** Uygulama bağlandığı aracı şase numarasından tanır ve her araç için sürüşleri, bakımı, masrafları ve ayarları ayrı tutar.
  - İlk bağlantıda "Yeni araç tanındı: … — doğru mu?" diye sorar ve araca uygun varsayılanları getirir; örneğin Fluence K4M için benzin, 1,6 L.
  - Gerekirse şase numarasının yalnızca ilk 11 karakteri bir araç tanıma servisine gönderilir; aracın seri numarası hiçbir yere gitmez.
  - Eski Renault'ların şase numarasında model yılı bulunmaz; uygulama bu yüzden yıl göstermez.
- **Tanılama paketi gönder:** Uygulamanın senin aracında nasıl çalıştığını tek bir dosyada toplar ve paylaşma menüsünü açar. Dosyada şunlar var: cihaz ve bağlantı bilgisi, aracın hangi değerleri verdiği, cihazla konuşmanın ham kaydı, arıza durumu, canlı değerler ve sürüş özetleri. Geliştirme için bu dosyayı göndermen yeterli. **API anahtarı, konum ve masraf notları dosyaya girmez.**

## Elektrikli araçlar (deneme aşamasında)

Ayarlar → Yakıt türü → **Elektrik** seç. Ardından **Araç profili** seç ya da "Otomatik" bırak.

- **Standart değerler:** batarya doluluğu (PID 5B), kilometre (PID A6) ve hız. Ancak bunları her elektrikli araç vermez.
- **Opel Corsa-e / Peugeot e-208 (e-CMP):** Batarya doluluğu, voltaj, akım, güç, hücre voltajları, sıcaklık, batarya sağlığı ve 12 V. Topluluk kaynaklarından (evDash, WiCAN, OBDb) derlendi.
- **KGM Torres EVX:** Yalnızca gösterge doluluğu bir kaynakta doğrulanmış; diğer değerler tahmin.
- **Anlık güç, kWh/100 km ve sürüş başına enerji maliyeti** hesaplanır. "Şarj oluyor" ve "Frenle geri kazanım" durumları gösterilir.
- **Özel PID listesi yükle:** Car Scanner ya da Torque CSV biçimindeki komut listelerini içeri alabilirsin. Uygulama yalnızca okuma komutlarını kabul eder.

Bu değerlerin hepsi **"denenmemiş"** olarak işaretli. Gerçek araçta denedikten sonra **Ham yanıtları paylaş** ile sonuçları gönderirsen doğrulayıp düzeltilir.

## Deneme modu

Cihaz yanında değilken uygulamayı görmek içindir. **Değerler ve arıza kodları sahtedir.** Örneğin deneme modu bilerek P0301 ve P0171 kodlarını gösterir.

- Açıkken her ekranın üstünde **"DENEME MODU"** şeridi görünür.
- Uyarılar "Deneme:" diye başlar.
- Sürüş kaydedilmez.
- Önceki sürümlerden kalan deneme kayıtları Sürüşler sekmesindeki **"Deneme kayıtlarını sil"** düğmesiyle silinebilir.

## Uyarılar nasıl çalışır?

- Bir değer sınırın dışına **3 ölçüm üst üste** çıkarsa uyarı verilir. Tek bir hatalı okuma alarm çaldırmasın diye böyle ayarlandı.
- Uyarı gelince ekranın üstünde kırmızı şerit çıkar, bip sesi çalar ve telefon titrer. Telefon ayrıca uyarıyı Türkçe okur, örneğin "Dikkat. Soğutma suyu sıcaklığı 108 derece".
- Değer 3 ölçüm boyunca normale dönerse uyarı kendiliğinden kalkar.
- Sağ üstteki hoparlör düğmesi bütün sesleri (bip ve konuşma) kapatır.

Konuşma İngilizce aksanlı geliyorsa telefonda Türkçe ses paketi yok demektir. Telefon ayarlarında arama kutusuna **"Metin okuma"** yaz ve açılan bölümden Google'ın Türkçe ses verisini indir.

## Yakıt hesabı

| Araçta ne varsa | Kullanılan yöntem | Doğruluk |
|---|---|---|
| Araç yakıt debisini kendisi veriyor (PID 5E) | Doğrudan o değer | En iyi |
| Hava akış sensörü (MAF) var | Havanın miktarından yakıt hesaplanır; yakıt ayar değerleriyle düzeltilir | ± %5-10 |
| MAF yok | Emme basıncı + devir + hava sıcaklığı + motor hacmi | ± %15 ve üstü |

**Dizelde** hava miktarından yapılan hesap yanıltıcıdır. Bu yüzden dizelde tüketim yalnızca araç kendi değerini veriyorsa gösterilir.

**Litre fiyatı kendiliğinden güncellenir:** Fiyatlar günde üç kez (06:15, 12:15, 18:15) Petrol Ofisi'nin il sayfalarından alınır; Petrol Ofisi'ne ulaşılamazsa Opet yedek kaynaktır. Ayarlar → Yakıt'tan ilini ve istersen ilçeni seç. Kendi fiyatını yazarsan otomatik güncelleme kapanır.

Birkaç depo sonra gerçek tüketimle karşılaştırıp **Ayarlar → Yakıt → Düzeltme oranı** ile ince ayar yapabilirsin. Örneğin uygulama 6,0 L/100 km gösteriyor, gerçekte 6,6 ise oranı 110 yap.

## Bilmen gereken sınırlar

- **Ekran açık, uygulama önde kalmalı.** Telefon kilitlenirse ya da başka uygulamaya geçersen Android tarayıcıyı durdurur; takip ve kayıt da durur. Telefonu tutucuya tak ve şarjda tut.
- Ucuz "v2.1" kopya cihazlar bazı komutları desteklemeyebilir. Bu durumda ilgili bölüm "Araç bu bilgiyi vermiyor" gösterir.
- Her araç her değeri vermez. Vermediği değerler soluk görünür.
- Üreticiye özel değerler (şanzıman sıcaklığı, DPF doluluğu…) ve ABS ya da hava yastığı arızaları henüz desteklenmiyor. Bunlar için marka bazlı komut tablosu gerekiyor. Elektrikli araçlar için bu tablolar kısmen eklendi.

## Gizlilik

Bütün veriler (ayarlar, sürüş kayıtları, GPS izi) **yalnızca senin telefonunda**, tarayıcının kendi deposunda tutulur. Hiçbir sunucuya gönderilmez. Harita görünürken OpenStreetMap'ten yalnızca harita görüntüleri indirilir.

Tarayıcı verilerini silersen kayıtlar da silinir. Önemli sürüşleri CSV olarak dışa aktar.

---

## Geliştiriciler için

Tek sayfalık bir web uygulaması; derleme adımı yok. Tek dış kütüphane harita için Leaflet (cdnjs üzerinden).

```
index.html            Uygulamanın çekirdeği (HTML + CSS + JS), eklenti kancaları
features/*.js         Her özellik kendi dosyasında (bkz. CONTRIBUTING.md)
test/                 Deneme modu testleri: npm install && npm test
sw.js                 Service worker: çevrimdışı açılış (sayfa ağdan, diğerleri önbellekten)
manifest.webmanifest  Ana ekrana kurulum bilgisi
icons/                Uygulama simgeleri
```

**Bağlantı katmanı:** Hepsi aynı arayüze sahip (`open`, `write`, `onData`, `onLost`, `close`). `Elm` sınıfı komutları sıraya koyar ve her yanıtı `>` işaretine kadar bekler.

- `SerialLink`: klasik Bluetooth. Web Serial üzerinden RFCOMM/SPP kullanır (Android Chrome 138+).
- `BleLink`: BLE. Web Bluetooth kullanır; yaygın ELM327 BLE servislerini (FFF0, FFE0, 18F0 ve diğerleri) dener.
- `DemoLink`: gerçek ELM327 yanıtlarını taklit eder, cihazsız geliştirme için.

**Kullanılan OBD servisleri (SAE J1979):**

| Mod | İşlev |
|---|---|
| 01 | Canlı veri |
| 02 | Donmuş kare |
| 03 / 07 / 0A | Kayıtlı / bekleyen / kalıcı arıza kodu |
| 04 | Arıza kodlarını silme (yalnızca onayla) |
| 09 | VIN ve yazılım bilgisi |

AT komutlarından `ATRV` (voltaj) ve `ATDPN` (protokol) kullanılır.

**Okuma hızı:** Her değerin bir okunma sıklığı (`every`) var. Devir ve hız her turda, sıcaklıklar 5 turda bir, yakıt seviyesi 20 turda bir okunur.

**Yerelde çalıştırma:** Herhangi bir statik sunucu yeterli. Örneğin `python -m http.server`, ardından `http://localhost:8000/#demo`.

Adres sonuna eklenebilen kısayollar:
- `#demo`: deneme modunu başlatır.
- `#ariza`, `#surus`, `#ayar`: ilgili sekmeyi açar.
- Birleştirilebilir, örneğin `#demo-ariza`.

## Sorumluluk

Bu uygulama bilgilendirme amaçlıdır. Arıza kodu açıklamaları genel SAE tanımlarıdır; kesin teşhis için yetkili servise danış. Sürüş sırasında telefonla ilgilenme.
