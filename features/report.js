// ---------- Arıza raporu (PDF) — Arıza sekmesi ----------
// Arıza kodları, donmuş kare, muayene hazırlığı, sayaçlar, akü testi, son sürüş ve bakım durumunu tek sayfalık
// yazdırılabilir bir rapora döker. window.print() → Android Chrome'da "PDF olarak kaydet". Tema ne olursa olsun
// rapor beyaz zemin, siyah yazıdır; yazdırırken yalnızca rapor çıkar (@media print).
const Report = (()=>{
  let lastMil=null, lastScan=null;
  on("dtc",(d,mil)=>{ lastMil=!!mil; lastScan=Date.now(); });
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const KIND={stored:"Kayıtlı", pending:"Bekleyen (henüz kesinleşmedi)", perm:"Kalıcı (sorun giderilince silinir)"};
  const LEVEL={over:"Gecikti", soon:"Yaklaştı", ok:"Zamanı var", unknown:"Bilgi yok"};

  // Rapora girecek her şeyi tek nesnede topla (test edilebilsin diye HTML'den ayrı)
  async function collect(){
    const D=S.diag||{}, dtc=[], seen=new Set();
    for(const kind of ["stored","perm","pending"]) for(const code of (S.dtc&&S.dtc[kind])||[]){
      if(seen.has(code)) continue; seen.add(code); const i=dtcInfo(code); dtc.push({code, desc:i.desc, kind, severe:i.severe});
    }
    let trip=null;
    try{ const t=(await getTrips()).find(x=>!(REC.trip && REC.trip.id===x.id)) || (await getTrips())[0];
      if(t) trip={start:t.start, dur:t.end-t.start, km:t.distance?t.distance/1000:(t.odo||0), kmSrc:t.distance?"GPS":"hızdan", fuel:t.fuel||null,
        crit:t.events.filter(e=>e.level==="crit").map(e=>e.text), dtcs:t.dtcs||[], demo:!!t.demo, maxCool:t.stats&&t.stats["05"]?t.stats["05"].max:null};
    }catch(e){}
    const car=[settings.car,settings.carModel,settings.model].find(x=>typeof x==="string" && x.trim());
    return {now:Date.now(), connected:!!S.active, demo:typeof DemoLink!=="undefined" && S.link instanceof DemoLink, car:car||null,
      vehicle:D.vehicle||null, mil:lastMil, scanned:lastScan, dtc, freeze:D.freeze||null, ready:D.ready||null, counters:D.counters||null,
      batt:S.batt||null, trip, maint:typeof Maint!=="undefined" ? Maint.summary().filter(x=>x.level!=="unknown") : null,
      odo:settings.maint&&settings.maint.odo!=null?settings.maint.odo:null};
  }

  function html(d){
    const dt=ms=>new Date(ms).toLocaleString("tr-TR",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
    const rows=r=>`<table class="kvt">${r.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
    // iki sütunlu tablo: uzun listeler (donmuş kare) sayfaya sığsın
    const rows2=r=>{ let o=""; for(let i=0;i<r.length;i+=2){ const a=r[i], b=r[i+1]; o+=`<tr><th>${esc(a[0])}</th><td>${esc(a[1])}</td>${b?`<th>${esc(b[0])}</th><td>${esc(b[1])}</td>`:"<th></th><td></td>"}</tr>`; } return `<table class="kvt kv2">${o}</table>`; };
    const none=t=>`<p class="muted">${esc(t)}</p>`;
    let h=`<div class="rh"><h1>Araç arıza raporu</h1><div>${esc(dt(d.now))}${d.demo?" · DENEME VERİSİ":""}</div></div>`;
    // Araç
    const veh=[]; if(d.car) veh.push(["Araç",d.car]);
    (d.vehicle||[]).forEach(r=>veh.push(r));
    if(d.odo!=null) veh.push(["Kilometre (uygulamadaki)",`${fmt(d.odo,0)} km`]);
    h+=`<h2>Araç</h2>${veh.length?rows(veh):none("Araç bilgisi okunmadı.")}`;
    // Arıza kodları
    h+=`<h2>Arıza kodları</h2>`;
    h+= d.mil==null ? none("Arıza taraması yapılmadı. Rapordan önce araca bağlan.")
      : `<p class="${d.mil?"bad":""}"><b>Arıza lambası: ${d.mil?"YANIYOR":"sönük"}</b>${d.scanned?` · tarama ${esc(new Date(d.scanned).toLocaleTimeString("tr-TR"))}`:""}</p>`;
    if(d.dtc.length) h+=`<table class="dtct"><tr><th>Kod</th><th>Açıklama</th><th>Durum</th></tr>${d.dtc.map(x=>
      `<tr><td class="code">${esc(x.code)}</td><td>${esc(x.desc)}${x.severe?" <b>(ciddi)</b>":""}</td><td>${esc(KIND[x.kind])}</td></tr>`).join("")}</table>`;
    else if(d.mil!=null) h+=none("Motor beyninde kayıtlı arıza kodu yok.");
    // Donmuş kare
    h+=`<h2>Donmuş kare</h2><p class="muted">Arıza kodu oluştuğu anda motorun durumu.</p>${d.freeze&&d.freeze.length?rows([d.freeze[0]])+(d.freeze.length>1?rows2(d.freeze.slice(1)):""):none("Kayıtlı donmuş kare yok.")}`;
    // Muayene hazırlığı
    h+=`<h2>Muayene hazırlığı</h2>`;
    if(d.ready&&d.ready.items){ h+=`<p>${d.ready.open?`${d.ready.open} test henüz tamamlanmadı.`:"Tüm testler tamamlanmış."}</p>`+
      `<p class="cols">${d.ready.items.map(([n,ok])=>`${esc(n)}: <b>${ok?"tamam":"bekliyor"}</b>`).join(" · ")}</p>`; }
    else h+=none("Okunmadı.");
    // Sayaçlar
    h+=`<h2>Sayaçlar</h2>${d.counters&&d.counters.length?rows2(d.counters):none("Araç bu bilgileri vermiyor ya da okunmadı.")}`;
    // Akü
    h+=`<h2>Akü testi</h2>`;
    h+= d.batt ? `<p class="muted">${esc(dt(d.batt.time))}</p>${rows(d.batt.rows)}<p${d.batt.bad?' class="bad"':""}>${esc(d.batt.notes.join(" "))}</p>` : none("Akü testi yapılmadı.");
    // Son sürüş
    h+=`<h2>Son sürüş</h2>`;
    if(d.trip){ const t=d.trip, r=[["Tarih",dt(t.start)+(t.demo?" (deneme)":"")],["Süre",fmtDur(t.dur)],["Yol",`${fmt(t.km,1)} km (${t.kmSrc})`]];
      if(t.fuel) r.push(["Yakıt (tahmini)",`${fmt(t.fuel,2)} L${t.km>0.5?` · ${fmt(t.fuel/t.km*100,1)} L/100 km`:""}`]);
      if(t.maxCool!=null) r.push(["En yüksek su sıcaklığı",`${fmt(t.maxCool,0)} °C`]);
      r.push(["Kritik uyarı",t.crit.length?`${t.crit.length}: ${[...new Set(t.crit)].slice(0,4).join("; ")}${new Set(t.crit).size>4?" …":""}`:"yok"]);
      if(t.dtcs.length) r.push(["Sürüşte görülen kodlar",t.dtcs.join(", ")]);
      h+=rows(r); }
    else h+=none("Kayıtlı sürüş yok.");
    // Bakım
    if(d.maint){ h+=`<h2>Bakım durumu</h2>`;
      h+= d.maint.length ? rows2(d.maint.map(x=>[x.name,`${LEVEL[x.level]} — ${x.text}`])) : none("Bakım bilgisi girilmemiş."); }
    h+=`<p class="disc">Bu rapor, aracın OBD-II soketinden (standart arıza okuma bağlantısı) telefonla okunan bilgilerle hazırlanmıştır. Kesin teşhis değildir;
      açıklamalar genel kod anlamlarıdır ve üreticiye göre farklılık gösterebilir. Onarım kararı için yetkili servis ya da usta kontrolü gerekir. Uygulama araca hiçbir şey yazmaz.</p>`;
    return h;
  }

  // ----- Arayüz -----
  const css=document.createElement("style");
  css.textContent=`
  #rpt{position:fixed;inset:0;z-index:50;overflow:auto;background:#fff;color:#000;color-scheme:light}
  #rpt .rpt-bar{position:sticky;top:0;display:flex;gap:8px;padding:10px 16px;background:#f2f2f2;border-bottom:1px solid #ccc}
  #rpt .rpt-bar button{background:#fff;color:#000;border-color:#999}
  #rpt .rpt-bar button.primary{background:#000;color:#fff;border-color:#000}
  #rpt .rpt-page{max-width:760px;margin:0 auto;padding:14px 16px 40px;font:12px/1.35 Arial,"Helvetica Neue",sans-serif}
  #rpt h1{font:700 20px/1.2 Arial,sans-serif;margin:0}
  #rpt h2{font:700 13px/1.2 Arial,sans-serif;margin:12px 0 4px;padding-bottom:2px;border-bottom:1.5px solid #000;text-transform:uppercase;letter-spacing:.04em}
  #rpt .rh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:3px solid #000;padding-bottom:6px}
  #rpt p{margin:3px 0}
  #rpt table{width:100%;border-collapse:collapse;font-size:12px}
  #rpt th,#rpt td{border:1px solid #bbb;padding:3px 6px;text-align:left;vertical-align:top;white-space:normal;color:#000;text-transform:none;letter-spacing:0;font-size:inherit}
  #rpt .kvt th{width:38%;font-weight:400;background:#f4f4f4}
  #rpt .kvt td{font-weight:600;overflow-wrap:anywhere}
  #rpt .kv2 th{width:auto}
  #rpt .dtct th{background:#f4f4f4;font-weight:700}
  #rpt .code{font-weight:700;white-space:nowrap}
  #rpt .muted{color:#555}
  #rpt .bad{font-weight:700}
  #rpt .disc{margin-top:14px;font-size:10.5px;color:#333;border-top:1px solid #999;padding-top:6px}
  @page{size:A4;margin:10mm}
  @media print{
    body.printing>*:not(#rpt){display:none!important}
    body.printing{padding:0!important;background:#fff!important}
    #rpt{position:static!important;overflow:visible!important}
    #rpt .rpt-bar{display:none!important}
    #rpt .rpt-page{max-width:none;padding:0}
    #rpt h2,#rpt tr{break-inside:avoid}
    /* tek sayfaya sığsın */
    #rpt .rpt-page{font-size:10px;line-height:1.25}
    #rpt table{font-size:10px}
    #rpt th,#rpt td{padding:1px 5px}
    #rpt h1{font-size:16px}
    #rpt h2{font-size:11px;margin:7px 0 3px}
    #rpt p{margin:2px 0}
    #rpt .disc{margin-top:8px;font-size:9px}
  }`;
  document.head.appendChild(css);
  const card=document.createElement("section"); card.className="card"; card.setAttribute("aria-labelledby","rptTitle");
  card.innerHTML=`<h2 id="rptTitle">Arıza raporu</h2>
    <p class="sub">Arıza kodları, donmuş kare, muayene hazırlığı, akü testi, son sürüş ve bakım durumunu tek sayfada toplar. Ustaya ya da servise göstermek için: yazdırma ekranında <b>"PDF olarak kaydet"</b>i seç.</p>
    <div class="actions"><button class="primary" id="btnReport">Rapor oluştur (PDF)</button></div>`;
  $("ext-ariza").appendChild(card);
  let box=null;
  function close(){ if(box){ box.remove(); box=null; } document.body.classList.remove("printing"); }
  async function open(opt={}){
    const d=await collect();
    close();
    box=document.createElement("div"); box.id="rpt"; box.setAttribute("role","dialog"); box.setAttribute("aria-label","Arıza raporu");
    box.innerHTML=`<div class="rpt-bar"><button class="primary" id="rptPrint">Yazdır / PDF kaydet</button><button id="rptClose">Kapat</button></div><div class="rpt-page">${html(d)}</div>`;
    document.body.appendChild(box); document.body.classList.add("printing");
    box.querySelector("#rptPrint").addEventListener("click",()=>window.print());
    box.querySelector("#rptClose").addEventListener("click",close);
    if(opt.print!==false && typeof window.print==="function") setTimeout(()=>window.print(),300);
    return d;
  }
  $("btnReport").addEventListener("click",()=>open());
  // Adres sonunda "rapor" varsa (ör. #demo-ariza-rapor) raporu yazdırmadan aç — görsel kontrol için.
  // Deneme aracında kodlar ~40. saniyede çıkar; o yüzden 45 sn bekleyip teşhisi yeniler.
  if(/(^|-)rapor(-|$)/.test(location.hash.slice(1))) on("connect",()=>setTimeout(async()=>{ await scanDtc(); await runDiag(); open({print:false}); },45000));
  return {collect, html, open, close};
})();
