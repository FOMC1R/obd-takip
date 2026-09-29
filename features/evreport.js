// ---------- Elektrikli araç: ikinci el batarya raporu ----------
// Batarya sağlığı (SOH), doluluk, voltaj, 12 V akü, hücre voltajları (en yüksek − en düşük = dengesizlik), sıcaklık ve
// kilometreyi aracın kendi beyninden okur; sade bir değerlendirmeyle yazdırılabilir (PDF) rapor yapar.
// Kaynak: seçili elektrikli araç profili (features/ev.js: Corsa-e, Torres…; features/obdb.js: açık veritabanı).
// Eşikler genel ölçüttür (üretici garantileri çoğunlukla 8 yılda %70 SOH); rapor bunu açıkça yazar.
// Geçmiş: settings.evReports (araca özel) — zaman içindeki düşüş görülsün.
const EVREPORT = (()=>{
  if(!Array.isArray(settings.evReports)) settings.evReports=[];
  const K=["SOC","SOH","V","AUX","CHG","T","TMIN","TMAX","CMIN","CMAX","E"];

  function sohVerdict(s){
    if(s==null) return null;
    if(s>=90) return {lvl:"ok",  text:"Çok iyi. Batarya neredeyse yeni gibi."};
    if(s>=80) return {lvl:"ok",  text:"İyi. Yaşına ve kullanımına uygun normal yıpranma."};
    if(s>=70) return {lvl:"warn",text:"Belirgin yıpranma. Menzil yeniye göre hissedilir biçimde kısalmıştır."};
    return {lvl:"crit", text:"Zayıf. Yetkili serviste batarya değerlendirmesi önerilir."};
  }
  function cellVerdict(dmv){
    if(dmv==null) return null;
    if(dmv<=30) return {lvl:"ok",  text:"Hücreler dengeli."};
    if(dmv<=80) return {lvl:"warn",text:"Hücreler arasında hafif fark var. Tam şarjdan sonra tekrar ölç; çoğunlukla şarjla dengelenir."};
    return {lvl:"crit", text:"Hücreler arasında büyük fark var. Zayıf bir hücre olabilir; kontrol ettirilmeli."};
  }
  function auxVerdict(v, charging){
    if(v==null) return null;
    if(v>=13.0) return {lvl:"ok", text:"12 V akü şarj ediliyor (araç çalışır durumda)."};
    if(v>=12.4) return {lvl:"ok", text:"12 V akü iyi."};
    if(v>=12.1) return {lvl:"warn",text:"12 V akü biraz zayıf."};
    return {lvl:"crit", text:"12 V akü zayıf. Elektrikli araçlarda sık görülen bir arızadır; değiştirilmesi gerekebilir."};
  }

  // ---- okuma ----
  async function readCells(p){
    const cells=p.cells||[]; if(!cells.length) return null;
    const groups=new Map();
    for(const c of cells){ const k=`${c.tx}|${c.rx}|${c.fc?1:0}`; (groups.get(k)||groups.set(k,[]).get(k)).push(c); }
    const vals=[];
    for(const arr of groups.values()){
      await EVA.withHeader(arr[0].tx, arr[0].rx, async send=>{
        const seen=new Map();
        for(const c of arr){
          let r=seen.get(c.cmd); if(r===undefined){ r=await send(c.cmd,2000); seen.set(c.cmd,r); }
          const b=r && !failed(r) ? EVA.respBytes(r,c.cmd) : null;
          const v=b ? c.decode(b) : null;
          if(v!=null && v>1.5 && v<5) vals.push(v);   // hücre voltajı olmayan (boş/ayrılmış) değerleri ele
        }
      }, arr[0].fc);
    }
    return vals.length ? vals : null;
  }
  async function collect(){
    const p=EVA.activeProfile();
    if(!p) throw new Error("Önce Ayarlar → Elektrikli araç bölümünden aracının profilini seç.");
    const items=p.items.filter(i=>K.includes(i.key)).map(i=>({...i, tx:i.tx||p.tx, rx:i.rx||p.rx, fc:!!(i.fc??p.fc), pid:"EV_"+i.key}));
    await EVA.readItems(items);
    const v={}; for(const k of K){ const c=EVA.st.cache[k]; if(c && c.v!=null && Date.now()-c.ts<60000) v[k]=c.v; }
    const cells=await readCells(p);
    let cmin=v.CMIN, cmax=v.CMAX, n=null, avg=null, low=[];
    if(cells){ cmin=Math.min(...cells); cmax=Math.max(...cells); n=cells.length; avg=cells.reduce((a,b)=>a+b,0)/n;
      low=cells.map((x,i)=>({i:i+1,x})).sort((a,b)=>a.x-b.x).slice(0,3); }
    let km=null;
    if(p.odo){ await EVA.withHeader(p.odo.tx, p.odo.rx, async send=>{ const r=await send(p.odo.cmd,2000); const b=r&&!failed(r)?EVA.respBytes(r,p.odo.cmd):null; km=b?p.odo.decode(b):null; }, p.odo.fc); }
    if(km==null) km=cur("A6");
    if(km==null && settings.maint && settings.maint.odo!=null) km=settings.maint.odo;
    const dmv = cmin!=null && cmax!=null ? Math.round((cmax-cmin)*1000) : null;
    const d={t:Date.now(), profile:p.name, source:p.source||null, note:p.note||"", vin:S.vin||null, km, ...v, cmin, cmax, cells:n, avg, low, dmv,
      charging: v.CHG!=null ? v.CHG>0 : null};
    d.verdicts=[["Batarya sağlığı",sohVerdict(d.SOH)],["Hücre dengesi",cellVerdict(dmv)],["12 V akü",auxVerdict(d.AUX,d.charging)]].filter(x=>x[1]);
    if(d.SOH==null && d.SOC==null && d.cells==null) throw new Error("Araçtan batarya bilgisi alınamadı. Araç çalışır durumda (READY) mı? Profil doğru mu?");
    return d;
  }

  // ---- rapor ----
  const f=(x,dec,u)=>x==null?"—":fmt(x,dec)+(u?" "+u:"");
  function html(d){
    const rows=[["Batarya sağlığı (SOH)",f(d.SOH,1,"%")],["Doluluk",f(d.SOC,1,"%")],["Batarya voltajı",f(d.V,1,"V")],["Kalan enerji",f(d.E,1,"kWh")],
      ["Hücre sayısı (okunan)",d.cells==null?"—":String(d.cells)],["En düşük / en yüksek hücre",d.cmin==null?"—":`${fmt(d.cmin,3)} / ${fmt(d.cmax,3)} V`],
      ["Hücre farkı",d.dmv==null?"—":d.dmv+" mV"],["Batarya sıcaklığı",d.T!=null?f(d.T,0,"°C"):(d.TMIN!=null?`${fmt(d.TMIN,0)} – ${fmt(d.TMAX,0)} °C`:"—")],
      ["12 V akü",f(d.AUX,2,"V")],["Şarj",d.charging==null?"—":(d.charging?"Şarj oluyor":"Şarjda değil")],["Kilometre",f(d.km,0,"km")]];
    const hist=settings.evReports.filter(r=>r.t!==d.t).slice(-5);
    return `<h1>İkinci el batarya raporu</h1>
      <p class="muted">${escHtml(new Date(d.t).toLocaleString("tr-TR"))} · ${escHtml(d.profile)}${d.vin?` · Şase: ${escHtml(d.vin.slice(0,11))}…`:""}</p>
      <h2>Değerlendirme</h2>
      <table class="dtct"><tbody>${d.verdicts.map(([k,v])=>`<tr><th>${escHtml(k)}</th><td class="${v.lvl!=="ok"?"bad":""}">${escHtml(v.text)}</td></tr>`).join("")}</tbody></table>
      <h2>Ölçülen değerler</h2>
      <table class="dtct"><tbody>${rows.map(([k,v])=>`<tr><th>${escHtml(k)}</th><td>${escHtml(v)}</td></tr>`).join("")}</tbody></table>
      ${d.low&&d.low.length?`<p class="muted">En düşük hücreler: ${d.low.map(c=>`${c.i}. hücre ${fmt(c.x,3)} V`).join(" · ")}</p>`:""}
      ${hist.length?`<h2>Önceki ölçümler</h2><table class="dtct"><tbody>${hist.map(r=>`<tr><th>${escHtml(new Date(r.t).toLocaleDateString("tr-TR"))}</th><td>SOH ${f(r.soh,1,"%")} · hücre farkı ${r.dmv==null?"—":r.dmv+" mV"} · ${f(r.km,0,"km")}</td></tr>`).join("")}</tbody></table>`:""}
      <p class="disc">Bu değerler aracın kendi beyninden okunmuştur; yetkili servis ölçümünün yerine geçmez. Eşikler genel ölçüttür
      (üretici garantileri çoğunlukla 8 yılda %70 sağlığı kapsar). Hücre farkı en doğru, araç bir süre dinlendikten ya da tam şarjdan sonra ölçülür.
      ${escHtml(d.note||"")} ${d.source?`Veri tanımı: ${escHtml(d.source)}.`:""} OBD Takip ${typeof APP_VERSION!=="undefined"?APP_VERSION:""}</p>`;
  }
  let box=null;
  function close(){ if(box){ box.remove(); box=null; } document.body.classList.remove("printing"); }
  function show(d){
    close();
    box=document.createElement("div"); box.id="rpt"; box.setAttribute("role","dialog"); box.setAttribute("aria-label","Batarya raporu");
    box.innerHTML=`<div class="rpt-bar"><button class="primary" id="evrPrint">Yazdır / PDF kaydet</button><button id="evrClose">Kapat</button></div><div class="rpt-page">${html(d)}</div>`;
    document.body.appendChild(box); document.body.classList.add("printing");
    box.querySelector("#evrPrint").addEventListener("click",()=>window.print());
    box.querySelector("#evrClose").addEventListener("click",close);
  }

  // ---- sayfa ----
  const main=document.querySelector("main")||document.body;
  const sec=document.createElement("section"); sec.className="tab"; sec.dataset.tab="batarya"; sec.hidden=true; sec.id="tab-batarya"; sec.setAttribute("aria-label","Batarya sağlığı");
  sec.innerHTML=`<section class="card" aria-labelledby="evrTitle"><h2 id="evrTitle">Batarya sağlığı</h2>
      <p class="sub">İkinci el elektrikli araç alırken ya da kendi aracının durumunu izlemek için: batarya sağlığını, hücrelerin dengesini ve 12 V aküyü okur,
      yazdırılabilir bir rapor hazırlar. Araç çalışır durumda (READY) olmalı.</p>
      <div class="actions"><button class="primary" id="evrBtn">Batarya raporunu oluştur</button></div>
      <p class="sub" id="evrMsg" role="status"></p></section>
    <section class="card" id="evrHistCard" hidden><h3>Önceki ölçümler</h3><dl class="kv" id="evrHist"></dl></section>`;
  main.appendChild(sec);
  function paint(){
    const ev=settings.fuel==="elektrik" || (EVA.st && EVA.st.demoEv);
    $("evrBtn").disabled=!S.active || !ev;
    if(!ev) $("evrMsg").textContent="Yakıt türü elektrik seçili olduğunda kullanılır (Ayarlar → Yakıt).";
    else if(!S.active) $("evrMsg").textContent="Önce araca bağlan.";
    else if(!EVA.activeProfile()) $("evrMsg").textContent="Ayarlar → Elektrikli araç bölümünden aracının profilini seç.";
    else if(/^Önce|^Yakıt|^Ayarlar/.test($("evrMsg").textContent||"")) $("evrMsg").textContent="";
    const h=settings.evReports.slice(-6).reverse();
    $("evrHistCard").hidden=!h.length;
    if(h.length) kv($("evrHist"), h.map(r=>[new Date(r.t).toLocaleDateString("tr-TR"), `SOH ${f(r.soh,1,"%")} · hücre farkı ${r.dmv==null?"—":r.dmv+" mV"} · ${f(r.km,0,"km")}`]));
  }
  $("evrBtn").addEventListener("click", async()=>{
    $("evrBtn").disabled=true; $("evrMsg").textContent="Batarya okunuyor… (hücre sayısına göre birkaç saniye)";
    try{
      const d=await collect();
      settings.evReports.push({t:d.t, soh:d.SOH??null, dmv:d.dmv, km:d.km, soc:d.SOC??null}); if(settings.evReports.length>50) settings.evReports.shift(); save();
      $("evrMsg").textContent=""; show(d);
    }catch(e){ $("evrMsg").textContent=e.message||String(e); }
    finally{ paint(); }
  });
  on("connect",paint); on("disconnect",paint); paint();
  return {collect, html, show, close, sohVerdict, cellVerdict, auxVerdict, paint, section:sec};
})();
