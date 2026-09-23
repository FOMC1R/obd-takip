// ---------- Elektrikli araç (EV) desteği ----------
// Genel (SAE J1979) batarya/kilometre değerleri, markaya özel batarya okuma profilleri (mod 22),
// Car Scanner / Torque özel PID listesi içe aktarma, güç ve kWh/100 km hesabı, EV deneme modu (#demo-ev).
// Markaya özel değerler gerçek araçta denenene kadar "denenmemiş" diye işaretlenir.
const EVA = (()=>{
"use strict";

// ================= 1) Güvenli formül çözücü =================
// Car Scanner / Torque formülleri: A, B, … Z, AA … (yanıt baytları; büyük/küçük harf fark etmez), sayılar, + - * / ( ),
// Signed(A) (işaretli bayt), ShortSigned(A,B) / Int16(A,B) (işaretli 16 bit), Signed16(x), Uint16(A,B),
// GetBit(A,n), If(k,a,b), Min/Max/Abs, {A:3} (A'nın 3. biti). Kaynak: https://www.carscanner.info/custompids/
// eval / Function kullanılmaz: metin önce parçalara ayrılır, sonra ağaç kurulur, ağaç hesaplanır.
const FUNCS = {
  SIGNED:   {n:1, f:x=>x>=128&&x<256 ? x-256 : x},
  SIGNED16: {n:1, f:x=>x>=32768&&x<65536 ? x-65536 : x},
  INT16:    {n:2, f:(a,b)=>{ const v=a*256+b; return v>=32768 ? v-65536 : v; }},
  UINT16:   {n:2, f:(a,b)=>a*256+b},
  SHORTSIGNED:{n:2, f:(a,b)=>{ const v=a*256+b; return v>=32768 ? v-65536 : v; }},   // Car Scanner
  GETBIT:   {n:2, f:(a,n)=>(a>>n)&1},
  IF:       {n:3, f:(c,a,b)=>c ? a : b},
  MIN:      {n:2, f:Math.min}, MAX:{n:2, f:Math.max}, ABS:{n:1, f:Math.abs},
};
const varIndex = name=>{   // A=0 … Z=25, AA=26 … AZ=51, BA=52 …
  if(name.length===1) return name.charCodeAt(0)-65;
  return (name.charCodeAt(0)-64)*26 + (name.charCodeAt(1)-65);
};
function tokenize(src){
  if(typeof src!=="string") throw new Error("formül metin değil");
  if(src.length>200) throw new Error("formül çok uzun");
  const out=[]; let i=0;
  while(i<src.length){
    const c=src[i];
    if(/\s/.test(c)){ i++; continue; }
    let m;
    if((m=/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i)))){ out.push({t:"num",v:parseFloat(m[0])}); i+=m[0].length; continue; }
    if((m=/^[A-Za-z][A-Za-z0-9]*/.exec(src.slice(i)))){ out.push({t:"id",v:m[0].toUpperCase()}); i+=m[0].length; continue; }
    if("+-*/(),{}:".includes(c)){ out.push({t:c}); i++; continue; }
    throw new Error(`izin verilmeyen karakter: "${c}"`);
  }
  return out;
}
// Dilbilgisi: ifade = terim (('+'|'-') terim)* ; terim = tekli (('*'|'/') tekli)* ;
// tekli = ('-'|'+') tekli | temel ; temel = sayı | bayt | işlev '(' ifade (',' ifade)* ')' | '(' ifade ')' | '{' bayt ':' sayı '}'
function compile(src){
  const tk=tokenize(src); let p=0, depth=0, maxVar=-1;
  const peek=()=>tk[p], eat=t=>{ const x=tk[p]; if(!x||x.t!==t) throw new Error(`"${t}" bekleniyordu`); p++; return x; };
  const guard=()=>{ if(++depth>40) throw new Error("formül çok iç içe"); };
  function expr(){ guard(); let n=term(); while(peek()&&(peek().t==="+"||peek().t==="-")){ const op=tk[p++].t, r=term(); n={op,l:n,r}; } depth--; return n; }
  function term(){ let n=unary(); while(peek()&&(peek().t==="*"||peek().t==="/")){ const op=tk[p++].t, r=unary(); n={op,l:n,r}; } return n; }
  function unary(){ const x=peek(); if(x&&(x.t==="-"||x.t==="+")){ p++; guard(); const n=unary(); depth--; return x.t==="-"?{op:"neg",a:n}:n; } return prim(); }
  function byteVar(name){
    if(!/^[A-Z]{1,2}$/.test(name)) throw new Error(`bilinmeyen ad: ${name}`);
    const k=varIndex(name); if(k>maxVar) maxVar=k; return {op:"var",k};
  }
  function prim(){
    const x=peek(); if(!x) throw new Error("formül eksik bitti");
    if(x.t==="num"){ p++; return {op:"num",v:x.v}; }
    if(x.t==="("){ p++; const n=expr(); eat(")"); return n; }
    if(x.t==="{"){ p++; const v=byteVar(eat("id").v); eat(":"); const b=eat("num").v; if(!(b>=0&&b<=7&&Number.isInteger(b))) throw new Error("bit 0-7 olmalı"); eat("}"); return {op:"bit",a:v,b}; }
    if(x.t==="id"){
      p++;
      if(peek()&&peek().t==="("){
        const F=FUNCS[x.v]; if(!F) throw new Error(`bilinmeyen işlev: ${x.v}`);
        p++; const args=[expr()]; while(peek()&&peek().t===","){ p++; args.push(expr()); } eat(")");
        if(args.length!==F.n) throw new Error(`${x.v} ${F.n} değer alır`);
        return {op:"fn",F,args};
      }
      return byteVar(x.v);
    }
    throw new Error(`beklenmeyen: "${x.t}"`);
  }
  const tree=expr(); if(p<tk.length) throw new Error(`fazladan: "${tk[p].t==="id"||tk[p].t==="num"?tk[p].v:tk[p].t}"`);
  const ev=(n,b)=>{
    switch(n.op){
      case "num": return n.v;
      case "var": return n.k<b.length ? b[n.k] : NaN;
      case "neg": return -ev(n.a,b);
      case "bit": { const v=ev(n.a,b); return (v>>n.b)&1; }
      case "fn":  return n.F.f(...n.args.map(a=>ev(a,b)));
      case "+": return ev(n.l,b)+ev(n.r,b);
      case "-": return ev(n.l,b)-ev(n.r,b);
      case "*": return ev(n.l,b)*ev(n.r,b);
      case "/": return ev(n.l,b)/ev(n.r,b);
    }
    return NaN;
  };
  return {src, need:maxVar+1, run:bytes=>{ const v=ev(tree,bytes||[]); return Number.isFinite(v) ? v : null; }};
}
const CACHE_F = new Map();
function evalExpr(src, bytes){
  let c=CACHE_F.get(src); if(!c){ c=compile(src); CACHE_F.set(src,c); }
  return c.run(bytes);
}

