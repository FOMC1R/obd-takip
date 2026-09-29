// ---------- Tam yedek ve geri yükleme (Ayarlar sekmesi) ----------
// Veriler yalnızca bu tarayıcıda duruyor: "tarayıcı verilerini sil" ya da telefon değiştirmek her şeyi siler.
// Yedek tek dosya: tüm ayarlar (araçlar, bakım, masraf, öğrenilmiş vitesler…) + sürüşler + ölçüm satırları.
// Telefonun kendi sıkıştırmasıyla (gzip) küçültülür; paylaş menüsüyle Drive/WhatsApp'a gider ya da indirilir.
// API anahtarı yalnız istenirse girer. Geri yükleme: "Birleştir" (eksik sürüşleri ekler, olanı tekrar eklemez)
// ya da "Tamamen geri yükle" (ayarlar ve sürüşler yedektekiyle değişir). Kalıcı: settings.lastBackup (ms).
const BACKUP = (()=>{
  const FORMAT="obd-takip-yedek", VER=1, REMIND_DAYS=30;
  if(settings.lastBackup===undefined) settings.lastBackup=null;

  const allSamples = async()=>idb((await os("samples")).getAll());
  const tripKey = t=>`${t.start}|${t.device||""}|${t.demo?1:0}`;

  async function build(opts={}){
    const set=JSON.parse(JSON.stringify(settings));
    if(!opts.withKey) delete set.aiKey;
    const trips=await getTrips(), samples=await allSamples();
    return {format:FORMAT, surum:VER, uygulama:typeof APP_VERSION!=="undefined"?APP_VERSION:null, olusturma:new Date().toISOString(),
      ayarlar:set, suruslar:trips, satirlar:samples};
  }
  // gzip: telefon (Chrome) destekliyorsa; yoksa düz JSON
  async function pack(obj){
    const txt=JSON.stringify(obj);
    if(typeof CompressionStream==="function"){
      const gz=await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
      return {blob:new Blob([gz],{type:"application/gzip"}), ext:"json.gz", raw:txt.length};
    }
    return {blob:new Blob([txt],{type:"application/json"}), ext:"json", raw:txt.length};
  }
  async function unpack(blob){
    const head=new Uint8Array(await blob.slice(0,2).arrayBuffer());
    let txt;
    if(head[0]===0x1f && head[1]===0x8b){
      if(typeof DecompressionStream!=="function") throw new Error("Bu tarayıcı sıkıştırılmış yedeği açamıyor.");
      txt=await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } else txt=await blob.text();
    let o; try{ o=JSON.parse(txt); }catch(e){ throw new Error("Dosya okunamadı: yedek dosyası değil ya da bozuk."); }
    if(!o || o.format!==FORMAT) throw new Error("Bu dosya bir OBD Takip yedeği değil.");
    if(o.surum>VER) throw new Error("Yedek daha yeni bir sürümle alınmış; önce uygulamayı güncelle.");
    if(!Array.isArray(o.suruslar) || !Array.isArray(o.satirlar) || typeof o.ayarlar!=="object") throw new Error("Yedek eksik.");
    return o;
  }

  async function exportFile(opts){
    const {blob, ext, raw}=await pack(await build(opts));
    const p2=n=>String(n).padStart(2,"0"), d=new Date();
    const name=`obd-takip-yedek_${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}.${ext}`;
    settings.lastBackup=Date.now(); save();
    try{
      const file=new File([blob],name,{type:blob.type});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"OBD Takip yedeği"}); return {name, size:blob.size, raw, shared:true}; }
    }catch(e){ if(e && e.name==="AbortError") return {name, size:blob.size, raw, shared:false, cancelled:true}; }
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    return {name, size:blob.size, raw, shared:false};
  }

  // Birleştir: aynı sürüş (başlangıç + cihaz) zaten varsa atlanır; yeni sürüşlere yeni numara verilir,
  // satırlar yeni numaraya bağlanır. Ayarlardan yalnız eksik araçlar eklenir (mevcut ayarlar korunur).
  async function merge(o){
    const have=new Set((await getTrips()).map(tripKey));
    const byTrip=new Map(); for(const s of o.satirlar){ if(!byTrip.has(s.trip)) byTrip.set(s.trip,[]); byTrip.get(s.trip).push(s); }
    let added=0, rows=0;
    for(const t of o.suruslar){
      if(have.has(tripKey(t))) continue;
      const old=t.id, copy={...t}; delete copy.id; delete copy.open;
      const id=await putTrip(copy);
      const smp=(byTrip.get(old)||[]).map(s=>({...s, trip:id}));
      for(let i=0;i<smp.length;i+=2000) await addSamples(smp.slice(i,i+2000));
      added++; rows+=smp.length; have.add(tripKey(t));
    }
    const vs=o.ayarlar.vehicles||{};
    if(!settings.vehicles || typeof settings.vehicles!=="object") settings.vehicles={};
    let veh=0; for(const k in vs) if(!settings.vehicles[k] && k!==settings.activeVehicle){ settings.vehicles[k]=vs[k]; veh++; }
    save();
    return {added, rows, veh};
  }
  // Tamamen geri yükle: ayarlar ve tüm sürüşler yedektekiyle değişir (API anahtarı yedekte yoksa mevcut korunur)
  async function replace(o){
    const key=settings.aiKey;
    const d=await dbOpen(), tx=d.transaction(["trips","samples"],"readwrite");
    tx.objectStore("trips").clear(); tx.objectStore("samples").clear();
    await done(tx);
    for(const t of o.suruslar){ const c={...t}; delete c.open; await putTrip(c); }   // numaralar korunur (satırlar bağlı)
    for(let i=0;i<o.satirlar.length;i+=2000) await addSamples(o.satirlar.slice(i,i+2000));
    Object.keys(settings).forEach(k=>delete settings[k]);
    Object.assign(settings, defaults(), o.ayarlar);
    if(!settings.aiKey && key) settings.aiKey=key;
    settings.lastBackup=o.ayarlar.lastBackup||Date.now();
    save();
    return {added:o.suruslar.length, rows:o.satirlar.length};
  }

  // ---- kart ----
  const card=document.createElement("section"); card.className="card"; card.setAttribute("aria-labelledby","bkTitle");
  card.innerHTML=`<h2 id="bkTitle">Yedekle ve geri yükle</h2>
    <p class="sub">Sürüşler, bakım, masraf ve ayarlar yalnızca bu telefonda, tarayıcının içinde duruyor. Tarayıcı verilerini silersen ya da telefon değiştirirsen kaybolur.
    Yedek dosyasını Drive'a ya da kendine WhatsApp'la gönder.</p>
    <p class="sub" id="bkLast"></p>
    <label class="check"><input type="checkbox" id="bkKey"> API anahtarını da yedeğe koy (dosyayı kimseyle paylaşma)</label>
    <div class="actions"><button class="primary" id="bkExport">Yedek al</button><button id="bkImport">Yedekten geri yükle</button></div>
    <input type="file" id="bkFile" accept=".gz,.json,application/gzip,application/json" hidden>
    <div class="confirm" id="bkAsk" hidden><div><b id="bkAskText"></b><p class="sub">Birleştir: eksik sürüşleri ve araçları ekler, mevcut ayarlarına dokunmaz.
      Tamamen geri yükle: ayarlar ve bütün sürüşler yedektekiyle değişir (yeni telefon için).</p></div>
      <div class="actions"><button class="primary" id="bkMerge">Birleştir</button><button class="danger" id="bkReplace">Tamamen geri yükle</button><button id="bkCancel">Vazgeç</button></div></div>
    <p class="sub" id="bkMsg" role="status"></p>`;
  $("ext-ayar").appendChild(card);
  const days=()=>settings.lastBackup ? Math.floor((Date.now()-settings.lastBackup)/86400000) : null;
  function paint(){
    const d=days();
    $("bkLast").textContent = d==null ? "Henüz yedek alınmadı." : d===0 ? "Son yedek: bugün." : `Son yedek: ${d} gün önce.`;
  }
  paint();
  const busy=v=>{ $("bkExport").disabled=$("bkImport").disabled=v; };
  $("bkExport").addEventListener("click",async()=>{
    busy(true); $("bkMsg").textContent="Yedek hazırlanıyor…";
    try{
      const r=await exportFile({withKey:$("bkKey").checked});
      $("bkMsg").textContent = r.cancelled ? "Paylaşım iptal edildi." : `${r.shared?"Paylaşıldı":"İndirildi"}: ${r.name} (${fmt(r.size/1024,0)} KB).`;
    }catch(e){ $("bkMsg").textContent="Yedek alınamadı: "+(e && e.message || e); }
    finally{ busy(false); paint(); }
  });
  let pending=null;
  $("bkImport").addEventListener("click",()=>{ $("bkFile").value=""; $("bkFile").click(); });
  $("bkFile").addEventListener("change",async e=>{
    const f=e.target.files && e.target.files[0]; if(!f) return;
    try{
      pending=await unpack(f);
      const when=pending.olusturma ? new Date(pending.olusturma).toLocaleDateString("tr-TR") : "?";
      $("bkAskText").textContent=`${when} tarihli yedek: ${pending.suruslar.length} sürüş, ${fmt(pending.satirlar.length,0)} ölçüm satırı.`;
      $("bkAsk").hidden=false; $("bkMsg").textContent="";
    }catch(x){ pending=null; $("bkMsg").textContent=x.message; }
  });
  const finish=async(fn,label)=>{
    if(!pending) return; $("bkAsk").hidden=true; busy(true); $("bkMsg").textContent="Geri yükleniyor…";
    try{
      if(S.active) stop();
      const r=await fn(pending); pending=null;
      $("bkMsg").textContent = label(r);
      renderTrips(); buildSettings(); buildGauges(); paint();
      emit("restored", r);
    }catch(x){ $("bkMsg").textContent="Geri yüklenemedi: "+(x && x.message || x); }
    finally{ busy(false); }
  };
  $("bkMerge").addEventListener("click",()=>finish(merge, r=>`${r.added} sürüş (${fmt(r.rows,0)} satır) ve ${r.veh} araç eklendi.`));
  $("bkReplace").addEventListener("click",()=>finish(async o=>{ const r=await replace(o); setTimeout(()=>{ try{ location.reload(); }catch(e){} }, 1500); return r; },
    r=>`Geri yüklendi: ${r.added} sürüş. Uygulama yeniden açılıyor…`));
  $("bkCancel").addEventListener("click",()=>{ pending=null; $("bkAsk").hidden=true; });

  // Hatırlatma: yeterince kayıt varsa ve uzun süredir yedek yoksa bir kez (açılışta) uyarı geçmişine yaz
  setTimeout(async()=>{
    try{
      const d=days(), n=(await getTrips()).filter(t=>!t.demo).length;
      if(n>=3 && (d==null || d>=REMIND_DAYS)) addLog("warn", d==null ? "Hiç yedek alınmamış. Ayarlar → Yedekle ve geri yükle." : `Son yedek ${d} gün önce. Ayarlar → Yedekle ve geri yükle.`);
    }catch(e){}
  }, 4000);

  return {build, pack, unpack, merge, replace, exportFile, days};
})();
