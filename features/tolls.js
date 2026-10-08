// ---------- Köprü, tünel ve otoyol geçiş ücretleri (tahmini) ----------
// HGS'nin geçiş geçmişine dışarıdan erişim yok (yalnız PTT uygulaması / e-Devlet, girişli). Bunun yerine sürüşün GPS
// izi telefonda gişe konumlarıyla karşılaştırılır: kapalı sistem otoyolda giriş ve çıkış gişesi çiftinin ücreti,
// köprü/tünelde sabit ücret. Konum hiçbir sunucuya gitmez; yalnız ücret tablosu (data/tolls.json) indirilir.
// Gişe konumları OpenStreetMap'ten (© OSM katkıcıları, ODbL); ücretler KGM ve işletmecilerin resmî tarifelerinden.
// Sonuç: sürüş ayrıntısında "Geçiş ücretleri (tahmini)"; yeni sürüşlerde istenirse masraf defterine kendiliğinden.
// Kalıcı (araç başına, vehicles.js PER): settings.gecisSinifi ("1"…"6"). Genel: settings.tollAuto (varsayılan açık).
const TOLLS = (()=>{
  const SRC=["https://raw.githubusercontent.com/FOMC1R/obd-takip/main/data/tolls.json","data/tolls.json"];
  const R_M=70;            // gişe noktasına bu kadar yaklaşan GPS satırı "geçti" sayılır (gişede araç yavaşlar; 1 sn'lik iz)
  const MERGE_MS=180000;   // aynı gişedeki ardışık yakın satırlar tek geçiş
  const PAIR_MS=6*3600000; // kapalı sistemde giriş ile çıkış arası en çok
  let data=null;

  // KGM / işletmeci sınıfları (dingil sayısı ve dingil mesafesi): 1 otomobil ve dingil mesafesi 3,20 m'den kısa hafif
  // ticari, 2 dingil mesafesi 3,20 m ve üstü iki akslı (minibüs, kamyonet), 3 üç akslı / otobüs, 4 dört-beş akslı,
  // 5 altı ve üstü akslı, 6 motosiklet. Hız sınırındaki araç sınıfından yalnız öneri çıkar; kullanıcı değiştirebilir.
  const CLASS_NAMES={"1":"Sınıf 1 — otomobil, dingil mesafesi 3,20 m'den kısa hafif ticari",
    "2":"Sınıf 2 — iki akslı, dingil mesafesi 3,20 m ve üstü (minibüs, kamyonet)", "3":"Sınıf 3 — üç akslı, otobüs",
    "4":"Sınıf 4 — dört-beş akslı", "5":"Sınıf 5 — altı ve üstü akslı", "6":"Sınıf 6 — motosiklet"};
  const FROM_SPEED={otomobil:"1", panelvan:"1", kamyonet:"2", minibus:"2", otobus:"3", kamyon:"3", tehlikeli:"3", motosiklet:"6", motosiklet2:"6"};
  if(settings.gecisSinifi===undefined) settings.gecisSinifi=null;   // null: araç sınıfından öner
  if(settings.tollAuto===undefined) settings.tollAuto=true;
  const cls=()=>settings.gecisSinifi || FROM_SPEED[settings.aracSinifi] || "1";

  async function load(){
    for(const u of SRC){
      try{ const r=await fetch(u,{cache:"no-cache"}); if(!r.ok) continue; const d=await r.json();
        if(d && Array.isArray(d.yollar)){ data=d; paintSettings(); return d; } }catch(e){}
    }
    return data;
  }

  // ---- geometri ----
  function meters(a,b){ const kx=111320*Math.cos(a[0]*Math.PI/180); return Math.hypot((b[1]-a[1])*kx,(b[0]-a[0])*110540); }
  // GPS satırlarından gişe geçişleri: [{yol, gise, t}] zaman sırasıyla
  function passages(samples, D=data){
    const pts=(samples||[]).filter(s=>s.lat!=null && s.lon!=null && isFinite(s.lat) && isFinite(s.lon));
    if(!D || pts.length<2) return [];
    let la0=90,la1=-90,lo0=180,lo1=-180;
    for(const s of pts){ la0=Math.min(la0,s.lat); la1=Math.max(la1,s.lat); lo0=Math.min(lo0,s.lon); lo1=Math.max(lo1,s.lon); }
    const pad=0.01, out=[];
    for(const y of D.yollar){
      for(const g of y.gise||[]){
        for(const k of g.k||[]){
          if(k[0]<la0-pad || k[0]>la1+pad || k[1]<lo0-pad || k[1]>lo1+pad) continue;
          let best=null;
          for(const s of pts){
            const d=meters(k,[s.lat,s.lon]);
            if(d<=R_M){ if(best && s.t-best.t>MERGE_MS){ out.push(best); best=null; }
              if(!best || d<best.d) best={yol:y.id, gise:g.ad, t:s.t, d}; }
          }
          if(best) out.push(best);
        }
      }
    }
    out.sort((a,b)=>a.t-b.t);
    // aynı gişenin birden çok noktası (iki yön, şeritler) tek geçiş
    const ded=[]; for(const p of out){ const l=ded[ded.length-1]; if(l && l.yol===p.yol && l.gise===p.gise && p.t-l.t<MERGE_MS) continue; ded.push(p); }
    return ded;
  }
  function priceOf(y, a, b, c){
    const tab=y.ucret && y.ucret[c]; if(!tab) return null;
    return tab[a+"|"+b] ?? tab[b+"|"+a] ?? null;
  }
  function fixedOf(y, c, t){
    if(y.saatli){
      const h=new Date(t), m=h.getHours()*60+h.getMinutes();
      for(const k of Object.keys(y.saatli)){ const z=y.saatli[k], [s,e]=(z.saat||"").split("-").map(x=>{ const [hh,mm]=x.split(":").map(Number); return hh*60+(mm||0); });
        const inside = s<=e ? (m>=s && m<e) : (m>=s || m<e); if(inside && z[c]!=null) return {tl:z[c], not:k}; }
    }
    return y.sabit && y.sabit[c]!=null ? {tl:y.sabit[c]} : null;
  }
  // Geçişlerden ücretler: [{yol, ad, giris, cikis?, tl|null, t, not?}]
  function compute(samples, opt={}){
    const D=opt.data||data, c=opt.sinif||cls(); if(!D) return null;
    const ps=passages(samples, D), byId=Object.fromEntries(D.yollar.map(y=>[y.id,y])), res=[];
    let open=null;
    for(const p of ps){
      const y=byId[p.yol]; if(!y) continue;
      if(y.tip!=="kapali"){
        const f=fixedOf(y,c,p.t);
        res.push({yol:y.id, ad:y.ad, giris:p.gise, tl:f?f.tl:null, t:p.t, not:f&&f.not||null});
        continue;
      }
      if(open && open.yol===p.yol && p.gise!==open.gise && p.t-open.t<=PAIR_MS){
        res.push({yol:y.id, ad:y.ad, giris:open.gise, cikis:p.gise, tl:priceOf(y,open.gise,p.gise,c), t:open.t});
        open=null;
      }else{
        if(open) res.push({yol:open.yol, ad:byId[open.yol].ad, giris:open.gise, cikis:null, tl:null, t:open.t, not:"çıkış gişesi bulunamadı"});
        open=p;
      }
    }
    if(open) res.push({yol:open.yol, ad:byId[open.yol].ad, giris:open.gise, cikis:null, tl:null, t:open.t, not:"çıkış gişesi bulunamadı"});
    return {sinif:c, tarife:D.tarifeTarihi||null, gecis:res, toplam:res.reduce((s,x)=>s+(x.tl||0),0)};
  }

  // ---- masraf defteri ----
  function toExpenses(t, r){
    if(typeof Expenses==="undefined" || !r || !r.gecis.length || t.tollsExp) return 0;
    let n=0;
    for(const g of r.gecis){
      if(!(g.tl>0)) continue;
      const d=new Date(g.t), p2=x=>String(x).padStart(2,"0");
      const x=Expenses.add({date:`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`, type:"Otopark-Köprü", amount:g.tl,
        note:`${g.ad}: ${g.giris}${g.cikis?" → "+g.cikis:""} (tahmini, sınıf ${r.sinif})`});
      if(x){ x.src="gecis"; x.trip=t.id; n++; }
    }
    t.tollsExp=true; save();
    try{ Expenses.render(); }catch(e){}
    return n;
  }
  async function process(t, samples, auto){
    if(!data) await load();
    if(!data || t.demo) return null;
    const r=compute(samples); if(!r) return null;
    t.tolls=r;
    if(auto && settings.tollAuto) toExpenses(t, r);
    try{ await putTrip(t); }catch(e){}
    return r;
  }
  // Sürüş bitince (satırlar kaydedilmiş olur): hesapla, istenirse masrafa ekle
  on("tripEnd", t=>{ if(t.demo) return; setTimeout(async()=>{ try{ await process(t, await getSamples(t.id), true); }catch(e){} }, 300); });

  // ---- sürüş ayrıntısı kartı ----
  const card=document.createElement("section"); card.className="card"; card.id="tollCard"; card.hidden=true;
  card.innerHTML=`<h2>Geçiş ücretleri (tahmini)</h2><div id="tollBox"></div>`;
  $("ext-viewer").appendChild(card);
  let cur=null;
  function paintTrip(t){
    const r=t && t.tolls; card.hidden=!(r && r.gecis.length);
    if(card.hidden) return;
    const fmtT=ms=>new Date(ms).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    $("tollBox").innerHTML=`<dl class="kv">${r.gecis.map(g=>`<dt>${escHtml(fmtT(g.t))} · ${escHtml(g.ad)}</dt><dd>${escHtml(g.giris)}${g.cikis?" → "+escHtml(g.cikis):""}: <b>${g.tl!=null?fmt(g.tl,2)+" TL":"ücret bulunamadı"}</b>${g.not?` <span class="sub">(${escHtml(g.not)})</span>`:""}</dd>`).join("")}</dl>
      <p><b>Toplam: ${fmt(r.toplam,2)} TL</b> · sınıf ${escHtml(r.sinif)}${r.tarife?` · tarife ${escHtml(r.tarife)}`:""}</p>
      <p class="sub">GPS izinden hesaplanan tahmindir; HGS'nin kestiği tutar indirim, ihlal ya da tarife değişikliği yüzünden farklı olabilir.</p>
      ${t.tollsExp?'<p class="sub">Masraf defterine eklendi.</p>':(r.toplam>0?'<div class="actions"><button id="tollAdd">Masraf defterine ekle</button></div>':"")}`;
    const b=document.getElementById("tollAdd");
    if(b) b.addEventListener("click",async()=>{ toExpenses(t, r); try{ await putTrip(t); }catch(e){} paintTrip(t); });
  }
  on("tripOpen", async(t, samples)=>{
    cur=t; paintTrip(t);
    // eski sürüş: ilk açılışta geriye dönük hesap (masrafa kendiliğinden eklenmez; düğme çıkar)
    if(t.tolls===undefined && !t.demo){ const r=await process(t, samples||[], false); if(cur===t && r) paintTrip(t); }
  });

  // ---- ayar kartı (Ayarlar → Sürüş ve navigasyon) ----
  const sc=document.createElement("section"); sc.className="card"; sc.id="tollSet";
  sc.innerHTML=`<h2>Köprü ve otoyol ücretleri</h2>
    <p class="sub">Ücretli köprü, tünel ve otoyollardan geçince sürüş ayrıntısında tahmini ücret görünür. Hesap telefonda, GPS izinden yapılır; konum hiçbir yere gönderilmez.</p>
    <div class="field"><label for="tollCls">Geçiş sınıfı</label><select id="tollCls"></select></div>
    <label class="check"><input type="checkbox" id="tollAuto"> Yeni sürüşlerdeki geçişleri masraf defterine kendiliğinden ekle</label>
    <p class="sub" id="tollInfo"></p>`;
  $("ext-ayar").appendChild(sc);
  function paintSettings(){
    const s=$("tollCls"), auto=FROM_SPEED[settings.aracSinifi]||"1";
    s.innerHTML=`<option value="">Araç sınıfından (${escHtml(CLASS_NAMES[auto].split(" — ")[0])})</option>`+Object.entries(CLASS_NAMES).map(([k,n])=>`<option value="${k}">${escHtml(n)}</option>`).join("");
    s.value=settings.gecisSinifi||""; $("tollAuto").checked=!!settings.tollAuto;
    $("tollInfo").textContent = data ? `${data.yollar.length} köprü, tünel ve otoyol · tarife ${data.tarifeTarihi||"?"}. Gişe konumları © OpenStreetMap katkıcıları.` : "Ücret tablosu henüz yüklenmedi (internet gerekir).";
  }
  $("tollCls").addEventListener("change",e=>{ settings.gecisSinifi=e.target.value||null; save(); paintSettings(); });
  $("tollAuto").addEventListener("change",e=>{ settings.tollAuto=e.target.checked; save(); });
  { const ob=buildSettings; buildSettings=function(){ ob(); try{ paintSettings(); }catch(e){} }; }
  paintSettings();
  load();

  return {load, passages, compute, process, toExpenses, cls, CLASS_NAMES, FROM_SPEED, meters,
    get data(){ return data; }, set data(d){ data=d; }};
})();
