// ---------- Bakım hatırlatıcı (Sürüşler sekmesi) ----------
// Kilometre sayacı: kullanıcı bir kez girer, her sürüş sonunda OBD hızından hesaplanan yol (trip.odo) eklenir.
// Araç PID A6'yı (kilometre sayacı, 2019 sonrası araçlarda standart) veriyorsa bağlanınca oradan okunur.
//
// Varsayılan aralıklar — Renault Fluence 1.6 16V (K4M benzinli, 2010-2016) için. Hepsi ekrandan değiştirilebilir.
// Kaynaklar (Eylül 2026'da bakıldı):
//  - Motor yağı + filtre 15.000 km / 12 ay, polen filtresi 12 ay, hava filtresi, fren hidroliği 24 ay, antifriz 60 ay:
//    https://getgaragehub.com/learn/vehicles/renault-maintenance-schedule/
//    (Renault'nun resmi 30.000 km yağ aralığı yalnızca uzun yol içindir; şehir içi için 15.000 km / 1 yıl önerilir.)
//  - Türkiye'de Fluence için yağ bakımı 10.000-15.000 km, "km dolmasa da yılda bir":
//    https://pratikaraba.com/renault-fluence-bakim-fiyati.html , https://www.renaultfanclub.com/threads/fluence-periyodik-bakim.100239/
//  - Triger seti (K4M): çoğu kaynak 120.000 km / 6 yıl der
//    (https://www.autodoc.co.uk/car-parts/water-pump-timing-belt-kit-10553/renault/fluence/fluence-l30/31722-1-6-16v-l301-l30f-l30p-l30r),
//    bazı bakım çizelgeleri 90.000 km (getgaragehub), Türk kullanıcıların aktardığı bazı kitapçıklar 60.000 km / 4 yıl der
//    (renaultfanclub). Motor kodu sonekine (K4M 838, 858…) ve kullanım koşuluna göre değişir; KESİN DEĞİL.
//    K4M "supap çarpan" bir motordur: kayış koparsa supaplar eğilir. Bu yüzden temkinli olan 90.000 km / 5 yıl seçildi.
//    Not: Fluence'ın CVT (X-Tronic) şanzımanlı 1.6'sı H4M motordur ve zincirlidir; orada bu kalem kapatılabilir.
//  - Buji 60.000 km (getgaragehub; LPG'li araçta 30.000 km önerilir).
//  - Muayene: 3 yaşını geçen hususi otomobilde 2 yılda bir. Trafik sigortası ve kasko yıllık.
const MAINT_ITEMS = [
  {key:"yag",     name:"Motor yağı + filtre", km:15000, mo:12},
  {key:"hava",    name:"Hava filtresi",       km:30000, mo:24},
  {key:"polen",   name:"Polen filtresi",      km:15000, mo:12},
  {key:"buji",    name:"Buji",                km:60000, mo:null, note:"LPG'li araçta 30.000 km"},
  {key:"triger",  name:"Triger seti",         km:90000, mo:60,  note:"Kitapçığa göre 60.000-120.000 km / 4-6 yıl; kendi kitapçığına bak"},
  {key:"fren",    name:"Fren hidroliği",      km:null,  mo:24},
  {key:"antifriz",name:"Antifriz",            km:100000,mo:60},
  {key:"muayene", name:"Araç muayenesi",      km:null,  mo:24},
  {key:"trafik",  name:"Trafik sigortası",    km:null,  mo:12},
  {key:"kasko",   name:"Kasko",               km:null,  mo:12},
];
const Maint = (()=>{
  if(settings.maint===undefined) settings.maint={odo:null, odoSrc:null, odoAt:null, items:{}, warnDay:null};
  const M=settings.maint; M.items=M.items||{};
  const DAY=86400000, SOON_KM=500, SOON_DAYS=15;
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const p2=n=>String(n).padStart(2,"0");
  const isoDay=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const parseDay=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||""); return m?new Date(+m[1],+m[2]-1,+m[3]):null; };
  const addMonths=(d,n)=>{ const x=new Date(d); const day=x.getDate(); x.setDate(1); x.setMonth(x.getMonth()+n); x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); return x; };
  // Kalem: varsayılan + kullanıcının değiştirdikleri
  function item(key){ const d=MAINT_ITEMS.find(x=>x.key===key); const u=M.items[key]||{};
    return {...d, km:"km" in u?u.km:d.km, mo:"mo" in u?u.mo:d.mo, lastKm:u.lastKm??null, lastDate:u.lastDate??null}; }
  function setItem(key, patch){ M.items[key]={...(M.items[key]||{}), ...patch}; save(); }
  // Durum: kalan km / gün, doluluk oranı ve seviye (ok | soon | over | unknown)
  function status(it, odo=M.odo, now=Date.now()){
    const r={remKm:null, remDays:null, frac:null, level:"unknown", due:null};
    const today=new Date(now); today.setHours(0,0,0,0);
    const fr=[];
    if(it.km && it.lastKm!=null && odo!=null){ r.remKm=it.lastKm+it.km-odo; fr.push((odo-it.lastKm)/it.km); }
    const ld=parseDay(it.lastDate);
    if(it.mo && ld){ const due=addMonths(ld,it.mo); r.due=isoDay(due); r.remDays=Math.round((due-today)/DAY); fr.push((today-ld)/(due-ld)); }
    if(!fr.length) return r;
    r.frac=Math.max(0,Math.min(1,Math.max(...fr)));
    const over=(r.remKm!=null&&r.remKm<0)||(r.remDays!=null&&r.remDays<0);
    const soon=(r.remKm!=null&&r.remKm<=SOON_KM)||(r.remDays!=null&&r.remDays<=SOON_DAYS);
    r.level = over?"over":soon?"soon":"ok";
    return r;
  }
  function remText(st){
    const parts=[];
    if(st.remKm!=null) parts.push(st.remKm<0?`${fmt(-st.remKm,0)} km geçti`:`${fmt(st.remKm,0)} km`);
    if(st.remDays!=null) parts.push(st.remDays<0?`${fmt(-st.remDays,0)} gün geçti`:`${fmt(st.remDays,0)} gün`);
    if(!parts.length) return "Son yapıldığı km ya da tarih girilmedi";
    const late=parts.some(p=>p.endsWith("geçti"));
    return late ? parts.map(p=>p.endsWith("geçti")?p:p+" kaldı").join(" · ") : parts.join(" / ")+" kaldı";
  }
  function all(now){ return MAINT_ITEMS.map(d=>{ const it=item(d.key); return {...it, st:status(it,M.odo,now)}; }); }
  function due(now){ return all(now).filter(x=>x.st.level==="over"||x.st.level==="soon"); }
  // Rapor ve diğer eklentiler için kısa özet
  function summary(now){ return all(now).map(x=>({name:x.name, level:x.st.level, text:remText(x.st)})); }
  function setOdo(km, src){ if(!(km>=0)) return; M.odo=km; M.odoSrc=src; M.odoAt=Date.now(); save(); }
  // Sürüş bitince: OBD hızından hesaplanan yolu sayaca ekle (deneme sürüşleri hariç)
  function addTrip(t){ if(!t || t.demo || M.odo==null || !(t.odo>0)) return; M.odo+=t.odo; M.odoAt=Date.now(); save(); }
  // PID A6 (kilometre sayacı): 4 bayt, 0,1 km çözünürlük. Destek listesi 0160→0180→01A0 zinciriyle öğrenilir.
  async function readObdOdo(){
    if(!S.elm) return null;
    for(const base of ["60","80","A0"]){
      if(!S.supported || !S.supported.has(base)) break;
      const r=await q("01"+base); if(!r) break;
      supportMask(r,base).forEach(p=>S.supported.add(p));
    }
    if(!has("A6")) return null;   // destek listesi yoksa has() true döner: yine de sorulur
    const b=pidBytes(await q("01A6")||"","A6");
    if(!b || b.length<4) return null;
    const km=((b[0]*16777216)+(b[1]<<16)+(b[2]<<8)+b[3])/10;
    setOdo(km,"obd"); return km;
  }
  // Bağlanınca: gecikmiş ya da yaklaşan bakım varsa günde bir kez uyar
  function checkDue(now=Date.now()){
    const d=due(now); const day=isoDay(new Date(now));
    if(!d.length || M.warnDay===day) return false;
    M.warnDay=day; save();
    const over=d.filter(x=>x.st.level==="over");
    const names=d.map(x=>x.name);
    const text=(over.length?"Bakım zamanı geçti: ":"Bakım zamanı yaklaştı: ")+d.map(x=>`${x.name} (${remText(x.st)})`).join(", ");
    raise("maint","warn",text,(over.length?"Bakım zamanı geçti. ":"Bakım zamanı yaklaştı. ")+names.join(", ").replace(/\+/g,"ve"));
    setTimeout(()=>drop("maint"),60000);
    return true;
  }

  // ----- Arayüz -----
  const css=document.createElement("style");
  css.textContent=`
  .mt-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .mt{padding:10px 12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line);display:grid;gap:6px}
  .mt.over{border-color:var(--crit)} .mt.soon{border-color:var(--warn)}
  .mt-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .mt-head b{margin-right:auto}
  .mt-rem{font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
  .mt.over .mt-rem{color:var(--crit);font-weight:600}
  .mt-bar{height:8px;border-radius:4px;background:var(--track);overflow:hidden}
  .mt-bar i{display:block;height:100%;border-radius:4px;background:var(--ok)}
  .mt.soon .mt-bar i{background:var(--warn)} .mt.over .mt-bar i{background:var(--crit)}
  .mt .actions button{flex:1}
  .mt-edit{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .mt-edit .field input{min-width:0}
  .mt-odo{display:flex;gap:8px;align-items:flex-end}
  .mt-odo .field{flex:1;min-width:0}
  .mt-note{font-size:12px;color:var(--muted)}`;
  document.head.appendChild(css);
  const card=document.createElement("section"); card.className="card"; card.id="maintCard"; card.setAttribute("aria-labelledby","maintTitle");
  $("ext-surus").appendChild(card);
  const openEdit=new Set(), openConf=new Set();
  function render(){
    const odoTxt = M.odo==null ? "Girilmedi" : `${fmt(M.odo,0)} km`;
    const src = M.odoSrc==="obd" ? "Araçtan okundu." : M.odo==null ? "Araçtaki göstergeden bir kez gir; sonra her sürüşle kendiliğinden artar." : "Tahmini: girdiğin değere sürüşlerde gidilen yol eklenir. Arada göstergeye bakıp düzeltebilirsin.";
    let h=`<div class="row"><h2 id="maintTitle" style="margin-right:auto">Bakım hatırlatıcı</h2><span class="empty">${esc(odoTxt)}</span></div>
      <div class="mt-odo"><div class="field"><label for="mtOdo">Kilometre sayacı (km)</label><input type="number" id="mtOdo" inputmode="numeric" min="0" step="1" value="${M.odo==null?"":Math.round(M.odo)}"></div><button id="mtOdoSave">Kaydet</button></div>
      <p class="sub">${esc(src)}</p><ul class="mt-list">`;
    for(const x of all()){
      const st=x.st, pct=st.frac==null?0:Math.round(st.frac*100);
      const chip = st.level==="over"?'<span class="chip crit">Gecikti</span>':st.level==="soon"?'<span class="chip warn">Yaklaştı</span>':"";
      h+=`<li class="mt ${st.level}" data-k="${x.key}">
        <div class="mt-head"><b>${esc(x.name)}</b>${chip}</div>
        <div class="mt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(x.name)} doluluk"><i style="width:${pct}%"></i></div>
        <div class="mt-rem">${esc(remText(st))}</div>
        <div class="mt-note">${esc([x.km?`Her ${fmt(x.km,0)} km`:"",x.mo?`${x.mo} ayda bir`:""].filter(Boolean).join(" ya da "))}${x.lastDate||x.lastKm!=null?` · son: ${esc([x.lastKm!=null?fmt(x.lastKm,0)+" km":"",x.lastDate?new Date(parseDay(x.lastDate)).toLocaleDateString("tr-TR"):""].filter(Boolean).join(", "))}`:""}${x.note?` · ${esc(x.note)}`:""}</div>
        <div class="actions"><button class="mtDone">Yapıldı</button><button class="mtEdit">Düzenle</button></div>
        ${openConf.has(x.key)?`<div class="confirm"><div><b>${esc(x.name)} bugün${M.odo!=null?` ${fmt(M.odo,0)} km'de`:""} yapıldı olarak işaretlensin mi?</b></div>
          <div class="actions"><button class="mtNo">Vazgeç</button><button class="primary mtYes">Evet, yapıldı</button></div></div>`:""}
        ${openEdit.has(x.key)?`<div class="mt-edit">
          <div class="field"><label>Her … km</label><input type="number" class="eKm" inputmode="numeric" min="0" value="${x.km??""}"></div>
          <div class="field"><label>Her … ay</label><input type="number" class="eMo" inputmode="numeric" min="0" value="${x.mo??""}"></div>
          <div class="field"><label>Son yapıldığı km</label><input type="number" class="eLk" inputmode="numeric" min="0" value="${x.lastKm??""}"></div>
          <div class="field"><label>Son yapıldığı tarih</label><input type="date" class="eLd" value="${x.lastDate??""}"></div>
          <div class="actions" style="grid-column:1/-1"><button class="mtCancel">Vazgeç</button><button class="primary mtSave">Kaydet</button></div></div>`:""}
      </li>`;
    }
    h+=`</ul><p class="sub">Aralıklar Renault Fluence 1.6 benzinli için genel önerilerdir; aracının bakım kitapçığı ve servis önerisi esastır. Boş bırakılan aralık kontrol edilmez.</p>`;
    card.innerHTML=h;
    const odoIn=card.querySelector("#mtOdo");
    card.querySelector("#mtOdoSave").addEventListener("click",()=>{ const v=Number(String(odoIn.value).replace(",",".")); if(v>=0 && odoIn.value!==""){ setOdo(v,"manual"); render(); } });
    card.querySelectorAll(".mt").forEach(li=>{
      const k=li.dataset.k, b=s=>li.querySelector(s);
      b(".mtDone").addEventListener("click",()=>{ openConf.add(k); render(); });
      b(".mtEdit").addEventListener("click",()=>{ openEdit.has(k)?openEdit.delete(k):openEdit.add(k); render(); });
      if(openConf.has(k)){
        b(".mtNo").addEventListener("click",()=>{ openConf.delete(k); render(); });
        b(".mtYes").addEventListener("click",()=>{ markDone(k); openConf.delete(k); render(); });
      }
      if(openEdit.has(k)){
        const n=s=>{ const v=b(s).value; return v===""?null:Number(v); };
        b(".mtCancel").addEventListener("click",()=>{ openEdit.delete(k); render(); });
        b(".mtSave").addEventListener("click",()=>{ setItem(k,{km:n(".eKm")||null, mo:n(".eMo")||null, lastKm:n(".eLk"), lastDate:b(".eLd").value||null}); openEdit.delete(k); render(); });
      }
    });
  }
  function markDone(k, now=Date.now()){ setItem(k,{lastKm:M.odo!=null?Math.round(M.odo):item(k).lastKm, lastDate:isoDay(new Date(now))}); }

  on("tripEnd",t=>{ addTrip(t); render(); });
  on("connect",async()=>{ try{ await readObdOdo(); }catch(e){} render(); checkDue(); });
  render();
  return {item, setItem, status, remText, all, due, summary, setOdo, addTrip, readObdOdo, checkDue, markDone, render, isoDay};
})();
