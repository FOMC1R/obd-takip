// Açılış animasyonu: varsayılan açık, ibre eğrisi (başta 0, tepede 1, sonda 0), animasyon desteklenmeyen ortamda
// oynamaz ve sayfayı gizli bırakmaz; index.html'deki erken gizleme en geç 4 sn'de kalkar
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
if(!/<script id="boot">[^<]*sp-boot[^<]*setTimeout\([^<]*4000\)/.test(html)) { console.error("erken gizleme ve 4 sn güvenliği yok"); process.exit(1); }
if(html.indexOf('<script id="boot">') > html.indexOf("<script>")) { console.error("boot betiği ana betikten sonra"); process.exit(1); }
require("./harness")(String.raw`
  if(typeof SPLASH==="undefined") throw new Error("SPLASH yok");
  if(settings.splash!==true) throw new Error("varsayılan açık değil");
  const n=SPLASH.needleAt;
  if(n(0)!==0 || n(850)!==0 || Math.abs(n(850+900*.55)-1)>0.02 || Math.abs(n(850+900*.6)-1)>1e-9 || n(1800)!==0) throw new Error("ibre eğrisi yanlış");
  let prev=-1, up=true; for(let t=850;t<=850+900*.55;t+=20){ const v=n(t); if(v<prev-1e-9) up=false; prev=v; }
  if(!up) throw new Error("çıkışta ibre geri gidiyor");
  if(SPLASH.play(true)!==false || SPLASH.el) throw new Error("animasyon desteği yokken oynadı");
  console.log("açılış animasyonu: varsayılan, ibre eğrisi, desteksiz ortam, erken gizleme tamam");
`);
