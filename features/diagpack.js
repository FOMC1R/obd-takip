// ---------- Tanılama paketi (Ayarlar sekmesi) ----------
// Uygulamayı gerçek araca göre geliştirebilmek için tek dosyada: cihaz/bağlantı bilgisi, aracın desteklediği
// değerler, ELM327 ile konuşmanın ham kaydı, araç durumu, canlı değerler, sürüş özetleri ve ayarlar.
// Gizlilik: API anahtarı, konum (enlem/boylam) ve masraf notları pakete girmez.
const DIAGPACK = (()=>{
  // ---- ELM327 konuşma kaydı: bağlantının ilk 80 komutu + son 300 komut ----
  const LOG = {first:[], last:[], session:0};
  const clip = s => String(s||"").replace(/\r/g,"\\r").replace(/\n/g,"\\n").slice(0,240);
  const origSend = Elm.prototype.send;
  Elm.prototype.send = function(cmd, timeout){
    const t0 = Date.now();
    const rec = r => { const e={t:t0, ms:Date.now()-t0, cmd, ...r};
      if(LOG.first.length<80) LOG.first.push(e); else { LOG.last.push(e); if(LOG.last.length>300) LOG.last.shift(); } };
    return origSend.call(this, cmd, timeout).then(
      r => { rec({resp:clip(r)}); return r; },
      e => { rec({err:String(e && e.message || e)}); throw e; });
  };
  on("connect", info => { LOG.session++; LOG.connect={t:Date.now(), ...info}; });

  const linkType = () => typeof DemoLink!=="undefined" && S.link instanceof DemoLink ? "deneme"
    : typeof SerialLink!=="undefined" && S.link instanceof SerialLink ? "klasik-bluetooth"
    : typeof BleLink!=="undefined" && S.link instanceof BleLink ? "ble" : null;

  // ---- paket ----
  async function build(opts={}){
    const now=Date.now();
    const live={};
    for(const g of GAUGES){ const st=S.g[g.pid]; if(!st) continue;
      live[g.pid]={name:g.name, unit:g.unit, v:st.v, ageMs:st.ts?now-st.ts:null, miss:st.miss, alarm:!!st.alarm,
        supported: g.read||g.virtual ? null : (S.supported ? S.supported.has(g.pid) : null)}; }
    // ayarlar: gizli ve kişisel alanlar çıkarılır
    const set=JSON.parse(JSON.stringify(settings));
    delete set.aiKey; delete set.expenses;
    let trips=[];
    try{ trips=await getTrips(); }catch(e){}
    const tripSum=trips.slice(0,20).map(t=>({start:new Date(t.start).toISOString(), dakika:Math.round((t.end-t.start)/60000), demo:!!t.demo,
      satir:t.samples, gpsKm:+((t.distance||0)/1000).toFixed(2), hizKm:+(t.odo||0).toFixed(2), yakitL:t.fuel!=null?+t.fuel.toFixed(3):null,
      puan:t.score??null, olaylar:(t.events||[]).map(e=>({saat:new Date(e.t).toLocaleTimeString("tr-TR"), seviye:e.level, metin:e.text})),
      kodlar:t.dtcs||[], ozet:Object.fromEntries(Object.entries(t.stats||{}).map(([k,s])=>[k,{min:s.min,max:s.max,ort:s.n?+(s.sum/s.n).toFixed(2):null}]))}));
    let lastTrip=null;
    if(opts.withSamples){
      const real=trips.find(t=>!t.demo);
      if(real){ const smp=await getSamples(real.id);
        // konum çıkarılır; yalnızca zaman, araç değerleri, GPS hızı ve doğruluğu kalır
        lastTrip={start:new Date(real.start).toISOString(), satirlar:smp.map(s=>({t:s.t, v:s.v, gs:s.gs, acc:s.acc, ev:s.ev}))}; }
    }
    return {
      paket:"OBD Takip tanılama paketi", surum:1, olusturma:new Date(now).toISOString(),
      cihaz:{tarayici:navigator.userAgent||null, ekran:(typeof screen!=="undefined"?`${screen.width}x${screen.height}`:null), dpr:window.devicePixelRatio||null,
        dil:navigator.language||null, webSerial:!!navigator.serial, webBluetooth:!!navigator.bluetooth},
      baglanti:{aktif:!!S.active, tur:linkType(), durum:(document.getElementById("statusText")||{}).textContent||null,
        protokol:S.proto||null, can:!!S.isCan, motorFiltresi:S.cra||null, voltajATRV:!!S.useAtrv, oturum:LOG.session, baglanma:LOG.connect||null},
      destekleyenPIDler:S.supported ? [...S.supported].sort() : null,
      aracDurumu:{kodlar:S.dtc||null, diag:S.diag||null, aku:S.batt||null, vin:opts.withVin ? (S.vin||null) : (S.vin ? S.vin.slice(0,3)+"…(gizlendi)" : null)},
      canliDegerler:live,
      uyarilar:[...(S.alarms||new Map()).entries()].map(([k,a])=>({k, seviye:a.level, metin:a.text})),
      gecmis:(S.log||[]).slice(0,60).map(e=>({saat:e.t.toLocaleTimeString?e.t.toLocaleTimeString("tr-TR"):e.t, seviye:e.level, metin:e.text})),
      elmKonusma:{ilk:LOG.first, son:LOG.last},
      suruslar:tripSum,
      sonGercekSurus:lastTrip,
      ayarlar:set,
    };
  }

  async function share(opts){
    const data=await build(opts), txt=JSON.stringify(data,null,1);
    const p2=n=>String(n).padStart(2,"0"), d=new Date();
    const name=`obd-tanilama_${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.json`;
    const blob=new Blob([txt],{type:"application/json"});
    try{
      const file=new File([blob],name,{type:"application/json"});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"OBD Takip tanılama paketi"}); return {name, size:txt.length, shared:true}; }
    }catch(e){ if(e && e.name==="AbortError") return {name, size:txt.length, shared:false}; }
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    return {name, size:txt.length, shared:false};
  }

  // ---- kart ----
  const card=document.createElement("section"); card.className="card"; card.setAttribute("aria-labelledby","dpTitle");
  card.innerHTML=`<h2 id="dpTitle">Tanılama paketi</h2>
    <p class="sub">Uygulamanın senin aracında nasıl çalıştığını gösteren tek bir dosya hazırlar. Geliştirme için gönderebilirsin.
    İçinde: cihaz ve bağlantı bilgisi, aracın hangi değerleri verdiği, cihazla konuşmanın ham kaydı, arıza durumu, canlı değerler ve sürüş özetleri.
    <b>Girmeyenler:</b> API anahtarı, konum (harita izi) ve masraf notları.</p>
    <label class="check"><input type="checkbox" id="dpSamples" checked> Son gerçek sürüşün ölçümlerini ekle (konumsuz)</label>
    <label class="check"><input type="checkbox" id="dpVin"> Şase numarasının tamamını ekle</label>
    <div class="actions"><button class="primary" id="dpBtn">Tanılama paketi gönder</button></div>
    <p class="sub" id="dpMsg" role="status"></p>`;
  $("ext-ayar").appendChild(card);
  $("dpBtn").addEventListener("click",async()=>{
    $("dpBtn").disabled=true; $("dpMsg").textContent="Hazırlanıyor…";
    try{
      const r=await share({withSamples:$("dpSamples").checked, withVin:$("dpVin").checked});
      $("dpMsg").textContent = r.shared ? `Paylaşıldı: ${r.name} (${fmt(r.size/1024,0)} KB)` : `Dosya hazırlandı: ${r.name} (${fmt(r.size/1024,0)} KB). İndirilenler klasörüne bak.`;
    }catch(e){ $("dpMsg").textContent="Paket hazırlanamadı: "+(e && e.message || e); }
    finally{ $("dpBtn").disabled=false; }
  });

  return {build, share, LOG};
})();