// ================= 2) Yanıt çözümleme =================
// Olumlu yanıt: (mod+0x40) + PID/DID yankısı + veri. Çok parçalı CAN yanıtında "0:", "1:" satırları birleştirilir.
function respBytes(resp, cmd){
  if(!resp) return null;
  const ls=lines(resp).filter(l=>!/SEARCHING|BUSINIT/.test(l));
  const mf=ls.filter(l=>/^[0-9A-F]:/.test(l));
  const hex = mf.length ? mf.map(l=>l.slice(2)).join("") : ls.join("");
  const mode=parseInt(cmd.slice(0,2),16);
  const head=(mode+0x40).toString(16).toUpperCase().padStart(2,"0")+cmd.slice(2).toUpperCase();
  const i=hex.indexOf(head); if(i<0) return null;
  const b=(hex.slice(i+head.length).match(/.{2}/g)||[]).map(h=>parseInt(h,16));
  return b.some(isNaN) ? null : b;
}

// ================= 3) Başlık (header) değiştirerek okuma =================
// Markaya özel beyinler (batarya yönetimi = BMS) motor beyni gibi 7DF'yi dinlemez; isteği onun adresine
// (ATSH) gönderip yalnızca onun cevabını (ATCRA) dinlemek gerekir. İş bitince motor ayarları geri yüklenir.
const ext29 = ()=>S.proto==="7"||S.proto==="9";
const defaultHdr = ()=>ext29() ? "DB33F1" : "7DF";
function autoRx(tx){   // cevap adresi verilmemişse tahmin: 7E0-7E7 → +8, 18DAxxF1 → 18DAF1xx
  if(/^7E[0-7]$/.test(tx)) return "7E"+(parseInt(tx[2],16)+8).toString(16).toUpperCase();
  if(/^18DA[0-9A-F]{2}F1$/.test(tx)) return "18DAF1"+tx.slice(4,6);
  return null;
}
const LOG=[];   // son komutlar ve ham yanıtlar (paylaşmak için)
function logRaw(cmd, r){ LOG.push(`${cmd} → ${(r||"(yanıt yok)").replace(/[\r\n>]+/g," ").trim()}`); if(LOG.length>80) LOG.shift(); }
// fc: bazı beyinler (ör. Stellantis e-CMP) uzun cevabın devamını ancak isteğin kendi adresinden gelen
// "devam et" çerçevesiyle (flow control) gönderir; ELM327'nin kendiliğinden gönderdiği yetmez.
async function withHeader(tx, rx, fn, fc){
  const e=S.elm; if(!e) return null;
  // Blok bitene kadar başka okumalar (ör. araç bilgisi taraması) araya giremesin: sıraya alınır
  const own=Object.prototype.hasOwnProperty.call(e,"send"), prev=e.send, raw=Elm.prototype.send;
  let release; const gate=new Promise(r=>release=r);
  e.send=(c,t)=>gate.then(()=>prev.call(e,c,t));
  const send=async(c,t)=>{ try{ return await raw.call(e,c,t); }catch(x){ return null; } };
  try{
    if(tx.length===8){ await send("ATCP"+tx.slice(0,2)); await send("ATSH"+tx.slice(2)); }
    else await send("ATSH"+tx);
    await send(rx ? "ATCRA"+rx : "ATAR");
    if(fc){ await send("ATFCSH"+tx); await send("ATFCSD300000"); await send("ATFCSM1"); }
    return await fn(send);
  }finally{
    if(fc) await send("ATFCSM0");
    if(tx.length===8) await send("ATCP18");
    await send("ATSH"+defaultHdr());
    await send(S.cra ? "ATCRA"+S.cra : "ATAR");
    if(own) e.send=prev; else delete e.send;
    release();
  }
}

