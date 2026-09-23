// Gösterge düzeni: Canlı sekmesindeki göstergelerin sırası, boyu (Normal / Geniş) ve görünürlüğü.
// Kalıcı ayar: settings.layout = {order:[pid…], size:{pid:"wide"}}. Görünürlük çekirdeğin
// settings.lim[pid].show alanında durur (Ayarlar tablosuyla aynı yer).
(function(){
  if(settings.layout===undefined) settings.layout={order:[], size:{}};
  if(!Array.isArray(settings.layout.order)) settings.layout.order=[];
  if(!settings.layout.size || typeof settings.layout.size!=="object") settings.layout.size={};

  const css=document.createElement("style");
  css.textContent=`
.canli-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.canli-tools button{flex:none}
.gauges>.g[data-size="wide"]{grid-column:1/-1}
.g[data-size="wide"] .val{font-size:64px}
.g[data-size="wide"] .val small{font-size:20px}
.g[data-size="wide"] canvas.spark{height:52px}
.g.big[data-size="wide"] canvas.spark{height:170px}
.gauges[data-edit="1"] .g{cursor:default;border-style:dashed;border-color:var(--accent)}
.gauges[data-edit="1"] .g canvas.spark,.gauges[data-edit="1"] .g .sparkinfo,.gauges[data-edit="1"] .g .range{display:none}
.lay-ctl{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lay-ctl button{min-height:44px;padding:6px 4px;font-size:14px;font-weight:600}
.lay-ctl button:disabled{opacity:.35}
.g[data-size="wide"] .lay-ctl{grid-template-columns:repeat(4,1fr)}
.lay-bar{display:grid;gap:10px}
.lay-bar .actions button{flex:1 1 0;min-width:0}
.lay-hidden{display:flex;gap:8px;flex-wrap:wrap}
.lay-hidden button{font-size:14px;padding:8px 12px}
`;
  document.head.appendChild(css);

  // Hazır düzenler: sıra + görünürlük (+ boy). Teşhis'e su sıcaklığı da eklendi: gizlenen gösterge
  // okunmadığı için aşırı ısınma uyarısı sessizce kapanmasın.
  const PRESETS = {
    surus:  {name:"Sürüş",  pids:["0D","0C","05","FL","42"], size:{"0D":"wide"}},
    teshis: {name:"Teşhis", pids:["06","07","0B","10","0E","0F","05"], size:{}},
    tumu:   {name:"Tümü",   pids:null, size:{}},
  };

  let editing=false;
  const LAY=()=>settings.layout;
  const shown=pid=>!!(GBY[pid] && settings.lim[pid] && settings.lim[pid].show);

  // Kayıtlı sıra + (henüz sırada olmayan göstergeler tanım sırasıyla sonda).
  // Bilinmeyen pid'ler (sonradan yüklenen eklenti göstergesi) kayıtta korunur.
  function fullOrder(){
    const o=LAY().order.filter((p,i,a)=>a.indexOf(p)===i);
    for(const g of GAUGES) if(!o.includes(g.pid)) o.push(g.pid);
    return o;
  }
  function visible(){ return fullOrder().filter(shown); }

  function apply(){
    const box=$("gauges"); if(!box) return;
    box.dataset.edit = editing ? "1" : "";
    const vis=visible();
    vis.forEach((pid,i)=>{
      const el=$("g"+pid); if(!el) return;
      el.dataset.size = LAY().size[pid]==="wide" ? "wide" : "";
      box.appendChild(el);   // var olan öğeyi sona taşır → sıra kurulur
      if(editing) addCtl(el,pid,i,vis.length);
    });
    paintBar();
  }

  function addCtl(el,pid,i,n){
    if(el._layCtl) return; el._layCtl=true;
    const g=GBY[pid], wide=LAY().size[pid]==="wide";
    const d=document.createElement("div"); d.className="lay-ctl";
    d.innerHTML=`<button type="button" data-act="up" data-pid="${pid}" aria-label="${g.name}: yukarı taşı" ${i===0?"disabled":""}>▲ Yukarı</button>`+
      `<button type="button" data-act="down" data-pid="${pid}" aria-label="${g.name}: aşağı taşı" ${i===n-1?"disabled":""}>▼ Aşağı</button>`+
      `<button type="button" data-act="size" data-pid="${pid}" aria-label="${g.name}: boyu ${wide?"normal":"geniş"} yap">${wide?"Normal":"Geniş"}</button>`+
      `<button type="button" data-act="hide" data-pid="${pid}" aria-label="${g.name}: gizle">Gizle</button>`;
    el.appendChild(d);
  }

  function persist(){ save(); }
  function rebuild(){ buildSettings(); buildGauges(); GAUGES.forEach(paintGauge); }

  function move(pid,dir){
    const o=fullOrder(), vis=o.filter(shown), i=vis.indexOf(pid), j=i+dir;
    if(i<0 || j<0 || j>=vis.length) return false;
    const a=o.indexOf(pid), b=o.indexOf(vis[j]); o[a]=vis[j]; o[b]=pid;
    LAY().order=o; persist(); buildGauges(); GAUGES.forEach(paintGauge);
    return true;
  }
  function toggleSize(pid){
    if(LAY().size[pid]==="wide") delete LAY().size[pid]; else LAY().size[pid]="wide";
    persist(); buildGauges(); GAUGES.forEach(paintGauge);
  }
  function setShown(pid,on){
    if(!settings.lim[pid]) return;
    settings.lim[pid].show=on; persist(); rebuild();
  }
  function preset(key){
    const p=PRESETS[key]; if(!p) return;
    if(p.pids){
      const set=new Set(p.pids.filter(x=>GBY[x]));
      for(const g of GAUGES) settings.lim[g.pid].show=set.has(g.pid);
      LAY().order=[...set, ...fullOrder().filter(x=>!set.has(x))];
    }else{
      for(const g of GAUGES) if(!g.hide) settings.lim[g.pid].show=true;
      LAY().order=[];
    }
    LAY().size={...p.size};
    persist(); rebuild();
  }
  function setEdit(on){
    editing=!!on;
    const b=$("btnLayout");
    if(b){ b.textContent=editing?"Bitti":"Düzenle"; b.setAttribute("aria-pressed",String(editing)); b.className=editing?"primary":""; }
    buildGauges(); GAUGES.forEach(paintGauge);   // denetimler yeniden kurulur / kalkar
  }

  // Düzenleme şeridi: hazır düzenler + gizli göstergeleri geri açma
  function paintBar(){
    const bar=$("layBar"); if(!bar) return;
    bar.hidden=!editing; if(!editing) return;
    const hid=GAUGES.filter(g=>settings.lim[g.pid] && !settings.lim[g.pid].show);
    bar.innerHTML=`<p class="sub">Okla sırayı değiştir, <b>Geniş</b> ile göstergeyi iki sütuna yay, <b>Gizle</b> ile kaldır. Bitince <b>Bitti</b>'ye dokun.</p>
      <div class="label">Hazır düzen</div>
      <div class="actions">${Object.entries(PRESETS).map(([k,p])=>`<button type="button" data-preset="${k}">${p.name}</button>`).join("")}</div>
      ${hid.length?`<details><summary class="label" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Gizli göstergeler (${hid.length}) — dokun, geri ekle</summary>
      <div class="lay-hidden">${hid.map(g=>`<button type="button" data-show="${g.pid}">+ ${g.name}</button>`).join("")}</div></details>`:""}`;
  }

  // Arayüz: "Düzenle" düğmesi başlık satırının altındaki araç satırında
  function tools(){
    let t=document.getElementById("canliTools");
    if(!t){
      const row=$("gTitle") && $("gTitle").parentNode; if(!row || !row.parentNode) return null;
      t=document.createElement("div"); t.id="canliTools"; t.className="canli-tools";
      row.parentNode.insertBefore(t,row.nextSibling);
    }
    return t;
  }
  const t=tools();
  if(t){
    const b=document.createElement("button"); b.type="button"; b.id="btnLayout"; b.textContent="Düzenle";
    b.setAttribute("aria-pressed","false"); b.setAttribute("aria-controls","gauges");
    b.addEventListener("click",()=>setEdit(!editing));
    t.appendChild(b);
  }
  const gb=$("gauges");
  if(gb && gb.parentNode && !document.getElementById("layBar")){
    const bar=document.createElement("div"); bar.id="layBar"; bar.className="card lay-bar"; bar.hidden=true;
    gb.parentNode.insertBefore(bar,gb);
    bar.addEventListener("click",e=>{
      const p=e.target.closest("[data-preset]"); if(p){ preset(p.dataset.preset); return; }
      const s=e.target.closest("[data-show]"); if(s) setShown(s.dataset.show,true);
    });
  }
  // Düzenleme modunda dokunuş çekirdeğin büyüt/küçült tıklamasına ulaşmasın (yakalama aşaması)
  if(gb){
    gb.addEventListener("click",e=>{
      if(!editing) return;
      e.stopPropagation(); e.preventDefault();
      const btn=e.target.closest && e.target.closest("[data-act]"); if(!btn || btn.disabled) return;
      const pid=btn.dataset.pid, act=btn.dataset.act;
      if(act==="up") move(pid,-1); else if(act==="down") move(pid,1);
      else if(act==="size") toggleSize(pid); else if(act==="hide") setShown(pid,false);
      const again=$("g"+pid) && $("g"+pid).querySelector(`[data-act="${act}"]`);
      if(again && !again.disabled && again.focus) again.focus();   // klavye/ekran okuyucu yerini kaybetmesin
    },true);
    gb.addEventListener("keydown",e=>{
      if(editing && (e.key==="Enter"||e.key===" ")) e.stopPropagation();   // düğmenin kendi tıklaması yine çalışır
    },true);
  }

  on("gaugesBuilt",apply);
  apply();   // bu dosya ilk buildGauges()'dan sonra yükleniyor

  window.LAYOUT={apply, move, toggleSize, setShown, preset, setEdit, visible, fullOrder, PRESETS, get editing(){ return editing; }};
})();
