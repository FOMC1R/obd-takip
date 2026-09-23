# Özellik geliştirme rehberi (features/)

Uygulama `index.html` içindeki tek bir betikten oluşur. Yeni özellikler **kendi dosyalarında** yazılır:

- `features/<ad>.js` — özelliğin tüm JS'i. Gerekirse CSS'i JS içinden `<style>` ekleyerek verir.
- `index.html`'de yalnızca şu satırın **altına** tek satır eklenir:
  `<!-- eklentiler: her özellik kendi dosyasında (features/) -->`
  `<script src="features/<ad>.js"></script>`
- `index.html`'in başka yerini değiştirmeniz gerekiyorsa minimal tutun ve raporda belirtin.

## Eklentinin erişebildikleri (index.html'deki genel değişkenler)

| Ad | Ne |
|---|---|
| `on(ad, fn)` | Kanca: `connect({name,demo})`, `disconnect()`, `tick()` (her okuma turu sonu), `sample(row, trip)` (kayda satır yazılmadan önce; `row.v[pid]`, `row.lat/lon/gs`; satıra alan eklenebilir), `tripEnd(trip)` (sürüş kapanırken; `trip`'e alan eklenebilir, sonra kaydedilir), `tripOpen(trip, samples)` (sürüş ayrıntısı açıldı), `alarm(key, level, text)`, `dtc(S.dtc, mil)`, `diag()`, `gaugesBuilt()` |
| `S` | Canlı durum: `S.active`, `S.elm.send(cmd, timeoutMs)` (ELM327'ye komut; sıralı), `S.g[pid].v/.ts/.hist`, `S.supported` (Set), `S.isCan`, `S.proto`, `S.cra` (motor filtresi), `S.paused` (true yapınca canlı okuma durur), `S.dtc {stored,pending,perm}`, `S.diag {vehicle, ready, freeze, counters}`, `S.batt`, `S.vin`, `S.link` |
| `GAUGES`, `GBY[pid]`, `addGauge(def)` | Gösterge tanımları. `addGauge({pid, name, unit, lo, hi, dec, min, max, every, hide, read: async()=>sayı, available: ()=>bool})` sonra `buildSettings(); buildGauges();` |
| `cur(pid)` | Güncel değer ya da `null` |
| `has(pid)` | Araç bu mod 01 PID'ini destekliyor mu |
| `q(cmd, t)` | Komut gönder, hata/NO DATA ise `null` |
| `lines(resp)`, `pidBytes(resp, pid)`, `decodeDtc(hex4)`, `dtcInfo(code)`, `multiFrameBytes(resp, head)` | Yanıt çözümleme |
| `settings`, `save()` | Kalıcı ayarlar. Kendi anahtarınızı `if(settings.x===undefined) settings.x=…` ile ekleyin |
| `REC.trip`, `getTrips()`, `getSamples(id)`, `putTrip(t)`, `V` (açık sürüş: `V.trip`, `V.samples`, `V.map` Leaflet) | Kayıt |
| `raise(key, level, text, say)`, `drop(key)`, `addLog(level, text)`, `speak(text)`, `beep(level)` | Uyarılar |
| `$`, `fmt(v, dec)`, `fmtDur(ms)`, `km(m)`, `fmtDate(ms)`, `kv(dlEl, rows)`, `showTab(ad)`, `wait(ms)` | Yardımcılar |
| `DemoLink` | Deneme cihazı. Yeni komutları desteklemek için `const o=DemoLink.prototype.reply; DemoLink.prototype.reply=function(cmd){ … return o.call(this,cmd); }` |

## Arayüz alanları

Kartınızı şu kaplara ekleyin: `#ext-canli`, `#ext-ariza`, `#ext-surus`, `#ext-viewer` (açık sürüşün içi), `#ext-ayar`.

## Tasarım kuralları

- Hedef ekran: **Xiaomi 14T Pro, Chrome, ~393 px genişlik**, dikey. Dokunma alanı en az 44 px. Yatay kaydırma olmamalı.
- Renk ve yazı tipi yalnızca CSS değişkenleriyle: `--bg --panel --panel-2 --line --text --muted --accent --accent-ink --ok --warn --crit --crit-bg --warn-bg --grid --series-b --f-body --f-num`. Açık ve koyu temanın ikisi de bu değişkenlerle kendiliğinden çalışır.
- Hazır sınıflar: `card`, `row`, `actions`, `sub`, `kv` (dl), `verdict ok|no`, `chip crit|warn|info`, `field`, `check`, `empty`, `confirm` (onay kutusu; **`confirm()`/`alert()` kullanmayın**), `button.primary`, `button.danger`, `h2`, `h3`.
- Dil: **sade Türkçe**, jargon yok. Teknik terim gerekirse bir kez parantez içinde açıklayın.
- Uygulama yalnızca **okur**. Araca yazma/kodlama yok.

## Test

```
npm install
node test/run.js            # tüm testler
node test/<ad>.test.js      # tek test
```

`test/harness.js` sahte tarayıcı ortamında index.html'i ve `<script src="features/...">` eklentilerini yükler. Test kodu `String.raw` şablonu içinde çalışır ve genel değişkenlere erişir; örnekler için `test/diag.test.js`, `test/hooks.test.js`.

Görsel kontrol (393 px, 3x piksel yoğunluğu): bir iframe barındıran HTML yazıp headless Chrome ile ekran görüntüsü alın:

```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --allow-file-access-from-files --user-data-dir="<geçici klasör>" --window-size=500,1400 \
  --force-device-scale-factor=3 --virtual-time-budget=20000 --screenshot=<çıktı.png> "file:///<host.html>"
```

`host.html`: `<iframe src="file:///<depo>/index.html#demo-ariza" style="width:393px;height:1400px;border:0">`. Adres sonu kısayolları: `#demo`, `#canli`, `#ariza`, `#surus`, `#ayar` (birleşebilir: `#demo-ariza`). **Chrome işlemlerini toplu kapatmayın**; kullanıcının açık tarayıcısı var.

## Commit

Conventional Commits, Türkçe: `tip(kapsam): özet` (≤50 karakter), gövdede **neden**. Tek commit = tek konu. Push yapılmaz; birleştirme ve yayın ana oturumda.
