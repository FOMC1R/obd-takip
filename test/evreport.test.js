// Batarya raporu: gerçek IONIQ 5 tanımıyla hücre cevapları tersinden üretilir (bit bit kodlama); rapor 192 hücreyi,
// en düşük/en yüksek hücreyi, farkı (mV), SOH'u ve değerlendirmeleri doğru çıkarır; geçmişe yazar; eşik kararları
const fx=require("fs").readFileSync(require("path").join(__dirname,"fixtures","obdb-ioniq5.json"),"utf8");
global.__fx=JSON.parse(fx);
require("./harness")(String.raw`
  const R=EVREPORT;
  if(R.sohVerdict(95).lvl!=="ok" || R.sohVerdict(75).lvl!=="warn" || R.sohVerdict(60).lvl!=="crit") throw new Error("SOH eşikleri");
  if(R.cellVerdict(20).lvl!=="ok" || R.cellVerdict(50).lvl!=="warn" || R.cellVerdict(120).lvl!=="crit") throw new Error("hücre eşikleri");
  if(R.auxVerdict(12.6).lvl!=="ok" || R.auxVerdict(11.8).lvl!=="crit") throw new Error("12 V eşikleri");

  // istenen değerleri bit bit kodla (OBDb fmt'nin tersi)
  function enc(b,fmt,val){ const bix=fmt.bix||0, len=fmt.len||8; let raw=Math.round((val-(fmt.add||0))*(fmt.div||1)/(fmt.mul||1));
    if(raw<0) raw+=2**len;
    if(fmt.blsb){ for(let i=0;i<len/8;i++){ b[(bix>>3)+i]=raw&255; raw=Math.floor(raw/256); } return; }
    for(let i=len-1;i>=0;i--){ const p=bix+i; b[p>>3]=(b[p>>3]||0)&~(1<<(7-(p&7))) | ((raw&1)<<(7-(p&7))); raw=Math.floor(raw/2); } }
  const entry=OBDB.byId("ioniq5"); OBDB.register(entry, __fx);
  const P=EVA.PROFILES.obdb_ioniq5;
  const want=new Map();   // "hdr|cmd" → bayt dizisi
  const put=(hdr,cmd,fmt,val)=>{ const k=hdr+"|"+cmd; if(!want.has(k)) want.set(k,new Array(64).fill(0)); enc(want.get(k),fmt,val); };
  const fmtOf=id=>{ for(const c of __fx.commands) for(const s of c.signals) if(s.id===id) return s.fmt; };
  let expMin=9, expMax=0;
  // aracın çözünürlüğüyle yuvarla (IONIQ 5 hücre adımı 0,02 V)
  const quant=(f,v)=>Math.round((v-(f.add||0))*(f.div||1)/(f.mul||1))*(f.mul||1)/(f.div||1)+(f.add||0);
  P.cells.forEach((c,i)=>{ const f=fmtOf(c.id), v=quant(f, 3.80+((i*37)%50)/1000 + (i===77?-0.12:0)); expMin=Math.min(expMin,v); expMax=Math.max(expMax,v); put(c.tx,c.cmd,f,v); });
  for(const it of P.items){ const f=fmtOf(it.src); const val={SOC:76,SOH:88.5,V:715.2,AUX:13.9,CHG:0}[it.key]; if(val!=null) put(it.tx,it.cmd,f,val); }
  const hx=a=>a.map(x=>x.toString(16).toUpperCase().padStart(2,"0")).join("");
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){ const r=o.call(this,cmd); const k=(this.hdr||"")+"|"+cmd;
    if(want.has(k)){ const mode=(parseInt(cmd.slice(0,2),16)+0x40).toString(16).toUpperCase(); return mode+cmd.slice(2)+hx(want.get(k)); } return r; };
  settings.fuel="elektrik"; settings.evProfile="obdb_ioniq5";
  await start(new DemoLink()); await wait(1500);
  const d=await R.collect();
  if(d.cells!==192) throw new Error("hücre sayısı: "+d.cells);
  if(Math.abs(d.cmin-expMin)>0.002 || Math.abs(d.cmax-expMax)>0.002) throw new Error("hücre min/max: "+d.cmin+" "+d.cmax+" beklenen "+expMin+" "+expMax);
  if(d.low[0].i!==78) throw new Error("en düşük hücre numarası: "+d.low[0].i);
  if(Math.abs(d.dmv-Math.round((expMax-expMin)*1000))>2) throw new Error("fark: "+d.dmv);
  if(Math.abs(d.SOH-88.5)>0.05 || Math.abs(d.SOC-76)>0.5) throw new Error("SOH/SOC: "+d.SOH+" "+d.SOC);
  const v=Object.fromEntries(d.verdicts.map(([k,x])=>[k,x.lvl]));
  if(v["Batarya sağlığı"]!=="ok" || v["Hücre dengesi"]!=="crit" || v["12 V akü"]!=="ok") throw new Error("değerlendirme: "+JSON.stringify(v));
  const h=R.html(d);
  if(!/192/.test(h) || !/78\. hücre/.test(h) || !/OBDb Hyundai-IONIQ-5/.test(h)) throw new Error("rapor metni eksik");
  // düğmeyle: geçmişe yazılır
  const n0=settings.evReports.length; $("evrBtn").disabled=false; await $("evrBtn").ev.click(); 
  if(settings.evReports.length!==n0+1 || Math.abs(settings.evReports.at(-1).soh-88.5)>0.05) throw new Error("geçmişe yazılmadı");
  R.close(); stop(); await wait(400);
  console.log("batarya raporu: 192 hücre, fark "+d.dmv+" mV (78. hücre zayıf), SOH %"+fmt(d.SOH,1)+", eşikler, geçmiş tamam");
`);
