// Güvenlik: içe aktarılan PID listesindeki kötü niyetli ad/birim sayfaya kod olarak giremez; gösterge adı her
// ekleyişte ayıklanır; sayfa güvenlik kuralı (CSP) koddaki her dış adresi kapsar; harita kütüphanesi imzalı yüklenir
const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const bad=[];
const csp=(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)||[])[1];
if(!csp) bad.push("CSP yok");
else {
  const dir=n=>((csp.match(new RegExp("(?:^|;)\\s*"+n+"\\s+([^;]+)"))||[])[1]||"").split(/\s+/);
  const connect=dir("connect-src"), img=dir("img-src"), script=dir("script-src");
  // Koddaki (yorum dışı) her dış adres ya CSP'de ya da yalnız bağlantı olarak açılanlar listesinde olmalı
  const LINK_ONLY=new Set(["https://claude.ai","https://chatgpt.com","https://github.com","https://www.google.com","https://www.goatcounter.com"]);
  // vehicles-data.js yalnız kaynak gösterimi (metin) içerir; uygulama o adreslere bağlanmaz
  const files=["index.html",...fs.readdirSync(path.join(ROOT,"features")).filter(f=>f!=="vehicles-data.js").map(f=>"features/"+f)];
  const hosts=new Map();
  for(const f of files){
    const txt=fs.readFileSync(path.join(ROOT,f),"utf8").replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:"'`])\/\/.*$/gm,"$1").replace(/<!--[\s\S]*?-->/g,"");
    for(const m of txt.matchAll(/https:\/\/([a-z0-9.{}\-]+)/gi)){ let h="https://"+m[1].replace(/^\{s\}\./,"*.").replace(/\$\{[^}]*\}/,"obd-takip"); if(!hosts.has(h)) hosts.set(h,f); }
  }
  const all=[...connect,...img,...script,...dir("style-src"),...dir("font-src")];
  const allowed=h=>all.some(c=>c===h || (c.startsWith("https://*.") && h.endsWith(c.slice(9))));
  for(const [h,f] of hosts) if(!allowed(h) && !LINK_ONLY.has(h)) bad.push(`CSP'de izin yok: ${h} (${f})`);
  if(hosts.size<5) bad.push("adres taraması çalışmadı: "+[...hosts.keys()]);
  if(!img.includes("https://obd-takip.goatcounter.com")) bad.push("kullanım sayacı img-src'de yok");
  if(connect.includes("*") || img.includes("*") || img.includes("https:")) bad.push("CSP çok geniş");
  if(!script.includes("https://cdnjs.cloudflare.com")) bad.push("Leaflet betiği CSP'de yok");
}
for(const m of html.matchAll(/<(script|link)[^>]+cdnjs\.cloudflare\.com[^>]*>/g))
  if(!/integrity="sha(256|384|512)-/.test(m[0]) || !/crossorigin="anonymous"/.test(m[0])) bad.push("imzasız dış dosya: "+m[0].slice(0,80));
if(bad.length){ console.error(bad.join("\n")); process.exit(1); }

require("./harness")(String.raw`
  const evil='<img src=x onerror="fetch(1)">Motor';
  const csv="Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header\n"
    + '"'+evil.replace(/"/g,'""')+'",k<b>,0x221234,A,0,100,"°C<script>",7E0\n';
  const r=EVA.parseCsv(csv);
  if(r.errors.length || r.rows.length!==1) throw new Error("satır okunamadı: "+JSON.stringify(r));
  const row=r.rows[0];
  if(/[<>"'&]/.test(row.name+row.unit+row.short)) throw new Error("ad/birim temizlenmedi: "+JSON.stringify(row));
  // doğrudan addGauge ile gelen kötü ad da ayıklanır
  const g=addGauge({pid:"ZZ1", name:'<svg onload=alert(1)>', unit:'"><b>', lo:0, hi:1, dec:0, read:async()=>1});
  if(/[<>"'&]/.test(g.name+g.unit)) throw new Error("addGauge ayıklamadı: "+g.name+" / "+g.unit);
  if(escHtml('<a href="x">\'&') !== "&lt;a href=&quot;x&quot;&gt;&#39;&amp;") throw new Error("escHtml yanlış: "+escHtml('<a href="x">\'&'));
  console.log("güvenlik: CSV ayıklama, addGauge ayıklama, escHtml, CSP adresleri, imzalı dış dosya tamam");
`);