// ================= 4) CSV (Car Scanner / Torque) =================
// Torque biçimi: Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header
// Car Scanner aynı biçimi içe aktarır; dışa aktarımda sona eklenen startDiagnostic,stopDiagnostic,Scale sütunları yok sayılır.
// Başlık "auto" ya da boşsa istek genel adrese (7DF) gider. Cevap adresi gerekiyorsa başlık "6B4:694" diye yazılabilir.
function splitCsvLine(line, sep){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true; else if(c===sep){ out.push(cur); cur=""; } else cur+=c;
  }
  out.push(cur); return out.map(s=>s.trim());
}
function parseCsv(text){
  const rows=[], errors=[];
  const ls=String(text||"").replace(/^﻿/,"").split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !/^(#|\/\/)/.test(l));
  if(!ls.length) return {rows, errors:["Dosya boş."]};
  const sep=(ls[0].split(";").length>ls[0].split(",").length) ? ";" : ",";
  ls.forEach((l,n)=>{
    const c=splitCsvLine(l,sep);
    if(n===0 && /name|modeandpid|equation/i.test(l)) return;   // başlık satırı
    const [name,short,mp,eq,mn,mx,unit,hdrc]=c;
    const line=n+1;
    const cmd=String(mp||"").replace(/^0x/i,"").replace(/\s/g,"").toUpperCase();
    if(!name){ errors.push(`${line}. satır: ad yok`); return; }
    if(!/^[0-9A-F]{4,8}$/.test(cmd) || cmd.length%2){ errors.push(`${line}. satır (${name}): komut anlaşılmadı "${mp||""}"`); return; }
    if(!/^(01|09|21|22)/.test(cmd)){ errors.push(`${line}. satır (${name}): yalnızca okuma komutları (01, 09, 21, 22) kabul edilir`); return; }
    try{ compile(eq||""); }catch(x){ errors.push(`${line}. satır (${name}): formül hatalı — ${x.message}`); return; }
    const hdr=String(hdrc||"").replace(/0x/ig,"").replace(/\s/g,"").toUpperCase();
    const [header, rx=""] = hdr==="AUTO" ? [""] : hdr.split(":");
    const okH=h=>/^([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/.test(h);
    if((header && !okH(header)) || (rx && !okH(rx))){ errors.push(`${line}. satır (${name}): başlık anlaşılmadı "${hdrc}"`); return; }
    const num=v=>{ const x=parseFloat(String(v||"").replace(",", ".")); return isNaN(x)?null:x; };
    let lo=num(mn), hi=num(mx); if(lo==null) lo=0; if(hi==null||hi<=lo) hi=lo+100;
    rows.push({name:name.slice(0,40), short:(short||name).slice(0,16), cmd, eq, lo, hi, unit:(unit||"").slice(0,10),
      header: header.length===6 ? "18"+header : header, rx: rx.length===6 ? "18"+rx : rx});
  });
  return {rows, errors};
}

// ================= 5) Durum, ayarlar =================
const PROFILES = {};    // doldurulur: bölüm 6
const PROFILE_NAMES = {auto:"Otomatik", generic:"Genel elektrikli", corsae:"Opel Corsa-e (e-CMP)", torres:"KGM Torres EVX"};
if(settings.evProfile===undefined) settings.evProfile="auto";
if(settings.customPids===undefined) settings.customPids=[];
if(settings.evPrev===undefined) settings.evPrev=null;
FUEL_PRICE.elektrik = FUEL_PRICE.elektrik || 3.50;   // TL/kWh — örnek değer (ev tarifesi); kullanıcı kendi fiyatını girer
const st = {demoEv:false, detected:null, probing:false, cache:{}, lastSample:0, applied:false};
const isEv = ()=>settings.fuel==="elektrik" || st.demoEv;
function profileKey(){
  if(!isEv()) return null;
  const p=settings.evProfile;
  if(p==="auto") return st.detected;
  return p==="generic" ? null : p;
}
const activeProfile = ()=>PROFILES[profileKey()]||null;

// ================= 6) Profiller =================
// Her öğe: key (gösterge), cmd (istek), eq (formül; A = "62 DID"den sonraki ilk bayt), isteğe bağlı tx/rx (başlık / cevap adresi).
// Hiçbiri bu uygulamayla gerçek araçta denenmedi. Güven: "3 kaynak" > "1 kaynak" > "tahmin".
//
// Stellantis e-CMP (Opel Corsa-e, Peugeot e-208/e-2008 …): batarya beyni 6B4 → cevap 694, 11 bit CAN 500 kbit/sn.
// Kaynaklar: evDash  https://github.com/nickn17/evDash/blob/master/src/CarPeugeotE208.cpp
//            WiCAN   https://raw.githubusercontent.com/meatpiHQ/wican-fw/main/vehicle_profiles/peugeot/e-208.json
//            OBDb    https://raw.githubusercontent.com/OBDb/VauxhallOpel-Corsa-e/main/signalsets/v3/default.json
// Kullanıcı notları: batarya çoğunlukla yalnızca kontak açıkken (READY) cevap veriyor (wican-fw tartışma #278, sorun #543).
PROFILES.corsae = {
  name:"Opel Corsa-e (e-CMP)", tx:"6B4", rx:"694", fc:true, probe:"SOC",
  note:"Batarya beyni çoğunlukla yalnızca araç çalışırken (READY) cevap verir. Kalan menzil için açık bir kaynak bulunamadı.",
  items:[
    {key:"SOC",  cmd:"22D410", eq:"(A*256+B)/512"},                        // gösterilen doluluk — 3 kaynak
    {key:"SOCR", cmd:"22D810", eq:"(A*256+B)/512"},                        // ham doluluk — 2 kaynak (DID), 1 kaynak (ölçek)
    {key:"V",    cmd:"22D815", eq:"(A*256+B)/16"},                         // batarya voltajı — 3 kaynak
    // akım: 4 bayt işaretsiz; evDash: I=(76800−ham)×0,018 (+ şarj). Uygulamada + sürüş olduğu için ters çevrildi — 1 kaynak
    {key:"I",    cmd:"22D816", eq:"((A*16777216+B*65536+C*256+D)-76800)*0.018"},
    {key:"CMIN", cmd:"22D86F", eq:"(A*256+B)/1000"},                       // mV → V — 3 kaynak
    {key:"CMAX", cmd:"22D870", eq:"(A*256+B)/1000"},                       // 3 kaynak
    {key:"T",    cmd:"22D877", eq:"A-40"},                                 // ortalama sıcaklık — 1 kaynak (evDash)
    {key:"TMIN", cmd:"22D87D", eq:"A-40"},                                 // 1 kaynak (evDash)
    {key:"SOH",  cmd:"22D860", eq:"(B*256+C)/16"},                         // sağlık — 3 kaynak
    {key:"E",    cmd:"22D865", eq:"(A*256+B)/64"},                         // kullanılabilir kalan enerji kWh — 2 kaynak
    {key:"AUX",  cmd:"22D822", eq:"(A*256+B)/1000"},                       // 12 V — 1 kaynak (evDash)
    {key:"CHG",  cmd:"22D854", eq:"A", tx:"590", rx:"58F"},               // şarj cihazı (OBC): >0 şarj oluyor — 1 kaynak
  ]};
// KGM Torres EVX: tek genel kaynak — Car Scanner kaydından yapılmış WiCAN profili (sahibi "çalışıyor" dedi, 2026-01):
//   https://raw.githubusercontent.com/meatpiHQ/wican-fw/main/vehicle_profiles/kmg/torres.json · https://github.com/meatpiHQ/wican-fw/issues/445
// Aracın mod 01 ve şase no (09) desteği yok (7F 01 11). Batarya bilgisi motor adresinden (7E0 → 7E8) mod 22 ile gelir.
// Yalnızca gösterilen doluluk (FD0D, D-E baytları) araç ekranıyla karşılaştırılmış; gerisi ham kayıttan tahmin.
PROFILES.torres = {
  name:"KGM Torres EVX", tx:"7E0", rx:"7E8", probe:"SOC",
  note:"Bu araç genel OBD değerlerini vermiyor. Gösterilen doluluk dışındaki değerler (voltaj, akım, sıcaklık) bir sahibin kaydından tahmin edildi; akımın yönü de tahmin.",
  items:[
    {key:"SOC",  cmd:"22FD0D", eq:"(D*256+E)/10"},                         // gösterilen doluluk — 1 kaynak, ekranla eşleşmiş
    {key:"SOCR", cmd:"22FD0D", eq:"(B*256+C)/10"},                         // tahmin
    {key:"V",    cmd:"22FD07", eq:"(A*256+B)*0.05"},                       // tahmin (~406 V)
    {key:"I",    cmd:"22FD07", eq:"(32768-(C*256+D))/10"},                 // tahmin; DC şarjda ham +185 A görülmüştü → uygulamada −
    {key:"TMAX", cmd:"22FD08", eq:"A-40"},                                 // tahmin (3 sıcaklıktan hangisi ne, bilinmiyor)
    {key:"TMIN", cmd:"22FD08", eq:"B-40"},
    {key:"T",    cmd:"22FD08", eq:"C-40"},
  ]};
// Genel: SAE J1979 PID 9A (hibrit/EV sistem verisi). Tek kaynak: OBDb SAEJ1979 —
//   https://raw.githubusercontent.com/OBDb/SAEJ1979/main/signalsets/v3/default.json · C-D: voltaj /64, E-F: işaretli akım /10.
// Akımın işaret yönü kaynakta net değil.
const GENERIC = [
  {key:"V", cmd:"019A", eq:"(C*256+D)/64"},
  {key:"I", cmd:"019A", eq:"Int16(E,F)/10"},
];

// ================= 7) Göstergeler =================
// Profil anahtarı → gösterge. Aynı anlamdaki değer her profilde aynı göstergeye yazılır.
// Akım işareti uygulama içinde tek: + = bataryadan çekilen (sürüş), − = bataryaya giren (şarj / frenle geri kazanım).
const KEYS = {
  SOC:  {name:"Batarya doluluğu",               unit:"%",  lo:0,   hi:100, dec:1, min:10,   max:null, every:10, show:true},
  SOCR: {name:"Batarya doluluğu (ham, BMS)",    unit:"%",  lo:0,   hi:100, dec:1, min:null, max:null, every:10},
  V:    {name:"Batarya voltajı",                unit:"V",  lo:200, hi:470, dec:1, min:null, max:null, every:2,  show:true},
  I:    {name:"Batarya akımı",                  unit:"A",  lo:-200,hi:400, dec:1, min:null, max:null, every:2},
  PB:   {name:"Batarya gücü (araçtan)",         unit:"kW", lo:-60, hi:140, dec:1, min:null, max:null, every:2},
  CMIN: {name:"En düşük hücre voltajı",         unit:"V",  lo:2.8, hi:4.3, dec:3, min:3.0,  max:null, every:10},
  CMAX: {name:"En yüksek hücre voltajı",        unit:"V",  lo:2.8, hi:4.3, dec:3, min:null, max:4.25, every:10},
  T:    {name:"Batarya sıcaklığı",              unit:"°C", lo:-20, hi:65,  dec:0, min:null, max:50,   every:10, show:true},
  TMIN: {name:"Batarya en düşük sıcaklık",      unit:"°C", lo:-20, hi:65,  dec:0, min:null, max:null, every:10},
  TMAX: {name:"Batarya en yüksek sıcaklık",     unit:"°C", lo:-20, hi:65,  dec:0, min:null, max:50,   every:10},
  SOH:  {name:"Batarya sağlığı (SOH)",          unit:"%",  lo:50,  hi:100, dec:1, min:null, max:null, every:60, show:true},
  AUX:  {name:"12 V akü (BMS)",                 unit:"V",  lo:10,  hi:16,  dec:2, min:null, max:null, every:10},
  E:    {name:"Kalan enerji",                   unit:"kWh",lo:0,   hi:80,  dec:1, min:null, max:null, every:10, show:true},
  CHG:  {name:"Şarj cihazı durumu (ham kod)",   unit:"",   lo:0,   hi:255, dec:0, min:null, max:null, every:10},
};
const kpid = k=>"EV_"+k;
// Etkin kaynak: seçili profil; yoksa ve araç 9A veriyorsa genel voltaj/akım
function rawItems(){
  const p=activeProfile();
  if(p) return p.items.map(it=>({...it, tx:it.tx||p.tx, rx:it.rx||p.rx, fc:!!(it.fc??p.fc)}));
  if(isEv() && S.supported && S.supported.has("9A")) return GENERIC.map(it=>({...it, tx:"", rx:""}));
  return [];
}
const itemFor = k=>rawItems().find(i=>i.key===k)||null;
const profileItems = ()=>rawItems().map(it=>({...it, pid:kpid(it.key)}));
for(const [k,d] of Object.entries(KEYS)){
  addGauge({pid:kpid(k), name:d.name, unit:d.unit, lo:d.lo, hi:d.hi, dec:d.dec, min:d.min, max:d.max, every:d.every, hide:true, ev:true, unverified:true,
    available:()=>S.active && !!itemFor(k),
    read:async()=>{ const all=profileItems(), it=all.find(i=>i.key===k); return it ? cached(it, all) : null; }});
}
// Standart (SAE J1979) değerler: her araçta aynı; araç destekliyorsa okunur
addGauge({pid:"5B", every:10, name:"Batarya doluluğu (genel OBD)", unit:"%", f:a=>a*100/255, lo:0, hi:100, dec:0, min:10, max:null, hide:true, ev:true});
addGauge({pid:"A6", every:30, name:"Kilometre sayacı", unit:"km", lo:0, hi:400000, dec:1, min:null, max:null, hide:true, ev:true,
  f:()=>null,   // donmuş karede 4 bayt gelmez; yalnızca canlı okunur
  available:()=>has("A6"),
  read:async()=>{ const b=pidBytes(await S.elm.send("01A6"),"A6"); return b&&b.length>=4 ? ((b[0]*16777216)+(b[1]<<16)+(b[2]<<8)+b[3])/10 : null; }});
// Hesaplanan: güç ve 100 km tüketimi (araçtan okunmaz, voltaj × akımdan)
function powerKw(){
  const pb=cur(kpid("PB")); if(pb!=null) return pb;
  const v=cur(kpid("V")), i=cur(kpid("I")); if(v!=null && i!=null) return v*i/1000;
  return null;
}
const hasPowerSource = ()=>!!(itemFor("PB") || (itemFor("V") && itemFor("I")));
addGauge({pid:"EVP", every:1, name:"Batarya gücü", unit:"kW", lo:-60, hi:140, dec:1, min:null, max:null, hide:true, ev:true, unverified:true,
  available:()=>S.active && isEv() && hasPowerSource(), read:async()=>powerKw()});
addGauge({pid:"EVK", every:1, name:"Enerji tüketimi (100 km)", unit:"kWh/100 km", lo:0, hi:40, dec:1, min:null, max:null, hide:true, ev:true, unverified:true,
  available:()=>S.active && isEv() && hasPowerSource(),
  read:async()=>{ const p=powerKw(), sp=cur("0D"); return p!=null && sp!=null && sp>=5 ? Math.max(-99,Math.min(99,p/sp*100)) : null; }});
["EV_V","EV_I","EV_PB","EV_SOC","5B"].forEach(p=>FUEL_NEED.add(p));   // gizli olsalar da güç/kayıt için okunur

// ================= 8) Önbellekli toplu okuma =================
// Aynı başlığa giden değerler tek seferde okunur: başlık bir kez değişir, bir kez geri yüklenir.
const CACHE_MS=1200;
function wanted(g){ return settings.lim[g.pid].show || (settings.recAll && REC.trip); }
async function readItems(items){
  const groups=new Map();
  for(const it of items){ const k=(it.tx||"")+"|"+(it.rx||"")+"|"+(it.fc?1:0); (groups.get(k)||groups.set(k,[]).get(k)).push(it); }
  for(const [,arr] of groups){
    const tx=arr[0].tx, rx=arr[0].rx||(tx?autoRx(tx):null);
    const job=async send=>{
      const seen=new Map();   // aynı komut bir kez gönderilir (ör. 019A'dan hem voltaj hem akım)
      for(const it of arr){
        let r=seen.get(it.cmd);
        if(r===undefined){ r=await send(it.cmd, 1500); seen.set(it.cmd,r); logRaw((tx?`[${tx}] `:"")+it.cmd, r); }
        const b=r && !failed(r) ? respBytes(r, it.cmd) : null;
        let v=null;
        try{ if(b) v=evalExpr(it.eq,b); }catch(x){ v=null; }
        st.cache[it.key]={v, ts:Date.now()};
        // aynı turda okunan kardeş değer göstergesine de yazılsın (yavaş değerler ilk turu beklemesin)
        const g=it.pid && GBY[it.pid], sg=g && S.g[it.pid];
        if(sg && v!=null){ sg.v=v; sg.ts=Date.now(); sg.miss=0; }
      }
    };
    if(tx) await withHeader(tx, rx, job, arr[0].fc);
    else await job(async(c,t)=>{ try{ return await S.elm.send(c,t); }catch(x){ return null; } });
  }
}
async function cached(it, all){
  const c=st.cache[it.key];
  if(c && Date.now()-c.ts<CACHE_MS) return c.v;
  // bu turda okunacak ve eskimiş olan tüm kardeşleri de birlikte oku
  const due=all.filter(x=>{ const g=GBY[x.pid]; if(!g) return false; const cx=st.cache[x.key];
    return (x===it || wanted(g) || FUEL_NEED.has(x.pid)) && (!cx || Date.now()-cx.ts > (g.every||1)*900-300); });
  if(!due.includes(it)) due.push(it);
  await readItems(due);
  return st.cache[it.key] ? st.cache[it.key].v : null;
}

// ================= 9) Özel PID listesi (CSV) göstergeleri =================
const customPid = r=>"C_"+(r.header||"STD")+"_"+r.cmd+"_"+r.short.replace(/[^A-Za-z0-9]/g,"").slice(0,8);
const customItem = r=>({key:customPid(r), pid:customPid(r), cmd:r.cmd, eq:r.eq, tx:r.header||"", rx:r.rx||""});
function addCustom(r){
  const pid=customPid(r); if(GBY[pid]) return GBY[pid];
  const span=r.hi-r.lo, dec=span<=10?2:span<=200?1:0;
  return addGauge({pid, name:r.name, unit:r.unit, lo:r.lo, hi:r.hi, dec, min:null, max:null, every:5, hide:true, custom:true, unverified:true,
    available:()=>S.active,
    read:async()=>{ const all=settings.customPids.map(customItem), it=all.find(i=>i.pid===pid); return it ? cached(it, all) : null; }});
}
function removeCustom(pid){
  settings.customPids=settings.customPids.filter(r=>customPid(r)!==pid);
  const i=GAUGES.findIndex(g=>g.pid===pid); if(i>=0) GAUGES.splice(i,1);
  delete GBY[pid]; delete settings.lim[pid]; delete S.g[pid]; S.big.delete(pid);
  save(); buildSettings(); buildGauges();
}
function importCsv(text){
  const {rows, errors}=parseCsv(text); let added=0;
  for(const r of rows){
    if(settings.customPids.some(x=>customPid(x)===customPid(r))) continue;
    if(settings.customPids.length>=60){ errors.push("En fazla 60 özel değer eklenebilir."); break; }
    settings.customPids.push(r); addCustom(r); added++;
  }
  save(); buildSettings(); buildGauges();
  return {added, errors};
}
settings.customPids.forEach(addCustom);

// ================= 10) Görünüm: EV'ye geçince yakıt / motor göstergeleri =================
// Motor olmayan araçta bu değerler anlamsız; EV seçilince gizlenir, geri dönünce önceki hâline getirilir.
const ENGINE_ONLY = ["FL","FK","0C","05","5C","04","11","0F","0B","10","06","07","0E","2F"];
const sup = p=>!!(S.supported && S.supported.has(p));
const EV_SHOW = ()=>{
  const items=rawItems(), s=new Set(["EVP","EVK"]);
  items.forEach(it=>{ if(KEYS[it.key] && KEYS[it.key].show) s.add(kpid(it.key)); });
  if(!hasPowerSource()){ s.delete("EVP"); s.delete("EVK"); }
  // genel batarya yüzdesi: profil kendi yüzdesini vermiyorsa (araç desteklemese de "vermiyor" diye görünür)
  if(!items.some(i=>i.key==="SOC")) s.add("5B");
  if(sup("A6")) s.add("A6");
  return s;
};
function applyView(){
  const on=isEv(), L=settings.lim;
  if(on){
    if(!settings.evPrev){ settings.evPrev={}; ENGINE_ONLY.forEach(p=>{ if(L[p]){ settings.evPrev[p]=L[p].show; L[p].show=false; } }); }
    const want=EV_SHOW();
    GAUGES.filter(g=>g.ev).forEach(g=>{ L[g.pid].show=want.has(g.pid); });
  }else if(settings.evPrev){
    Object.entries(settings.evPrev).forEach(([p,v])=>{ if(L[p]) L[p].show=v; });
    settings.evPrev=null;
    GAUGES.filter(g=>g.ev).forEach(g=>{ L[g.pid].show=false; });
  }
  st.viewKey=viewKey();
  save();
}
const viewKey = ()=>isEv() ? ["ev",profileKey(),sup("9A"),sup("A6")].join("|") : "yakıt";
function refreshView(){ if(st.viewKey!==viewKey()){ applyView(); coreBuildSettings(); buildGauges(); GAUGES.forEach(paintGauge); } }
st.viewKey = settings.evPrev ? null : "yakıt";   // kayıtlı durumdan başla (EV'de ilk çizimde görünüm yeniden kurulur)

// ================= 11) Arayüz =================
const css=document.createElement("style");
css.textContent=`
#evCard details summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
#evCard details p{margin:0 0 8px}
.ev-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.ev-list li{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);min-width:0}
.ev-list li span{flex:1;min-width:0;overflow-wrap:anywhere;font-size:14px}
.ev-list li small{display:block;color:var(--muted);font-size:12px}
.ev-list button{flex:none}
.g .name .chip{margin-left:4px;font-size:9px;padding:0 5px;vertical-align:1px}
#evLive .big{font-family:var(--f-num);font-size:30px;font-weight:600;line-height:1.1}
#evLive .big small{font-size:15px;color:var(--muted);font-weight:500;margin-left:4px}
#evLive .state{font-weight:600}
#evLive .state.chg{color:var(--ok)} #evLive .state.regen{color:var(--series-b)}
#evRaw{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:240px;overflow:auto;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px;margin:0}
`;
document.head.appendChild(css);
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// Yakıt türü listesine "Elektrik"
function ensureOption(){
  const sel=$("fuelType"); if(!sel || sel.querySelector('option[value="elektrik"]')&&sel.querySelector('option[value="elektrik"]').value==="elektrik") return;
  const o=document.createElement("option"); o.value="elektrik"; o.textContent="Elektrik"; sel.appendChild(o);
}
ensureOption();

// Ayarlar kartı
const card=document.createElement("section");
card.className="card"; card.id="evCard"; card.setAttribute("aria-labelledby","evTitle");
card.innerHTML=`<h2 id="evTitle">Elektrikli araç</h2>
  <p class="sub">Yakıt türünde <b>Elektrik</b> seçilince batarya değerleri okunur; motor ve yakıt göstergeleri gizlenir (geri dönünce eski hâline gelir).</p>
  <div class="field"><label for="evProfile">Araç profili</label>
    <select id="evProfile">${Object.entries(PROFILE_NAMES).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></div>
  <p class="sub" id="evProfNote"></p>
  <details><summary>Bu değerler nereden geliyor?</summary>
    <p class="sub">Elektrikli araçta batarya bilgisini (doluluk, voltaj, sıcaklık) herkesin okuyabildiği ortak OBD listesi çok az verir. Asıl bilgi, bataryayı yöneten beyinde (BMS: batarya yönetim sistemi) durur ve her marka bunu <b>kendi soru numarasıyla</b> saklar. Bu yüzden aracına uyan profili seçmen gerekir.</p>
    <p class="sub"><b>"Denenmemiş"</b> yazan değerler, aynı araca sahip kişilerin internette paylaştığı listelerden alındı; bu uygulamayla senin aracında henüz denenmedi. Değer mantıksızsa (ör. doluluk %0 ya da 900 V) ona güvenme.</p>
    <p class="sub"><b>Sonucu paylaşmak için:</b> aracı çalıştır (gösterge panelinde READY), 1-2 dakika bekle, aşağıdaki <b>Ham yanıtları paylaş</b> düğmesine bas ve çıkan metni gönder. Aynı anda araç ekranındaki batarya yüzdesini ve kilometreyi de not et; karşılaştırıp profili düzeltebiliriz.</p>
    <p class="sub">Uygulama araca hiçbir şey yazmaz; yalnızca okur.</p>
  </details>
  <h3 style="margin:0">Özel değer listesi</h3>
  <div class="field"><label for="evCsv">Özel PID listesi yükle (Car Scanner / Torque CSV)</label>
    <input type="file" id="evCsv" accept=".csv,text/csv,text/plain"></div>
  <p class="sub" id="evCsvNote">Her satır: Ad, Kısa ad, Komut (ör. 22D410), Formül (ör. A/2), En az, En çok, Birim, Başlık (ör. 6B4). Eklenen değerler gizli başlar; yukarıdaki sınır tablosundan "Göster"i işaretleyebilirsin.</p>
  <ul class="ev-list" id="evCustomList"></ul>
  <div class="actions"><button id="evShare">Ham yanıtları paylaş</button></div>
  <pre id="evRaw" hidden></pre>`;
$("ext-ayar").appendChild(card);

function renderSettingsCard(){
  const sel=$("evProfile"); if(sel) sel.value=settings.evProfile;
  const p=activeProfile(), note=$("evProfNote");
  let t="";
  if(!isEv()) t="Önce yukarıdaki Yakıt kartında türü \"Elektrik\" yap.";
  else if(settings.evProfile==="auto") t = st.detected ? `Bulunan araç: ${PROFILE_NAMES[st.detected]} (denenmemiş).` : "Bağlanınca şase numarasına ve bataryanın cevabına bakılarak seçilecek. Bulunamazsa yalnızca genel değerler okunur.";
  else if(settings.evProfile==="generic") t="Yalnızca her araçta aynı olan genel değerler (batarya yüzdesi, kilometre) denenir. Çoğu elektrikli araç bunları vermez.";
  if(p && p.note) t+=" "+p.note;
  if(note) note.textContent=t;
  const ul=$("evCustomList"); if(!ul) return;
  ul.innerHTML="";
  if(!settings.customPids.length){ const li=document.createElement("li"); li.className="empty"; li.textContent="Yüklenmiş özel değer yok."; ul.appendChild(li); }
  settings.customPids.forEach(r=>{
    const li=document.createElement("li"), pid=customPid(r);
    li.innerHTML=`<span>${esc(r.name)} <em class="chip warn">denenmemiş</em><small>${esc(r.cmd)}${r.header?" · başlık "+esc(r.header):""} · ${esc(r.eq)}${r.unit?" · "+esc(r.unit):""}</small></span><button type="button">Kaldır</button>`;
    li.querySelector("button").addEventListener("click",()=>removeCustom(pid));
    ul.appendChild(li);
  });
}
$("evProfile").addEventListener("change",e=>{ settings.evProfile=e.target.value; st.detected=null; save(); refreshView(); renderSettingsCard(); if(S.active) detect(); });
$("evCsv").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  const text=await f.text(); const r=importCsv(text);
  $("evCsvNote").textContent=`${r.added} değer eklendi.`+(r.errors.length?` Atlanan: ${r.errors.slice(0,5).join(" · ")}${r.errors.length>5?" …":""}`:"");
  e.target.value="";
});
$("evShare").addEventListener("click",()=>{
  const head=[`OBD Takip · EV ham yanıtlar · ${new Date().toLocaleString("tr-TR")}`,
    `Profil: ${PROFILE_NAMES[settings.evProfile]}${st.detected?" → "+PROFILE_NAMES[st.detected]:""} · Protokol: ${S.proto||"?"} · Motor filtresi: ${S.cra||"yok"} · VIN: ${S.vin||"?"}`];
  const vals=GAUGES.filter(g=>g.ev||g.custom).map(g=>{ const v=S.g[g.pid].v; return v==null?null:`${g.name}: ${fmt(v,g.dec)} ${g.unit}`; }).filter(Boolean);
  const text=[...head, "", ...vals, "", ...LOG].join("\n");
  const pre=$("evRaw"); pre.textContent=text; pre.hidden=false;
  try{ if(navigator.share) navigator.share({title:"OBD Takip EV yanıtları", text}).catch(()=>{}); else if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{}); }catch(x){}
});

