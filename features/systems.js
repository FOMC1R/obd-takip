// ---------- Araç sistemleri: motor dışındaki beyinler (şanzıman…) ----------
// CAN'li araçlarda standart OBD verisini motor beyni (7E0 → cevap 7E8) dışında şanzıman (genelde 7E1 → 7E9) ve
// bazı araçlarda hibrit/batarya gibi başka beyinler de verir. Bağlanınca 7E1-7E7 adresleri tek tek sorulur;
// cevap veren her sistem kendi sayfasında gösterilir, birkaç saniyede bir okunur ve sürüş kaydına yazılır
// (satırda row.s = {"7E1": {pid: değer}}; sürüşte trip.sysStats).
// Vites: motor devri ÷ araç hızı her viteste belli bir değerde toplanır; uygulama bu değerleri sürüşlerden
// kendisi öğrenir (araçtan araca oran tablosu gerekmez). Şanzıman beyni standart "dişli oranı" (PID A4) verirse o kullanılır.
// Arama her araç için bir kez yapılır (araç tanındıktan sonra, "diag" kancası); sonucu saklanır, elle yeniden aranabilir.
// Kalıcı (araca özel): settings.systems, settings.systemsChecked, settings.gear. Ortak: settings.sysEvery (okuma aralığı, sn).
// Deneme modunda bulunanlar ve öğrenilen vitesler yalnızca bellekte tutulur; gerçek aracın kaydına karışmaz.
const SYS = (()=>{
  const ADDRS = ["7E1","7E2","7E3","7E4","7E5","7E6","7E7"];
  const rxOf = tx=>"7E"+(parseInt(tx[2],16)+8).toString(16).toUpperCase();
  const hx2 = n=>n.toString(16).toUpperCase().padStart(2,"0");
  const LN_BIN = 40;           // vites öğrenme: oran ekseni ln(oran)*40 → ~%2,5'lik bölmeler
  const MATCH = 0.06;          // ölçülen oran öğrenilen vitese ±%6 içindeyse o vites
  const DECAY_AT = 6000;       // bu kadar ölçümden sonra eski ölçümler yarıya iner (araç değişirse uyum sağlasın)
  const SKIP = new Set(["01","03","1C","1D","1E","13","41"]);   // durum/bayrak değerleri: gösterilmez

  if(!settings.systems || typeof settings.systems!=="object") settings.systems={};
  if(settings.sysEvery===undefined) settings.sysEvery=10;
  const st = {probing:false, probed:false, ready:false, msg:null, live:{}, reading:false, lastRead:0, lastSave:0, prevSp:null, prevT:0, lastSample:0,
    demo:{systems:{}, checked:false, gear:{h:{}, n:0, a4:[]}}};
  const isDemo = ()=>typeof DemoLink!=="undefined" && S.link instanceof DemoLink;
  const G = ()=>{ if(isDemo()) return st.demo.gear;
    if(!settings.gear || typeof settings.gear!=="object") settings.gear={h:{}, n:0, a4:[]}; return settings.gear; };
  const store = ()=>isDemo() ? st.demo.systems : (settings.systems||{});
  const checked = ()=>isDemo() ? st.demo.checked : !!settings.systemsChecked;
  const persist = ()=>{ if(!isDemo()) save(); };
  const list = ()=>Object.values(store()).sort((a,b)=>a.tx<b.tx?-1:1);
  const tcm = ()=>store()["7E1"] || null;

  // ---- adlar ----
  const ACR = {ECM:"Motor", PCM:"Motor", TCM:"Şanzıman", TCU:"Şanzıman", HPCM:"Hibrit sistem", HCU:"Hibrit sistem",
    BECM:"Batarya", BMS:"Batarya", GPCM:"Kızdırma bujisi", ABS:"ABS fren", DCM:"Dizel sistemi"};
  function nameOf(tx, ecu){
    const a = ecu ? ecu.split(/[^A-Z0-9]/i)[0].toUpperCase() : "";
    if(ACR[a]) return ACR[a];
    if(tx==="7E1") return "Şanzıman";
    return a ? `${a} sistemi` : `Sistem ${tx}`;
  }
  const readable = s=>(s.pids||[]).filter(p=>!SKIP.has(p) && (p==="A4" || (GBY[p] && GBY[p].f && !GBY[p].virtual && !GBY[p].read)));
  const label = p=>p==="A4" ? {name:"Şanzıman dişli oranı", unit:"", dec:3} : GBY[p] ? {name:GBY[p].name, unit:GBY[p].unit, dec:GBY[p].dec??0} : {name:"PID "+p, unit:"", dec:0};
  function decode(pid, b){
    if(!b || !b.length) return null;
    if(pid==="A4"){ if(b.length<4) return null; const r=(b[2]*256+b[3])/1000; return r>0 ? r : null; }
    const g=GBY[pid]; if(!g || !g.f) return null;
    const v=g.f(b[0], b[1]||0); return Number.isFinite(v) ? v : null;
  }
  function mask9(resp, base){   // mod 09 destek listesi
    const set=new Set(), baseN=parseInt(base,16);
    for(const l of lines(resp||"")){ const i=l.indexOf("49"+base); if(i<0) continue;
      const b=(l.slice(i+4).match(/.{2}/g)||[]).map(h=>parseInt(h,16)); if(b.length<4) continue;
      for(let k=0;k<32;k++) if(b[k>>3] & (0x80>>(k&7))) set.add(hx2(baseN+k+1)); }
    return set;
  }

  // ---- 1) keşif ----
  async function probe(){
    if(st.probing || !S.active || !S.elm || typeof EVA==="undefined") return;
    if(!(S.isCan && (S.proto==="6" || S.proto==="8"))){
      st.msg = S.isCan ? "Bu araç 29 bitlik CAN kullanıyor; diğer sistemlerin aranması henüz yalnızca 11 bitlik CAN'de var."
                       : "Bu araç eski bir iletişim türü kullanıyor; diğer sistemler bu yolla aranamıyor.";
      st.probed=true; paint(); return;
    }
    st.probing=true; st.msg=null; paint();
    const found={};
    try{
      for(const tx of ADDRS){
        if(!S.active) break;
        const res = await EVA.withHeader(tx, rxOf(tx), async send=>{
          const r0=await send("0100",2500), m0=supportMask(r0||"","00");
          if(!m0.size) return null;
          const pids=new Set(m0);
          for(let base=0x20; base<=0xA0 && pids.has(hx2(base)); base+=0x20)
            supportMask(await send("01"+hx2(base),2500)||"", hx2(base)).forEach(p=>pids.add(p));
          let ecu=null;
          if(mask9(await send("0900",2500),"00").has("0A")){
            const rn=await send("090A",4000);
            if(rn) ecu=ascii(multiFrameBytes(rn,"490A")).replace(/[^\x20-\x7E]/g,"").trim() || null;
          }
          return {pids:[...pids].filter(p=>!/^(20|40|60|80|A0|C0)$/.test(p)).sort(), ecu};
        });
        if(res) found[tx]={tx, rx:rxOf(tx), pids:res.pids, ecu:res.ecu, name:nameOf(tx,res.ecu), t:Date.now()};
      }
      if(isDemo()){ st.demo.systems=found; st.demo.checked=true; }
      else { settings.systems=found; settings.systemsChecked=true; save(); }
      st.probed=true;
      addLog("info", Object.keys(found).length ? "Bulunan sistemler: "+list().map(s=>s.name).join(", ") : "Motor dışında standart veri veren sistem bulunamadı.");
    }catch(e){ st.msg="Arama yarıda kaldı: "+(e && e.message || e); }
    finally{ st.probing=false; buildTabs(); paint(); emit("systems", store()); }
  }

  // ---- 2) canlı okuma ----
  async function readRound(){
    if(st.reading || st.probing || !st.ready || !S.active || S.paused || typeof EVA==="undefined") return;
    const sys=list().filter(s=>readable(s).length); if(!sys.length) return;
    st.reading=true; st.lastRead=Date.now();
    try{
      for(const s of sys){
        if(!S.active) break;
        await EVA.withHeader(s.tx, s.rx, async send=>{
          const L=st.live[s.tx]||(st.live[s.tx]={});
          for(const p of readable(s)){
            const r=await send("01"+p,1500); const v=decode(p, r && pidBytes(r,p));
            if(v!=null) L[p]={v, ts:Date.now()};
          }
        });
      }
    }finally{ st.reading=false; }
    if(tcmRatio()!=null) learnA4(tcmRatio());
    paint();
  }
  setInterval(()=>{ if(S.active && Date.now()-st.lastRead >= settings.sysEvery*1000) readRound(); }, 1000);
  const fresh = (tx,p)=>{ const x=st.live[tx] && st.live[tx][p]; return x && Date.now()-x.ts <= Math.max(15000, settings.sysEvery*3000) ? x.v : null; };
  const tcmRatio = ()=>tcm() ? fresh("7E1","A4") : null;

  // ---- 3) vites ----
  function learn(now){
    const sp=cur("0D"), rpm=cur("0C");
    const prev=st.prevSp, dt=(now-st.prevT)/1000; st.prevSp=sp; st.prevT=now;
    if(sp==null || rpm==null || sp<12 || rpm<800 || prev==null || !(dt>0) || dt>5) return;
    if(Math.abs(sp-prev)/dt > 2) return;   // hızlanırken/yavaşlarken debriyaj ya da kayma olabilir: öğrenme
    const g=G(), b=Math.round(Math.log(rpm/sp)*LN_BIN);
    g.h[b]=(g.h[b]||0)+1; g.n++;
    if(g.n>DECAY_AT){ let n=0; for(const k in g.h){ g.h[k]=Math.floor(g.h[k]/2); if(!g.h[k]) delete g.h[k]; else n+=g.h[k]; } g.n=n; }
    if(now-st.lastSave>60000){ st.lastSave=now; persist(); }
  }
  function peaks(){
    const g=G(), h=g.h, keys=Object.keys(h).map(Number); if(!keys.length) return [];
    const sm=k=>(h[k-1]||0)+(h[k]||0)+(h[k+1]||0), min=Math.max(20, g.n*0.04);
    let c=keys.filter(k=>sm(k)>=min && sm(k)>=sm(k-1) && sm(k)>=sm(k+1)).sort((a,b)=>sm(b)-sm(a));
    const out=[]; for(const k of c) if(!out.some(o=>Math.abs(o-k)<=3)) out.push(k);
    return out.slice(0,6).sort((a,b)=>b-a).map(k=>Math.exp(k/LN_BIN));   // büyük oran = küçük vites
  }
  function learnA4(r){
    const g=G(); if(!g.a4) g.a4=[];
    if(!g.a4.some(x=>Math.abs(x-r)/x<0.01)){ g.a4.push(+r.toFixed(3)); g.a4.sort((a,b)=>b-a); if(g.a4.length>10) g.a4.length=10; persist(); }
  }
  // {gear: 1.. | null, state: "duruyor" | "gecis" | "ogreniyor" | "vites", src: "oran" | "beyin"}
  function gear(){
    const sp=cur("0D"), rpm=cur("0C");
    if(sp!=null && sp<3) return {gear:null, state:"duruyor"};
    const a4=tcmRatio(), g=G();
    if(a4!=null && g.a4 && g.a4.length){
      const i=g.a4.findIndex(x=>Math.abs(x-a4)/x<0.01);
      return i>=0 ? {gear:i+1, state:"vites", src:"beyin", ratio:a4} : {gear:null, state:"gecis", src:"beyin", ratio:a4};
    }
    if(sp==null || rpm==null) return {gear:null, state:"bilinmiyor"};
    const P=peaks(); if(P.length<2 || g.n<200) return {gear:null, state:"ogreniyor"};
    const r=rpm/sp; let best=-1, d=1;
    P.forEach((p,i)=>{ const x=Math.abs(Math.log(r/p)); if(x<d){ d=x; best=i; } });
    return d<=MATCH ? {gear:best+1, state:"vites", src:"oran"} : {gear:null, state:"gecis", src:"oran"};
  }
  on("tick", ()=>{ learn(Date.now()); if(Date.now()-st.lastPaint>900) paint(); });

  // ---- 4) kayıt ----
  on("sample", (row, t)=>{
    const s={};
    for(const sys of list()) for(const p of readable(sys)){
      const v=fresh(sys.tx,p); if(v==null) continue;
      const x=Math.round(v*1000)/1000; (s[sys.tx]=s[sys.tx]||{})[p]=x;
      const ss=(t.sysStats=t.sysStats||{}), a=(ss[sys.tx]=ss[sys.tx]||{}), m=a[p]||(a[p]={min:x,max:x,sum:0,n:0});
      m.min=Math.min(m.min,x); m.max=Math.max(m.max,x); m.sum+=x; m.n++;
    }
    if(Object.keys(s).length) row.s=s;
    const gr=gear();
    if(gr.gear){ row.gr=gr.gear;
      const dt=st.lastSample ? Math.min(5,(row.t-st.lastSample)/1000) : 1;
      const gs=(t.gearSec=t.gearSec||{}); gs[gr.gear]=(gs[gr.gear]||0)+dt; }
    st.lastSample=row.t;
    if(!t.sysNames && list().length) t.sysNames=Object.fromEntries(list().map(x=>[x.tx,x.name]));
  });
  on("connect", ()=>{ st.lastSample=0; st.prevSp=null; });
  on("csvCols", (cols, smp)=>{
    const seen=new Map();
    smp.forEach(s=>{ for(const tx in s.s||{}) for(const p in s.s[tx]) seen.set(tx+"|"+p,[tx,p]); });
    const names=Object.fromEntries(list().map(x=>[x.tx,x.name]));
    for(const [tx,p] of seen.values()){ const L=label(p);
      cols.push({head:`${names[tx]||("Sistem "+tx)} · ${L.name}${L.unit?` (${L.unit})`:""}`, get:s=>s.s && s.s[tx] ? s.s[tx][p] : null}); }
    if(smp.some(s=>s.gr)) cols.push({head:"Tahmini vites", get:s=>s.gr||null});
  });

  // ---- 5) sayfalar ----
  const css=document.createElement("style");
  css.textContent=`
.sys-gear{display:flex;align-items:baseline;gap:12px;margin:6px 0 2px}
.sys-gear b{font-family:var(--f-num);font-size:64px;line-height:1;font-weight:700;color:var(--text)}
.sys-gear span{color:var(--muted);font-size:15px}
.sys-bars{display:grid;gap:6px;margin-top:8px}
.sys-bars div{display:grid;grid-template-columns:56px 1fr 44px;align-items:center;gap:8px;font-size:14px}
.sys-bars i{display:block;height:10px;border-radius:5px;background:var(--accent)}
.sys-bars em{font-style:normal;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
`;
  document.head.appendChild(css);
  const main=document.querySelector("main")||document.body;
  function section(tab, label){
    let sec=document.querySelector(`section.tab[data-tab="${tab}"]`);
    if(sec) return sec;
    sec=document.createElement("section"); sec.className="tab"; sec.dataset.tab=tab; sec.hidden=true;
    sec.setAttribute("aria-label",label); sec.id="tab-"+tab; main.appendChild(sec); return sec;
  }
  // Şanzıman sayfası her araçta var (vites tahmini şanzıman beyni olmadan da çalışır)
  const tr=section("sanziman","Şanzıman");
  tr.innerHTML=`<section class="card" aria-labelledby="trTitle">
      <h2 id="trTitle">Şanzıman</h2>
      <p class="sub" id="trType"></p>
      <div class="sys-gear" aria-live="polite"><b id="trGear">–</b><span id="trGearTxt"></span></div>
      <p class="sub" id="trLearn"></p>
    </section>
    <section class="card" id="trLiveCard" hidden aria-labelledby="trLiveTitle">
      <h2 id="trLiveTitle">Şanzıman beyninden canlı değerler</h2>
      <dl class="kv" id="trLive"></dl>
    </section>
    <section class="card" aria-labelledby="trNoteTitle">
      <h3 id="trNoteTitle">Bilinmesi gerekenler</h3>
      <p class="sub">Şanzıman yağı sıcaklığı, vites kolu konumu ve yağ eskime sayacı gibi bilgiler markaya özel komutlarla okunur.
      Fluence'ın otomatik şanzımanı (DP0) için bu komutlar açık kaynaklarda yayınlanmış değil; tahminle eklenmedi.</p>
      <p class="sub">Vites, motor devrinin araç hızına oranından tahmin edilir. Otomatik şanzımanda tork konvertörü (motorla şanzıman arasındaki yağlı kavrama)
      kilitli değilken oran kayar; o anlar "geçişte" görünür.</p>
      <div class="actions"><button id="trProbe">Sistemleri yeniden ara</button><button id="trReset">Vites öğrenmesini sıfırla</button></div>
      <p class="sub" id="trMsg" role="status"></p>
    </section>`;
  $("trProbe").addEventListener("click", ()=>{ if(!S.active){ $("trMsg").textContent="Önce araca bağlan."; return; } probe(); });
  function resetGear(){ if(isDemo()) st.demo.gear={h:{}, n:0, a4:[]}; else { settings.gear={h:{}, n:0, a4:[]}; save(); } }
  $("trReset").addEventListener("click", ()=>{ resetGear(); paint(); $("trMsg").textContent="Vites öğrenmesi sıfırlandı."; });

  function buildTabs(){
    for(const s of list()){
      if(s.tx==="7E1") continue;   // şanzıman kendi sayfasında
      const sec=section("sys-"+s.tx, s.name);
      if(sec.dataset.built===s.name) continue;
      sec.dataset.built=s.name;
      sec.innerHTML=`<section class="card"><h2>${s.name}</h2>
        <p class="sub">Adres ${s.tx}${s.ecu?` · beynin kendi adı: ${s.ecu.replace(/[<>&]/g,"")}`:""}. Değerler ${settings.sysEvery} saniyede bir okunur ve sürüş kaydına yazılır.</p>
        <dl class="kv" id="sysLive-${s.tx}"></dl></section>`;
    }
  }
  function liveRows(s){
    const rows=[];
    for(const p of readable(s)){ const L=label(p), v=fresh(s.tx,p);
      rows.push([L.name, v==null ? "–" : fmt(v,L.dec)+(L.unit?" "+L.unit:"")]); }
    const other=(s.pids||[]).filter(p=>!readable(s).includes(p) && !SKIP.has(p));
    if(other.length) rows.push(["Çözülemeyen değerler", other.join(", ")]);
    return rows;
  }
  st.lastPaint=0;
  function paint(){
    st.lastPaint=Date.now();
    const T=tcm();
    $("trType").textContent = st.probing ? "Araçtaki sistemler aranıyor…"
      : T ? `Otomatik şanzıman: şanzıman beyni cevap veriyor (adres 7E1${T.ecu?` · ${T.ecu}`:""}).`
      : (st.probed || checked())
        ? "Şanzıman beyni standart veriye cevap vermedi: manuel şanzıman olabilir ya da beyni bu veriyi paylaşmıyor."
        : "Araca bağlanınca şanzıman beyni aranır.";
    if(st.msg) $("trType").textContent+=" "+st.msg;
    const gr=gear();
    $("trGear").textContent = gr.gear ? String(gr.gear) : "–";
    $("trGearTxt").textContent = !S.active ? "Bağlı değil"
      : gr.state==="vites" ? `. vites${gr.src==="beyin"?" · şanzıman beyninden":" · tahmini"}`
      : gr.state==="duruyor" ? "Araç duruyor" : gr.state==="gecis" ? "Geçişte / kayıyor" : gr.state==="ogreniyor" ? "Öğreniyor" : "Hız ya da devir yok";
    const g=G(), P=peaks();
    $("trLearn").textContent = P.length>=2 && g.n>=200
      ? `Öğrenilen ${P.length} vites (${g.n} ölçüm). 1000 devirde hızlar: ${P.map((p,i)=>`${i+1}. ${fmt(1000/p,0)}`).join(" · ")} km/sa.`
      : `Vitesler öğreniliyor: ${g.n}/200 ölçüm. Sabit hızla giderken birkaç farklı viteste sürmek yeterli.`;
    $("trLiveCard").hidden=!T;
    if(T) kv($("trLive"), liveRows(T));
    for(const s of list()) if(s.tx!=="7E1"){ const el=document.getElementById("sysLive-"+s.tx); if(el) kv(el, liveRows(s)); }
    emit("systemsPaint");
  }
  // Araç, bağlantıdaki ilk araç bilgisi taramasından (runDiag → "diag") sonra bellidir; arama ve okuma ondan sonra başlar
  on("connect", ()=>{ if(S.resuming) return; st.ready=false; st.probed=false; st.live={}; if(isDemo()) st.demo={systems:{}, checked:false, gear:st.demo.gear}; paint(); });
  on("diag", ()=>{
    if(!S.active || st.ready) return;
    st.ready=true; buildTabs();
    if(checked()) st.probed=true; else setTimeout(()=>{ if(S.active) probe(); }, 500);
    paint();
  });
  on("disconnect", ()=>{ st.ready=false; paint(); });

  // ---- 6) sürüş ayrıntısı ----
  const vc=document.createElement("section"); vc.className="card"; vc.hidden=true;
  vc.innerHTML=`<h2>Şanzıman ve diğer sistemler</h2><div id="sysTripGear"></div><dl class="kv" id="sysTripStats"></dl>`;
  $("ext-viewer").appendChild(vc);
  on("tripOpen", t=>{
    const gs=t.gearSec||{}, tot=Object.values(gs).reduce((a,b)=>a+b,0);
    const stats=t.sysStats||{}, names=t.sysNames||{};
    vc.hidden = !tot && !Object.keys(stats).length;
    $("sysTripGear").innerHTML = tot ? `<h3>Viteste geçen süre</h3><div class="sys-bars">${Object.keys(gs).sort().map(k=>{
        const pc=gs[k]/tot*100; return `<div><span>${k}. vites</span><i style="width:${pc.toFixed(1)}%"></i><em>%${fmt(pc,0)}</em></div>`; }).join("")}</div>` : "";
    const rows=[];
    for(const tx in stats) for(const p in stats[tx]){ const m=stats[tx][p], L=label(p);
      rows.push([`${names[tx]||("Sistem "+tx)} · ${L.name}`, `en az ${fmt(m.min,L.dec)} · ort. ${fmt(m.sum/m.n,L.dec)} · en çok ${fmt(m.max,L.dec)}${L.unit?" "+L.unit:""}`]); }
    kv($("sysTripStats"), rows);
  });

  // ---- 7) deneme modu: 7E1'de 4 ileri otomatik şanzıman beyni ----
  const RATIOS=[2.724,1.499,1.000,0.710];
  const w2=n=>{ n=Math.max(0,Math.min(65535,Math.round(n))); return hx2(n>>8)+hx2(n&255); };
  const mk=(base,ls)=>{ let m=0; ls.forEach(p=>{ m|=1<<(31-(parseInt(p,16)-base-1)); }); return (m>>>0).toString(16).toUpperCase().padStart(8,"0"); };
  const isoTp=d=>{ const n=d.length/2, out=[n.toString(16).toUpperCase().padStart(3,"0")]; let i=0,k=0;
    while(i<d.length){ const take=(k===0?6:7)*2; out.push(k.toString(16).toUpperCase()+":"+d.slice(i,i+take).padEnd(take,"0")); i+=take; k++; } return out.join("\r"); };
  const nameResp=name=>isoTp("490A01"+[...name.padEnd(20,"\0")].map(c=>hx2(c.charCodeAt(0))).join(""));
  const prevReply=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    const out=prevReply.call(this,cmd);   // ev.js burada this.hdr'yi izler
    if(cmd.startsWith("AT")) return out;
    const hdr=this.hdr && this.hdr!=="7DF" ? this.hdr : null;
    if(cmd==="0900" && (!hdr || hdr==="7E0" || hdr==="7E1")) return "4900"+mk(0,["02","04","0A"]);
    if(cmd==="090A" && (!hdr || hdr==="7E0")) return nameResp("ECM-EngineControl");
    if(!hdr || hdr==="7E0" || !/^7E[1-7]$/.test(hdr)) return out;
    if(hdr!=="7E1") return "NO DATA";
    const sp=Number(S.g["0D"] && S.g["0D"].v)||0;
    switch(cmd){
      case "0100": return "4100"+mk(0,["04","05","0C","0D","20"]);
      case "0120": return "4120"+mk(0x20,["40"]);
      case "0140": return "4140"+mk(0x40,["60"]);
      case "0160": return "4160"+mk(0x60,["80"]);
      case "0180": return "4180"+mk(0x80,["A0"]);
      case "01A0": return "41A0"+mk(0xA0,["A4"]);
      case "01A4": return sp<3 ? "41A402000000" : "41A40200"+w2(RATIOS[sp<25?0:sp<45?1:sp<70?2:3]*1000);
      case "090A": return nameResp("TCM-TransmissionCtl");
      case "0104": case "0105": case "010C": case "010D": return out;
      default: return "NO DATA";
    }
  };

  buildTabs(); paint();
  return {probe, readRound, list, gear, peaks, learn, resetGear, store, get live(){ return st.live; }, st, label, decode, tcm, section};
})();
