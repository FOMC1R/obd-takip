// OBDb çevirici: bit çözümü (büyük/küçük uçlu, işaretli, 1 bitlik, ölçek, mil→km), gerçek IONIQ 5 tanımından profil
// (doğru beyin ve sinyal seçimi, hücre voltajları), profilin ev.js okuma yoluyla araçtan değer alması
const fx=require("fs").readFileSync(require("path").join(__dirname,"fixtures","obdb-ioniq5.json"),"utf8");
global.__fx=JSON.parse(fx);
require("./harness")(String.raw`
  const D=OBDB.decoder, near=(a,b)=>Math.abs(a-b)<1e-9;
  const b=new Array(40).fill(0);
  b[25]=0x03; b[26]=0xB6;                 // bix 200, 16 bit → 950
  if(!near(D({bix:200,len:16,div:10})(b),95)) throw new Error("16 bit büyük uçlu");
  b[12]=0x10; b[13]=0x0A;                 // blsb: 0x0A10 = 2576
  if(!near(D({bix:96,len:16,blsb:true,mul:2,div:4})(b),1288)) throw new Error("küçük uçlu");
  b[0]=0xFF; b[1]=0xFE;
  if(D({bix:0,len:16,sign:true})(b)!==-2) throw new Error("işaretli");
  b[9]=0x80; if(D({bix:72,len:1})(b)!==1) throw new Error("1 bit (en soldaki)");
  b[9]=0x08; if(D({bix:76,len:1})(b)!==1 || D({bix:75,len:1})(b)!==0) throw new Error("bit sırası");
  b[5]=100; if(!near(D({bix:40,len:8,add:-40})(b),60)) throw new Error("ekleme");
  if(!near(D({bix:40,len:8,unit:"miles"})(b),160.9344)) throw new Error("mil → km");
  if(D({bix:320,len:8})(b)!==null) throw new Error("kısa cevapta null dönmedi");

  // gerçek IONIQ 5 tanımı
  const entry=OBDB.byId("ioniq5"), p=OBDB.toProfile(entry, __fx);
  const k=Object.fromEntries(p.items.map(i=>[i.key,i]));
  for(const x of ["SOC","SOH","V","AUX","CHG"]) if(!k[x]) throw new Error("eksik anlam: "+x+" | "+Object.keys(k));
  if(k.SOC.tx!=="7E4" || k.SOC.src!=="IONIQ5_HVBAT_SOC_DISP" || k.SOC.cmd!=="220105") throw new Error("SOC yanlış seçildi: "+k.SOC.tx+" "+k.SOC.src);
  if(k.SOH.cmd!=="220105" || !k.SOH.fc) throw new Error("SOH komutu/akış: "+k.SOH.cmd+" "+k.SOH.fc);
  if(p.cells.length<90) throw new Error("hücre voltajları az: "+p.cells.length);
  if(!p.odo) throw new Error("kilometre yok");

  // araçtan okuma: deneme cihazı 7E4 22 0105'e SOH 95,0 ve ekran doluluğu %76 versin
  const resp=new Array(40).fill(0); resp[25]=0x03; resp[26]=0xB6; resp[31]=152;
  const hx=a=>a.map(x=>x.toString(16).toUpperCase().padStart(2,"0")).join("");
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){ const r=o.call(this,cmd); if(cmd==="220105" && this.hdr==="7E4") return "620105"+hx(resp); return r; };
  OBDB.register(entry, __fx);
  await start(new DemoLink()); await wait(1200);
  const it=EVA.PROFILES["obdb_ioniq5"].items.filter(i=>i.key==="SOH"||i.key==="SOC").map(i=>({...i, pid:"EV_"+i.key}));
  await EVA.readItems(it);
  const soh=EVA.st.cache.SOH, soc=EVA.st.cache.SOC;
  if(!soh || !near(soh.v,95) || !soc || !near(soc.v,76)) throw new Error("araçtan okunmadı: "+JSON.stringify({soh,soc}));
  stop(); await wait(400);
  if(!EVA.PROFILE_NAMES.obdb_ioniq5 || !/OBDb/.test(EVA.PROFILE_NAMES.obdb_meb)) throw new Error("ayar listesinde yok");
  console.log("OBDb: bit çözümü, IONIQ 5 profili ("+p.items.length+" anlam, "+p.cells.length+" hücre), araçtan okuma tamam");
`);
