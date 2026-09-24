// ---------- Araçlarım: birden çok araç, her birinin ayrı ayarları ----------
// Bağlanınca araç şase numarasının (VIN) ilk 11 hanesinden tanınır (seri numarası kısmı kullanılmaz, saklanmaz).
// Şase numarası okunamazsa iletişim türü + desteklenen değerler listesinden bir "imza" çıkarılır; kullanıcı adını yazar.
// Her aracın kendine ait ayarları (sınırlar, yakıt, bakım, masraf, gösterge düzeni…) araç değişince yer değiştirir.
// Model bilgisi features/vehicles-data.js tablosundan; bulunamazsa (çevrimiçiyken) NHTSA vPIC'e yalnızca ilk 11 hane sorulur.
const VEH = (()=>{
"use strict";
const D = typeof VEHICLE_DATA!=="undefined" ? VEHICLE_DATA : {wmi:{}, presets:{}, models:[]};
// Araca özel ayar anahtarları. Geri kalanlar (sekme, ses, ön cam, yakıt fiyatı yeri, yapay zekâ anahtarı…) ortaktır.
// customPids (içe aktarılan özel değerler) ortak kaldı: göstergeleri uygulama açılırken bir kez kuruluyor.
const PER = ["lim","fuel","disp","ve","calib","carModel","maint","expenses","evProfile","evPrev","layout","perf"];
const FUELS = {benzin:"Benzin", dizel:"Dizel", lpg:"LPG", elektrik:"Elektrik"};
if(!settings.vehicles || typeof settings.vehicles!=="object") settings.vehicles={};
if(settings.activeVehicle===undefined) settings.activeVehicle=null;
if(settings.legacyVehicle===undefined) settings.legacyVehicle=null;   // eski (araç damgasız) sürüşlerin sahibi
if(settings.tripsAll===undefined) settings.tripsAll=false;
const V = ()=>settings.vehicles;
// Çekirdeğin üretici listesinde olmayan kodlar
for(const [k,v] of Object.entries(D.wmiLabel||{})) if(!WMI[k]) WMI[k]=v;

const st = {sig:null, demo:null, editing:null, deleting:null, vpicBusy:false, real:false};
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = x=>x===undefined ? undefined : JSON.parse(JSON.stringify(x));

// ================= 1) Şase numarasından model =================
// Tablo satırı: {wmi, vds:"LZ???" (4-8. haneler; ? = her şey, baştan eşleşir), marka, model, yil, motor, yakit, preset, guven, kaynak}
function vdsMatch(pat, vds){ for(let i=0;i<pat.length;i++){ if(pat[i]!=="?" && pat[i]!==vds[i]) return false; } return true; }
function decode(vin){
  const v=String(vin||"").toUpperCase(), wmi=v.slice(0,3), vds=v.slice(3,8);
  if(v.length<3) return null;
  let best=null, score=-1;
  for(const m of D.models){
    if(m.wmi!==wmi || !vdsMatch(m.vds, vds)) continue;
    const sc=m.vds.replace(/\?/g,"").length;
    if(sc>score){ best=m; score=sc; }
  }
  const marka=(D.wmi||{})[wmi] || (WMI[wmi]||"").replace(/\s*\(.*\)$/,"") || "";
  if(!best) return marka ? {marka, model:"", kaynak:"marka", guven:"yüksek"} : null;
  const pr=best.preset ? D.presets[best.preset]||{} : {};
  return {marka:best.marka||marka, model:best.model||"", yil:best.yil||"", motor:best.motor||pr.motor||"", yakit:best.yakit||pr.yakit||"",
    preset:best.preset||null, guven:best.guven||"düşük", kaynak:"tablo"};
}
const title = p=>p ? (p.ad || [p.marka,p.model].filter(Boolean).join(" ") || "Adsız araç") : "";
const modelText = p=>[p.marka,p.model].filter(Boolean).join(" ")+(p.motor?` ${p.motor}`:"")+(p.yil?` (${p.yil})`:"");
const carModelText = p=>{ const s=[p.marka,p.model,p.motor].filter(Boolean).join(" "); return s ? s+(p.yakit?`, ${p.yakit}`:"") : ""; };

// ================= 2) Araca özel ayarlar =================
function freshCfg(){
  const d=defaults();
  GAUGES.forEach(g=>{ if(!d.lim[g.pid]) d.lim[g.pid]={show:!g.hide,min:g.min??null,max:g.max??null}; });
  return {lim:d.lim, fuel:d.fuel, disp:d.disp, ve:d.ve, calib:d.calib, carModel:"",
    maint:{odo:null, odoSrc:null, odoAt:null, items:{}, warnDay:null}, expenses:[], evProfile:"auto", evPrev:null,
    layout:{order:[], size:{}}, perf:{}};
}
// Hazır seçimin (ör. Fluence K4M) önerdiği ayarlar. onlyDefault: yalnızca hâlâ varsayılanda duran alanlar değişir
function applyPreset(cfg, preset, onlyDefault){
  const pr=D.presets[preset]; if(!pr) return cfg;
  const d=freshCfg(), set=(k,v)=>{ if(v===undefined) return; if(!onlyDefault || JSON.stringify(cfg[k])===JSON.stringify(d[k])) cfg[k]=v; };
  set("fuel", pr.yakit); set("disp", pr.disp); set("evProfile", pr.evProfile);
  for(const [pid,o] of Object.entries(pr.lim||{})){
    const L=cfg.lim[pid]; if(!L) continue;
    for(const [k,v] of Object.entries(o)) if(!onlyDefault || L[k]===d.lim[pid][k]) L[k]=v;
  }
  return cfg;
}
// Nesne/dizi ayarlarını yerinde değiştir: eklentiler (ör. bakım) nesneyi açılışta bir kez yakalıyor
function putIn(k, val){
  const cur=settings[k];
  if(cur && val && typeof cur==="object" && typeof val==="object" && Array.isArray(cur)===Array.isArray(val)){
    if(Array.isArray(cur)){ cur.length=0; cur.push(...val); }
    else { Object.keys(cur).forEach(x=>delete cur[x]); Object.assign(cur, val); }
  } else settings[k]=val;
}
function stashActive(){
  const p=V()[settings.activeVehicle]; if(!p) return;
  PER.forEach(k=>{ p[k]=clone(settings[k]); });
}
function switchTo(key, why){
  const p=V()[key]; if(!p || key===settings.activeVehicle) return false;
  const oldFuel=settings.fuel;
  stashActive();
  const f=freshCfg();
  PER.forEach(k=>{ putIn(k, k in p ? p[k] : f[k]); delete p[k]; });
  GAUGES.forEach(g=>{ if(!settings.lim[g.pid]) settings.lim[g.pid]={show:!g.hide,min:g.min??null,max:g.max??null}; });
  if(!settings.maint.items) settings.maint.items={};
  settings.activeVehicle=key;
  fixPrice(oldFuel);
  save(); refreshAll();
  if(why) addLog("warn", `Araç değişti: ${title(p)}. Bu aracın ayarları kullanılıyor.`);
  return true;
}
// Yakıt fiyatı ortak ayar; araçların yakıtı farklıysa fiyat yeni yakıtın fiyatına geçer (elle girilmiş özel fiyat değilse)
function fixPrice(oldFuel){
  const nf=settings.fuel; if(nf===oldFuel) return;
  const f = typeof PRICES!=="undefined" && PRICES.lookup ? PRICES.lookup(nf) : null;
  if(settings.priceAuto && f) settings.price=f.v;
  else if(settings.priceAuto || settings.price===FUEL_PRICE[oldFuel]) settings.price=FUEL_PRICE[nf]||settings.price;
}
function refreshAll(){
  if(typeof EVA!=="undefined" && EVA.st) EVA.st.detected=null;
  try{ buildSettings(); buildGauges(); GAUGES.forEach(paintGauge); }catch(e){ console.error(e); }
  for(const r of [()=>Maint.render(), ()=>Expenses.render()]) try{ r(); }catch(e){}
  const car=$("aiCar"); if(car && "value" in car) car.value=settings.carModel||"";
  if(typeof EVA!=="undefined" && S.active && settings.fuel==="elektrik" && settings.evProfile==="auto") EVA.detect().catch(()=>{});
  renderTrips(); render();
}

// ================= 3) Tanıma =================
function signature(){
  const pids=S.supported ? [...S.supported].filter(p=>parseInt(p,16)<0x60).sort().join("") : "";
  let h=0; for(const c of pids) h=(h*31+c.charCodeAt(0))>>>0;
  return `${S.proto||"?"}-${S.cra?"f":"n"}-${pids ? h.toString(36) : "yok"}`;
}
function makeProfile(key, info, sig, how){
  const i=info||{};
  return {ad:"", marka:i.marka||"", model:i.model||"", yil:i.yil||"", motor:i.motor||"", yakit:i.yakit||"", preset:i.preset||null,
    guven:i.guven||"", kaynak:i.kaynak||"", how, sig, created:Date.now(), lastSeen:Date.now(), pending:true};
}
// Bağlı aracı tanı: yeni ise profil aç, gerekirse o araca geç, sürüşü damgala
function identify(vin, opts={}){
  const vs=V(), sig=opts.sig||st.sig||signature();
  const ok=typeof vin==="string" && vin.length===17;
  let key = ok ? vin.slice(0,11) : (Object.keys(vs).find(k=>vs[k].sig===sig) || "sig:"+sig);
  const info = ok ? decode(vin) : null;
  if(opts.demo){
    st.demo={key, ...makeProfile(key, info, sig, ok?"vin":"sig")};
    showConfirm(); modelRow(); render(); return st.demo;
  }
  let p=vs[key];
  if(!p){
    const first=!Object.keys(vs).length;
    p=vs[key]=makeProfile(key, info, sig, ok?"vin":"sig");
    if(first){
      // İlk araç (eski tek araçlı kullanım dahil): mevcut ayarlar bu aracın olur, hiçbir şey kaybolmaz.
      // Tablonun önerileri yalnızca hâlâ varsayılanda duran alanlara uygulanır.
      settings.activeVehicle=key; settings.legacyVehicle=key;
      const cur={}; PER.forEach(k=>cur[k]=settings[k]);
      if(p.preset) applyPreset(cur, p.preset, true);
      PER.forEach(k=>{ if(cur[k]!==settings[k]) settings[k]=cur[k]; });
      p.yakit=settings.fuel;
      if(!String(settings.carModel||"").trim() && carModelText(p)){ settings.carModel=carModelText(p); p.autoCar=settings.carModel; }
      refreshAll();
    }else{
      const c=freshCfg(); if(p.preset) applyPreset(c, p.preset, false);
      if(p.yakit && !p.preset) c.fuel=p.yakit in FUELS ? p.yakit : c.fuel;
      c.carModel=carModelText(p); p.autoCar=c.carModel;
      Object.assign(p, c);
      if(!p.yakit) p.yakit=c.fuel;
    }
  }
  p.lastSeen=Date.now(); if(!p.sig) p.sig=sig;
  if(settings.activeVehicle!==key) switchTo(key, true);
  stamp(key);
  save(); modelRow(); if(p.pending) showConfirm(); render();
  if(ok && (!info || info.kaynak!=="tablo")) vpic(vin, key);
  return p;
}
function stamp(key){
  const t=REC.trip; if(!t || t.vehicle) return;
  t.vehicle=key; putTrip(t).catch(()=>{}); renderTrips();
}
// Arıza → Araç durumu: tanınan model satırı
function modelRow(){
  const p=st.demo || V()[settings.activeVehicle]; if(!p || !S.diag || !Array.isArray(S.diag.vehicle)) return;
  const rows=S.diag.vehicle.filter(r=>r[0]!=="Model");
  const txt = p.model || p.ad ? modelText(p) || title(p) : p.marka ? `${p.marka} (model bilinmiyor)` : ""; if(!txt) return;
  const i=rows.findIndex(r=>r[0]==="Üretici");
  rows.splice(i<0?rows.length:i+1, 0, ["Model", txt]);
  S.diag.vehicle=rows; kv($("vehInfo"), rows);
}

// ================= 4) Yedek: NHTSA vPIC (yalnızca ilk 11 hane, çevrimiçiyken, sonuç saklanır) =================
// https://vpic.nhtsa.dot.gov/api/ — tarayıcıdan erişime açık (Access-Control-Allow-Origin: *). Avrupa pazarı araçların
// çoğunda yalnızca üretici adını verir (Renault, Opel); ABD/Japon/Kore kökenli araçlarda model de gelir.
// Verdiği model yılı Avrupa araçlarında yanlıştır (VF1LZB10A44 → 2004 diyor); yıl alınmaz.
const VPIC_KEY="obdTakip.vpic";
async function vpicLookup(vin11){
  let cache={}; try{ cache=JSON.parse(localStorage.getItem(VPIC_KEY)||"{}")||{}; }catch(e){}
  if(cache[vin11]) return cache[vin11];
  if(typeof navigator!=="undefined" && navigator.onLine===false) return null;
  const r=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin11)}?format=json`);
  if(!r.ok) return null;
  const x=((await r.json()).Results||[])[0]||{};
  const fuel={Gasoline:"benzin", Diesel:"dizel", Electric:"elektrik"}[x.FuelTypePrimary]||"";
  const tc=s=>String(s||"").toLowerCase().replace(/(^|[\s-])\S/g,c=>c.toUpperCase());
  const out={marka:tc(x.Make), model:x.Model||"", motor:x.DisplacementL?`${(+x.DisplacementL).toFixed(1)} L`:"", yakit:fuel};
  cache[vin11]=out; try{ localStorage.setItem(VPIC_KEY, JSON.stringify(cache)); }catch(e){}
  return out;
}
async function vpic(vin, key){
  if(st.vpicBusy) return; st.vpicBusy=true;
  try{
    const r=await vpicLookup(vin.slice(0,11)); const p=V()[key];
    if(!r || !p || !p.pending || p.edited) return;
    let changed=false;
    if(r.marka && !p.marka){ p.marka=r.marka; changed=true; }
    if(r.model && !p.model){ p.model=r.model; p.motor=p.motor||r.motor; p.kaynak="vpic"; p.guven="orta"; changed=true; }
    if(changed){ save(); modelRow(); showConfirm(); render(); }
  }catch(e){}finally{ st.vpicBusy=false; }
}

// ================= 5) Arayüz =================
const css=document.createElement("style");
css.textContent=`
#vehConfirm{border-color:var(--accent)}
#vehConfirm .vc-t{font-weight:700;font-size:17px}
.veh-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.veh-list>li{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:6px;background:var(--panel-2)}
.veh-list .vn{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:700}
.veh-list .actions,#vehConfirm .actions{flex-wrap:wrap}
.veh-form{display:grid;gap:10px;grid-template-columns:1fr 1fr}
.veh-form .field{min-width:0}
.veh-form .wide{grid-column:1/-1}
.trip .chip.veh{text-transform:none;letter-spacing:0;color:var(--accent)}
#tripsVehRow{margin:4px 0 8px}
`;
document.head.appendChild(css);

// Yeni araç kartı: Canlı sekmesinin başında
const conf=document.createElement("section"); conf.className="card"; conf.id="vehConfirm"; conf.hidden=true;
conf.setAttribute("aria-live","polite");
{ const idle=$("idleCard"); if(idle && idle.parentNode && idle.insertAdjacentElement) idle.insertAdjacentElement("afterend", conf); else $("ext-canli").appendChild(conf); }
// Ayarlar → Araçlarım
const card=document.createElement("section"); card.className="card"; card.id="vehCard";
$("ext-ayar").appendChild(card);
// Sürüşler: yalnızca bu araç / tüm araçlar
const tRow=document.createElement("div"); tRow.id="tripsVehRow"; tRow.hidden=true;
tRow.innerHTML=`<label class="check"><input type="checkbox" id="tripsAll"> Tüm araçların sürüşlerini göster</label><p class="sub" id="tripsVehNote"></p>`;
{ const ul=$("trips"); if(ul && ul.parentNode && ul.parentNode.insertBefore) ul.parentNode.insertBefore(tRow, ul); else $("ext-surus").appendChild(tRow); }
const tAll=tRow.querySelector("#tripsAll");
tAll.addEventListener("change",e=>{ settings.tripsAll=!!e.target.checked; save(); renderTrips(); });

function presetOptions(sel){
  return `<option value="">— Listeden seç (isteğe bağlı) —</option>`+Object.entries(D.presets).map(([k,p])=>
    `<option value="${k}"${k===sel?" selected":""}>${esc(p.ad)}</option>`).join("");
}
function formHtml(p, id){
  const f=(k,l,ph)=>`<div class="field"><label for="${id}_${k}">${l}</label><input id="${id}_${k}" type="text" autocomplete="off" maxlength="40" value="${esc(p[k])}" placeholder="${ph||""}"></div>`;
  return `<div class="veh-form">
    <div class="field wide"><label for="${id}_preset">Hazır seçim</label><select id="${id}_preset">${presetOptions(p.preset)}</select></div>
    <div class="field wide"><label for="${id}_ad">Kısa ad (listede görünür)</label><input id="${id}_ad" type="text" autocomplete="off" maxlength="40" value="${esc(p.ad)}" placeholder="${esc([p.marka,p.model].filter(Boolean).join(" ")||"Örn. Benim araba")}"></div>
    ${f("marka","Marka","Renault")}${f("model","Model","Fluence")}${f("yil","Yıl","2012")}${f("motor","Motor","1.6 16V")}
    <div class="field wide"><label for="${id}_yakit">Yakıt</label><select id="${id}_yakit">${Object.entries(FUELS).map(([k,v])=>`<option value="${k}"${(p.yakit||"benzin")===k?" selected":""}>${v}</option>`).join("")}</select></div>
  </div>`;
}
function readForm(root, id){
  const g=k=>{ const e=root.querySelector("#"+id+"_"+k); return e ? String(e.value||"").trim() : ""; };
  return {preset:g("preset")||null, ad:g("ad"), marka:g("marka"), model:g("model"), yil:g("yil"), motor:g("motor"), yakit:g("yakit")};
}
function wirePreset(root, id){
  const sel=root.querySelector("#"+id+"_preset"); if(!sel) return;
  sel.addEventListener("change",()=>{
    const pr=D.presets[sel.value]; if(!pr) return;
    for(const k of ["marka","model","motor","yakit"]){ const e=root.querySelector("#"+id+"_"+k); if(e && pr[k]!=null) e.value=pr[k]; }
  });
}
// Düzeltilen bilgiyi kaydet; etkin araçsa yakıt ve yapay zekâ için araç adı da güncellenir
function applyEdit(key, x){
  const p=V()[key]; if(!p) return;
  const oldPreset=p.preset, oldFuel=key===settings.activeVehicle ? settings.fuel : p.fuel;
  Object.assign(p, {ad:x.ad, marka:x.marka, model:x.model, yil:x.yil, motor:x.motor, yakit:x.yakit in FUELS ? x.yakit : p.yakit, preset:x.preset||p.preset});
  p.pending=false; p.edited=true;
  const active=key===settings.activeVehicle, cfg=active ? settings : p;
  if(x.preset && x.preset!==oldPreset){
    const tmp={}; PER.forEach(k=>tmp[k]=cfg[k]); applyPreset(tmp, x.preset, false); PER.forEach(k=>{ if(tmp[k]!==cfg[k]) cfg[k]=tmp[k]; });
  }
  if(p.yakit) cfg.fuel=p.yakit;
  const auto=carModelText(p);
  if(!String(cfg.carModel||"").trim() || cfg.carModel===p.autoCar){ cfg.carModel=auto; p.autoCar=auto; }
  if(active){ fixPrice(oldFuel); save(); refreshAll(); } else save();
  modelRow();
}

function showConfirm(){
  const demo=!!st.demo, p=st.demo || V()[settings.activeVehicle];
  if(!p || !p.pending){ conf.hidden=true; return; }
  const key=demo ? st.demo.key : settings.activeVehicle;
  const name=modelText(p) || (p.how==="sig" ? "Şase numarasını vermeyen bir araç" : "Bilinmeyen araç");
  const known=p.kaynak==="tablo" || p.kaynak==="vpic";
  const editing=st.editing===key;
  conf.hidden=false;
  conf.innerHTML=`<div class="vc-t">${known?"Yeni araç tanındı":"Yeni araç bağlandı"}: ${esc(name)}${known?" — doğru mu?":""}</div>
    <p class="sub">${demo ? "Deneme: bu araç kaydedilmez." :
      known ? "Bu aracın sınırları, yakıtı, bakım ve masraf kayıtları ayrı tutulacak." + (p.guven && p.guven!=="yüksek" ? " Model bilgisi kesin değil (şase numarasından tahmin)." : "") :
      p.how==="sig" ? "Araç şase numarasını (VIN) vermedi. Aracı tanıyabilmemiz için adını ve modelini yaz." :
      "Markası bulundu ama modeli bilinmiyor. Modelini yazarsan yapay zekâ ve bakım önerileri daha doğru olur."}</p>
    ${editing ? formHtml(p,"vcf")+`<div class="actions"><button id="vcCancel">Vazgeç</button><button class="primary" id="vcSave">Kaydet</button></div>`
      : `<div class="actions"><button id="vcFix">${known?"Düzelt":"Bilgileri yaz"}</button><button class="primary" id="vcYes">${known?"Evet":"Böyle kalsın"}</button></div>`}`;
  const q=s=>conf.querySelector(s);
  if(editing){
    wirePreset(conf,"vcf");
    q("#vcCancel").addEventListener("click",()=>{ st.editing=null; showConfirm(); });
    q("#vcSave").addEventListener("click",()=>{
      const x=readForm(conf,"vcf"); st.editing=null;
      if(demo){ Object.assign(st.demo, x, {pending:false}); conf.hidden=true; modelRow(); render(); return; }
      applyEdit(key, x); conf.hidden=true; render();
    });
  }else{
    q("#vcFix").addEventListener("click",()=>{ st.editing=key; showConfirm(); });
    q("#vcYes").addEventListener("click",()=>{ p.pending=false; if(!demo) save(); conf.hidden=true; render(); });
  }
}

function render(){
  const vs=V(), keys=Object.keys(vs).sort((a,b)=>(vs[b].lastSeen||0)-(vs[a].lastSeen||0));
  const busy=!!S.active;
  let h=`<h2>Araçlarım</h2>
    <p class="sub">Bağlandığın araç şase numarasından (VIN) tanınır. Her aracın uyarı sınırları, yakıtı, bakım ve masraf kayıtları ayrı tutulur. Şase numarasının yalnızca ilk 11 hanesi (marka, model, fabrika) kullanılır; model tabloda yoksa bu 11 hane internetten NHTSA'ya (ABD trafik güvenliği kurumu) sorulur.</p>`;
  if(!keys.length && !st.demo) h+=`<p class="empty">Henüz araç yok. İlk bağlandığında araç kendiliğinden eklenir; şimdiki ayarların o araca geçer.</p>`;
  h+=`<ul class="veh-list">`;
  if(st.demo) h+=`<li><div class="vn">${esc(title(st.demo))} <span class="chip info">Deneme</span></div><div class="sub">${esc(modelText(st.demo))} · kaydedilmez</div></li>`;
  for(const k of keys){
    const p=vs[k], act=k===settings.activeVehicle;
    const fuel=act ? settings.fuel : (p.fuel||p.yakit);
    h+=`<li data-k="${esc(k)}"><div class="vn">${esc(title(p))}${act?' <span class="chip warn">Şu anki araç</span>':""}${p.pending?' <span class="chip info">Onay bekliyor</span>':""}</div>
      <div class="sub">${esc(modelText(p)||"Model bilinmiyor")}${fuel?" · "+esc(FUELS[fuel]||fuel):""} · son bağlantı ${fmtDate(p.lastSeen||p.created)}${p.how==="sig"?" · şase no vermiyor":""}</div>`;
    if(st.editing==="card:"+k) h+=formHtml(p,"vef")+`<div class="actions"><button data-a="cancel">Vazgeç</button><button class="primary" data-a="save">Kaydet</button></div>`;
    else if(st.deleting===k) h+=`<div class="confirm"><div><b>${esc(title(p))} silinsin mi?</b> Ayarları, bakım ve masraf kayıtları silinir.</div>
        <label class="check"><input type="checkbox" data-a="deltrips"> Bu aracın sürüş kayıtlarını da sil</label>
        <div class="actions"><button data-a="nodel">Vazgeç</button><button class="danger" data-a="yesdel">Sil</button></div></div>`;
    else h+=`<div class="actions"><button data-a="edit">Düzenle</button>${act?"":`<button data-a="use"${busy?" disabled":""}>Bu araca geç</button>`}<button class="danger" data-a="del"${act&&busy?" disabled":""}>Sil</button></div>`;
    h+=`</li>`;
  }
  h+=`</ul>`;
  if(busy && keys.length>1) h+=`<p class="sub">Bağlıyken araç elle değiştirilemez; bağlı araç kendiliğinden seçilir.</p>`;
  card.innerHTML=h;
  (card.querySelectorAll("li[data-k]")||[]).forEach(li=>{
    const k=li.dataset.k;
    if(st.editing==="card:"+k) wirePreset(li,"vef");
    (li.querySelectorAll("button[data-a]")||[]).forEach(b=>b.addEventListener("click",()=>act(k, b.dataset.a, li)));
  });
}
async function act(k, a, li){
  if(a==="edit"){ st.editing="card:"+k; st.deleting=null; }
  else if(a==="cancel"){ st.editing=null; }
  else if(a==="save"){ applyEdit(k, readForm(li,"vef")); st.editing=null; showConfirm(); }
  else if(a==="use"){ if(!S.active) switchTo(k); }
  else if(a==="del"){ st.deleting=k; st.editing=null; }
  else if(a==="nodel"){ st.deleting=null; }
  else if(a==="yesdel"){ const cb=li.querySelector('input[data-a="deltrips"]'); await remove(k, !!(cb && cb.checked)); }
  render();
}
async function remove(k, withTrips){
  const vs=V(); if(!vs[k]) return;
  if(withTrips){
    const legacy=settings.legacyVehicle===k;
    for(const t of await getTrips()) if(t.vehicle===k || (legacy && !t.vehicle && !t.demo)) if(!(REC.trip && REC.trip.id===t.id)) await deleteTrip(t.id);
  }
  if(settings.activeVehicle===k){
    const next=Object.keys(vs).filter(x=>x!==k).sort((a,b)=>(vs[b].lastSeen||0)-(vs[a].lastSeen||0))[0];
    if(next && !S.active) switchTo(next);
    else if(!next) settings.activeVehicle=null;   // ayarlar olduğu gibi kalır; sonraki ilk araca geçer
  }
  if(settings.activeVehicle===k) return;          // bağlıyken etkin araç silinmez
  delete vs[k];
  if(settings.legacyVehicle===k) settings.legacyVehicle=null;
  st.deleting=null; save(); renderTrips();
}

