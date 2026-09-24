// ---------- İstatistik (5. sekme) ----------
// Kayıtlı sürüşlerin özetini dönem dönem gösterir: toplam km, süre, yakıt ve maliyet, tüketim eğilimi,
// hangi saatlerde sürüldüğü, sürüş uzunlukları, rekorlar, uyarı ve arıza geçmişi. En önemli bölüm
// "Araç sağlığı eğilimleri": her sürüşten birkaç ölçü (trip.metrics) çıkarılır ve sürüşler boyunca
// yavaş bir kayma (ör. şarj voltajının her sürüşte biraz düşmesi) aranır.
//
// trip.metrics = {mv, vRun, ltft, coolMax, coolStart, warmupMin, idlePct, runMin}
//   vRun      motor çalışırken (devir > 500) ortalama akü/şarj voltajı, V  (pid 42)
//   ltft      motor çalışırken uzun süreli yakıt ayarı ortalaması, %      (pid 07)
//   coolMax   en yüksek soğutma suyu sıcaklığı, °C                        (pid 05)
//   coolStart ilk okunan su sıcaklığı, °C
//   warmupMin soğuk çalıştırmada (ilk 2 dk içinde okunan su < 40 °C) suyun 80 °C'ye çıkma süresi, dk
//   idlePct   motor çalışma süresinin rölantide (devir > 500, hız < 3 km/sa) geçen yüzdesi
//   runMin    motorun çalıştığı süre, dk
// Yeni sürüşte "sample" kancasıyla toplamlar tutulur, "tripEnd"te yazılır (örnekler yeniden okunmaz).
// Eski sürüşler arka planda, tek tek, getSamples ile hesaplanıp putTrip ile saklanır.
// Görünüm yalnızca sürüş özetlerini kullanır; yüzlerce sürüşte de hızlıdır. Deneme sürüşleri hiç sayılmaz.
const STATS = (()=>{
  const MV = 1;                 // ölçü tanımı değişirse artır: eski ölçüler yeniden hesaplanır
  const DAY = 86400000;
  const DRIFT_N = 10, DRIFT_MIN = 5;   // eğilim için son 10 sürüş; en az 5 sürüş yoksa yorum yok
  const PERIODS = [["hafta","Bu hafta"],["ay","Bu ay"],["3ay","Son 3 ay"],["yil","Bu yıl"],["tumu","Tümü"]];
  const PREV_TXT = {hafta:"geçen haftanın aynı günlerine", ay:"geçen ayın aynı günlerine", "3ay":"önceki 3 aya", yil:"geçen yılın aynı dönemine"};
  const WD = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  const WD_LONG = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  if(settings.statsPeriod===undefined) settings.statsPeriod="3ay";
  const st = {veh:null, busy:false, token:0, backfill:{running:false, done:0, total:0}, trips:null};

  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const tripKm=t=>t.distance ? t.distance/1000 : (t.odo||0);
  const dShort=ms=>new Date(ms).toLocaleDateString("tr-TR",{day:"numeric",month:"short"});
  const dLong=ms=>new Date(ms).toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"});
  const mean=a=>a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
  const r1=v=>v==null ? null : Math.round(v*10)/10, r2=v=>v==null ? null : Math.round(v*100)/100;
  const elecPrice=()=>settings.fuel==="elektrik" ? settings.price : ((typeof FUEL_PRICE!=="undefined" && FUEL_PRICE.elektrik) || 0);

  // ================= 1) Sürüş başına ölçüler =================
  function newAcc(id){ return {id, firstT:null, lastT:null, runS:0, idleS:0, vS:0, vN:0, lS:0, lN:0,
    coolMax:null, coolStart:null, coolStartT:null, t80:null, n:0}; }
  function feed(a,row){
    const v=row.v||{}, t=row.t, rpm=v["0C"], sp=v["0D"], volt=v["42"], lt=v["07"], cool=v["05"];
    if(a.firstT==null) a.firstT=t;
    const dt = a.lastT!=null ? Math.max(0,Math.min(5,(t-a.lastT)/1000)) : 0;   // boşluklar süreyi şişirmesin
    a.lastT=t; a.n++;
    if(rpm!=null && rpm>500){
      a.runS+=dt; if(sp!=null && sp<3) a.idleS+=dt;
      if(volt!=null){ a.vS+=volt; a.vN++; }
      if(lt!=null){ a.lS+=lt; a.lN++; }
    }
    if(cool!=null){
      if(a.coolStart==null){ a.coolStart=cool; a.coolStartT=t; }
      a.coolMax = a.coolMax==null ? cool : Math.max(a.coolMax,cool);
      if(a.t80==null && cool>=80) a.t80=t;
    }
  }
  function finish(a){
    const cold = a.coolStart!=null && a.coolStart<40 && a.coolStartT-a.firstT<=120000;
    return {mv:MV,
      vRun: a.vN>=5 ? r2(a.vS/a.vN) : null,
      ltft: a.lN>=3 ? r1(a.lS/a.lN) : null,
      coolMax: a.coolMax, coolStart: a.coolStart,
      warmupMin: cold && a.t80!=null ? r1((a.t80-a.firstT)/60000) : null,
      idlePct: a.runS>=60 ? r1(a.idleS/a.runS*100) : null,
      runMin: r1(a.runS/60)};
  }
  function metricsFrom(samples){
    const a=newAcc(null);
    [...samples].sort((x,y)=>x.t-y.t).forEach(r=>feed(a,r));
    return finish(a);
  }
  let acc=null;
  on("sample",(row,t)=>{ if(!acc || acc.id!==t.id) acc=newAcc(t.id); feed(acc,row); });
  on("tripEnd",t=>{
    // Sürüşün o günkü fiyatı: sonradan fiyat değişse de maliyet doğru kalsın
    if(t.fuel>0 && settings.fuel!=="elektrik" && settings.price>0) t.price=settings.price;
    if(t.kwh!=null && elecPrice()>0) t.priceKwh=elecPrice();
    if(acc && acc.id===t.id && acc.n){ t.metrics=finish(acc); }
    acc=null;
    if(isShown()) setTimeout(render,600);
  });

  // Eski sürüşler: arka planda, tek tek, arayüzü kilitlemeden
  const needsMetrics=t=>!t.demo && t.samples>0 && !(REC.trip && REC.trip.id===t.id) && !(t.metrics && t.metrics.mv===MV);
  async function getTrip(id){ return idb((await os("trips")).get(id)); }
  function backfill(opts={}){
    const b=st.backfill; if(b.running) return b.promise;
    b.running=true;
    return b.promise=runBackfill(opts);
  }
  async function runBackfill(opts){
    const b=st.backfill; let n=0;
    try{
      const todo=(await getTrips()).filter(needsMetrics);
      b.total=todo.length; b.done=0;
      for(const t0 of todo){
        const smp=await getSamples(t0.id);
        const t=await getTrip(t0.id); if(!t) continue;     // bu arada silinmiş olabilir
        t.metrics=metricsFrom(smp);
        await putTrip(t); n++; b.done++;
        if(st.trips){ const i=st.trips.findIndex(x=>x.id===t.id); if(i>=0) st.trips[i]=t; }
        if(!opts.fast) await new Promise(r=>setTimeout(r,30));   // arayüze nefes aldır
        if(isShown() && b.done%5===0) paintProgress();
      }
    }finally{ b.running=false; }
    if(n && isShown()) render();
    return n;
  }

  // ================= 2) Dönem, araç, süzme =================
  function period(key, now=Date.now()){
    const d=new Date(now); let from, prevFrom=null, prevTo=null, bucket;
    if(key==="hafta"){
      const s=new Date(d.getFullYear(),d.getMonth(),d.getDate()); s.setDate(s.getDate()-(s.getDay()+6)%7);
      from=+s; const p=new Date(s); p.setDate(p.getDate()-7); prevFrom=+p; prevTo=Math.min(prevFrom+(now-from),from); bucket="day";
    }else if(key==="ay"){
      from=+new Date(d.getFullYear(),d.getMonth(),1); prevFrom=+new Date(d.getFullYear(),d.getMonth()-1,1);
      prevTo=Math.min(prevFrom+(now-from),from); bucket="week";
    }else if(key==="3ay"){
      from=now-90*DAY; prevFrom=now-180*DAY; prevTo=from; bucket="week";
    }else if(key==="yil"){
      from=+new Date(d.getFullYear(),0,1); prevFrom=+new Date(d.getFullYear()-1,0,1);
      prevTo=Math.min(prevFrom+(now-from),from); bucket="month";
    }else{ key="tumu"; from=-Infinity; bucket="month"; }
    return {key, from, to:now, prevFrom, prevTo, bucket};
  }
  const inRange=(t,a,b)=>t.start>=a && t.start<b;

  // Araç profilleri (başka bir eklenti ekler): settings.vehicles + settings.activeVehicle, sürüşte trip.vehicle
  function vehicles(){
    const v=settings.vehicles; if(!v || typeof v!=="object") return [];
    const arr=Array.isArray(v) ? v : Object.entries(v).map(([k,x])=>Object.assign({id:k},x));
    return arr.filter(x=>x && typeof x==="object").map((x,i)=>{
      const vin=x.vin ? String(x.vin) : "";
      return {key:String(x.id ?? x.key ?? (vin ? vin.slice(0,11) : i)), vin, name:String(x.name||x.label||x.ad||x.model||("Araç "+(i+1)))};
    });
  }
  const profilesOn=()=>settings.activeVehicle!=null && settings.activeVehicle!=="" && vehicles().length>0;
  function vehOf(key){ const k=String(key); return vehicles().find(v=>v.key===k || (v.vin && (v.vin===k || v.vin.slice(0,11)===k))) || null; }
  function currentVeh(){ if(!profilesOn()) return "*"; return st.veh ?? (vehOf(settings.activeVehicle)||{key:String(settings.activeVehicle)}).key; }
  function matchVeh(t,key){
    if(key==="*" || key==null) return true;
    if(t.vehicle==null) return vehicles().length<=1;   // profil öncesi kayıtlar: tek araç varsa ona aittir
    const v=vehOf(key); const tv=String(t.vehicle);
    return tv===key || (!!v && !!v.vin && (tv===v.vin.slice(0,11) || tv===v.vin));
  }
  // Sayılacak sürüşler: deneme değil, şu an sürmüyor, seçili araca ait
  function scope(trips, vehKey=currentVeh()){
    return trips.filter(t=>!t.demo && !(REC.trip && REC.trip.id===t.id) && matchVeh(t,vehKey));
  }

  // Dönemin sürüşleri (eskiden yeniye) ve karşılaştırılacak önceki eşit dönem
  function select(all, key, now=Date.now(), vehKey=currentVeh()){
    const p=period(key, now), scoped=scope(all, vehKey);
    const cur=scoped.filter(t=>inRange(t,p.from,p.to+1)).sort((a,b)=>a.start-b.start);
    const prev=p.prevFrom!=null ? scoped.filter(t=>inRange(t,p.prevFrom,p.prevTo)) : null;
    return {p, scoped, cur, prev};
  }

  // ================= 3) Özet =================
  function summary(trips){
    const s={n:trips.length, km:0, ms:0, fuel:0, fuelKm:0, cost:0, kwh:0, kwhKm:0, ecost:0, hasKwh:false, hasFuel:false, scores:[]};
    for(const t of trips){
      const k=tripKm(t); s.km+=k; s.ms+=Math.max(0,(t.end||t.start)-t.start);
      if(t.fuel>0){ s.hasFuel=true; s.fuel+=t.fuel; s.fuelKm+=k; s.cost+=t.fuel*(t.price ?? settings.price ?? 0); }
      if(t.kwh!=null){ s.hasKwh=true; const e=Math.max(0,t.kwh); s.kwh+=e; s.kwhKm+=k; s.ecost+=e*(t.priceKwh ?? elecPrice()); }
      if(typeof t.score==="number") s.scores.push(t.score);
    }
    s.l100 = s.fuelKm>=1 ? s.fuel/s.fuelKm*100 : null;
    s.kwh100 = s.kwhKm>=1 ? s.kwh/s.kwhKm*100 : null;
    s.speed = s.ms>=60000 ? s.km/(s.ms/3600000) : null;
    s.score = s.scores.length ? mean(s.scores) : null;
    return s;
  }
  const pct=(a,b)=>a==null || b==null || !(b>0) ? null : (a-b)/b*100;

  // ================= 4) Eğilim ve yorum =================
  function drift(vals, N=DRIFT_N){
    const pts=vals.filter(v=>v!=null && isFinite(v)).slice(-N), n=pts.length;
    if(n<DRIFT_MIN) return {n, enough:false};
    const xm=(n-1)/2, ym=mean(pts); let sxy=0, sxx=0;
    pts.forEach((y,i)=>{ sxy+=(i-xm)*(y-ym); sxx+=(i-xm)**2; });
    const slope=sxy/sxx, h=Math.floor(n/2);
    return {n, enough:true, slope, a:ym-slope*xm, change:slope*(n-1),
      halfDiff:mean(pts.slice(n-h))-mean(pts.slice(0,h)), last:mean(pts.slice(-5)), max:Math.max(...pts), min:Math.min(...pts)};
  }
  const HEALTH = [
    {key:"vRun", name:"Şarj voltajı (motor çalışırken)", unit:"V", dec:2, band:[13.2,14.8],
      note:"Motor çalışırken alternatör (şarj dinamosu) aküyü doldurur; 13,2–14,8 V beklenir. Bazı yeni araçlar yakıt tasarrufu için bu değeri 12,5–15 V arasında oynatır."},
    {key:"ltft", name:"Uzun süreli yakıt ayarı", unit:"%", dec:1, band:[-10,10],
      note:"Motor beyninin karışıma kalıcı olarak eklediği (+) ya da kıstığı (−) yakıt. 0'a yakın olması iyidir."},
    {key:"coolMax", name:"En yüksek su sıcaklığı", unit:"°C", dec:0, band:[80,105],
      note:"En az 10 dakika çalışan sürüşler. Çoğu motor 85–100 °C'de çalışır."},
    {key:"warmupMin", name:"Isınma süresi (80 °C'ye)", unit:"dk", dec:1, band:[2,15],
      note:"Yalnızca soğuk çalıştırmalar (su 40 °C'nin altındayken). Soğuk havada uzaması normaldir."},
    {key:"idlePct", name:"Rölantide geçen süre", unit:"%", dec:0, band:[0,30],
      note:"Motor çalışırken aracın durduğu sürenin payı. Yüksekse trafikte bekleme ya da ısıtmak için çalıştırma çoktur."},
  ];
  const f1=(v,d)=>fmt(v,d);
  const sgn=(v,d)=>(v>0?"+":v<0?"−":"")+fmt(Math.abs(v),d);
  // Yorum: yeterli veri yoksa hiçbir hüküm vermez
  function verdict(key, vals){
    const d=drift(vals);
    if(!d.enough) return {level:"info", d, text:`Yorum için en az ${DRIFT_MIN} sürüşte bu ölçü gerekli (şimdilik ${d.n}).`};
    const n=d.n, L=`Son ${n} sürüşte`;
    if(key==="vRun"){
      if(d.last<13.0) return {level:"no", d, text:`${L} şarj voltajı ortalama ${f1(d.last,2)} V — beklenenden düşük. Akü ve alternatör kontrol ettirilmeli.`};
      if(d.last>15.0) return {level:"no", d, text:`${L} şarj voltajı ortalama ${f1(d.last,2)} V — yüksek. Voltaj düzenleyici (regülatör) kontrol ettirilmeli.`};
      if(d.change<=-0.2 && d.halfDiff<=-0.1) return {level:"no", d, text:`${L} şarj voltajı ortalama ${f1(-d.change,1)} V düştü — akü/alternatör kontrolü önerilir.`};
      return {level:"ok", d, text:`${L} ortalama ${f1(d.last,2)} V — normal, belirgin bir değişim yok.`};
    }
    if(key==="ltft"){
      if(Math.abs(d.last)>10) return {level:"no", d, text:`${L} yakıt ayarı ortalama ${sgn(d.last,1)} % — normal aralığın dışında. `+
        (d.last>0 ? "Motor fazladan yakıt ekliyor: hava kaçağı, hava akış sensörü ya da yakıt basıncı kontrol ettirilebilir." : "Motor yakıtı kısıyor: enjektör kaçağı ya da oksijen sensörü kontrol ettirilebilir.")};
      if(Math.abs(d.change)>=4 && Math.sign(d.halfDiff)===Math.sign(d.change) && Math.abs(d.halfDiff)>=2)
        return {level:"no", d, text:`${L} yakıt ayarı ${sgn(d.change,1)} puan kaydı (şimdi ${sgn(d.last,1)} %). Henüz sınırda değil; artmaya devam ederse kontrol ettir.`};
      return {level:"ok", d, text:`${L} ortalama ${sgn(d.last,1)} % — normal, belirgin bir değişim yok.`};
    }
    if(key==="coolMax"){
      if(d.max>=110) return {level:"no", d, text:`${L} su sıcaklığı ${f1(d.max,0)} °C'ye çıktı. Soğutma suyu seviyesi, fan ve termostat kontrol ettirilmeli.`};
      if(d.change>=5 && d.halfDiff>=3) return {level:"no", d, text:`${L} en yüksek su sıcaklığı ortalama ${f1(d.change,0)} °C arttı. Soğutma suyu seviyesine ve fana baktır.`};
      if(d.last<75) return {level:"no", d, text:`${L} motor ${f1(d.last,0)} °C civarında kalıyor, tam ısınmıyor olabilir. Termostat açık kalmış olabilir.`};
      return {level:"ok", d, text:`${L} en yüksek sıcaklık ortalama ${f1(d.last,0)} °C — normal.`};
    }
    if(key==="warmupMin"){
      if(d.change>=3 && d.halfDiff>=2) return {level:"no", d, text:`${L} ısınma süresi ${f1(d.change,0)} dk uzadı. Havalar soğuduysa normaldir; değilse termostat kontrol ettirilebilir.`};
      if(d.last>20) return {level:"no", d, text:`Motor ortalama ${f1(d.last,0)} dakikada ısınıyor — uzun. Havalar soğuk değilse termostat kontrol ettirilebilir.`};
      return {level:"ok", d, text:`Soğuk çalıştırmada motor ortalama ${f1(d.last,0)} dakikada ısınıyor — normal.`};
    }
    if(key==="idlePct"){
      if(d.last>30) return {level:"info", d, text:`Motor çalışma sürenin ortalama %${f1(d.last,0)}'i rölantide geçiyor. Uzun beklemede motoru kapatmak yakıt kazandırır.`};
      return {level:"ok", d, text:`Motor çalışma sürenin ortalama %${f1(d.last,0)}'i rölantide geçiyor.`};
    }
    return {level:"info", d, text:""};
  }
  // Uyarı türleri (sürüşün olay listesinden)
  const EV_TYPES=[
    ["Arıza kodu", /^Yeni (bekleyen )?arıza|arıza lambası/i], ["Tekleme", /tekleme/i], ["Sert fren", /^Sert fren/], ["Sert hızlanma", /^Sert hızlanma/],
    ["Hız aşımı", /^Hız aşımı/], ["Yüksek devir", /^Yüksek devir/], ["Sınır aşımı", /\((üst|alt) sınır/], ["Bağlantı", /bağlantı/i], ["Bakım", /bakım/i]];
  function evType(e){
    if(!e || !e.text || /normale döndü/.test(e.text)) return null;
    for(const [n,re] of EV_TYPES) if(re.test(e.text)) return n;
    return e.level==="crit" ? "Diğer" : null;
  }
  function alertCounts(trips){
    const c={}; for(const t of trips) for(const e of t.events||[]){ const k=evType(e); if(k) c[k]=(c[k]||0)+1; }
    return Object.entries(c).sort((a,b)=>b[1]-a[1]);
  }
  function dtcHistory(trips){
    const m=new Map();
    for(const t of trips) for(const c of t.dtcs||[]){
      const x=m.get(c)||{code:c, first:t.start, last:t.start, n:0};
      x.first=Math.min(x.first,t.start); x.last=Math.max(x.last,t.start); x.n++; m.set(c,x);
    }
    return [...m.values()].sort((a,b)=>b.last-a.last);
  }
  function records(trips){
    const best=(arr,f,better)=>arr.reduce((b,t)=>{ const v=f(t); return v==null ? b : (!b || better(v,b.v) ? {t,v} : b); },null);
    return {
      longest: best(trips, t=>tripKm(t)>0 ? tripKm(t) : null, (a,b)=>a>b),
      fastest: best(trips, t=>t.stats && t.stats["0D"] ? t.stats["0D"].max : null, (a,b)=>a>b),
      thrifty: best(trips, t=>t.fuel>0 && tripKm(t)>=5 ? t.fuel/tripKm(t)*100 : null, (a,b)=>a<b),
      bestScore: best(trips, t=>typeof t.score==="number" ? t.score : null, (a,b)=>a>b),
    };
  }

  // ================= 5) Grafikler (satır içi SVG, uygulamanın renk değişkenleriyle) =================
  const CH={};       // grafik kimliği → {tips, xs, type, ...}: dokunma/üzerinde gezme okuması için
  let chN=0;
  const niceMax=v=>{ if(!(v>0)) return 1; const p=10**Math.floor(Math.log10(v)); for(const m of [1,1.5,2,2.5,3,4,5,6,8,10]) if(m*p>=v) return m*p; return 10*p; };
  const tickFmt=v=>fmt(v, Math.abs(v)<10 && v%1 ? 1 : 0);
  function svgOpen(id,W,H,label){ return `<svg class="st-svg" data-ch="${id}" viewBox="0 0 ${W} ${H}" width="100%" role="img" tabindex="0" aria-label="${esc(label)}">`; }
  function chartBox(id, svg, hint){ return `${svg}<p class="st-read" id="st-read-${id}" aria-live="polite">${esc(hint||"Dokun: değerini gör.")}</p>`; }
  function tableView(head, rows){
    if(!rows.length) return "";
    return `<details class="st-tbl"><summary>Tablo olarak göster</summary><div class="st-tscroll"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>`+
      `<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  }
  // Sütun grafiği: tek seri, değer ekseni solda, etiket altta
  function bars({W, labels, values, tips, title, H=170, capLabels=false, cls="st-a"}){
    const id="c"+(++chN), L=32, R=4, T=capLabels?18:10, B=22, pw=W-L-R, ph=H-T-B, n=values.length;
    const mx=niceMax(Math.max(...values,0)), slot=pw/Math.max(1,n), bw=Math.min(24,Math.max(3,slot-2));
    let s=svgOpen(id,W,H,title);
    for(const f of [0,.5,1]){ const y=T+ph-ph*f; s+=`<line class="st-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="st-ax" x="${L-4}" y="${y+4}" text-anchor="end">${tickFmt(mx*f)}</text>`; }
    const every=Math.max(1,Math.ceil(n/7)), xs=[];
    values.forEach((v,i)=>{
      const cx=L+slot*i+slot/2, h=v>0?Math.max(2,ph*v/mx):0, y=T+ph-h; xs.push(cx);
      if(h) s+=`<path class="${cls}" d="${barPath(cx-bw/2,y,bw,h)}"/>`;
      if(capLabels && v>0) s+=`<text class="st-val" x="${cx}" y="${y-4}" text-anchor="middle">${esc(tips.cap?tips.cap[i]:tickFmt(v))}</text>`;
      if(i%every===0 || n<=8) s+=`<text class="st-ax" x="${cx}" y="${H-6}" text-anchor="middle">${esc(labels[i])}</text>`;
    });
    s+=`<line class="st-cur" x1="0" x2="0" y1="${T}" y2="${T+ph}" visibility="hidden"/></svg>`;
    CH[id]={type:"x", xs, tips:tips.text, W};
    return chartBox(id,s);
  }
  // 4 px yuvarlak uç, tabanda köşeli
  function barPath(x,y,w,h){ const r=Math.min(4,w/2,h); return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`; }
  // Nokta + çizgi grafiği: her sürüş bir nokta; isteğe bağlı normal bant ve ikinci seri (çizgi)
  function dots({W, pts, line, band, title, unit, dec, H=150, lineName}){
    const id="c"+(++chN), L=36, R=6, T=8, B=20, pw=W-L-R, ph=H-T-B, n=pts.length;
    const all=pts.map(p=>p.v).concat(line?line.filter(v=>v!=null):[], band||[]);
    let lo=Math.min(...all), hi=Math.max(...all); if(lo===hi){ lo-=1; hi+=1; } const pad=(hi-lo)*.08; lo-=pad; hi+=pad;
    const X=i=>L+(n<=1?pw/2:pw*i/(n-1)), Y=v=>T+ph-(v-lo)/(hi-lo)*ph;
    let s=svgOpen(id,W,H,title);
    if(band){ const y1=Y(Math.min(band[1],hi)), y2=Y(Math.max(band[0],lo)); if(y2>y1) s+=`<rect class="st-band" x="${L}" y="${y1}" width="${pw}" height="${y2-y1}"/>`; }
    const ticks=[lo+pad, (lo+hi)/2, hi-pad];
    for(const v of ticks){ const y=Y(v); s+=`<line class="st-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="st-ax" x="${L-4}" y="${y+4}" text-anchor="end">${fmt(v, Math.abs(hi-lo)<6?1:0)}</text>`; }
    if(n){ s+=`<text class="st-ax" x="${L}" y="${H-4}">${esc(dShort(pts[0].t))}</text>`;
      if(n>1) s+=`<text class="st-ax" x="${W-R}" y="${H-4}" text-anchor="end">${esc(dShort(pts[n-1].t))}</text>`; }
    const r=n>80?2.5:n>30?3:4;
    pts.forEach((p,i)=>{ s+=`<circle class="st-dot" cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${r}"/>`; });
    if(line){ let dp=""; line.forEach((v,i)=>{ if(v!=null) dp+=(dp?"L":"M")+X(i).toFixed(1)+","+Y(v).toFixed(1); }); if(dp) s+=`<path class="st-line" d="${dp}"/>`; }
    s+=`<line class="st-cur" x1="0" x2="0" y1="${T}" y2="${T+ph}" visibility="hidden"/></svg>`;
    CH[id]={type:"x", xs:pts.map((p,i)=>X(i)), W,
      tips:pts.map((p,i)=>`${dShort(p.t)} · ${fmt(p.v,dec)} ${unit}`+(line&&line[i]!=null?` · ${lineName||"ortalama"} ${fmt(line[i],dec)} ${unit}`:""))};
    return chartBox(id,s);
  }
  // Haftanın günü × saat ısı ızgarası (sürüş dakikası)
  function heat({W, grid, title}){
    const id="c"+(++chN), L=30, T=4, B=18, cw=(W-L)/24, chh=18, H=T+7*chh+B;
    const mx=Math.max(1,...grid.flat()), lvl=v=>v<=0?0:Math.min(4,Math.ceil(v/mx*4));
    let s=svgOpen(id,W,H,title);
    for(let d=0;d<7;d++){
      s+=`<text class="st-ax" x="${L-4}" y="${T+d*chh+13}" text-anchor="end">${WD[d]}</text>`;
      for(let h=0;h<24;h++) s+=`<rect class="st-h${lvl(grid[d][h])}" x="${(L+h*cw+1).toFixed(1)}" y="${T+d*chh+1}" width="${(cw-2).toFixed(1)}" height="${chh-2}" rx="2"/>`;
    }
    for(const h of [0,6,12,18]) s+=`<text class="st-ax" x="${(L+h*cw+1).toFixed(1)}" y="${H-4}">${String(h).padStart(2,"0")}:00</text>`;
    s+=`<rect class="st-cell-cur" x="0" y="0" width="${(cw).toFixed(1)}" height="${chh}" rx="3" visibility="hidden"/></svg>`;
    CH[id]={type:"grid", L, T, cw, chh, W, grid};
    return s+`<div class="st-scale" aria-hidden="true">Az <i class="st-h1"></i><i class="st-h2"></i><i class="st-h3"></i><i class="st-h4"></i> Çok</div><p class="st-read" id="st-read-${id}" aria-live="polite">Dokun: değerini gör.</p>`;
  }
  // Yatay çubuk listesi (uyarı türleri)
  function hbars(rows){
    const mx=Math.max(1,...rows.map(r=>r[1]));
    return `<ul class="st-hb">${rows.map(([n,v])=>`<li><span>${esc(n)}</span><i><b class="st-hbar" style="width:${Math.max(2,v/mx*100)}%"></b></i><em>${v}</em></li>`).join("")}</ul>`;
  }
  function paintRead(svg, i, j){
    const id=svg.dataset.ch, c=CH[id]; if(!c) return;
    const out=$("st-read-"+id);
    if(c.type==="grid"){
      const v=c.grid[i][j], cur=svg.querySelector(".st-cell-cur");
      if(cur){ cur.setAttribute("x",(c.L+j*c.cw).toFixed(1)); cur.setAttribute("y",c.T+i*c.chh); cur.setAttribute("visibility","visible"); }
      c.cur=[i,j];
      if(out) out.textContent=`${WD_LONG[i]} ${String(j).padStart(2,"0")}:00–${String((j+1)%24).padStart(2,"0")}:00 · ${v?fmt(v,0)+" dk sürüş":"sürüş yok"}`;
      return;
    }
    i=Math.max(0,Math.min(c.xs.length-1,i)); c.cur=i;
    const ln=svg.querySelector(".st-cur");
    if(ln){ ln.setAttribute("x1",c.xs[i]); ln.setAttribute("x2",c.xs[i]); ln.setAttribute("visibility","visible"); }
    if(out) out.textContent=c.tips[i];
  }
  function pointAt(svg, e){
    const c=CH[svg.dataset.ch]; if(!c) return;
    const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)*c.W/r.width, y=(e.clientY-r.top)*(svg.viewBox?svg.viewBox.baseVal.height:1)/r.height;
    if(c.type==="grid"){
      const j=Math.floor((x-c.L)/c.cw), i=Math.floor((y-c.T)/c.chh);
      if(i>=0 && i<7 && j>=0 && j<24) paintRead(svg,i,j); return;
    }
    let best=0; c.xs.forEach((v,k)=>{ if(Math.abs(v-x)<Math.abs(c.xs[best]-x)) best=k; });
    paintRead(svg,best);
  }

  // ================= 6) Görünüm =================
  const css=document.createElement("style");
  css.textContent=`
.tabbar{grid-template-columns:repeat(5,1fr)}
.tabbar button span{white-space:nowrap}
.st-per{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:3px;border-radius:12px;background:var(--panel-2);border:1px solid var(--line)}
.st-per button{border:0;background:none;min-height:44px;padding:4px 2px;font-size:14px;line-height:1.1;color:var(--muted);border-radius:9px}
.st-per button[aria-pressed="true"]{background:var(--panel);color:var(--text);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.st-veh{display:grid;gap:6px}
.st-veh select{font:inherit;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--text);width:100%}
.st-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.st-tile{padding:10px 12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line);display:grid;gap:2px;min-width:0}
.st-tile span{font-size:13px;color:var(--muted)}
.st-tile b{font-family:var(--f-num);font-size:26px;font-weight:600;line-height:1.1;overflow-wrap:anywhere}
.st-tile b small{font-size:15px;font-weight:500;color:var(--muted);margin-left:3px}
.st-tile em{font-style:normal;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.st-up-bad,.st-dn-bad{color:var(--crit)} .st-up-good,.st-dn-good{color:var(--ok)} .st-flat{color:var(--muted)}
.st-svg{display:block;width:100%;overflow:visible;touch-action:pan-y;font-family:var(--f-body)}
.st-svg:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.st-grid{stroke:var(--grid);stroke-width:1}
.st-ax{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.st-val{fill:var(--text);font-size:12px;font-weight:600}
.st-a,.st-hbar{fill:var(--accent);background:var(--accent)}
.st-dot{fill:var(--accent);stroke:var(--panel);stroke-width:2}
.st-line{fill:none;stroke:var(--series-b);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.st-band{fill:var(--ok);opacity:.12}
.st-cur{stroke:var(--muted);stroke-width:1}
.st-cell-cur{fill:none;stroke:var(--text);stroke-width:2}
.st-h0{fill:var(--panel-2);background:var(--panel-2)}
.st-h1{fill:var(--accent);background:var(--accent);opacity:.25} .st-h2{fill:var(--accent);background:var(--accent);opacity:.5}
.st-h3{fill:var(--accent);background:var(--accent);opacity:.75} .st-h4{fill:var(--accent);background:var(--accent)}
.st-scale{display:flex;gap:4px;align-items:center;font-size:12px;color:var(--muted);justify-content:flex-end}
.st-scale i{display:inline-block;width:14px;height:10px;border-radius:2px}
.st-read{margin:0;font-size:13px;color:var(--muted);min-height:1.4em;font-variant-numeric:tabular-nums}
.st-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin:0}
.st-leg i{display:inline-block;vertical-align:middle;margin-right:5px}
.st-leg .kd{width:9px;height:9px;border-radius:50%;background:var(--accent)}
.st-leg .kl{width:16px;height:2px;background:var(--series-b)}
.st-leg .kb{width:14px;height:10px;background:var(--ok);opacity:.3;border-radius:2px}
.st-leg .kw{width:12px;height:10px;border-radius:2px;background:var(--warn)} .st-leg .kc{width:12px;height:10px;border-radius:2px;background:var(--crit)}
.st-warnbar{fill:var(--warn)} .st-critbar{fill:var(--crit)}
.st-tbl summary{min-height:44px;display:flex;align-items:center;font-size:14px;color:var(--muted);cursor:pointer}
.st-tscroll{max-height:260px;overflow:auto}
.st-tbl table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.st-tbl th,.st-tbl td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line)}
.st-h{display:grid;gap:8px;padding-top:12px;border-top:1px solid var(--line)}
.st-h:first-of-type{border-top:0;padding-top:0}
.st-h .row b{font-size:15px}
.verdict.st-info{border-color:var(--line);color:var(--text);font-weight:500}
.st-hb{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:14px}
.st-hb li{display:grid;grid-template-columns:minmax(0,7.5em) 1fr 2.5em;gap:8px;align-items:center}
.st-hb i{display:block;height:12px}
.st-hb b{display:block;height:12px;border-radius:0 4px 4px 0}
.st-hb em{font-style:normal;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.st-rec{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.st-rec button{width:100%;display:grid;grid-template-columns:1fr auto;gap:2px 10px;text-align:left;align-items:baseline}
.st-rec button span{font-size:13px;color:var(--muted)}
.st-rec button b{font-family:var(--f-num);font-size:20px;font-weight:600;grid-row:1/3;grid-column:2}
.st-dtc{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:14px}
.st-dtc li{display:grid;gap:2px;padding:8px 10px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line)}
.st-dtc code{font-family:var(--f-num);font-size:18px;font-weight:700}
.st-dtc span{color:var(--muted);font-size:13px}
`;
  document.head.appendChild(css);

  const ICON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/></svg>`;
  const btn=document.createElement("button"); btn.dataset.tab="istatistik"; btn.innerHTML=ICON+"<span>İstatistik</span>";
  const tabbar=$("tabbar"), ayarBtn=tabbar.querySelector('button[data-tab="ayar"]');
  if(ayarBtn && ayarBtn.parentNode===tabbar) tabbar.insertBefore(btn, ayarBtn); else tabbar.appendChild(btn);
  btn.addEventListener("click",()=>showTab("istatistik"));
  const sec=document.createElement("section"); sec.className="tab"; sec.dataset.tab="istatistik"; sec.hidden=true;
  sec.setAttribute("aria-label","İstatistik"); sec.id="tab-istatistik";
  (document.querySelector("main")||document.body).appendChild(sec);
  function isShown(){ return !sec.hidden; }

  // Çekirdekteki showTab tüm .tab bölümlerini ve #tabbar düğmelerini dolaştığı için yeni sekmeyi de yönetir;
  // yalnızca sekme açıldığında içeriği çizmek için sarıyoruz.
  const coreShowTab=showTab;
  showTab=function(name){ coreShowTab(name); if(name==="istatistik") render(); };

  function tile(label, value, unit, delta, goodDir){
    let d="";
    if(delta!=null && isFinite(delta)){
      const up=delta>=2, dn=delta<=-2;   // %2'den küçük fark: değişim yok
      const cls = !up&&!dn ? "st-flat" : goodDir==null ? "st-flat" : (up===(goodDir>0) ? (up?"st-up-good":"st-dn-good") : (up?"st-up-bad":"st-dn-bad"));
      d=`<em class="${cls}">${up?"▲":dn?"▼":"="} %${fmt(Math.abs(delta),0)}</em>`;
    }
    return `<div class="st-tile"><span>${esc(label)}</span><b>${value}${unit?`<small>${esc(unit)}</small>`:""}</b>${d}</div>`;
  }
  function hoursMin(ms){ const m=Math.round(ms/60000); return m>=60 ? `${Math.floor(m/60)} sa ${String(m%60).padStart(2,"0")}` : `${m}`; }
  function buckets(p, trips){
    const now=p.to, out=[];
    const first=trips.length ? Math.min(...trips.map(t=>t.start)) : now;
    const from = p.from===-Infinity ? first : p.from;
    const mk=(s,e,label,long)=>out.push({s,e,label,long,km:0,n:0});
    if(p.bucket==="day"){
      for(let i=0;i<7;i++){ const s=new Date(from); s.setDate(s.getDate()+i); const e=new Date(s); e.setDate(e.getDate()+1);
        mk(+s,+e,WD[i],WD_LONG[i]+" "+dShort(+s)); }
    }else if(p.bucket==="week"){
      const s=new Date(from); s.setHours(0,0,0,0); s.setDate(s.getDate()-(s.getDay()+6)%7);
      for(let guard=0; +s<now && guard<60; guard++){ const e=new Date(s); e.setDate(e.getDate()+7);
        const lastDay=new Date(+e-DAY); mk(+s,+e,dShort(+s),`${dShort(+s)} – ${dShort(+lastDay)}`); s.setTime(+e); }
    }else{
      const s=new Date(from); s.setHours(0,0,0,0); s.setDate(1);
      let months=(new Date(now).getFullYear()-s.getFullYear())*12+new Date(now).getMonth()-s.getMonth()+1;
      if(months>36){   // çok uzun geçmiş: yıllık
        out.unit="year";
        for(let y=s.getFullYear(); y<=new Date(now).getFullYear(); y++) mk(+new Date(y,0,1), +new Date(y+1,0,1), String(y), String(y));
      }else{
        const multiYear=s.getFullYear()!==new Date(now).getFullYear();
        for(let i=0;i<months;i++){ const a=new Date(s.getFullYear(),s.getMonth()+i,1), e=new Date(s.getFullYear(),s.getMonth()+i+1,1);
          const m=a.toLocaleDateString("tr-TR",{month:"short"});
          mk(+a,+e, multiYear ? m+" "+String(a.getFullYear()).slice(2) : m, a.toLocaleDateString("tr-TR",{month:"long",year:"numeric"})); }
      }
    }
    for(const t of trips){ const b=out.find(b=>t.start>=b.s && t.start<b.e); if(b){ b.km+=tripKm(t); b.n++; } }
    return out;
  }
  function hourGrid(trips){
    const g=Array.from({length:7},()=>new Array(24).fill(0));
    for(const t of trips){
      let a=t.start; const end=Math.min(t.end||t.start, t.start+12*3600000);
      while(a<end){ const d=new Date(a), nx=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()+1).getTime(), e=Math.min(end,nx);
        g[(d.getDay()+6)%7][d.getHours()]+=(e-a)/60000; a=e; }
    }
    return g;
  }
  const LEN_BINS=[["0–5 km",0,5],["5–15 km",5,15],["15–40 km",15,40],["40+ km",40,Infinity]];

  function paintProgress(){
    const el=$("st-bf"); if(!el) return;
    const b=st.backfill;
    el.textContent = b.running && b.total ? `Eski sürüşler inceleniyor: ${b.done} / ${b.total}. Bitince grafikler kendiliğinden dolar.` : "";
    el.hidden=!(b.running && b.total);
  }

  async function render(){
    const my=++st.token;
    let all; try{ all=await getTrips(); }catch(e){ sec.innerHTML=`<section class="card"><h2>İstatistik</h2><p class="empty">Bu tarayıcı kayıt tutamıyor (gizli sekme olabilir).</p></section>`; return; }
    if(my!==st.token) return;
    st.trips=all;
    for(const k in CH) delete CH[k];
    const W=Math.max(260, Math.round(((sec.clientWidth||361)-34)));
    const pKey=settings.statsPeriod, vk=currentVeh(), {p, scoped, cur, prev}=select(all, pKey, Date.now(), vk);
    let h=`<section class="card"><h2>İstatistik</h2>
      <div class="st-per" role="group" aria-label="Dönem">${PERIODS.map(([k,n])=>`<button type="button" data-period="${k}" aria-pressed="${k===pKey}">${n}</button>`).join("")}</div>`;
    if(profilesOn()){
      const vs=vehicles();
      h+=`<div class="st-veh"><label class="sub" for="st-veh">Araç</label><select id="st-veh">${vs.map(v=>`<option value="${esc(v.key)}"${v.key===vk?" selected":""}>${esc(v.name)}</option>`).join("")}<option value="*"${vk==="*"?" selected":""}>Tüm araçlar</option></select></div>`;
    }
    h+=`<p class="sub" id="st-bf" hidden></p></section>`;

    if(scoped.length<3){
      h+=`<section class="card"><h3>Henüz yeterli sürüş yok</h3><p class="empty">İstatistikler en az 3 gerçek sürüşten sonra anlam kazanır (şimdilik ${scoped.length}). `+
        `Araca bağlandığında sürüşler kendiliğinden kaydedilir; deneme modundaki sürüşler burada sayılmaz.</p></section>`;
      sec.innerHTML=h; paintProgress(); kickBackfill(); return;
    }
    if(!cur.length){
      h+=`<section class="card"><h3>Bu dönemde sürüş yok</h3><p class="empty">Başka bir dönem seç; ör. "Tümü" bütün kayıtları gösterir.</p></section>`;
      sec.innerHTML=h; paintProgress(); kickBackfill(); return;
    }

    // --- Özet ---
    const S0=summary(cur), P0=prev?summary(prev):null, dl=k=>P0 && P0.n ? pct(S0[k],P0[k]) : null;
    const ev=S0.hasKwh;
    let tiles=tile("Toplam yol",fmt(S0.km,S0.km<100?1:0),"km",dl("km"),null)
      +tile("Sürüş süresi",hoursMin(S0.ms),"dk",dl("ms"),null)
      +tile("Sürüş sayısı",String(S0.n),"",dl("n"),null);
    if(S0.hasFuel || !ev){
      tiles+=tile("Yakıt",S0.hasFuel?fmt(S0.fuel,1):"—","L",dl("fuel"),-1)
        +tile("Yakıt maliyeti",S0.hasFuel?fmt(S0.cost,0):"—","TL",dl("cost"),-1)
        +tile("Ortalama tüketim",S0.l100!=null?fmt(S0.l100,1):"—","L/100 km",P0&&P0.l100!=null?pct(S0.l100,P0.l100):null,-1);
    }
    if(ev){
      tiles+=tile("Enerji",fmt(S0.kwh,1),"kWh",dl("kwh"),-1)
        +tile("Ortalama tüketim",S0.kwh100!=null?fmt(S0.kwh100,1):"—","kWh/100 km",P0&&P0.kwh100!=null?pct(S0.kwh100,P0.kwh100):null,-1)
        +tile("Enerji maliyeti",fmt(S0.ecost,0),"TL",dl("ecost"),-1);
    }
    tiles+=tile("Ortalama hız",S0.speed!=null?fmt(S0.speed,0):"—","km/sa",P0&&P0.speed!=null?pct(S0.speed,P0.speed):null,null)
      +tile("Ortalama sürüş puanı",S0.score!=null?fmt(S0.score,0):"—","/ 100",P0&&P0.score!=null?pct(S0.score,P0.score):null,+1);
    const cmp = !prev ? "Tüm kayıtlar." : P0.n ? `▲▼: ${PREV_TXT[pKey]} göre (${dShort(p.prevFrom)} – ${dShort(p.prevTo-1)}, ${P0.n} sürüş). Yeşil iyi, kırmızı kötü yönde.`
      : `Karşılaştırma yok: ${PREV_TXT[pKey]} ait sürüş kaydı yok.`;
    h+=`<section class="card"><h3>Özet</h3><div class="st-tiles">${tiles}</div><p class="sub">${esc(cmp)} Yakıt uygulamanın tahminidir; maliyet sürüş günündeki litre fiyatıyla hesaplanır.</p></section>`;

    // --- km grafiği ---
    const bk=buckets(p,cur), unitTxt={day:"Günlere",week:"Haftalara",month:"Aylara"}[p.bucket];
    h+=`<section class="card"><h3>${bk.unit==="year" ? "Yıllara" : unitTxt} göre yol</h3>`+
      bars({W, labels:bk.map(b=>b.label), values:bk.map(b=>Math.round(b.km*10)/10), title:"Dönemlere göre kilometre",
        tips:{text:bk.map(b=>`${b.long}: ${fmt(b.km,1)} km · ${b.n} sürüş`)}})+
      tableView(["Dönem","km","Sürüş"], bk.map(b=>[b.long, fmt(b.km,1), String(b.n)]))+`</section>`;

    // --- tüketim eğilimi ---
    const useK=ev && !S0.hasFuel;
    const cons=cur.map(t=>{ const k=tripKm(t); const v=useK ? (t.kwh!=null && k>=1 ? Math.max(0,t.kwh)/k*100 : null) : (t.fuel>0 && k>=1 ? t.fuel/k*100 : null); return v==null?null:{t:t.start, v}; }).filter(Boolean);
    const cu=useK?"kWh/100 km":"L/100 km";
    h+=`<section class="card"><h3>Tüketim (${cu})</h3>`;
    if(cons.length>=3){
      const roll=cons.map((_,i)=>i>=2 ? mean(cons.slice(Math.max(0,i-4),i+1).map(p=>p.v)) : null);
      h+=`<p class="st-leg"><span><i class="kd"></i>Her sürüş</span><span><i class="kl"></i>Son 5 sürüşün ortalaması</span></p>`+
        dots({W, pts:cons, line:roll, title:"Sürüş başına tüketim", unit:cu, dec:1, H:170, lineName:"5 sürüş ort."})+
        tableView(["Tarih",cu], cons.map(p=>[dLong(p.t), fmt(p.v,1)]));
    }else h+=`<p class="empty">Tüketim eğilimi için en az 3 sürüşte en az 1 km yol ve yakıt bilgisi gerekli.</p>`;
    h+=`</section>`;

    // --- saatler ---
    const grid=hourGrid(cur);
    h+=`<section class="card"><h3>Ne zaman sürüyorsun?</h3><p class="sub">Günlere ve saatlere göre sürüş dakikası.</p>`+heat({W, grid, title:"Gün ve saate göre sürüş süresi"})+
      tableView(["Gün","En yoğun saat","Toplam dk"], grid.map((r,d)=>{ const tot=r.reduce((a,b)=>a+b,0), mh=r.indexOf(Math.max(...r)); return [WD_LONG[d], tot?String(mh).padStart(2,"0")+":00":"—", fmt(tot,0)]; }))+`</section>`;

    // --- uzunluk dağılımı ---
    const lens=LEN_BINS.map(([n,a,b])=>({n, c:cur.filter(t=>{ const k=tripKm(t); return k>=a && k<b; }).length}));
    h+=`<section class="card"><h3>Sürüş uzunlukları</h3>`+
      bars({W, labels:lens.map(x=>x.n), values:lens.map(x=>x.c), capLabels:true, H:150, title:"Uzunluğa göre sürüş sayısı",
        tips:{text:lens.map(x=>`${x.n}: ${x.c} sürüş (%${fmt(x.c/cur.length*100,0)})`)}})+
      (lens[0].c/cur.length>0.4 ? `<p class="sub">Sürüşlerin çoğu 5 km'den kısa. Kısa sürüşte motor tam ısınmaz; tüketim ve aşınma artar.</p>` : "")+`</section>`;

    // --- araç sağlığı ---
    h+=renderHealth(W, cur);

    // --- rekorlar ---
    const rc=records(cur), recRow=(label,r,val)=>r?`<li><button type="button" data-open="${r.t.id}"><span>${esc(label)}</span><span>${esc(fmtDate(r.t.start))} · aç</span><b>${val}</b></button></li>`:"";
    h+=`<section class="card"><h3>Rekorlar</h3><ul class="st-rec">`+
      recRow("En uzun sürüş",rc.longest,rc.longest&&fmt(rc.longest.v,1)+" km")+
      recRow("En yüksek hız",rc.fastest,rc.fastest&&fmt(rc.fastest.v,0)+" km/sa")+
      recRow("En düşük tüketim (5 km üstü)",rc.thrifty,rc.thrifty&&fmt(rc.thrifty.v,1)+" L/100")+
      recRow("En iyi sürüş puanı",rc.bestScore,rc.bestScore&&fmt(rc.bestScore.v,0))+`</ul></section>`;

    // --- uyarı ve arıza geçmişi ---
    const ac=alertCounts(cur), dh=dtcHistory(cur);
    h+=`<section class="card"><h3>Uyarı ve arıza geçmişi</h3>`+
      (ac.length ? hbars(ac) : `<p class="empty">Bu dönemde uyarı yok.</p>`)+
      (dh.length ? `<h3>Görülen arıza kodları</h3><ul class="st-dtc">${dh.map(x=>`<li><code>${esc(x.code)}</code><div>${esc(typeof dtcInfo==="function"?dtcInfo(x.code).desc:"")}</div>`+
        `<span>İlk: ${esc(dLong(x.first))} · Son: ${esc(dLong(x.last))} · ${x.n} sürüşte</span></li>`).join("")}</ul>` : `<p class="empty">Bu dönemde arıza kodu görülmedi.</p>`)+`</section>`;

    sec.innerHTML=h;
    paintProgress(); kickBackfill();
  }

  function renderHealth(W, cur){
    const withM=cur.filter(t=>t.metrics);
    let h=`<section class="card"><h2>Araç sağlığı eğilimleri</h2>
      <p class="sub">Her nokta bir sürüş. Yeşil şerit normal aralık. Yorum, son ${DRIFT_N} sürüşe bakar ve en az ${DRIFT_MIN} sürüş ister.</p>
      <p class="st-leg"><span><i class="kd"></i>Sürüş</span><span><i class="kl"></i>Son ${DRIFT_N} sürüşün eğilimi</span><span><i class="kb"></i>Normal aralık</span></p>`;
    const missing=cur.length-withM.length;
    if(!withM.length){
      h+=`<p class="empty">Bu dönemdeki sürüşlerin ölçüleri henüz hesaplanmadı${missing?" (arka planda hesaplanıyor)":""}.</p></section>`;
      return h;
    }
    let any=false;
    for(const m of HEALTH){
      const src = m.key==="coolMax" ? withM.filter(t=>!(t.metrics.runMin<10)) : withM;
      const pts=src.filter(t=>t.metrics[m.key]!=null).map(t=>({t:t.start, v:t.metrics[m.key]})).slice(-60);
      if(!pts.length) continue;
      any=true;
      const vd=verdict(m.key, pts.map(p=>p.v)), d=vd.d;
      let line=null;
      if(d.enough){ const off=pts.length-d.n; line=pts.map((_,i)=>i>=off ? d.a+d.slope*(i-off) : null); }
      h+=`<div class="st-h"><div class="row"><b style="margin-right:auto">${esc(m.name)}</b><span class="sub">${pts.length===60?"son 60 sürüş":pts.length+" sürüş"}</span></div>`+
        dots({W, pts, line, band:m.band, title:m.name, unit:m.unit, dec:m.dec, H:130, lineName:"eğilim"})+
        `<div class="verdict ${vd.level==="info"?"st-info":vd.level}">${esc(vd.text)}</div><p class="sub">${esc(m.note)}</p></div>`;
    }
    // tekleme ve kritik uyarılar: sürüş başına
    const last=cur.slice(-30), mis=last.map(t=>(t.events||[]).filter(e=>evType(e)==="Tekleme").length),
      crit=last.map(t=>(t.events||[]).filter(e=>e.level==="crit" && evType(e) && evType(e)!=="Tekleme").length);
    if(last.length){
      any=true;
      const id="c"+(++chN), L=32, R=4, T=8, B=20, H=110, pw=W-L-R, ph=H-T-B, n=last.length, slot=pw/n, bw=Math.min(24,Math.max(3,slot-2));
      const mx=niceMax(Math.max(1,...last.map((_,i)=>mis[i]+crit[i])));
      let s=svgOpen(id,W,H,"Sürüş başına tekleme ve uyarı sayısı"), xs=[];
      for(const f of [0,1]){ const y=T+ph-ph*f; s+=`<line class="st-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="st-ax" x="${L-4}" y="${y+4}" text-anchor="end">${fmt(mx*f,0)}</text>`; }
      last.forEach((t,i)=>{ const cx=L+slot*i+slot/2; xs.push(cx);
        const h1=ph*mis[i]/mx, h2=ph*crit[i]/mx, x=cx-bw/2;
        if(h1) s+=`<path class="st-warnbar" d="${crit[i]?`M${x},${T+ph}V${T+ph-h1}H${x+bw}V${T+ph}Z`:barPath(x,T+ph-h1,bw,h1)}"/>`;
        if(h2) s+=`<path class="st-critbar" d="${barPath(x,T+ph-h1-h2,bw,Math.max(1,h2-(h1?2:0)))}"/>`; });
      s+=`<text class="st-ax" x="${L}" y="${H-4}">${esc(dShort(last[0].start))}</text><text class="st-ax" x="${W-R}" y="${H-4}" text-anchor="end">${esc(dShort(last[n-1].start))}</text>`;
      s+=`<line class="st-cur" x1="0" x2="0" y1="${T}" y2="${T+ph}" visibility="hidden"/></svg>`;
      CH[id]={type:"x", xs, W, tips:last.map((t,i)=>`${fmtDate(t.start)} · ${mis[i]} tekleme · ${crit[i]} kritik uyarı`)};
      const r10=last.slice(-DRIFT_N), m10=r10.filter((t,i)=>mis[last.length-r10.length+i]>0).length, c10=crit.slice(-DRIFT_N).reduce((a,b)=>a+b,0);
      const vtxt = m10 ? `Son ${r10.length} sürüşün ${m10} tanesinde tekleme uyarısı var. Bujiler, bobinler ve enjektörler kontrol ettirilebilir.`
        : c10 ? `Son ${r10.length} sürüşte tekleme yok; ${c10} kritik uyarı var (ayrıntı aşağıda).` : `Son ${r10.length} sürüşte tekleme ya da kritik uyarı yok.`;
      h+=`<div class="st-h"><div class="row"><b style="margin-right:auto">Tekleme ve uyarılar</b><span class="sub">son ${n} sürüş</span></div>
        <p class="st-leg"><span><i class="kw"></i>Tekleme</span><span><i class="kc"></i>Diğer kritik uyarı</span></p>`+chartBox(id,s)+
        `<div class="verdict ${m10?"no":"ok"}">${esc(vtxt)}</div></div>`;
    }
    if(!any) h+=`<p class="empty">Bu aracın okuduğu değerlerden sağlık ölçüsü çıkarılamadı (voltaj, yakıt ayarı, su sıcaklığı gelmiyor).</p>`;
    if(missing) h+=`<p class="sub">${missing} sürüşün ölçüleri henüz yok${st.backfill.running?"; arka planda hesaplanıyor":""}.</p>`;
    return h+`</section>`;
  }

  let kicked=false;
  function kickBackfill(){ if(kicked || st.backfill.running) return; kicked=true; setTimeout(()=>{ kicked=false; backfill().catch(e=>console.error("istatistik ölçüleri:",e)); },400); }

  // ---- etkileşim: tek dinleyici (dönem, araç, rekor aç, grafik okuma) ----
  sec.addEventListener("click",e=>{
    const t=e.target && e.target.closest ? e.target : null; if(!t) return;
    const pb=t.closest("[data-period]");
    if(pb){ settings.statsPeriod=pb.dataset.period; save(); render(); return; }
    const ob=t.closest("[data-open]");
    if(ob){ const id=Number(ob.dataset.open); showTab("surus"); openTrip(id); return; }
  });
  sec.addEventListener("change",e=>{ if(e.target && e.target.id==="st-veh"){ st.veh=e.target.value; render(); } });
  const svgOf=e=>e.target && e.target.closest ? e.target.closest("svg[data-ch]") : null;
  sec.addEventListener("pointermove",e=>{ const s=svgOf(e); if(s) pointAt(s,e); });
  sec.addEventListener("pointerdown",e=>{ const s=svgOf(e); if(s) pointAt(s,e); });
  sec.addEventListener("keydown",e=>{
    const s=svgOf(e); if(!s) return; const c=CH[s.dataset.ch]; if(!c) return;
    const dx=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0, dy=e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0;
    if(!dx && !dy) return; e.preventDefault();
    if(c.type==="grid"){ const [i,j]=c.cur||[0,-1]; paintRead(s, Math.max(0,Math.min(6,i+dy)), Math.max(0,Math.min(23,j+dx))); }
    else paintRead(s, (c.cur??-1)+dx);
  });
  let rz=null; window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(()=>{ if(isShown()) render(); },250); });

  // Açılış: sekme kaydedilmişse ya da adres #istatistik içeriyorsa (çekirdek bu sekmeyi bilmiyor)
  const hashTab=location.hash.slice(1).split("-").includes("istatistik");
  if(hashTab || settings.tab==="istatistik") showTab("istatistik");
  else setTimeout(()=>kickBackfill(), 5000);   // sekme açılmasa da eski sürüşlerin ölçüleri hazırlansın

  return {period, select, summary, scope, vehicles, matchVeh, currentVeh, metricsFrom, feed, finish, newAcc, drift, verdict,
    alertCounts, dtcHistory, records, buckets, hourGrid, backfill, render, section:sec, button:btn, pct, st, HEALTH, MV};
})();
