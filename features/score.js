// ---------- Sürüş puanı ----------
// Aracın hız bilgisinden (OBD 0D) sert fren / sert hızlanma, uzun hız aşımı ve yüksek devir olaylarını
// yakalar; sürüş bitince 0-100 arası bir puan verir. Olaylar kayıt satırına (row.ev) ve sürüşe
// (trip.scoreEvents, trip.score) yazılır; sürüş ayrıntısında puan, sayılar ve haritada işaret gösterilir.
const SCORE = (()=>{
  const G = 9.81;
  // Eşikler. Filo takip (telematik) sistemleri "sert" olayı ivmeyle tanımlar; binek araç için yaygın
  // varsayılanlar ~0,3 g hızlanma ve ~0,4 g fren civarındadır (sınıfa göre ayarlanabilir eşikler:
  // Geotab "Understanding acceleration, braking and cornering", Samsara "Harsh Event Detection").
  // Burada ivme ölçer yok; ivmeyi tamsayı km/sa hızın ≥0,8 sn'lik farkından hesaplıyoruz. Bu ortalama,
  // anlık tepeyi biraz düşük gösterir; bu yüzden eşikleri yükseltmedik, yaygın değerlerde bıraktık.
  const ACC_MAX = 0.30*G;     // 2,94 m/s² ≈ 1 sn'de 10,6 km/sa artış → "Sert hızlanma"
  const BRK_MIN = -0.40*G;    // −3,92 m/s² ≈ 1 sn'de 14,1 km/sa düşüş → "Sert fren"
  const WIN_MIN = 800;        // ms: iki hız okuması arası en az bu kadar olsun (1 km/sa'lik yuvarlama gürültüsü)
  const WIN_MAX = 2500;       // ms: daha uzun boşlukta (okuma durdu, bağlantı gitti) ivme hesaplanmaz
  const OVER_MS = 10000;      // hız sınırının üstünde bu kadar kesintisiz kalınırsa bir "Hız aşımı"
  const RPM_MS = 2000;        // devir sınırının üstünde bu kadar kalınırsa bir "Yüksek devir" (anlık sıçramayı saymasın)
  const PEN = {fren:5, hizlanma:3, hiz:5, devir:2};   // her olayın 10 km başına puan kesintisi
  const MIN_KM = 10;          // kısa sürüşte tek olay puanı sıfırlamasın: 10 km'den kısa sürüş 10 km sayılır
  const TYPES = ["fren","hizlanma","hiz","devir"];
  const LABEL = {fren:"Sert fren", hizlanma:"Sert hızlanma", hiz:"Hız aşımı", devir:"Yüksek devir"};
  const COLOR = {fren:"--crit", hizlanma:"--warn", hiz:"--series-b", devir:"--text"};
  const TIP = {
    fren:"Öndeki araçla aranı aç, yavaşlamaya daha erken başla.",
    hizlanma:"Gaza daha yumuşak bas; hem yakıt hem lastik kazanır.",
    hiz:"Hız sınırına dikkat et; ayarlardaki üst sınırı uzun süre aştın.",
    devir:"Vitesi daha erken büyüt; motoru yüksek devirde tutma.",
  };

  // Olay yakalayıcı: okumaları (zaman, değer) sırayla alır, yeni olayların türlerini döndürür.
  function detector(){ return {hist:[], lastTs:0, accOn:false, brkOn:false, overSince:null, overDone:false,
    rpmTs:0, rpmSince:null, rpmDone:false}; }
  function feedSpeed(d, ts, v, lim){
    const out=[];
    if(ts===d.lastTs || v==null) return out;
    if(d.lastTs && ts-d.lastTs>WIN_MAX){ d.hist=[]; d.accOn=d.brkOn=false; d.overSince=null; d.overDone=false; }
    d.lastTs=ts; d.hist.push({ts,v});
    while(d.hist.length && ts-d.hist[0].ts>WIN_MAX) d.hist.shift();
    let ref=null; for(const h of d.hist) if(ts-h.ts>=WIN_MIN) ref=h;   // en yeni, ≥0,8 sn önceki okuma
    if(ref){
      const a=(v-ref.v)/3.6/((ts-ref.ts)/1000);
      if(!d.accOn && a>ACC_MAX){ d.accOn=true; out.push("hizlanma"); } else if(d.accOn && a<ACC_MAX/2) d.accOn=false;
      if(!d.brkOn && a<BRK_MIN){ d.brkOn=true; out.push("fren"); } else if(d.brkOn && a>BRK_MIN/2) d.brkOn=false;
    }
    if(lim!=null && v>lim){
      if(d.overSince==null) d.overSince=ts;
      if(!d.overDone && ts-d.overSince>=OVER_MS){ d.overDone=true; out.push("hiz"); }
    }else{ d.overSince=null; d.overDone=false; }
    return out;
  }
  function feedRpm(d, ts, r, lim){
    if(ts===d.rpmTs || r==null) return [];
    if(d.rpmTs && ts-d.rpmTs>WIN_MAX*2){ d.rpmSince=null; d.rpmDone=false; }
    d.rpmTs=ts;
    if(lim!=null && r>lim){
      if(d.rpmSince==null) d.rpmSince=ts;
      if(!d.rpmDone && ts-d.rpmSince>=RPM_MS){ d.rpmDone=true; return ["devir"]; }
    }else{ d.rpmSince=null; d.rpmDone=false; }
    return [];
  }

  const zero = ()=>({fren:0, hizlanma:0, hiz:0, devir:0});
  const tripKm = t=>t.distance ? t.distance/1000 : (t.odo||0);
  function compute(counts, kmv){
    const pen=TYPES.reduce((s,k)=>s+(counts[k]||0)*PEN[k],0), per=Math.max(MIN_KM,kmv||0)/10;
    return {score:Math.max(0,Math.min(100,Math.round(100-pen/per))), pen, per};
  }

  // ---- canlı: tick'te yeni okumaları işle, olayları sürüşe ve sıradaki kayıt satırına yaz ----
  let det=detector(), pending=[];
  function lim(pid){ const l=settings.lim&&settings.lim[pid]; return l && l.max!=null && l.max!=="" ? Number(l.max) : null; }
  function note(types){
    const t=REC.trip; if(!t || !types.length) return;
    if(!t.scoreEvents) t.scoreEvents=zero();
    types.forEach(k=>{
      t.scoreEvents[k]++; pending.push(k);
      // Sürüşün olay listesine de yaz: ekrandaki "Olaylar" ve CSV'nin "Olay" sütunu aynı kaynaktan beslensin
      const sp=cur("0D"), rp=cur("0C");
      recEvent("warn", `${LABEL[k]} · ${k==="devir" ? fmt(rp,0)+" d/dk" : fmt(sp,0)+" km/sa"}`);
    });
  }
  on("connect",()=>{ det=detector(); pending=[]; if(REC.trip && !REC.trip.scoreEvents) REC.trip.scoreEvents=zero(); paintLive(); });
  on("disconnect",()=>{ det=detector(); pending=[]; paintLive(); });
  on("tick",()=>{
    const s=S.g["0D"], r=S.g["0C"];
    if(s && s.v!=null && s.ts) note(feedSpeed(det, s.ts, s.v, lim("0D")));
    if(r && r.v!=null && r.ts) note(feedRpm(det, r.ts, r.v, lim("0C")));
    paintLive();
  });
  on("sample",(row)=>{ if(pending.length){ row.ev=[...new Set(pending)].join(","); pending=[]; } });
  on("tripEnd",(t)=>{
    if(!t.scoreEvents) t.scoreEvents=zero();
    const c=compute(t.scoreEvents, tripKm(t)); t.score=c.score;
  });

  // ---- görünüm ----
  const css=document.createElement("style");
  css.textContent=`
.sc-live{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-radius:99px;border:1px solid var(--line);background:var(--panel);font-size:14px;color:var(--muted);justify-self:start;max-width:100%}
.sc-live b{font-family:var(--f-num);font-size:20px;color:var(--text)}
.sc-top{display:flex;align-items:baseline;gap:10px}
.sc-num{font-family:var(--f-num);font-size:64px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.sc-top span{color:var(--muted);font-size:15px}
.sc-sw{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.sc-tip{margin:0;font-weight:600}
.sc-tip+.sc-tip{margin-top:-6px}
#scoreCard .sub{margin:0;font-size:13px;color:var(--muted)}`;
  document.head.appendChild(css);

  const live=document.createElement("div"); live.id="scoreLive"; live.className="sc-live"; live.hidden=true;
  $("ext-canli").appendChild(live);
  function paintLive(){
    const t=REC.trip;
    if(!t || !S.active){ live.hidden=true; return; }
    const ev=t.scoreEvents||zero(), c=compute(ev, tripKm(t));
    const parts=TYPES.filter(k=>ev[k]).map(k=>`${ev[k]} ${LABEL[k].toLocaleLowerCase("tr-TR")}`);
    live.innerHTML=`<span>Bu sürüş:</span> <b>${c.score}</b> <span>puan${parts.length?" · "+parts.join(", "):""}</span>`;
    live.hidden=false;
  }

  const card=document.createElement("section"); card.className="card"; card.id="scoreCard"; card.hidden=true;
  $("ext-viewer").appendChild(card);
  const band=s=>s>=80?"--ok":s>=60?"--warn":"--crit";
  const how=`Nasıl hesaplanır: 100 puandan başlar. Her sert fren −${PEN.fren}, sert hızlanma −${PEN.hizlanma}, `+
    `hız aşımı −${PEN.hiz}, yüksek devir −${PEN.devir} puan. Kesinti 10 km başınadır: 20 km'lik sürüşte yarıya iner; ${MIN_KM} km'den kısa sürüş ${MIN_KM} km sayılır. `+
    `Sert fren: hız bir saniyede ${fmt(-BRK_MIN*3.6,0)} km/sa ya da daha çok düşerse. Sert hızlanma: bir saniyede ${fmt(ACC_MAX*3.6,0)} km/sa ya da daha çok artarsa. `+
    `Hız aşımı: ayarlardaki hız sınırının üstünde ${OVER_MS/1000} saniyeden uzun kalmak. Yüksek devir: devir sınırının üstünde ${RPM_MS/1000} saniyeden uzun kalmak.`;
  function render(t){
    if(!t.scoreEvents){
      card.innerHTML=`<h2>Sürüş puanı</h2><p class="empty">Bu sürüş, puanlama eklenmeden önce kaydedildi; puan hesaplanamıyor.</p>`;
      return;
    }
    const ev=t.scoreEvents, c=compute(ev, tripKm(t)), s=t.score!=null && !(REC.trip&&REC.trip.id===t.id) ? t.score : c.score;
    const worst=TYPES.filter(k=>ev[k]).sort((a,b)=>ev[b]*PEN[b]-ev[a]*PEN[a]).slice(0,2);
    const tips=worst.length ? worst.map(k=>`<p class="sc-tip">${TIP[k]}</p>`).join("") : `<p class="sc-tip">Sakin ve düzgün bir sürüş. Böyle devam!</p>`;
    card.innerHTML=`<h2>Sürüş puanı</h2>
      <div class="sc-top"><b class="sc-num" style="color:var(${band(s)})">${s}</b><span>/ 100 · ${km(tripKm(t)*1000)}</span></div>
      <div class="stats">${TYPES.map(k=>`<div class="stat"><b>${ev[k]||0}</b><span><i class="sc-sw" style="background:var(${COLOR[k]})"></i>${LABEL[k]}</span></div>`).join("")}</div>
      ${tips}
      <p class="sub">${how}</p>`;
  }
  function markers(samples){
    if(!window.L || !V.map) return 0;   // harita yok (çevrimdışı ya da GPS kaydı yok)
    const cs=getComputedStyle(document.documentElement), col=n=>cs.getPropertyValue(n).trim();
    let n=0;
    for(const s of samples){
      if(!s.ev || s.lat==null) continue;
      for(const k of s.ev.split(",")){ if(!LABEL[k]) continue;
        L.circleMarker([s.lat,s.lon],{radius:7,color:col("--panel"),weight:2,fillColor:col(COLOR[k]),fillOpacity:1}).addTo(V.map)
          .bindPopup(new Date(s.t).toLocaleTimeString("tr-TR")+" — "+LABEL[k]+(s.v&&s.v["0D"]!=null?` (${fmt(s.v["0D"],0)} km/sa)`:""));
        n++; }
    }
    return n;
  }
  on("tripOpen",(t, samples)=>{ card.hidden=false; render(t); markers(samples||[]); });

  // ---- deneme modu ----
  // Deneme cihazının hızı sinüs dalgası; 0'a yaklaşırken ve 0'dan kalkarken eğimi ~4,4 m/s² olduğundan
  // her dalgada hem sert fren hem sert hızlanma sayılırdı. Hız değişimini sakin bir sürücü gibi
  // 9 km/sa/sn ile sınırlıyoruz; her üç dalgadan birinde fren sınırı kalkar ve bir "sert fren" oluşur.
  const origReply=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    const r=origReply.call(this,cmd);
    if(cmd!=="010D" || !/^410D[0-9A-F]{2}/.test(r)) return r;
    const target=parseInt(r.slice(4,6),16), now=Date.now(), k=Math.floor((now-this.t0)/1000/(12*Math.PI));
    const p=this._score;
    if(!p || now-p.ts>3000 || now<p.ts){ this._score={v:target,ts:now}; return r; }
    const dt=(now-p.ts)/1000, up=9, down=k%3===1?30:9;
    const v=target>p.v ? Math.min(target,p.v+up*dt) : Math.max(target,p.v-down*dt);
    this._score={v,ts:now};
    return "410D"+Math.round(v).toString(16).toUpperCase().padStart(2,"0")+r.slice(6);
  };

  return {ACC_MAX, BRK_MIN, WIN_MIN, WIN_MAX, OVER_MS, RPM_MS, PEN, MIN_KM, LABEL, detector, feedSpeed, feedRpm, compute, tripKm, render, card, live};
})();