// Ayarlar yeniden çizildiğinde: seçenek, etiketler, görünüm
const coreBuildSettings = buildSettings;
buildSettings = function(){
  ensureOption();
  coreBuildSettings();
  const ev=isEv() && settings.fuel==="elektrik";
  const lab=document.querySelector('label[for="fuelPrice"]'); if(lab && lab.textContent!==undefined) lab.textContent = ev ? "kWh fiyatı (TL) — şarj ettiğin yerin fiyatı" : "Litre fiyatı (TL)";
  for(const id of ["fuelDisp","fuelCalib"]){ const el=$(id), f=el && el.closest && el.closest(".field"); if(f) f.hidden=ev; }
  if(ev) $("fuelNote").textContent="Elektrikli araçta tüketim, bataryanın voltajı ve akımından hesaplanır (kWh/100 km). Bunun için aşağıdan araç profili seçilmeli. Varsayılan kWh fiyatı örnek değerdir; kendi tarifeni gir.";
  // sınır tablosunda denenmemiş işareti
  GAUGES.filter(g=>g.unverified).forEach(g=>{ const cb=$("s_show_"+g.pid), td=cb && cb.parentElement && cb.parentElement.nextElementSibling;
    if(td && td.appendChild && !td.querySelector(".chip")){ const c=document.createElement("em"); c.className="chip warn"; c.textContent="denenmemiş"; td.append(" ",c); } });
  if(st.viewKey!==viewKey()){ applyView(); coreBuildSettings(); buildGauges(); }
  renderSettingsCard();
};

