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
      if(y.ikiNokta){ const p=twoPoint(y, pts); if(p) out.push(p); continue; }
      for(const g of y.gise||[]){
        for(const k of g.k||[]){
          if(k[0]<la0-pad || k[0]>la1+pad || k[1]<lo0-pad || k[1]>lo1+pad) continue;
          let best=null; const R=g.r||R_M;   // g.r: yaklaşık konum (kavşaktan) için daha geniş yarıçap
          for(const s of pts){
            const d=meters(k,[s.lat,s.lon]);
            if(d<=R){ if(best && s.t-best.t>MERGE_MS){ out.push(best); best=null; }
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
  // Tünel: GPS içeride çekmez; iki ağzın ikisine de 20 dk içinde yaklaşılmışsa geçilmiş sayılır
  // (yalnız birinin yanından geçen şehir trafiği sayılmasın)
  function twoPoint(y, pts){
    const g=(y.gise||[])[0]; if(!g || !g.k || g.k.length<2) return null;
    const hits=g.k.map(k=>pts.filter(s=>meters(k,[s.lat,s.lon])<=R_M).map(s=>s.t));
    for(const a of hits[0]) for(const b of hits[1]) if(Math.abs(a-b)<=20*60000) return {yol:y.id, gise:g.ad, t:Math.min(a,b), d:0};
    return null;
  }
  // Tarife: sürüş, yolun güncel tarifesinden önceyse ve eski tarife varsa o (ör. YİD'de 1 Temmuz 2026 zammı)
  const tariff=(y,t)=>(y.onceki && y.tarih && t<Date.parse(y.tarih)) ? y.onceki : y;
  // Kapalı sistem ücret ızgarası: m[sınıf] = n×n dizi (satır giriş, sütun çıkış; gişe sırası y.gise). Yön önemli
  // (bazı çiftlerde gidiş-dönüş farklı); tek yönlü yazılmış tabloda ters yöne bakılır.
  function priceOf(y, a, b, c, t){
    const T=tariff(y,t), m=T.m && T.m[c]; if(!m) return null;
    // a, b tablo sütun adları (yöne göre ad çözülmüş olarak gelir: compute → adGiris / adCikis)
    const n=y.gise.length, i=y.gise.findIndex(g=>g.ad===a), j=y.gise.findIndex(g=>g.ad===b);
    if(i<0 || j<0) return null;
    return m[i*n+j] ?? m[j*n+i] ?? null;
  }
  function fixedOf(y0, c, t){
    const y=tariff(y0,t);
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
    // Kapalı sistemde yalnız iki gişeden geçilir: aynı yolda arka arkaya görülen geçişlerin İLKİ giriş, SONUNCUSU çıkış.
    // Aradakiler yok sayılır (ana yolun yanındaki gişe noktaları, kavşaktan yaklaşık konumlar). 45 dk'dan uzun ara = yeni oturum.
    const dangling=o=>({yol:o.yol, ad:byId[o.yol].ad, giris:o.gise, cikis:null, tl:null, t:o.t, not:"çıkış gişesi bulunamadı"});
    const sess={};
    for(const p of ps){
      const y=byId[p.yol]; if(!y) continue;
      if(y.tip!=="kapali"){
        const f=fixedOf(y,c,p.t);
        res.push({yol:y.id, ad:y.ad, giris:p.gise, tl:f?f.tl:null, t:p.t, not:f&&f.not||null});
        continue;
      }
      const list=sess[p.yol]||(sess[p.yol]=[]), cur=list[list.length-1];
      if(cur && p.t-cur[cur.length-1].t<=45*60000 && p.t-cur[0].t<=PAIR_MS) cur.push(p); else list.push([p]);
    }
    for(const id in sess) for(const ss of sess[id]){
      const y=byId[id], o=ss[0], e=ss[ss.length-1];
      if(o.gise===e.gise){ res.push(dangling(o)); continue; }
      const gi=y.gise.find(g=>g.ad===o.gise)||{}, go=y.gise.find(g=>g.ad===e.gise)||{};
      const a=gi.adGiris||o.gise, b=go.adCikis||e.gise;
      res.push({yol:y.id, ad:y.ad, giris:a, cikis:b, tl:priceOf(y,a,b,c,o.t), t:o.t, t2:e.t, not:(gi.r||go.r)?"yaklaşık (gişe konumu kavşaktan)":null});
    }
    res.sort((a,b)=>a.t-b.t);
    // Aynı yerde iki yolun gişesi olabilir (ör. Kurtköy: Anadolu Otoyolu ve Kuzey Marmara). Bir yolda eşleşmiş geçişle aynı
    // dakikalarda öbür yolda yarım kalan "giriş" hayalettir: atılır.
    for(let i=res.length-1;i>=0;i--){ const r=res[i]; if(r.cikis!==null || r.tl!==null || byId[r.yol].tip!=="kapali") continue;
      if(res.some(x=>x!==r && x.yol!==r.yol && x.cikis && (Math.abs(x.t-r.t)<=180000 || Math.abs((x.t2||x.t)-r.t)<=180000))) res.splice(i,1); }
    // Ücreti başka bir tabloya dahil olan köprü (ör. YSS → Kuzey Marmara; Osmangazi → O-5 İstanbul yönü çıkışı) ayrıca sayılmaz
    for(const r of res){
      const y=byId[r.yol]; if(!y || !y.dahil || r.tl==null) continue;
      if(y.dahil.some(d=>res.some(x=>x!==r && x.yol===d.yol && x.tl!=null && (!d.cikis || x.cikis===d.cikis) && r.t>=x.t-600000 && r.t<=(x.t2||x.t)+600000))){
        r.not="ücreti otoyol ücretine dahil"; r.tl=0; }
    }
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
        note:`${g.ad}: ${nice(g.giris)}${g.cikis?" → "+nice(g.cikis):""} (tahmini, sınıf ${r.sinif})`});
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
  // KGM tabloları adları büyük harfle yazar ("ANADOLU (ÇAMLICA)") → "Anadolu (Çamlıca)"
  const nice=s=>{
    if(!s || s!==s.toLocaleUpperCase("tr-TR")) return s;
    const w=s.toLocaleLowerCase("tr-TR").split(/([\s()\-.\/]+)/);   // ayraçlar da dizide kalır
    return w.map(x=>!x || /^[\s()\-.\/]+$/.test(x) ? x : (x==="osb" ? "OSB" : x[0].toLocaleUpperCase("tr-TR")+x.slice(1))).join("");
  };
  function paintTrip(t){
    const r=t && t.tolls; card.hidden=!(r && r.gecis.length);
    if(card.hidden) return;
    const fmtT=ms=>new Date(ms).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    $("tollBox").innerHTML=`<dl class="kv">${r.gecis.map(g=>`<dt>${escHtml(fmtT(g.t))} · ${escHtml(g.ad)}</dt><dd>${escHtml(nice(g.giris))}${g.cikis?" → "+escHtml(nice(g.cikis)):""}: <b>${g.tl!=null?fmt(g.tl,2)+" TL":"ücret bulunamadı"}</b>${g.not?` <span class="sub">(${escHtml(g.not)})</span>`:""}</dd>`).join("")}</dl>
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

  return {load, passages, compute, process, toExpenses, cls, nice, CLASS_NAMES, FROM_SPEED, meters,
    get data(){ return data; }, set data(d){ data=d; }};
})();