// ================= 6) Sürüş listesi: araca göre =================
const owner = t=>t.vehicle || settings.legacyVehicle || null;
function filterTrips(view){
  const vs=V(), n=Object.keys(vs).length, a=settings.activeVehicle;
  const others=view.trips.some(t=>!t.demo && owner(t) && owner(t)!==a);
  tRow.hidden=!(n>1 || others);
  tAll.checked=!!settings.tripsAll;
  const note=tRow.querySelector("#tripsVehNote");
  if(note) note.textContent = !settings.tripsAll && a && vs[a] ? `Yalnızca ${title(vs[a])} gösteriliyor.` : "";
  if(settings.tripsAll || !a || !vs[a]) return;
  view.trips=view.trips.filter(t=>t.demo || owner(t)===a || !owner(t));
  view.empty="Bu aracın henüz kaydı yok. Diğer araçlar için yukarıdaki kutuyu işaretle.";
}
function tripChip(li, t){
  const vs=V(); if(!settings.tripsAll || Object.keys(vs).length<2) return;
  const p=vs[owner(t)]; if(!p) return;
  const c=document.createElement("span"); c.className="chip info veh"; c.textContent=title(p);
  const b=li.querySelector("button"); if(b && li.insertBefore) li.insertBefore(c,b); else li.appendChild(c);
}
on("tripList", filterTrips);
on("tripItem", tripChip);