// Canlı sekmesi: batarya özeti
const live=document.createElement("section");
live.className="card"; live.id="evLive"; live.hidden=true; live.setAttribute("aria-labelledby","evLiveTitle");
live.innerHTML=`<div class="row"><h2 id="evLiveTitle" style="margin-right:auto">Batarya</h2><em class="chip warn" id="evLiveChip">denenmemiş</em></div>
  <div class="big" id="evSoc">—<small>%</small></div>
  <div class="state" id="evState">Bağlı değil</div>
  <p class="sub" id="evLiveNote"></p>`;
$("ext-canli").appendChild(live);
function chargeState(){
  const p=powerKw(), sp=cur("0D");
  if(p==null) return {k:"none", text: S.active ? (hasPowerSource() ? "Batarya gücü okunuyor…" : "Bu profil batarya gücünü vermiyor") : "Bağlı değil"};
  const moving = sp!=null && sp>=1;
  if(p<-0.3 && !moving) return {k:"chg", text:`Şarj oluyor · ${fmt(-p,1)} kW`};
  if(p<-0.3) return {k:"regen", text:`Frenle geri kazanım · ${fmt(-p,1)} kW`};
  return {k:"use", text: moving ? `Sürüşte · ${fmt(p,1)} kW harcıyor` : `Duruyor · ${fmt(p,1)} kW harcıyor`};
}
function paintLive(){
  live.hidden=!isEv();
  if(live.hidden) return;
  const soc=cur(kpid("SOC"))??cur("5B");
  $("evSoc").innerHTML=`${fmt(soc,soc!=null&&soc<100?1:0)}<small>%</small>`;
  const s=chargeState(), el=$("evState"); el.textContent=s.text; el.className="state "+s.k;
  const p=activeProfile(), en=cur(kpid("E"));
  $("evLiveChip").hidden=!rawItems().length;
  $("evLiveNote").textContent = (en!=null ? `Kullanılabilir enerji: ${fmt(en,1)} kWh. ` : "")
    + (p ? `Profil: ${p.name}. Değerler bu araçta henüz doğrulanmadı.` : "Yalnızca genel OBD değerleri. Batarya ayrıntısı için Ayarlar → Elektrikli araç → Araç profili.");
}
paintLive();

