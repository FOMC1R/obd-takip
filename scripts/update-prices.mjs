// Akaryakıt fiyatlarını günceller → data/prices.json
// Kaynak: Petrol Ofisi il sayfaları (benzin 95, motorin, otogaz; ilçe ilçe, KDV dahil).
// Yedek: Opet fiyat servisi (yalnızca benzin ve motorin; LPG satmıyor).
// Tarayıcı bu sitelere doğrudan erişemediği (CORS) için GitHub Actions'ta günde birkaç kez çalışır;
// uygulama sonucu kendi adresinden okur. Bağımlılık yok: node 20+ (yerleşik fetch).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; obd-takip-fiyat/1.0; +https://github.com/FOMC1R/obd-takip)";
const PO = "https://www.petrolofisi.com.tr/akaryakit-fiyatlari";
const OUT = "data/prices.json";
const wait = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "tr-TR" }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.text();
      if (r.status < 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { if (i === tries) throw e; }
    await wait(1500 * i);
  }
}

const num = s => { const v = parseFloat(String(s).replace(",", ".")); return Number.isFinite(v) && v > 5 && v < 500 ? v : null; };
// Baş harfleri büyük yaz. Kaynak ilçe adlarını Türkçe harfsiz BÜYÜK yazıyor ("ATASEHIR"): bunlarda Türkçe
// küçültme "I"yı "ı" yapıp "Atasehır" gibi yanlış ad üretir, o yüzden düz küçültme kullanılır.
const title = s => (/^[\x00-\x7F]*$/.test(s) ? s.toLowerCase() : s.toLocaleLowerCase("tr-TR"))
  .replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("tr-TR"));
const median = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };

// Petrol Ofisi il sayfası: başlık satırındaki ürün adlarına göre sütunu bul (sıra değişirse de doğru okunsun)
function parsePO(html) {
  const head = (html.match(/<thead[\s\S]*?<\/thead>/) || [""])[0];
  const cols = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase());
  const idx = (re) => cols.findIndex(c => re.test(c)) - 1;   // ilk sütun ilçe adı
  const iB = idx(/kurşunsuz|kursunsuz/), iD = idx(/diesel|motorin/), iL = idx(/otogaz|lpg/);
  const out = {};
  for (const m of html.matchAll(/<tr class="price-row[^"]*"[^>]*data-disctrict-name="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const v = [...m[2].matchAll(/class="with-tax">([\d.,]+)</g)].map(x => num(x[1]));
    const row = { b: iB >= 0 ? v[iB] : null, d: iD >= 0 ? v[iD] : null, l: iL >= 0 ? v[iL] : null };
    if (row.b || row.d || row.l) out[title(m[1])] = row;
  }
  return out;
}

async function fromPO() {
  const main = await get(PO);
  const slugs = [...new Set([...main.matchAll(/akaryakit-fiyatlari\/([a-z0-9-]+)-akaryakit-fiyatlari/g)].map(m => m[1]))]
    .filter(s => !/bolgesi$/.test(s));
  const provinces = {};
  for (const slug of slugs) {
    try {
      const html = await get(`${PO}/${slug}-akaryakit-fiyatlari`);
      const name = (html.match(/<h1[^>]*>([^<]+)</) || [, slug])[1].replace(/akaryakıt\s+fiyatları/i, "").trim();
      const districts = parsePO(html);
      const rows = Object.values(districts);
      if (!rows.length) { console.warn("boş:", slug); continue; }
      provinces[slug] = { ad: title(name || slug),
        ort: { benzin: median(rows.map(r => r.b)), dizel: median(rows.map(r => r.d)), lpg: median(rows.map(r => r.l)) },
        ilce: Object.fromEntries(Object.entries(districts).map(([k, r]) => [k, [r.b, r.d, r.l]])) };
    } catch (e) { console.warn("alınamadı:", slug, e.message); }
    await wait(400);   // siteyi yormamak için
  }
  return provinces;
}

// Yedek: Opet (il kodu ile). Yalnızca PO'da bulunamayan il/ürünleri tamamlar.
const OPET_CODES = { istanbul: 934, "istanbul-anadolu": 34, ankara: 6, izmir: 35, bursa: 16, antalya: 7, kocaeli: 41 };
async function fillFromOpet(provinces) {
  for (const [slug, code] of Object.entries(OPET_CODES)) {
    const p = provinces[slug];
    if (p && p.ort.benzin && p.ort.dizel) continue;
    try {
      const js = JSON.parse(await get(`https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=${code}`));
      const pick = (re) => median(js.map(d => (d.prices.find(x => re.test(x.productName)) || {}).amount ?? null));
      const b = pick(/Kurşunsuz Benzin 95/i), d = pick(/^Motorin/i);
      provinces[slug] = p || { ad: title(js[0]?.provinceName || slug), ort: { benzin: null, dizel: null, lpg: null }, ilce: {} };
      provinces[slug].ort.benzin ??= b; provinces[slug].ort.dizel ??= d; provinces[slug].yedek = "Opet";
    } catch (e) { console.warn("Opet alınamadı:", slug, e.message); }
  }
}

const provinces = await fromPO().catch(e => { console.warn("Petrol Ofisi alınamadı:", e.message); return {}; });
await fillFromOpet(provinces);
const count = Object.keys(provinces).length;
if (count < 20) {
  // Kaynak bozulduysa eski dosyayı ezme; iş başarısız görünsün ki fark edilsin
  console.error(`Yalnızca ${count} il alınabildi; data/prices.json değiştirilmedi.`);
  process.exit(1);
}
const data = { guncelleme: new Date().toISOString(), kaynak: "Petrol Ofisi (yedek: Opet)", birim: "TL/L, KDV dahil",
  not: "ilce değerleri [benzin95, motorin, otogaz]", iller: provinces };
mkdirSync("data", { recursive: true });
// Fiyatlar aynıysa dosyaya dokunma (gereksiz commit olmasın)
if (existsSync(OUT)) {
  const old = JSON.parse(readFileSync(OUT, "utf8"));
  if (JSON.stringify(old.iller) === JSON.stringify(data.iller)) { console.log("Fiyatlar değişmedi."); process.exit(0); }
}
writeFileSync(OUT, JSON.stringify(data));
const ist = provinces.istanbul?.ort;
console.log(`${count} il yazıldı. İstanbul: benzin ${ist?.benzin}, motorin ${ist?.dizel}, LPG ${ist?.lpg}`);