// ================= 7) Kancalar =================
on("connect", ()=>{
  // Önceki bağlantının şase numarası yeni araçta kalmasın (bu bağlantıda runDiag yeniden okur)
  S.vin=null; st.sig=signature(); st.demo=null; st.editing=null; conf.hidden=true;
});
on("diag", ()=>{
  if(!S.active) return;
  const demo=S.link instanceof DemoLink && !st.real;
  identify(S.vin||null, {demo, sig:st.sig||signature()});
});
on("disconnect", ()=>{ if(st.demo){ st.demo=null; conf.hidden=true; } render(); });

// Deneme cihazının şase numarası tablodaki bir araca denk gelsin (elektrikli denemeye karışmaz)
const coreReply=DemoLink.prototype.reply;
DemoLink.prototype.reply=function(cmd){
  if(cmd==="0902" && D.demoVin && !this.ev && !(typeof EVA!=="undefined" && EVA.st.demoEv)){
    const b=[...D.demoVin].map(c=>c.charCodeAt(0).toString(16).toUpperCase().padStart(2,"0")).join("");
    return "014\r0:490201"+b.slice(0,6)+"\r1:"+b.slice(6,20)+"\r2:"+b.slice(20);
  }
  return coreReply.call(this,cmd);
};

render(); renderTrips();
return {decode, identify, switchTo, remove, freshCfg, applyPreset, applyEdit, signature, vpicLookup, filterTrips, owner, render, showConfirm, PER, st};
})();