// Göstergelerde "denenmemiş" işareti; özel okunan değerler "araç vermiyor" diye soluk görünmesin
on("gaugesBuilt",()=>{
  GAUGES.filter(g=>g.unverified && settings.lim[g.pid].show).forEach(g=>{
    const el=$("g"+g.pid), n=el && el.querySelector(".name");
    if(n && n.append){ const c=document.createElement("em"); c.className="chip warn"; c.textContent="denenmemiş"; n.append(" ",c); }
  });
});
const corePaint = paintGauge;
paintGauge = function(g){
  if(g && g.read && g.pid!=="A6" && S.supported && !S.supported.has(g.pid) && (!g.available || g.available())){
    S.supported.add(g.pid);
    try{ corePaint(g); }finally{ S.supported.delete(g.pid); }
  } else corePaint(g);
};
// Motor olmayan araçta yakıt hesabı yapılmaz
const coreFuelPossible = fuelPossible, coreFuelLH = fuelLH;
fuelPossible = function(){ return isEv() ? false : coreFuelPossible(); };
fuelLH = function(){ return isEv() ? null : coreFuelLH(); };

// ================= 12) Bağlantı: desteklenen listeyi genişlet, profili bul =================
// Ana program 00-5F aralığını sorar; EV değerleri (9A, A6) 60-BF aralığında
async function extendSupport(full){
  if(!S.supported && !full) return;
  const bases = full ? ["00","20","40","60","80","A0"] : ["60","80","A0"];
  for(const base of bases){
    if(S.supported && base!=="00" && !S.supported.has(base)) break;
    const m=supportMask(await q("01"+base,2000)||"",base);
    if(m.size){ S.supported=S.supported||new Set(); m.forEach(p=>S.supported.add(p)); } else break;
  }
}
// Şase numarasının ilk 3 harfi (üretici kodu) → profil. Yalnızca ipucu; tahmini, doğrulanmadı.
const WMI_PROFILE = {VXK:"corsae", VR3:"corsae", VR7:"corsae"};
async function detect(){
  if(!S.active || !isEv() || settings.evProfile!=="auto" || st.probing) return;
  st.probing=true;
  try{
    let found = S.vin ? WMI_PROFILE[S.vin.slice(0,3)]||null : null;
    if(!found){
      for(const [k,p] of Object.entries(PROFILES)){
        const pr=p.items.find(i=>i.key===p.probe); if(!pr) continue;
        const it={...pr, key:"probe_"+k, pid:"probe", tx:pr.tx||p.tx, rx:pr.rx||p.rx};
        await readItems([it]);
        const c=st.cache[it.key]; if(c && c.v!=null){ found=k; break; }
      }
    }
    if(found!==st.detected){ st.detected=found; if(found) addLog("warn",`Elektrikli araç profili seçildi: ${PROFILE_NAMES[found]} (denenmemiş)`); refreshView(); renderSettingsCard(); }
  }finally{ st.probing=false; }
}
on("connect", async()=>{
  st.cache={}; LOG.length=0;
  await extendSupport(st.demoEv && !sup("5B"));   // deneme: ilk tarama bu dosya yüklenmeden yapıldıysa baştan
  if(has("A6") && S.supported && S.active) await readGauge(GBY.A6).catch(()=>{});   // kilometre: ilk değer hemen
  if(isEv()){ await detect(); refreshView(); GAUGES.forEach(paintGauge); }
  paintLive();
});
on("diag", ()=>{ if(isEv() && settings.evProfile==="auto" && S.vin && WMI_PROFILE[S.vin.slice(0,3)] && !st.detected) detect(); });
on("tick", paintLive);
on("disconnect", ()=>{ if(st.demoEv){ st.demoEv=false; st.detected=null; refreshView(); } paintLive(); });

