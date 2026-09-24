// ---------- Hız sınırı (Ayarlar → Hız sınırı) ----------
// Yasal sınırlar data/speedlimits.json'da durur. Yakıt fiyatlarındaki gibi uygulama her açılışta önce GitHub'daki
// güncel kopyayı, olmazsa sitenin kendi kopyasını okur ve son hâlini saklar. Yasalar seyrek değiştiği için
// dosya elle güncellenir (fiyatlardaki gibi günlük bir çekme işi yok); değişince tüm telefonlara kendiliğinden gelir.
const SPEEDLIM = (()=>{
  const SRC=["https://raw.githubusercontent.com/FOMC1R/obd-takip/main/data/speedlimits.json","data/speedlimits.json"];
  const CACHE_KEY="obdTakip.speedlimits";
  // İnternet hiç yokken ilk açılış için gömülü kopya (data/speedlimits.json ile aynı)
  const BUILTIN={surum:1, guncelleme:"2026-09-24",
    otomobil:{yerlesim:50, sehirlerarasi:90, bolunmus:110, otoyol:120},
    yolAdi:{yerlesim:"Yerleşim yeri içi", sehirlerarasi:"Şehirlerarası çift yönlü yol", bolunmus:"Bölünmüş yol", otoyol:"Otoyol"},
    otoyolNot:"Bazı otoyollarda sınır 130 ya da 140 km/sa'e çıkarıldı (İçişleri Bakanlığı, 1 Temmuz 2022). Haritada bu yollar genellikle kendi sınırıyla işaretlidir.",
    bolgeKodlari:{"TR:urban":"yerlesim","TR:rural":"sehirlerarasi","TR:trunk":"bolunmus","TR:dual_carriageway":"bolunmus","TR:motorway":"otoyol"},
    yolTuru:{motorway:"otoyol", motorway_link:"otoyol", residential:"yerlesim", living_street:"yerlesim"},
    ceza:{yerlesimIciBaslangic:6, yerlesimDisiBaslangic:11}};
  const valid=d=>d && d.otomobil && typeof d.otomobil.yerlesim==="number";
  let table=BUILTIN;
  try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); if(valid(c)) table=c; }catch(e){}

  async function load(){
    for(const u of SRC){
      try{
        const r=await fetch(u,{cache:"no-cache"}); if(!r.ok) continue;
        const d=await r.json(); if(!valid(d)) continue;
        table=d; try{ localStorage.setItem(CACHE_KEY,JSON.stringify(d)); }catch(e){}
        paint(); return d;
      }catch(e){}
    }
    return table;
  }
  // Harita kodundan ("TR:urban") ya da yol türünden yasal sınır
  function legalFor(key){ const v=key && table.otomobil[key]; return v ? {v, tur:key, ad:(table.yolAdi||{})[key]||key} : null; }

  // ---------- Bulunduğun yolun sınırı (isteğe bağlı, varsayılan kapalı) ----------
  // Açıksa konum, araç ilerledikçe OpenStreetMap'in Overpass sunucusuna gönderilir ve en yakın yolun
  // maxspeed etiketi okunur. Etiket yoksa yol türü/bölge kodundan yasal sınır, o da yoksa elle girilen sınır.
  // Konum yalnızca bu isteğe gider; ayarlara, kayda ya da tanılama paketine yazılmaz.
  if(!settings.speedLim) settings.speedLim={};
  if(settings.speedLim.mode===undefined) settings.speedLim.mode="ayar";   // "ayar" | "yol"
  if(settings.speedLim.tol===undefined) settings.speedLim.tol="0";        // "0" | "5" | "10" | "ceza"
  const OVERPASS="https://overpass-api.de/api/interpreter";
  const EVERY_MS=20000, EVERY_M=200, RADIUS=30, MAX_AGE=90000, MAX_AWAY=600, MAX_ACC=60;
  const HW="motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service";
  const R={road:null, lastQ:null, busy:false, fails:0, backoff:0, watch:null, fix:null, key:"", requests:0};
  const onRoad=()=>settings.speedLim.mode==="yol";

  // "50", "90 mph", "TR:urban", "none"… → {v, tur?} ya da null
  function speedFromTag(s){
    if(s==null) return null;
    const first=String(s).split(";")[0].trim();
    const m=first.match(/^(\d+(?:[.,]\d+)?)\s*(mph|km\/h|kmh)?$/i);
    if(m){ const n=parseFloat(m[1].replace(",",".")); if(!(n>0)) return null; return {v: m[2] && /mph/i.test(m[2]) ? Math.round(n*1.609) : Math.round(n)}; }
    const z=(table.bolgeKodlari||{})[first], L=legalFor(z);
    return L ? {v:L.v, tur:z} : null;
  }
  function limitOfWay(tags){
    tags=tags||{};
    let r=speedFromTag(tags.maxspeed);
    if(!r){ const f=speedFromTag(tags["maxspeed:forward"]), b=speedFromTag(tags["maxspeed:backward"]);
      if(f || b) r = f && b ? (f.v<=b.v ? f : b) : (f || b); }
    if(r) return {v:r.v, kaynak:r.tur ? "yasal" : "yol", tur:r.tur};
    for(const k of ["maxspeed:type","source:maxspeed","zone:maxspeed"]){ const z=speedFromTag(tags[k]); if(z && z.tur) return {v:z.v, kaynak:"yasal", tur:z.tur}; }
    const t=(table.yolTuru||{})[tags.highway], L=legalFor(t);
    return L ? {v:L.v, kaynak:"yasal", tur:t} : null;
  }
  // Noktanın yol çizgisine en kısa uzaklığı (metre, küçük alanda düz kabul)
  function distToWay(p, geom){
    if(!geom || !geom.length) return Infinity;
    const kx=111320*Math.cos(p.lat*Math.PI/180), ky=110540;
    const X=g=>(g.lon-p.lon)*kx, Y=g=>(g.lat-p.lat)*ky;
    if(geom.length===1) return Math.hypot(X(geom[0]),Y(geom[0]));
    let best=Infinity;
    for(let i=0;i<geom.length-1;i++){
      const ax=X(geom[i]), ay=Y(geom[i]), dx=X(geom[i+1])-ax, dy=Y(geom[i+1])-ay, L2=dx*dx+dy*dy;
      const t=L2 ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L2)) : 0;
      best=Math.min(best, Math.hypot(ax+t*dx, ay+t*dy));
    }
    return best;
  }
  // En yakın yol; otopark/servis yolu yalnızca başka yol yoksa. Sınırı bilinen yol 8 m içindeyse o seçilir.
  function pickWay(elements, p){
    let ways=(elements||[]).filter(e=>e.type==="way" && e.tags && e.geometry);
    if(ways.some(w=>w.tags.highway!=="service")) ways=ways.filter(w=>w.tags.highway!=="service");
    const list=ways.map(w=>({w, d:distToWay(p,w.geometry), lim:limitOfWay(w.tags)})).sort((a,b)=>a.d-b.d);
    if(!list.length) return null;
    const known=list.find(x=>x.lim && x.d<=list[0].d+8);
    const c=known || list[0];
    return c.lim ? Object.assign({}, c.lim, {ad:c.w.tags.name || c.w.tags.ref || "", d:Math.round(c.d)}) : null;
  }

  function fixNow(t){
    const f=(typeof REC!=="undefined" && REC.fix && t-REC.fix.t<15000) ? REC.fix : (R.fix && t-R.fix.t<15000 ? R.fix : null);
    return f && (f.acc==null || f.acc<=MAX_ACC) ? f : null;
  }
  function changed(){
    const n=now(), k=[n.v,n.kaynak,n.yer||""].join("|");
    if(k!==R.key){ R.key=k; emit("speedLimit", n); }
    paintNow();
  }
  async function query(p, t){
    R.busy=true; R.lastQ={t, pos:{lat:p.lat, lon:p.lon}}; R.requests++;
    const q=`[out:json][timeout:10];way(around:${RADIUS},${p.lat.toFixed(5)},${p.lon.toFixed(5)})["highway"~"^(${HW})$"];out tags geom;`;
    let ctl=null, timer=null;
    try{
      if(typeof AbortController==="function"){ ctl=new AbortController(); timer=setTimeout(()=>ctl.abort(),12000); }
      // POST: konum adres satırına (URL) yazılmaz; basit form isteği olduğu için ön-izin (CORS) sorgusu da gerekmez
      const r=await fetch(OVERPASS,{method:"POST", body:"data="+encodeURIComponent(q),
        headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ctl?ctl.signal:undefined});
      if(!r.ok) throw new Error("Overpass "+r.status);
      const d=await r.json();
      const w=pickWay(d.elements, p);
      R.road = w ? Object.assign(w, {at:t, pos:{lat:p.lat, lon:p.lon}}) : null;
      R.fails=0; R.backoff=0;
    }catch(e){
      R.fails++; R.backoff=t+Math.min(300000, 30000*2**(R.fails-1));   // meşgul/erişilemez: giderek seyrek dene
    }finally{ clearTimeout(timer); R.busy=false; changed(); }
  }
  // Her okuma turunda çağrılır; gerçek istek en çok 20 sn'de bir ve 200 m yer değişince
  function poll(t=Date.now()){
    if(!onRoad()) return;
    const p=fixNow(t);
    if(R.road && (t-R.road.at>MAX_AGE || (p && haversine(R.road.pos,p)>MAX_AWAY))){ R.road=null; changed(); }
    if(!p || R.busy || t<R.backoff) return;
    if(R.lastQ && (t-R.lastQ.t<EVERY_MS || haversine(R.lastQ.pos,p)<EVERY_M)) return;
    return query(p, t);
  }
  function startWatch(){
    if(R.watch!=null || !onRoad() || !S.active || S.link instanceof DemoLink) return;
    if(typeof navigator==="undefined" || !navigator.geolocation) return;
    try{ R.watch=navigator.geolocation.watchPosition(
      p=>{ R.fix={lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy, t:Date.now()}; },
      ()=>{}, {enableHighAccuracy:true, maximumAge:2000, timeout:20000}); }catch(e){}
  }
  function stopWatch(){
    try{ if(R.watch!=null) navigator.geolocation.clearWatch(R.watch); }catch(e){}
    R.watch=null; R.fix=null;
  }
  function reset(){ stopWatch(); R.road=null; R.lastQ=null; R.fails=0; R.backoff=0; changed(); }

  // Şu an geçerli sınır: {v, kaynak:"yol"|"yasal"|"ayar", yer?, tur?}
  function now(){
    if(onRoad() && R.road) return {v:R.road.v, kaynak:R.road.kaynak, yer:R.road.ad||"", tur:R.road.tur};
    const L=settings.lim["0D"]; return {v:L && L.max!=null ? L.max : null, kaynak:"ayar"};
  }
  function tolFor(v){
    const t=settings.speedLim.tol, C=table.ceza||{yerlesimIciBaslangic:6, yerlesimDisiBaslangic:11};
    if(t==="ceza") return (v<=50 ? C.yerlesimIciBaslangic : C.yerlesimDisiBaslangic)-1;
    return parseInt(t,10)||0;
  }
  // Çekirdekteki hız uyarısı: yol sınırı biliniyorsa ona göre (özellik kapalıyken hiçbir şey değişmez)
  const baseLimOf=limOf;
  limOf=pid=>{
    const L=baseLimOf(pid);
    if(pid!=="0D" || !onRoad() || !R.road) return L;
    return Object.assign({}, L, {max:R.road.v+tolFor(R.road.v)});
  };

  // ---- arayüz ----
  const card=document.createElement("section"); card.className="card"; card.id="speedLimCard";
  card.innerHTML=`<h2>Hız sınırı</h2>
    <div class="field"><label for="slMode">Hız uyarısı hangi sınıra göre verilsin?</label>
      <select id="slMode"><option value="ayar">Elle girdiğim sınır (Sınırlar tablosu)</option><option value="yol">Bulunduğum yolun sınırı (haritadan)</option></select></div>
    <p class="sub" id="slPriv">Açarsan konumun, araç ilerledikçe en çok 20 saniyede bir OpenStreetMap'in sunucusuna gönderilir; başka hiçbir yere gitmez ve kaydedilmez. Haritada yolun sınırı yoksa yol türüne göre yasal sınır, o da bilinmiyorsa elle girdiğin sınır kullanılır.</p>
    <div class="field" id="slTolBox"><label for="slTol">Ne zaman uyarsın?</label>
      <select id="slTol"><option value="0">Sınır geçilince</option><option value="5">Sınırın 5 km/sa üstünde</option><option value="10">Sınırın 10 km/sa üstünde</option><option value="ceza">Ceza başlamadan hemen önce (şehir içi +5, dışı +10)</option></select></div>
    <p class="sub" id="slNow" role="status"></p>
    <details><summary>Yasal sınırlar (otomobil)</summary><dl class="kv" id="slTable"></dl><p class="sub" id="slNote"></p></details>`;
  $("ext-ayar").appendChild(card);
  const selStyle="font:inherit;width:100%;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--text)";
  ["slMode","slTol"].forEach(id=>{ const e=$(id); if(e && e.setAttribute) e.setAttribute("style",selStyle); });
  function paintNow(){
    const n=now(), el=$("slNow");
    $("slTolBox").hidden=!onRoad();
    if(!onRoad()){ el.textContent=n.v ? `Şu an ${n.v} km/sa'i geçince uyarır.` : "Hız uyarısı kapalı (Sınırlar tablosunda üst sınır yok)."; return; }
    if(!S.active){ el.textContent="Araca bağlanınca bulunduğun yolun sınırı burada görünür."; return; }
    if(n.kaynak==="ayar"){ el.textContent=`Yolun sınırı henüz bilinmiyor; elle girdiğin ${n.v ?? "—"} km/sa kullanılıyor.`; return; }
    const where=n.yer ? n.yer+" · " : "", from=n.kaynak==="yol" ? "haritadaki tabela" : "yol türüne göre yasal sınır";
    el.textContent=`Şu an: ${where}${n.v} km/sa (${from}).`;
  }
  function paint(){
    const T=table, rows=["yerlesim","sehirlerarasi","bolunmus","otoyol"].filter(k=>T.otomobil[k]).map(k=>[(T.yolAdi||{})[k]||k, T.otomobil[k]+" km/sa"]);
    kv($("slTable"), rows);
    $("slNote").textContent=[T.otoyolNot, T.guncelleme ? "Tablo tarihi: "+new Date(T.guncelleme).toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"}) : ""].filter(Boolean).join(" ");
    $("slMode").value=settings.speedLim.mode; $("slTol").value=settings.speedLim.tol;
    paintNow();
  }
  $("slMode").addEventListener("change",e=>{ settings.speedLim.mode=e.target.value; save(); reset(); if(onRoad()) startWatch(); paint(); });
  $("slTol").addEventListener("change",e=>{ settings.speedLim.tol=e.target.value; save(); paintNow(); });
  on("connect",()=>{ startWatch(); paintNow(); });
  on("disconnect",()=>reset());
  on("tick",()=>{ poll(Date.now()); });

  paint();
  load();
  const api={load, legalFor, now, poll, reset, speedFromTag, limitOfWay, pickWay, distToWay, tolFor,
    get table(){ return table; }, set table(d){ table=d; },
    get state(){ return {road:R.road, requests:R.requests, lastQ:R.lastQ, backoff:R.backoff, watch:R.watch}; }};
  try{ window.SPEEDLIM=api; }catch(e){}
  return api;
})();
