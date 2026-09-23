// ---------- Performans ölçümü: 0-100 ve 80-120 km/sa ----------
// Ölçüm sırasında canlı okuma durdurulur (S.paused) ve yalnızca hız (010D) olabildiğince sık okunur.
// Başlangıç ve bitiş anları iki okuma arasında doğrusal ara değerle (interpolasyon) bulunur.
const PERF = (()=>{
  const MODES = {
    "0-100":  {from:0,  to:100, label:"0-100 km/sa"},
    "80-120": {from:80, to:120, label:"80-120 km/sa (sollama)"},
  };
  const ARM_MS = 30000;   // "Hazırla"dan sonra bu sürede kalkış olmazsa vazgeç (canlı okuma durmuş kalmasın)
  const RUN_MS = 30000;   // ölçüm başladıktan sonra bu sürede hedef hıza varılmazsa vazgeç
  if(settings.perf===undefined) settings.perf={};

  // Hız X'i a ile b okumaları arasında geçti (a.v < X ≤ b.v): geçiş anını doğrusal ara değerle bul
  function cross(a, b, X){ return b.v===a.v ? b.t : a.t+(X-a.v)/(b.v-a.v)*(b.t-a.t); }
  // Kalkış anı: a'da duruyor (0), b'de hareket var. b ve c'den geçen doğruyu 0 km/sa'e geri uzat;
  // sonuç a ile b arasında kalsın. (Kalkışta ivme kısa aralıkta hemen hemen sabittir.)
  function launch(a, b, c){
    if(c && c.v>b.v){ const t0=b.t-b.v*(c.t-b.t)/(c.v-b.v); return Math.min(b.t, Math.max(a.t, t0)); }
    return (a.t+b.t)/2;
  }
  // i. okumadaki hızlanma eğimi (km/sa/sn): en az 0,5 sn öncesi ya da sonrasındaki okumayla
  function slope(smp, i){
    let j=i; while(j>0 && smp[i].t-smp[j].t<500) j--;
    let k=i; while(k<smp.length-1 && smp[k].t-smp[i].t<500) k++;
    const a=smp[j], b=smp[Math.max(k,i)]; if(b.t===a.t) return 0;
    return (b.v-a.v)/((b.t-a.t)/1000);
  }
  // Okuma listesinden süreyi hesapla. smp: [{t (ms), v (km/sa)}], sırayla.
  function analyze(smp, key){
    const m=MODES[key]; if(!m) return null;
    const f=smp.findIndex((s,i)=>i>0 && s.v>=m.to && smp[i-1].v<m.to); if(f<1) return null;
    let st=null, s0=-1;
    for(let i=f;i>=1;i--){
      if(key==="0-100" ? (smp[i-1].v===0 && smp[i].v>0) : (smp[i-1].v<m.from && smp[i].v>=m.from)){ s0=i; break; }
    }
    if(s0<0) return null;
    st = key==="0-100" ? launch(smp[s0-1], smp[s0], smp[s0+1]) : cross(smp[s0-1], smp[s0], m.from);
    const end=cross(smp[f-1], smp[f], m.to);
    const dt=(smp[f].t-smp[s0-1].t)/(f-s0+1);   // ortalama okuma aralığı (ms)
    // Belirsizlik: (1) okuma aralığının yarısı; (2) araç hızı tamsayı km/sa verir, yuvarlama ±0,5 km/sa
    // → o anki hızlanma eğimine bölünce zamana çevrilir (yavaş hızlanmada daha büyük). Karelerin toplamının kökü.
    const q=i=>{ const k=slope(smp,i); return k>0 ? 0.5/k : 0; };
    const prec=Math.sqrt((dt/2000)**2 + q(s0)**2 + q(f)**2);
    return {sec:(end-st)/1000, prec, hz:1000/dt};
  }

  // ---- görünüm ----
  const css=document.createElement("style");
  css.textContent=`
#perfCard .sub{margin:0}
.pf-live{display:grid;gap:6px;padding:12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line)}
.pf-time{font-family:var(--f-num);font-size:56px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.pf-time small{font-size:20px;color:var(--muted);margin-left:4px}
.pf-msg{font-weight:600;font-size:18px}
.pf-sp{color:var(--muted);font-variant-numeric:tabular-nums}
.pf-warn{margin:0;padding:10px 12px;border-radius:10px;background:var(--warn-bg);border:1px solid var(--warn);font-weight:600}
#perfCard .actions button{flex:1 1 150px}`;
  document.head.appendChild(css);

  const card=document.createElement("details"); card.className="card"; card.id="perfCard";
  card.innerHTML=`<summary>Performans ölçümü</summary>
    <p class="pf-warn">Yalnızca kapalı ve güvenli alanda dene. Trafikte ve yolda deneme.</p>
    <p class="sub">Aracın hızlanma süresini ölçer. <b>0-100</b>: duruştan 100 km/sa'e. <b>80-120</b>: sollama (öndeki aracı geçme) hızlanması.
    Ölçüm sırasında diğer değerler okunmaz; yalnızca hız çok sık okunur.</p>
    <div class="actions"><button id="pfA">0-100 · Hazırla</button><button id="pfB">80-120 · Hazırla</button></div>
    <div class="pf-live" id="pfLive" hidden>
      <div class="pf-time" id="pfTime">0,00<small>sn</small></div>
      <div class="pf-msg" id="pfMsg"></div>
      <div class="pf-sp" id="pfSp"></div>
      <div class="actions"><button id="pfStop">Vazgeç</button></div>
    </div>
    <div id="pfRes"></div>
    <h3>En iyi sonuçlar</h3>
    <dl class="kv" id="pfBest"></dl>`;
  $("ext-canli").appendChild(card);
  const el=id=>card.querySelector("#"+id);

  let R=null;   // süren ölçüm
  const last={};
  const fs=v=>fmt(v,2)+" sn";
  function paintBest(){
    kv(el("pfBest"), Object.entries(MODES).map(([k,m])=>{ const b=settings.perf[k];
      return [m.label, b ? `${fs(b.sec)} (±${fmt(b.prec,2)}) · ${fmtDate(b.at)}` : "Henüz yok"]; }));
  }
  function paintButtons(){ el("pfA").disabled=el("pfB").disabled=!S.active || !!R; }
  function show(msg, v, tSec){
    el("pfLive").hidden=false; el("pfMsg").textContent=msg; el("pfStop").hidden=!R;
    if(v!=null) el("pfSp").textContent=`Hız: ${fmt(v,0)} km/sa`;
    el("pfTime").innerHTML=fmt(tSec||0,2)+"<small>sn</small>";
  }
  function result(html, ok){ el("pfRes").innerHTML=html ? `<div class="verdict ${ok?"ok":"no"}">${html}</div>` : ""; }

  async function run(key){
    if(!S.active || R) return;
    const m=MODES[key], demo=S.link instanceof DemoLink;
    R={key, phase:"arm", smp:[], t0:Date.now(), stop:false, fail:null};
    card.open=true; result(""); paintButtons();
    show("Hazırlanıyor…", null, 0);
    S.paused=true; await wait(400);   // canlı döngü elindeki komutu bitirsin
    if(demo) DEMO.start=Date.now();
    let err=0, lastPaint=0;
    try{
      while(!R.stop && S.active){
        const t1=Date.now(); let b=null;
        try{ b=pidBytes(await S.elm.send("010D",1000),"0D"); }catch(e){}
        const t2=Date.now();
        if(!b || !b.length){ if(++err>=5){ R.fail="Hız okunamadı."; break; } continue; }
        err=0;
        const s={t:(t1+t2)/2, v:b[0]}, prev=R.smp[R.smp.length-1]; R.smp.push(s);
        const g=S.g["0D"]; if(g){ g.v=s.v; g.ts=t2; }
        if(R.phase==="arm"){
          const go = key==="0-100" ? (prev && prev.v===0 && s.v>0) : (prev && prev.v<m.from && s.v>=m.from);
          if(go){ R.phase="run"; R.tStart = key==="0-100" ? prev.t : cross(prev,s,m.from); }
          else{
            if(R.smp.length>6) R.smp.splice(0,R.smp.length-6);   // beklerken son birkaç okuma yeter
            R.msg = key==="0-100" ? (s.v===0 ? "Araç dururken gaza bas" : "Önce aracı tamamen durdur")
                                  : (s.v<m.from ? "80 km/sa'in altından gaza bas" : "Önce 80 km/sa'in altına in");
            if(t2-R.t0>ARM_MS){ R.fail="30 saniye içinde kalkış olmadı; ölçüm iptal."; break; }
          }
        }
        if(R.phase==="run"){
          R.msg=`Ölçülüyor… hedef ${m.to} km/sa`;
          if(s.v>=m.to){ R.phase="done"; break; }
          if(t2-R.tStart>RUN_MS){ R.fail=`30 saniyede ${m.to} km/sa'e varılmadı; ölçüm iptal.`; break; }
        }
        if(t2-lastPaint>100){ lastPaint=t2; show(R.msg, s.v, R.phase==="run" ? (t2-R.tStart)/1000 : 0); if(g) paintGauge(GBY["0D"]); }
      }
    }finally{
      S.paused=false; DEMO.start=null;
      const r=R; R=null; paintButtons();
      if(r.phase==="done"){
        const a=analyze(r.smp,key);
        if(a){
          last[key]=a;
          show(`Bitti: ${m.label}`, r.smp[r.smp.length-1].v, a.sec);
          const best=settings.perf[key];
          let note="";
          if(demo) note=" Deneme modu; en iyi sonuçlara yazılmadı.";
          else if(!best || a.sec<best.sec){ settings.perf[key]={sec:+a.sec.toFixed(3), prec:+a.prec.toFixed(3), at:Date.now()}; save(); note=" Yeni en iyi sonuç!"; paintBest(); }
          result(`${m.label}: <b>${fs(a.sec)}</b> (±${fmt(a.prec,2)} sn). Hız saniyede yaklaşık ${fmt(a.hz,0)} kez okundu.${note}`, true);
        }else result("Ölçüm hesaplanamadı; tekrar dene.", false);
      }else{
        el("pfLive").hidden=true;
        result(r.fail || (r.stop ? "Ölçümden vazgeçildi." : "Bağlantı koptu; ölçüm iptal."), false);
      }
    }
  }
  el("pfA").addEventListener("click",()=>run("0-100"));
  el("pfB").addEventListener("click",()=>run("80-120"));
  el("pfStop").addEventListener("click",()=>{ if(R) R.stop=true; });
  on("connect",paintButtons);
  on("disconnect",()=>{ if(R){ R.stop=true; R.fail="Bağlantı koptu; ölçüm iptal."; } paintButtons(); });
  paintBest(); paintButtons();

  // ---- deneme modu: ölçüm sırasında 1,5 sn bekleyip 0'dan ~11 sn'de 110 km/sa'e hızlanan araç ----
  // v(t) = 150·(1 − e^(−t/8,2)): 0-100 ≈ 9,01 sn, 80-120 ≈ 6,95 sn (testte gerçek değerle karşılaştırılır)
  const DEMO={start:null, wait:1.5, vmax:150, tau:8.2};
  const origReply=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    if(cmd==="010D" && DEMO.start!=null){
      const t=(Date.now()-DEMO.start)/1000-DEMO.wait;
      const v=t<=0 ? 0 : DEMO.vmax*(1-Math.exp(-t/DEMO.tau));
      return "410D"+Math.min(255,Math.round(v)).toString(16).toUpperCase().padStart(2,"0");
    }
    return origReply.call(this,cmd);
  };

  return {MODES, cross, launch, analyze, run, last, DEMO, card, get running(){ return R; }};
})();