// ================= 13) Sürüş kaydı: enerji =================
on("sample",(row,t)=>{
  if(!isEv()) return;
  const now=row.t, dt=REC.lastT ? Math.min(5,(now-REC.lastT)/1000) : 0;
  const p=powerKw(), sp=cur("0D"), soc=cur(kpid("SOC"))??cur("5B");
  if(soc!=null){ if(t.socStart==null) t.socStart=soc; t.socEnd=soc; }
  if(p==null || !dt) return;
  t.ev=true;
  const e=p*dt/3600, moving=sp!=null && sp>=1;
  if(p<0 && !moving) t.kwhCharged=(t.kwhCharged||0)-e;          // şarj enerjisi sürüşe sayılmaz
  else { t.kwh=(t.kwh||0)+e; if(p<0) t.kwhRegen=(t.kwhRegen||0)-e; }
});
on("tripEnd", t=>{
  if(t.kwh==null) return;
  t.kwh=Math.round(t.kwh*1000)/1000;
  t.kwh100 = t.odo>0.5 ? Math.round(t.kwh/t.odo*1000)/10 : null;
});
const viewer=document.createElement("section");
viewer.className="card"; viewer.id="evTrip"; viewer.hidden=true;
viewer.innerHTML=`<div class="row"><h3 style="margin:0;margin-right:auto">Elektrik</h3><em class="chip warn">denenmemiş</em></div><div class="stats" id="evTripStats"></div>`;
$("ext-viewer").appendChild(viewer);
on("tripOpen", t=>{
  const box=$("evTripStats"); viewer.hidden = !(t && (t.ev || t.kwh!=null));
  if(viewer.hidden) return;
  box.innerHTML="";
  const k100 = t.kwh100!=null ? t.kwh100 : (t.kwh!=null && t.odo>0.5 ? t.kwh/t.odo*100 : null);
  const price=settings.fuel==="elektrik" ? settings.price : FUEL_PRICE.elektrik;
  [[t.kwh!=null?fmt(t.kwh,2)+" kWh":"—","Harcanan enerji"],
   [k100!=null?fmt(k100,1):"—","Ortalama, kWh/100 km"],
   [t.kwhRegen?fmt(t.kwhRegen,2)+" kWh":"—","Frenle geri kazanılan"],
   [t.kwhCharged?fmt(t.kwhCharged,2)+" kWh":"—","Şarj edilen"],
   [t.socStart!=null?`%${fmt(t.socStart,0)} → %${fmt(t.socEnd,0)}`:"—","Batarya"],
   [t.kwh!=null?fmt(Math.max(0,t.kwh)*(price||0),0)+" TL":"—","Enerji maliyeti"]]
  .forEach(([b,s])=>{ const d=document.createElement("div"); d.className="stat"; d.innerHTML=`<b>${b}</b><span>${s}</span>`; box.appendChild(d); });
});

