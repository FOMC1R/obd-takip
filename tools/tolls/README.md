# Köprü ve otoyol ücret verisi (`data/tolls.json`)

Uygulama (`features/tolls.js`) sürüşün GPS izini bu dosyadaki gişe konumlarıyla telefonda karşılaştırır.

## Kaynaklar
- **Ücretler:** KGM "Otoyol ve Köprü Geçiş Ücretleri" sayfasındaki 2026 PDF'leri
  (https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Otoyollar/UcretlerYeni.aspx) ve avrasyatuneli.com.
  KGM yolları 01.01.2026; YİD yolları 01.07.2026 (eski tarife `onceki` alanında).
- **Konumlar:** OpenStreetMap (© OSM katkıcıları, ODbL 1.0): `barrier=toll_booth` noktaları, `highway=motorway_junction`
  adları, köprü / tünel yol çizgileri.

## Her ocak (ve YİD'de temmuz) zammında
1. Yeni PDF'leri indir; `indir/kgm_pdf.py` ve `indir/yid_pdf.py` ile `kaynak/ucret_kgm.json`, `kaynak/ucret_yid.json`
   üret (betiklerin içindeki dosya yollarını kendi klasörüne göre düzenle). Rakamı yalnız resmî PDF'ten al.
2. Gişeler değiştiyse `indir/osm_giseler.py`, `indir/osm_kavsaklar.py` (Overpass; meşgulse yedek sunucu dener).
3. `python tools/tolls/uret.py` → `data/tolls.json` ve kapsama raporu (yol başına konumu bulunan gişe sayısı).
4. `node test/tolls-data.test.js` (İstanbul gerçek koordinat testi) ve tam test.

## Bilinen sınırlar
- Konumu bulunamayan gişeden geçiş "ücret bulunamadı" olarak görünür (yanlış ücret yazmaz).
- `r: 250` olan gişe konumu kavşaktan yaklaşıktır; ücret "yaklaşık" işaretlenir.
- Kuzey Marmara serbest geçiş noktaları (havalimanı bağlantıları vb.) henüz yok.
- İstanbul elle doğrulandı (`uret.py` → `OVERRIDE`); diğer illerde eşleştirme otomatik.
