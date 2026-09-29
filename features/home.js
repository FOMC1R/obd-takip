// ---------- Ana sayfa: telefon uygulaması gibi menü ----------
// Uygulama bu sayfayla açılır (adres bir sekme istemiyorsa). Kutucuklar ilgili sekmeye ya da tam ekran görünüme gider;
// altlarında o bölümün kısa canlı özeti yazar. Araçta bulunan ek sistemler (features/systems.js) kendi kutucuğunu alır.
// Sağ alt köşede sürüm numarası: APP_VERSION (index.html) — sw.js önbellek numarasıyla aynı tutulur (test/integrity.test.js).
const HOME = (()=>{
  const I = (d)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    home: I('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>'),
    motor: I('<path d="M5 9h3V7h6v2h3l2 3v5h-2v2H7v-2H5z"/><path d="M2 12h3M19 13h3"/>'),
    trans: I('<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v8M12 8v8M18 8v4H6"/>'),
    sys: I('<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>'),
    ariza: I('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
    surus: I('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'),
    stat: I('<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>'),
    panel: I('<path d="M3 17a9 9 0 1 1 18 0"/><path d="M12 17l4-5"/><path d="M6 17h.01M18 17h.01"/>'),
    hud: I('<path d="M3 5h18l-2 10H5z"/><path d="M9 19h6M12 15v4"/>'),
    batt: I('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><path d="M7 10v4M10.5 10v4M14 10v4"/>'),
    bakim: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
    masraf: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
    ayar: I('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  };

  const css=document.createElement("style");
  css.textContent=`
.tabbar{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
.home-head{display:grid;gap:4px;padding:14px 16px}
.home-head b{font-size:20px}
.home-head .chips{display:flex;flex-wrap:wrap;gap:6px}
.home-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.home-grid button{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;row-gap:2px;align-items:center;
  text-align:left;min-height:84px;padding:12px;border-radius:16px;background:var(--panel);border:1px solid var(--line);color:var(--text)}
.home-grid button svg{grid-row:1/3;width:30px;height:30px;color:var(--accent)}
.home-grid button b{font-size:16px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.home-grid button span{font-size:13px;color:var(--muted);line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.home-grid button.alert span{color:var(--crit);font-weight:600}
.home-grid button.warn span{color:var(--warn)}
.home-nav{margin-top:8px;min-height:52px;font-size:17px;display:flex;align-items:center;justify-content:center;gap:10px}
.home-nav svg{width:22px;height:22px}
.home-ver{text-align:right;color:var(--muted);font-size:12px;margin:14px 2px 0;font-variant-numeric:tabular-nums}
`;
  document.head.appendChild(css);

  // ---- sekme ve alt çubuk düğmesi ----
  const sec=document.createElement("section"); sec.className="tab"; sec.dataset.tab="ana"; sec.hidden=true;
  sec.setAttribute("aria-label","Ana sayfa"); sec.id="tab-ana";
  const main=document.querySelector("main")||document.body;
  if(main.firstChild && main.insertBefore) main.insertBefore(sec, main.firstChild); else main.appendChild(sec);
  sec.innerHTML=`<div class="card home-head"><b id="homeVeh">OBD Takip</b><span class="sub" id="homeState"></span><div class="chips" id="homeChips"></div>
    <button class="primary home-nav" id="homeNav">Navigasyona geç</button></div>
    <nav class="home-grid" id="homeGrid" aria-label="Bölümler"></nav>
    <p class="home-ver" id="homeVer"></p>`;
  const bar=$("tabbar");
  const btn=document.createElement("button"); btn.dataset.tab="ana"; btn.innerHTML=ICON.home+"<span>Ana sayfa</span>";
  if(bar.firstChild && bar.insertBefore) bar.insertBefore(btn, bar.firstChild); else bar.appendChild(btn);
  btn.addEventListener("click",()=>showTab("ana"));
  $("homeVer").textContent = "Sürüm "+(typeof APP_VERSION!=="undefined" ? APP_VERSION : "?");
  // bağlıyken: küçük pencereyi açıp seçili haritaya geçer (features/background.js goNav)
  $("homeNav").innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z"/></svg><span>Navigasyona geç</span>`;
  $("homeNav").addEventListener("click",()=>{ if(typeof BG!=="undefined" && BG.goNav) BG.goNav("ana-sayfa"); });

  // ---- kutucuklar ----
  const has = tab=>!!document.querySelector(`section.tab[data-tab="${tab}"]`);
  const toMaint = ()=>{ showTab("surus"); const h=document.getElementById("maintTitle"); if(h && h.scrollIntoView) setTimeout(()=>h.scrollIntoView({behavior:"smooth",block:"start"}),50); };
  function tiles(){
    const T=[
      {k:"motor", icon:ICON.motor, name:"Motor", go:()=>showTab("canli"), sub:subMotor},
      {k:"sanziman", icon:ICON.trans, name:"Şanzıman", go:()=>showTab("sanziman"), sub:subTrans, show:()=>has("sanziman")},
    ];
    if(typeof SYS!=="undefined") for(const s of SYS.list()) if(s.tx!=="7E1")
      T.push({k:"sys-"+s.tx, icon:ICON.sys, name:s.name, go:()=>showTab("sys-"+s.tx), sub:()=>subSys(s)});
    T.push(
      {k:"batarya", icon:ICON.batt, name:"Batarya sağlığı", go:()=>showTab("batarya"), sub:subBatt, show:()=>has("batarya") && (settings.fuel==="elektrik" || !!(typeof EVA!=="undefined" && EVA.st && EVA.st.demoEv))},
      {k:"ariza", icon:ICON.ariza, name:"Arızalar", go:()=>showTab("ariza"), sub:subDtc},
      {k:"surus", icon:ICON.surus, name:"Sürüşler", go:()=>showTab("surus"), sub:()=>REC.trip ? ["Kayıt sürüyor",""] : ["Kayıtlar, harita, grafik",""]},
      {k:"istatistik", icon:ICON.stat, name:"İstatistik", go:()=>showTab("istatistik"), sub:()=>["Tüketim, eğilimler",""], show:()=>has("istatistik")},
      {k:"panel", icon:ICON.panel, name:"Gösterge paneli", go:()=>window.CLUSTER && CLUSTER.open(), sub:()=>["Tam ekran kadran",""], show:()=>!!window.CLUSTER},
      {k:"hud", icon:ICON.hud, name:"Ön cam (HUD)", go:()=>window.HUD && HUD.open(), sub:()=>["Cama yansıyan hız",""], show:()=>!!window.HUD},
      {k:"bakim", icon:ICON.bakim, name:"Bakım", go:()=>has("bakim") ? showTab("bakim") : toMaint(), sub:subMaint},
      {k:"masraf", icon:ICON.masraf, name:"Masraf", go:()=>showTab("masraf"), sub:()=>["Yakıt, bakım, sigorta harcamaları",""], show:()=>has("masraf")},
      {k:"ayar", icon:ICON.ayar, name:"Ayarlar", go:()=>showTab("ayar"), sub:()=>["Sınırlar, yakıt, araçlar",""]},
    );
    return T.filter(t=>!t.show || t.show());
  }
  // her biri [yazı, "alert" | "warn" | ""]
  function subMotor(){
    if(!S.active) return ["Canlı değerler",""];
    const c=cur("05"), v=cur("42"), p=[];
    if(c!=null) p.push(fmt(c,0)+" °C"); if(v!=null) p.push(fmt(v,1)+" V");
    const bad=[...(S.alarms||new Map()).entries()].some(([k,a])=>a.level==="crit" && k!=="link");
    return [p.join(" · ")||"Bağlı", bad?"alert":""];
  }
  function subTrans(){
    if(typeof SYS==="undefined") return ["",""];
    if(!S.active) return [SYS.tcm() ? "Otomatik · beyin bulundu" : "Vites, şanzıman beyni",""];
    const g=SYS.gear();
    return [g.gear ? `${g.gear}. vites` : g.state==="duruyor" ? "Duruyor" : g.state==="ogreniyor" ? "Vitesler öğreniliyor" : g.state==="gecis" ? "Geçişte" : "Vites bilinmiyor", ""];
  }
  function subSys(s){
    const n=SYS.list().find(x=>x.tx===s.tx);
    return [S.active ? "Canlı okunuyor" : `${(n && n.pids || []).length} değer`, ""];
  }
  function subBatt(){
    const r=(settings.evReports||[]).slice(-1)[0];
    return r && r.soh!=null ? [`Son ölçüm: sağlık %${fmt(r.soh,0)}`, r.soh<70?"alert":r.soh<80?"warn":""] : ["İkinci el batarya raporu",""];
  }
  // yaklaşan bakım (features/maintenance.js kartındaki durum yazısından)
  function subMaint(){
    const c=document.getElementById("maintCard"), t=c && c.querySelector ? c.querySelector(".chip.crit, .chip.warn") : null;
    if(!t || !t.textContent) return ["Hatırlatıcı, yağ, filtre",""];
    const n=t.parentElement && t.parentElement.querySelector ? t.parentElement.querySelector("b") : null;
    return [(n && n.textContent ? n.textContent.trim()+": " : "")+t.textContent.trim(), /crit/.test(t.className)?"alert":"warn"];
  }
  function subDtc(){
    const d=S.dtc||{}, n=(d.stored||[]).length+(d.pending||[]).length+(d.perm||[]).length;
    if(!S.lastDtc) return ["Kodlar, rapor, akü testi",""];
    return n ? [`${n} arıza kodu`, (d.stored||[]).length||(d.perm||[]).length ? "alert" : "warn"] : ["Arıza kodu yok",""];
  }

  let sig="";
  function render(){
    const T=tiles(), key=T.map(t=>t.k).join("|");
    const grid=$("homeGrid");
    if(key!==sig){ sig=key; grid.innerHTML="";
      for(const t of T){ const b=document.createElement("button"); b.dataset.k=t.k;
        b.innerHTML=`${t.icon}<b>${t.name.replace(/[<>&]/g,"")}</b><span></span>`;
        b.addEventListener("click",()=>t.go()); grid.appendChild(b); } }
    const btns=grid.querySelectorAll ? grid.querySelectorAll("button") : [];
    btns.forEach(b=>{ const t=T.find(x=>x.k===b.dataset.k); if(!t) return;
      const [txt,cls]=t.sub(); b.lastChild.textContent=txt; b.className=cls||""; });
    // üst kart
    const v=settings.vehicles && settings.activeVehicle ? settings.vehicles[settings.activeVehicle] : null;
    $("homeVeh").textContent = v ? (v.ad || [v.marka,v.model].filter(Boolean).join(" ") || "Aracım") : "OBD Takip";
    $("homeState").textContent = ($("statusText")||{}).textContent || "";
    $("homeNav").hidden = !(typeof BG!=="undefined" && BG.goNav);   // bağlı değilken yalnız haritayı açar
    const al=[...(S.alarms||new Map()).values()], crit=al.filter(a=>a.level==="crit").length;
    $("homeChips").innerHTML = (crit?`<span class="chip crit">${crit} kritik uyarı</span>`:"")
      + (al.length-crit?`<span class="chip warn">${al.length-crit} uyarı</span>`:"")
      + (REC.trip?`<span class="chip info">Kayıt sürüyor</span>`:"");
  }
  let last=0;
  const soon=()=>{ if(!sec.hidden && Date.now()-last>900){ last=Date.now(); render(); } };
  on("tick", soon); on("connect", render); on("disconnect", render); on("dtc", render); on("alarm", render);
  on("systems", render); on("diag", render);
  setInterval(()=>{ if(!sec.hidden) render(); }, 3000);

  // showTab sarılır: ana sayfa açılınca tazele
  const origShow=showTab;
  showTab=function(name){ origShow(name); if(name==="ana") render(); };
  // Açılış: adres bir sekme istemiyorsa ana sayfa
  const h=location.hash.slice(1).split("-");
  if(h.includes("sanziman")) showTab("sanziman");   // çekirdek bu sekmeyi bilmiyor
  else if(!h.some(x=>["canli","ariza","surus","ayar","istatistik","bakim","masraf"].includes(x))) showTab("ana");
  render();
  return {render, tiles, section:sec};
})();