// ================= 14) Deneme modu: elektrikli Corsa-e taklidi (#demo-ev) =================
// Motor devri 0; standart 5B / 9A / A6 ve e-CMP batarya beyni (6B4 → 694) istekleri gerçekçi değerlerle cevaplanır.
// Batarya beyni yalnızca istek doğru adrese (ATSH6B4) gidip cevap adresi süzgeci (ATCRA) 694 ise cevap verir.
function demoState(d){
  const t=(Date.now()-d.t0)/1000, drive=Math.max(0,Math.sin(t/6));
  const speed = d.charging ? 0 : drive*95, acc = d.charging||drive<=0 ? 0 : 95*Math.cos(t/6)/6;   // km/sa/sn
  let p = d.charging ? -7.2 : 1.2 + 0.16*speed + 0.035*speed*acc;                                  // kW (+ harcama)
  p=Math.max(-40,Math.min(100,p));
  const soc = Math.max(5, 72 - t*0.004), cell = 3.5+0.0065*soc, voc = 108*cell;
  const v = voc - (p*1000/voc)*0.09, i = p*1000/v;
  return {t, speed, p, soc, v, i, cell, temp:24, soh:97.5, energy:46*soc/100};
}
const hx=(n,len)=>{ n=Math.max(0,Math.round(n)); return n.toString(16).toUpperCase().padStart(len*2,"0").slice(-len*2); };
const coreReply = DemoLink.prototype.reply;
DemoLink.prototype.reply = function(cmd){
  if(cmd.startsWith("ATSH")) this.hdr=cmd.slice(4);
  else if(cmd==="ATZ"||cmd==="ATD") this.hdr=null;
  if(cmd.startsWith("AT")) { if(this.ev||st.demoEv) (this.at=this.at||[]).push(cmd); return coreReply.call(this,cmd); }
  if(!(this.ev||st.demoEv)) return coreReply.call(this,cmd);
  const s=demoState(this), mask=(base,list)=>{ let m=0; list.forEach(p=>{ m|=1<<(31-(parseInt(p,16)-base-1)); }); return (m>>>0).toString(16).toUpperCase().padStart(8,"0"); };
  const hdr=this.hdr||"7DF", flt=this.filter||null;
  if(/^22/.test(cmd)){
    const at=(tx,rx)=>hdr===tx && (!flt || flt===rx);
    const did=cmd.slice(2), w=n=>hx(n,2);
    if(at("6B4","694")){
      const cells=s.cell*1000;
      const bms={D410:w(s.soc*512), D810:w((s.soc+1.6)*512), D815:w(s.v*16), D816:hx(76800+s.i/0.018,4),
        D86F:w(cells-6), D870:w(cells+5), D877:hx(s.temp+40,1), D87D:hx(s.temp-2+40,1), D860:"01"+w(s.soh*16),
        D865:w(s.energy*64), D822:w(14.35*1000)};
      return bms[did] ? "62"+did+bms[did] : "7F2231";
    }
    if(at("590","58F")) return did==="D854" ? "62D854"+(this.charging?"01":"00") : "7F2231";
    return "NO DATA";
  }
  if(hdr!=="7DF") return "NO DATA";
  switch(cmd){
    case "03": return "4300";          // elektrikli denemede arıza kodu yok
    case "07": return "4700";
    case "020200": return "4202000000";
    case "0100": return "4100"+mask(0,["01","0D","1C","20"]);
    case "0120": return "4120"+mask(0x20,["40"]);
    case "0140": return "4140"+mask(0x40,["42","46","5B","60"]);
    case "0160": return "4160"+mask(0x60,["80"]);
    case "0180": return "4180"+mask(0x80,["9A","A0"]);
    case "01A0": return "41A0"+mask(0xA0,["A6"]);
    case "0101": return "410100000000";
    case "010C": return "410C0000";
    case "010D": return "410D"+hx(s.speed,1);
    case "011C": return "411C"+"06";
    case "0142": return "4142"+hx(14350+Math.random()*60,2);
    case "015B": return "415B"+hx(s.soc*2.55,1);
    case "019A": { const I=Math.round(-s.i*10); return "419A"+"07"+"00"+hx(s.v*64,2)+hx(I<0?I+65536:I,2); }
    case "01A6": return "41A6"+hx((12345.6+s.t*0.01)*10,4);
    case "0902": { const vin="VXKUKZKXZNW123456"; return "014\r0:490201"+[...vin].slice(0,3).map(c=>hx(c.charCodeAt(0),1)).join("")+"\r1:"+[...vin].slice(3,10).map(c=>hx(c.charCodeAt(0),1)).join("")+"\r2:"+[...vin].slice(10).map(c=>hx(c.charCodeAt(0),1)).join(""); }
  }
  if(/^01(0[4-9A-F]|1[0-9A-F]|2F|4[3-9A-F]|5C|5E|6[12])$/.test(cmd)) return "NO DATA";   // motor değerleri yok
  return coreReply.call(this,cmd);
};
// #demo-ev: ana betik deneme modunu çoktan başlattı; bu bağlantıyı elektrikli yap
{ const h=location.hash.slice(1).split("-");
  if(h.includes("demo") && h.includes("ev")){ st.demoEv=true; if(S.link instanceof DemoLink) S.link.ev=true; } }

// İlk çizim (ana betik ayarları bu dosya yüklenmeden çizdi)
buildSettings(); buildGauges(); GAUGES.forEach(paintGauge); paintLive();

return {compile, evalExpr, tokenize, respBytes, parseCsv, importCsv, demoState, removeCustom, customPid, withHeader, autoRx, readItems, cached, st, isEv,
  profileKey, activeProfile, powerKw, chargeState, detect, refreshView, PROFILES, PROFILE_NAMES, KEYS, LOG, defaultHdr};
})();
