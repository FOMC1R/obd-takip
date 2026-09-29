// ---------- Alt menüler: uzun sekmeleri telefon ayarları gibi bölümlere ayırır ----------
// Ayarlar ve Arıza sekmeleri önce bir başlık listesi gösterir; dokununca yalnız o bölümün kartları açılır, üstte "‹ Geri".
// Telefonun geri tuşu da listeye döner (history). Kartlar başlıklarına (ilk h2) göre bölüme atanır: kart.dataset.mg.
// Hiçbir bölüme uymayan kart "Diğer"e düşer — yeni eklenen bir kart kaybolmaz. Gizleme CSS ile yapılır; kartların
// kendi "hidden" durumuna dokunulmaz. Bakım ve Masraf, Sürüşler'den çıkıp kendi sekmelerine taşınır (ana sayfa kutucukları).
// Bu dosya en sonda yüklenir (bütün kartlar oluşmuş olur).
const MENUS = (()=>{
  const I = d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC={
    car:I('<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>'),
    warn:I('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
    fuel:I('<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12M14 9h2a2 2 0 0 1 2 2v5a2 2 0 0 0 4 0V8l-3-3"/>'),
    batt:I('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M7 10v4M10.5 10v4"/>'),
    gear:I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    road:I('<path d="M8 3L4 21M16 3l4 18M12 5v2M12 11v2M12 17v2"/>'),
    spark:I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    save:I('<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
    lock:I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    help:I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5M12 17v.01"/>'),
    info:I('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M8 8h8M8 16h5"/>'),
    chip:I('<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>'),
    test:I('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>'),
    doc:I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'),
    more:I('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  };
  const DEF={
    ayar:{groups:[
      {k:"arac",  icon:IC.car,   name:"Araçlarım",            sub:"Kayıtlı araçlar, araç değiştirme",              match:/^Araçlarım/},
      {k:"sinir", icon:IC.warn,  name:"Uyarı sınırları",      sub:"Hangi değer, hangi sınırda uyarsın",            match:/^Uyarı sınırları/},
      {k:"yakit", icon:IC.fuel,  name:"Yakıt ve fiyat",       sub:"Yakıt türü, litre fiyatı, motor hacmi",         match:/^Yakıt/},
      {k:"ev",    icon:IC.batt,  name:"Elektrikli araç",      sub:"Araç profili, özel değer listesi",              match:/^Elektrikli araç/},
      {k:"genel", icon:IC.gear,  name:"Ses, kayıt ve ekran",  sub:"Sesli uyarı, kayıt, GPS, arka planda çalışma",  match:/^(Uygulama|Arka planda çalışma|Açılış animasyonu|Uygulama olarak yükle)$/},
      {k:"surus", icon:IC.road,  name:"Sürüş ekranları",      sub:"Otomatik açılan ekran, hız sınırı",             match:/^(Sürüşte otomatik aç|Hız sınırı)$/},
      {k:"ai",    icon:IC.spark, name:"Yapay zekâ",           sub:"Yorum için API anahtarı",                       match:/^Yapay zekâ/},
      {k:"yedek", icon:IC.save,  name:"Yedek ve tanılama",    sub:"Yedek al, geri yükle, tanılama paketi",         match:/^(Yedekle|Tanılama)/},
      {k:"gizli", icon:IC.lock,  name:"Gizlilik",             sub:"Kullanım istatistiği",                          match:/^Kullanım istatistiği/},
      {k:"yardim",icon:IC.help,  name:"Yardım ve yenilikler", sub:"Nasıl kullanılır, sürüm notları",               match:/^(Nasıl kullanılır|Yenilikler)/},
    ]},
    ariza:{pinned:/^Arıza kodları/, groups:[
      {k:"durum", icon:IC.info,  name:"Araç durumu",          sub:"Şase no, muayene hazırlığı, donmuş kare, sayaçlar", match:/^Araç durumu/},
      {k:"beyin", icon:IC.chip,  name:"Diğer beyinler",       sub:"ABS, hava yastığı, gösterge, gövde",           match:/^Diğer beyinler/},
      {k:"test",  icon:IC.test,  name:"Testler",              sub:"Akü testi, tekleme sayacı, aracın kendi testleri", match:/^(Akü testi|Tekleme sayacı|Aracın kendi test)/},
      {k:"rapor", icon:IC.doc,   name:"Rapor ve yorum",       sub:"Yapay zekâ yorumu, PDF rapor",                  match:/^(Yapay zekâ|Arıza raporu)/},
    ]},
  };
  const OTHER={k:"diger", icon:IC.more, name:"Diğer", sub:"", match:null};
  const titleOf=c=>{ const h=c.querySelector && c.querySelector("h2"); return h && h.textContent ? h.textContent.trim() : ""; };
  function groupOf(tab, title){
    const d=DEF[tab]; if(!d) return null;
    if(d.pinned && d.pinned.test(title)) return "";
    const g=d.groups.find(x=>x.match.test(title)); return g ? g.k : OTHER.k;
  }

  // ---- stil: liste görünümünde bölüm kartları, bölüm görünümünde diğer bölümler gizli ----
  const css=document.createElement("style");
  const keys=[...new Set(Object.values(DEF).flatMap(d=>d.groups.map(g=>g.k)).concat(OTHER.k))];
  css.textContent=`
.mg-head{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.mg-head button{min-height:40px;padding:6px 12px 6px 8px;font-weight:600}
.mg-head b{font-size:18px}
.mg-list{display:grid;gap:0;padding:4px 0;overflow:hidden}
.mg-list button{display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;column-gap:12px;align-items:center;text-align:left;
  width:100%;min-height:62px;padding:10px 14px;border:0;border-radius:0;background:none;color:var(--text);border-top:1px solid var(--line)}
.mg-list button:first-child{border-top:0}
.mg-list button svg{grid-row:1/3;width:24px;height:24px;color:var(--accent)}
.mg-list button b{font-size:16px;font-weight:600}
.mg-list button span{grid-column:2;font-size:13px;color:var(--muted);line-height:1.3}
.mg-list button i{grid-row:1/3;grid-column:3;font-style:normal;font-size:22px;color:var(--muted)}
section.tab[data-mg=""] [data-mg]:not([data-mg=""]){display:none!important}
section.tab[data-mg=""] .mg-head{display:none}
section.tab:not([data-mg=""]) .mg-list, section.tab:not([data-mg=""]) [data-mg=""]{display:none!important}
${keys.map(k=>`section.tab[data-mg="${k}"] [data-mg]:not([data-mg="${k}"]){display:none!important}`).join("\n")}
.lim-f{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.lim-f button{min-height:36px;padding:4px 12px;border-radius:999px;font-size:14px}
.lim-f button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
${["on","motor","yakit","ev","ozel"].map(f=>`#settings[data-lf="${f}"] tbody tr:not([data-lf~="${f}"]){display:none}`).join("\n")}
`;
  document.head.appendChild(css);

  const st={};   // sekme → {sec, groups, pushed}
  function setup(tab){
    const sec=document.querySelector(`section.tab[data-tab="${tab}"]`); if(!sec || !sec.querySelectorAll) return;
    const cards=[...sec.querySelectorAll(".card")].filter(c=>!(c.parentElement && c.parentElement.closest && c.parentElement.closest(".card")));
    const used=new Set();
    for(const c of cards){ const g=groupOf(tab, titleOf(c)); c.dataset.mg=g; if(g) used.add(g); }
    const groups=DEF[tab].groups.filter(g=>used.has(g.k)).concat(used.has(OTHER.k)?[OTHER]:[]);
    const head=document.createElement("div"); head.className="mg-head";
    head.innerHTML=`<button type="button">‹ Geri</button><b></b>`;
    const list=document.createElement("nav"); list.className="card mg-list"; list.setAttribute("aria-label","Bölümler");
    list.innerHTML=groups.map(g=>`<button type="button" data-k="${g.k}">${g.icon}<b>${escHtml(g.name)}</b><span>${escHtml(g.sub)}</span><i aria-hidden="true">›</i></button>`).join("");
    // Arıza: sabit kart (arıza kodları) üstte kalır, liste onun altında
    const pin=cards.find(c=>c.dataset.mg==="");
    if(pin && pin.after) pin.after(list); else sec.prepend(list);
    sec.prepend(head);
    list.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>open(tab, b.dataset.k)));
    head.querySelector("button").addEventListener("click",()=>back(tab));
    sec.dataset.mg="";
    st[tab]={sec, groups, head, list, pushed:false};
    refresh(tab);
  }
  // İçindeki bütün kartlar gizliyse (ör. elektrikli araç değilken) satır da gizlenir
  function refresh(tab){
    const s=st[tab]; if(!s) return;
    s.list.querySelectorAll("button").forEach(b=>{
      const cs=[...s.sec.querySelectorAll(`[data-mg="${b.dataset.k}"]`)];
      b.hidden = !cs.some(c=>!c.hidden);
    });
  }
  function open(tab, k){
    const s=st[tab]; if(!s) return;
    const g=s.groups.find(x=>x.k===k); if(!g) return;
    s.sec.dataset.mg=k; s.head.querySelector("b").textContent=g.name;
    try{ if(!s.pushed && typeof history!=="undefined" && history.pushState){ history.pushState({mg:tab},""); s.pushed=true; } }catch(e){}
    window.scrollTo(0,0);
  }
  function close(tab){ const s=st[tab]; if(!s) return; s.sec.dataset.mg=""; refresh(tab); window.scrollTo(0,0); }
  function back(tab){
    const s=st[tab]; if(!s) return;
    if(s.pushed){ try{ history.back(); return; }catch(e){} }
    close(tab);
  }
  window.addEventListener("popstate",()=>{ for(const t in st) if(st[t].pushed){ st[t].pushed=false; close(t); } });

  // ---- Uyarı sınırları süzgeci: satırlar GAUGES sırasıyla oluşur (buildSettings) ----
  const LF=[["on","Gösterilenler"],["motor","Motor"],["yakit","Yakıt"],["ev","Elektrik"],["ozel","Özel"]];
  const catOf=g=>g.ev ? "ev" : g.custom ? "ozel" : /yakıt|tüketim|hava akışı|manifold|lambda|oksijen|depo|L\/100/i.test(g.name) ? "yakit" : "motor";
  if(settings.limFilter===undefined) settings.limFilter="on";
  function tagRows(){
    const tb=$("setBody"); if(!tb || !tb.children || !tb.children.length) return;
    [...tb.children].forEach((tr,i)=>{ const g=GAUGES[i]; if(!g || !tr.dataset) return;
      tr.dataset.lf=catOf(g)+(settings.lim[g.pid] && settings.lim[g.pid].show ? " on" : ""); });
  }
  function paintFilter(){
    $("settings").dataset.lf=settings.limFilter;
    const bar=$("limF"); if(bar && bar.querySelectorAll) bar.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.f===settings.limFilter)));
  }
  { const bar=document.createElement("div"); bar.className="lim-f"; bar.id="limF"; bar.setAttribute("role","group"); bar.setAttribute("aria-label","Değerleri süz");
    bar.innerHTML=LF.map(([f,n])=>`<button type="button" data-f="${f}">${n}</button>`).join("")+`<button type="button" data-f="all">Tümü</button>`;
    const tbl=document.querySelector("#settings .set-table");
    if(tbl && tbl.parentNode && tbl.parentNode.insertBefore) tbl.parentNode.insertBefore(bar, tbl); else $("settings").appendChild(bar);
    if(bar.querySelectorAll) bar.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ settings.limFilter=b.dataset.f; save(); tagRows(); paintFilter(); }));
    const tb=$("setBody"); if(tb.addEventListener) tb.addEventListener("change",()=>tagRows());
  }
  const origBuild=buildSettings;
  buildSettings=function(){ origBuild(); tagRows(); paintFilter(); };
  tagRows(); paintFilter();

  // ---- Bakım ve Masraf: kendi sekmeleri ----
  function ownTab(name, label, card){
    if(!card) return;
    const sec=document.createElement("section"); sec.className="tab"; sec.dataset.tab=name; sec.hidden=true; sec.setAttribute("aria-label",label);
    const main=document.querySelector("main")||document.body; main.appendChild(sec); sec.appendChild(card);
  }
  ownTab("bakim","Bakım", $("maintCard"));
  ownTab("masraf","Masraf", $("expCard"));

  for(const t in DEF) setup(t);
  // başka sekmeye geçince açık bölüm kapanır (dönüşte liste görünür)
  const origShow=showTab;
  showTab=function(name){
    for(const t in st) if(t!==name && st[t].sec.dataset.mg){ st[t].pushed=false; close(t); }
    origShow(name);
    if(st[name]) refresh(name);
  };
  { const h=location.hash.slice(1).split("-"); for(const x of ["bakim","masraf"]) if(h.includes(x)) showTab(x); }

  return {DEF, groupOf, catOf, open, close, back, refresh, st, tagRows};
})();
