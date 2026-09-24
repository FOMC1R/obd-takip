// ---------- Güncel yakıt fiyatı (Ayarlar → Yakıt) ----------
// Fiyatlar günde üç kez GitHub Actions ile Petrol Ofisi'nden (yedek: Opet) çekilip data/prices.json'a yazılır
// (scripts/update-prices.mjs). Burada seçilen il/ilçe ve yakıt türüne göre litre fiyatı kendiliğinden ayarlanır.
// Kullanıcı fiyatı elle değiştirirse otomatik güncelleme kapanır; onun fiyatı ezilmez.
const PRICES = (()=>{
  // Önce GitHub'ın ham dosya adresi (betik yazdığı an güncel, tarayıcı erişimine açık), olmazsa sitenin kendi kopyası
  const SRC=["https://raw.githubusercontent.com/FOMC1R/obd-takip/main/data/prices.json","data/prices.json"];
  const CACHE_KEY="obdTakip.prices";
  const IDX={benzin:0, dizel:1, lpg:2};
  if(settings.priceAuto===undefined) settings.priceAuto=true;
  if(settings.priceCity===undefined) settings.priceCity="istanbul";
  if(settings.priceDistrict===undefined) settings.priceDistrict="";
  let data=null;
  try{ data=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); }catch(e){}
  if(!data || typeof data.iller!=="object" || !data.iller) data=null;   // bozuk/eski önbellek

  async function load(){
    for(const u of SRC){
      try{
        const r=await fetch(u,{cache:"no-cache"}); if(!r.ok) continue;
        const d=await r.json(); if(!d || !d.iller) continue;
        data=d; try{ localStorage.setItem(CACHE_KEY,JSON.stringify(d)); }catch(e){}
        return d;
      }catch(e){}
    }
    return data;
  }
  // Seçili yer ve yakıt için fiyat: {v, yer} ya da null
  function lookup(fuel=settings.fuel, city=settings.priceCity, dist=settings.priceDistrict){
    if(!data || !(fuel in IDX)) return null;
    const p=data.iller[city]; if(!p) return null;
    if(dist && p.ilce && p.ilce[dist] && p.ilce[dist][IDX[fuel]]!=null) return {v:p.ilce[dist][IDX[fuel]], yer:`${p.ad} / ${dist}`};
    const v=p.ort && p.ort[fuel]; return v!=null ? {v, yer:`${p.ad} (il ortalaması)`} : null;
  }
  function apply(){
    const f=lookup();
    if(settings.priceAuto && f && settings.price!==f.v){ settings.price=f.v; save(); if(typeof buildSettings==="function") buildSettings(); }
    paint();
    return f;
  }

  // ---- arayüz: Yakıt kartındaki fiyat alanının altına ----
  const box=document.createElement("div"); box.className="field"; box.id="priceAutoBox";
  box.innerHTML=`<label class="check"><input type="checkbox" id="priceAuto"> Fiyatı otomatik güncelle (günde 3 kez, Petrol Ofisi)</label>
    <div class="row" id="priceWhere" style="gap:8px">
      <select id="priceCity" aria-label="İl" style="flex:1 1 140px;min-width:0"></select>
      <select id="priceDistrict" aria-label="İlçe" style="flex:1 1 140px;min-width:0"></select>
    </div>
    <p class="sub" id="priceInfo" role="status"></p>`;
  const anchor=$("fuelPrice") && $("fuelPrice").closest ? $("fuelPrice").closest(".field") : null;
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else $("ext-ayar").appendChild(box);
  const selStyle="font:inherit;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--text)";
  ["priceCity","priceDistrict"].forEach(id=>{ const e=$(id); if(e && e.setAttribute) e.setAttribute("style",(e.getAttribute("style")||"")+";"+selStyle); });

  const trSort=(a,b)=>a.localeCompare(b,"tr");
  function fillSelects(){
    if(!data) return;
    const c=$("priceCity"), d=$("priceDistrict");
    c.innerHTML=""; Object.entries(data.iller).sort((a,b)=>trSort(a[1].ad,b[1].ad)).forEach(([k,p])=>{ const o=document.createElement("option"); o.value=k; o.textContent=p.ad; c.appendChild(o); });
    c.value=settings.priceCity;
    d.innerHTML=""; const all=document.createElement("option"); all.value=""; all.textContent="İl ortalaması"; d.appendChild(all);
    const p=data.iller[settings.priceCity];
    if(p && p.ilce) Object.keys(p.ilce).sort(trSort).forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent=n; d.appendChild(o); });
    d.value=settings.priceDistrict;
  }
  function paint(){
    const ev=settings.fuel==="elektrik";
    box.hidden=ev;
    $("priceAuto").checked=!!settings.priceAuto;
    $("priceWhere").hidden=!settings.priceAuto;
    const f=lookup(), info=$("priceInfo");
    if(!data){ info.textContent="Güncel fiyatlara henüz ulaşılamadı; internet gelince denenecek."; return; }
    const when=new Date(data.guncelleme).toLocaleString("tr-TR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"});
    info.textContent = !f ? "Bu yer ve yakıt türü için fiyat yok." :
      settings.priceAuto ? `${f.yer}: ${fmt(f.v,2)} TL · güncelleme ${when}` :
      `Otomatik güncelleme kapalı. Güncel fiyat ${f.yer}: ${fmt(f.v,2)} TL (${when}).`;
  }

  $("priceAuto").addEventListener("change",e=>{ settings.priceAuto=e.target.checked; save(); apply(); });
  $("priceCity").addEventListener("change",e=>{ settings.priceCity=e.target.value; settings.priceDistrict=""; save(); fillSelects(); apply(); });
  $("priceDistrict").addEventListener("change",e=>{ settings.priceDistrict=e.target.value; save(); apply(); });
  // Fiyatı elle yazarsa otomatik güncelleme kapanır (onun fiyatı korunsun)
  $("fuelPrice").addEventListener("change",()=>{ const f=lookup(); if(settings.priceAuto && (!f || settings.price!==f.v)){ settings.priceAuto=false; save(); paint(); } });
  // Yakıt türü değişince o türün güncel fiyatı (çekirdeğin varsayılanından sonra çalışır)
  $("fuelType").addEventListener("change",()=>setTimeout(apply,0));

  fillSelects(); apply();
  load().then(()=>{ fillSelects(); apply(); });
  setInterval(()=>load().then(apply), 6*3600*1000);   // uygulama saatlerce açık kalırsa
  return {load, lookup, apply, get data(){ return data; }, set data(d){ data=d; }};
})();
