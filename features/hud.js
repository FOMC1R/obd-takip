// Ön cam görünümü (HUD — telefonu torpidoya koyup ön camdaki yansımasını okumak için).
// Üstte devir çubuğu ve vites uyarısı, ortada çok büyük hız ve hız sınırı, altta seçilebilir
// üç değer; o an süren tehlikede uyarının kendisi büyük yazıyla çıkar.
// Kalıcı ayar: settings.hud = {flipY, flipX, bright:"oto"|"gunduz"|"aksam"|"gece", color, slots:[pid…], shift, simple}
(function(){
  const DEF={flipY:false, flipX:false, bright:"oto", color:"turkuaz", slots:["05","FUEL","42"], shift:0, simple:false};
  if(settings.hud===undefined) settings.hud={};
  // eski sürüm: {mirror:bool} → sağ-sol aynalama
  if(settings.hud.mirror!==undefined && settings.hud.flipX===undefined) settings.hud.flipX=!!settings.hud.mirror;
  for(const k in DEF) if(settings.hud[k]===undefined) settings.hud[k]=Array.isArray(DEF[k])?DEF[k].slice():DEF[k];

  // Renkler: gece yansımasında göz almayan, siyah zeminde en okunaklı tonlar
  const COLORS={turkuaz:"#00e5ff", yesil:"#3dff8a", beyaz:"#ffffff", amber:"#ffb020"};
  const BRIGHT={gunduz:1, aksam:.7, gece:.42};
  const BRIGHT_NAME={oto:"Otomatik", gunduz:"Gündüz", aksam:"Akşam", gece:"Gece"};
  // Alt satıra konabilecek değerler ("FUEL": hareket ederken L/100 km, dururken L/sa)
  const SLOT_CHOICES=["05","FUEL","42","04","0F","11","2F","0C","5C","3C","0B"];

  const css=document.createElement("style");
  css.textContent=`
.hud{position:fixed;inset:0;z-index:1000;background:#000;color:#fff;overflow:hidden;
  font-family:var(--f-num);user-select:none;-webkit-user-select:none;touch-action:manipulation;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);
  --hc:#00e5ff}
.hud-in{position:absolute;inset:0;display:grid;grid-template-rows:auto auto 1fr auto;gap:2vh;padding:3vh 5vw 5vh;min-height:0}
.hud-top{display:flex;justify-content:space-between;font-family:var(--f-body);font-weight:600;font-size:min(4.4vw,2.6vh);color:#9aa;letter-spacing:.02em;font-variant-numeric:tabular-nums}
/* devir çubuğu: 20 bölme, yeşil → sarı → kırmızı; vites noktasında tümü yanıp söner */
.hud-rpm{display:grid;grid-template-columns:repeat(20,1fr);gap:.6vw;height:min(5vh,7vw)}
.hud-rpm i{border-radius:2px;background:#161a1a}
.hud-rpm i.on{background:#35e07a}.hud-rpm i.on.m{background:#ffc400}.hud-rpm i.on.h{background:#ff3b30}
.hud-rpm.shift i{background:#ff3b30;animation:hudshift .18s steps(2) infinite}
@keyframes hudshift{50%{background:#300}}
.hud-main{display:grid;place-items:center;align-content:center;min-height:0;position:relative}
.hud-spd{font-size:min(66vw,40vh);font-weight:700;line-height:.82;color:var(--hc);font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.hud-spd.d3{font-size:min(46vw,32vh)}
.hud-spd.near{color:#ffc400}.hud-spd.over{color:#ff3b30}
.hud-sub{display:flex;align-items:center;gap:4vw;margin-top:1.2vh}
.hud-u{font-size:min(6.5vw,4vh);font-weight:600;letter-spacing:.06em;color:#fff}
.hud-lim{display:grid;place-items:center;width:min(15vw,9vh);height:min(15vw,9vh);border-radius:50%;
  border:min(1.6vw,1vh) solid #ff3b30;background:#fff;color:#000;font-weight:700;font-size:min(6vw,3.6vh);font-variant-numeric:tabular-nums}
.hud-row{display:grid;grid-template-columns:repeat(3,1fr);gap:3vw}
.hud-c{display:grid;justify-items:center;line-height:1;padding:1.2vh 0;border-radius:12px;min-width:0}
.hud-v{font-size:min(12.5vw,7.5vh);font-weight:700;font-variant-numeric:tabular-nums;color:#fff;white-space:nowrap}
.hud-c.bad .hud-v{color:#ff3b30}.hud-c.warn .hud-v{color:#ffc400}
.hud-l{font-size:min(3.8vw,2.3vh);color:#9aa;font-family:var(--f-body);font-weight:600;margin-top:.5em;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.hud.edit .hud-c{outline:2px dashed #555;cursor:pointer}
/* süren tehlike: kırmızı çerçeve ve uyarının kendisi */
.hud-alert{position:absolute;left:4vw;right:4vw;top:calc(env(safe-area-inset-top,0px) + 2.5vh);background:#ff1f1f;z-index:2;color:#fff;border-radius:14px;
  padding:2.2vh 4vw;font-family:var(--f-body);font-weight:700;font-size:min(7vw,4.4vh);line-height:1.15;text-align:center;
  box-shadow:0 0 0 6px #000}
.hud.alarm{box-shadow:inset 0 0 0 10px #ff1f1f;animation:hudflash .7s steps(2) infinite}
@keyframes hudflash{50%{box-shadow:inset 0 0 0 10px #000}}
.hud.simple .hud-row,.hud.simple .hud-top{visibility:hidden}
/* kontrol çubuğu (dokununca 4 sn görünür; yansıtma uygulanmaz ki okunsun) */
.hud-bar{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  background:#0a0c0c;padding:10px;border-radius:14px;border:1px solid #333}
.hud-bar button{min-height:52px;background:#161a1a;color:#fff;border:1px solid #444;font-size:15px;font-weight:600;padding:6px 4px;line-height:1.15}
.hud-bar button[aria-pressed="true"]{border-color:var(--hc);color:var(--hc)}
.hud-bar .hint{grid-column:1/-1;color:#9aa;font:13px/1.35 var(--f-body);margin:0}
@media (orientation:landscape){
  .hud-in{grid-template-columns:1.3fr 1fr;grid-template-rows:auto auto 1fr;padding:2.5vh 3vw}
  .hud-top,.hud-rpm{grid-column:1/-1}
  .hud-spd{font-size:min(34vw,64vh)}
  .hud-spd.d3{font-size:min(25vw,56vh)}
  .hud-u{font-size:min(3vw,6vh)}
  .hud-lim{width:min(8vw,15vh);height:min(8vw,15vh);font-size:min(3.2vw,6vh)}
  .hud-row{grid-template-columns:none;grid-template-rows:repeat(3,1fr);align-content:center;gap:2vh}
  .hud-v{font-size:min(7vw,13vh)}
  .hud-l{font-size:min(2vw,4.2vh)}
  .hud-top{font-size:min(2.2vw,4.5vh)}
  .hud-alert{left:3vw;right:3vw;top:calc(env(safe-area-inset-top,0px) + 1.5vh);font-size:min(4vw,7vh);padding:1.6vh 3vw}
  .hud-bar{grid-template-columns:repeat(6,1fr);left:50%;right:auto;transform:translateX(-50%);width:min(96vw,900px)}
}
@media (prefers-reduced-motion:reduce){.hud.alarm,.hud-rpm.shift i{animation:none}}
`;
  document.head.appendChild(css);

  const H={open:false, el:null, inn:null, bar:null, vals:{}, slots:[], segs:[], timer:null, barT:null, pushed:false, fs:false, edit:false};
  const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const btn=(txt,fn)=>{ const b=mk("button",null,txt); b.type="button"; b.addEventListener("click",e=>{ e.stopPropagation(); fn(b); showBar(); }); return b; };

  // Kısa etiket: alt satırda yer dar
  const SHORT={"05":"Su (°C)","42":"Akü (V)","04":"Yük (%)","0F":"Emme havası (°C)","11":"Gaz (%)","2F":"Yakıt (%)","0C":"Devir","5C":"Yağ (°C)","3C":"Katalizör (°C)","0B":"Emme bas. (kPa)","5B":"Batarya (%)"};
  function slotLabel(pid){
    if(pid==="FUEL") return cur("FK")!=null ? "Tüketim (L/100)" : "Tüketim (L/sa)";
    const g=GBY[pid]; return SHORT[pid] || (g ? `${g.name} (${g.unit})` : pid);
  }
  function slotValue(pid){
    if(pid==="FUEL"){ const fk=cur("FK"); return fk!=null ? fmt(fk,1) : fmt(cur("FL"),1); }
    const g=GBY[pid]; if(!g) return "—"; const v=cur(pid); return v==null ? "—" : fmt(v,g.dec);
  }
  function slotState(pid){
    const g=GBY[pid==="FUEL"?"FK":pid]; if(!g) return "";
    const st=S.g[g.pid], L=settings.lim[g.pid]; if(!st || st.v==null || !L) return "";
    if(st.alarm) return "bad";
    const span=(g.hi-g.lo)*0.05;
    if((L.max!=null && st.v>L.max-span) || (L.min!=null && st.v<L.min+span)) return "warn";
    return "";
  }
  // Seçilebilir değerler: listede olup aracın verdiği (ya da henüz bilinmeyen) değerler + EV bataryası
  function choices(){
    const list=SLOT_CHOICES.filter(p=>p==="FUEL" || (GBY[p] && (!S.supported || has(p) || GBY[p].read)));
    if(GBY["5B"] && !list.includes("5B")) list.push("5B");
    return list;
  }

  function build(){
    const o=mk("div","hud"); o.setAttribute("role","dialog"); o.setAttribute("aria-label","Ön cam görünümü");
    const inn=mk("div","hud-in");
    const top=mk("div","hud-top"), clock=mk("span"), trip=mk("span"); top.append(clock,trip);
    const rpm=mk("div","hud-rpm"); rpm.setAttribute("aria-hidden","true");
    const segs=[]; for(let i=0;i<20;i++){ const s=mk("i"); rpm.appendChild(s); segs.push(s); }
    const main=mk("div","hud-main"), spd=mk("div","hud-spd","—");
    const sub=mk("div","hud-sub"), u=mk("span","hud-u","km/sa"), lim=mk("span","hud-lim","");
    lim.setAttribute("aria-label","Hız uyarı sınırı"); sub.append(lim,u); main.append(spd,sub);
    const alert=mk("div","hud-alert"); alert.hidden=true;
    const row=mk("div","hud-row"), slots=[];
    for(let i=0;i<3;i++){
      const c=mk("div","hud-c"), v=mk("div","hud-v","—"), l=mk("div","hud-l","");
      c.append(v,l); row.appendChild(c); slots.push({c,v,l});
      c.addEventListener("click",e=>{ if(!H.edit) return; e.stopPropagation(); cycleSlot(i); showBar(); });
    }
    inn.append(top,rpm,main,row,alert); o.appendChild(inn);

    const bar=mk("div","hud-bar"); bar.hidden=true;
    const bY=btn("Ön cam yansıması",()=>{ settings.hud.flipY=!settings.hud.flipY; save(); applyView(); });
    const bX=btn("Sağ-sol aynala",()=>{ settings.hud.flipX=!settings.hud.flipX; save(); applyView(); });
    const bB=btn("",()=>{ const k=["oto","gunduz","aksam","gece"]; settings.hud.bright=k[(k.indexOf(settings.hud.bright)+1)%k.length]; save(); applyView(); });
    const bC=btn("Renk",()=>{ const k=Object.keys(COLORS); settings.hud.color=k[(k.indexOf(settings.hud.color)+1)%k.length]; save(); applyView(); });
    const bE=btn("Değerleri seç",()=>{ H.edit=!H.edit; applyView(); });
    const bS=btn("Sade",()=>{ settings.hud.simple=!settings.hud.simple; save(); applyView(); });
    const bK=btn("Kapat",()=>close());
    const hint=mk("p","hint","Torpidoda düz yatan telefonda \"Ön cam yansıması\"nı aç. \"Değerleri seç\" açıkken alttaki değerlere dokunarak değiştir.");
    bar.append(bY,bX,bB,bC,bE,bS,bK,hint);
    // 3 sütunda 7 düğme: Kapat son satırın tamamını kaplar
    bK.style.gridColumn="1/-1";
    o.appendChild(bar);
    o.addEventListener("click",showBar);
    Object.assign(H,{el:o, inn, bar, segs, rpmEl:rpm, slots, alertEl:alert, limEl:lim, clock, trip,
      vals:{spd}, btns:{bY,bX,bB,bC,bE,bS}});
  }

  function cycleSlot(i){
    const list=choices(), curPid=settings.hud.slots[i];
    let j=list.indexOf(curPid);
    for(let n=0;n<list.length;n++){ j=(j+1)%list.length; if(!settings.hud.slots.includes(list[j]) || list[j]===curPid) break; }
    settings.hud.slots[i]=list[j]; save(); update();
  }
  function brightness(){
    if(settings.hud.bright!=="oto") return BRIGHT[settings.hud.bright];
    const h=new Date().getHours(); return (h>=20 || h<7) ? BRIGHT.gece : (h>=18 || h<8) ? BRIGHT.aksam : BRIGHT.gunduz;
  }
  function applyView(){
    if(!H.inn) return;
    const sx=settings.hud.flipX?-1:1, sy=settings.hud.flipY?-1:1;
    H.inn.style.transform=(sx<0||sy<0)?`scale(${sx},${sy})`:"";
    H.inn.style.filter=`brightness(${brightness()})`;
    if(H.el.style.setProperty) H.el.style.setProperty("--hc", COLORS[settings.hud.color]||COLORS.turkuaz);
    const b=H.btns;
    b.bY.setAttribute("aria-pressed",String(!!settings.hud.flipY));
    b.bX.setAttribute("aria-pressed",String(!!settings.hud.flipX));
    b.bB.textContent="Parlaklık: "+BRIGHT_NAME[settings.hud.bright];
    b.bC.textContent="Renk: "+settings.hud.color.replace("yesil","yeşil");
    b.bE.setAttribute("aria-pressed",String(H.edit));
    b.bS.setAttribute("aria-pressed",String(!!settings.hud.simple));
    update();
  }
  function showBar(){
    if(!H.bar) return;
    H.bar.hidden=false; clearTimeout(H.barT);
    H.barT=setTimeout(()=>{ if(H.bar){ H.bar.hidden=true; if(H.edit){ H.edit=false; applyView(); } } },H.edit?8000:4000);
  }
  // Geriye uyum: eski "Aynala" = sağ-sol
  function setMirror(on){ settings.hud.flipX=!!on; settings.hud.mirror=!!on; save(); applyView(); }

  // Kısa uyarı metni: "Soğutma suyu sıcaklığı: 112 °C (üst sınır 110)" → "SOĞUTMA SUYU SICAKLIĞI 112 °C"
  function alertText(){
    const now=[...S.alarms.entries()].filter(([k,a])=>a.level==="crit" && (k.startsWith("g") || k==="link"));
    if(!now.length) return null;
    const [k,a]=now[now.length-1];
    if(k==="link") return "BAĞLANTI KOPTU";
    return a.text.replace(/\s*\(.*\)\s*$/,"").replace(":","").toLocaleUpperCase("tr-TR");
  }

  function update(){
    if(!H.open) return;
    const sp=cur("0D"), rpm=cur("0C"), lim=settings.lim["0D"] && settings.lim["0D"].max;
    // hız ve sınır
    H.vals.spd.textContent=fmt(sp,0);
    // üç haneli hızda yazı küçülür ki ekrana sığsın
    H.vals.spd.className="hud-spd"+(sp!=null && sp>=100?" d3":"")+(sp!=null && lim ? (sp>lim?" over":sp>lim-5?" near":"") : "");
    H.limEl.hidden=!lim; H.limEl.textContent=lim?String(lim):"";
    // devir çubuğu: tam ölçek = uyarı sınırının %110'u; vites noktası ayarlı değilse sınırın 700 altı
    const red=(settings.lim["0C"] && settings.lim["0C"].max) || 6200, full=red*1.1;
    const shift=settings.hud.shift || red-700;
    H.rpmEl.hidden=(rpm==null);
    if(rpm!=null){
      const n=Math.round(Math.min(1,rpm/full)*20);
      H.segs.forEach((s,i)=>{ const f=(i+1)/20*full; s.className=(i<n?"on":"")+(f>red?" h":f>red*.75?" m":""); });
      H.rpmEl.classList.toggle("shift", rpm>=shift);
    }
    // alt satır
    settings.hud.slots.forEach((pid,i)=>{
      const s=H.slots[i]; if(!s) return;
      s.v.textContent=slotValue(pid); s.l.textContent=slotLabel(pid);
      s.c.className="hud-c "+slotState(pid);
    });
    // saat ve sürüş
    const d=new Date(); H.clock.textContent=d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    const t=REC.trip; H.trip.textContent = t ? `${fmt((t.odo||0),1)} km · ${fmtDur(Date.now()-t.start).replace(/ \d+ sn$/,"")}` : "";
    // süren tehlike
    const txt=alertText();
    H.alertEl.hidden=!txt; if(txt) H.alertEl.textContent=txt;
    const cls="hud"+(txt?" alarm":"")+(H.edit?" edit":"")+(settings.hud.simple?" simple":"");
    if(H.el.className!==cls) H.el.className=cls;
  }

  function open(){
    if(H.open) return;
    if(!H.el) build();
    document.body.appendChild(H.el); H.open=true; H.fs=false; H.edit=false;
    applyView();
    try{ if(typeof history!=="undefined" && history.pushState){ history.pushState({hud:1},""); H.pushed=true; } }catch(e){}
    try{
      if(H.el.requestFullscreen){
        const p=H.el.requestFullscreen({navigationUI:"hide"});
        if(p && p.then) p.then(()=>{ H.fs=true; },()=>{});
      }
    }catch(e){}
    try{ if(typeof keepAwake==="function") keepAwake(); }catch(e){}
    update(); showBar();
    H.timer=setInterval(update,500);
  }
  function close(fromPop){
    if(!H.open) return;
    H.open=false; clearInterval(H.timer); clearTimeout(H.barT);
    try{ H.el.remove(); }catch(e){}
    try{ if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{}); }catch(e){}
    if(H.pushed){ H.pushed=false; if(!fromPop) try{ history.back(); }catch(e){} }
    const b=$("btnHud"); if(b && b.focus) b.focus();
  }

  on("tick",update);
  window.addEventListener("popstate",()=>{ if(H.open){ H.pushed=false; close(true); } });
  document.addEventListener("keydown",e=>{ if(H.open && e.key==="Escape") close(); });
  document.addEventListener("fullscreenchange",()=>{
    if(document.fullscreenElement) H.fs=true;
    else if(H.open && H.fs) close();   // telefonun geri hareketi tam ekrandan çıkınca görünüm de kapansın
  });

  // Düğme: "Anlık değerler" başlığının altındaki araç satırı (layout.js ile ortak)
  let t=document.getElementById("canliTools");
  if(!t){
    const row=$("gTitle") && $("gTitle").parentNode;
    if(row && row.parentNode){ t=document.createElement("div"); t.id="canliTools"; t.className="canli-tools"; row.parentNode.insertBefore(t,row.nextSibling); }
  }
  if(t){
    if(!document.getElementById("hudToolsCss")){   // layout.js yüklü değilse satır stili burada
      const s=document.createElement("style"); s.id="hudToolsCss";
      s.textContent=".canli-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.canli-tools button{flex:none}";
      document.head.appendChild(s);
    }
    const b=document.createElement("button"); b.type="button"; b.id="btnHud"; b.textContent="Ön cam (HUD)";
    b.setAttribute("aria-label","Ön cam görünümünü aç: büyük hız, siyah zemin");
    b.addEventListener("click",open);
    t.insertBefore ? t.insertBefore(b,t.firstChild) : t.appendChild(b);
  }

  window.HUD={open, close, update, setMirror, applyView, cycleSlot, alertText,
    get isOpen(){ return H.open; }, get vals(){ return H.vals; }, get slots(){ return H.slots; }, get el(){ return H.el; }, get rpmEl(){ return H.rpmEl; },
    set edit(v){ H.edit=!!v; }};
})();
