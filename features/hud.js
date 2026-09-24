// Ön cam görünümü (HUD — telefonu torpidoya koyup ön camdaki yansımasını okumak için).
// Üstte devir çubuğu ve vites uyarısı, ortada çok büyük hız ve hız sınırı, altta seçilebilir
// üç değer; o an süren tehlikede uyarının kendisi büyük yazıyla çıkar.
// Üç stil: Klasik (yukarıdaki), Şerit (dev hız + ince devir çizgisi + tek satır değer), Sportif (vites ışıkları,
// italik kalın rakam, kutulu değerler). Hepsi siyah zeminde; yansıma, parlaklık, renk, sade kip hepsinde geçerli.
// Kalıcı ayar: settings.hud = {flipY, flipX, bright:"oto"|"gunduz"|"aksam"|"gece", color, slots:[pid…], shift, simple, style}
(function(){
  const DEF={flipY:false, flipX:false, bright:"oto", color:"turkuaz", slots:["05","FUEL","42"], shift:0, simple:false, style:"klasik"};
  if(settings.hud===undefined) settings.hud={};
  // eski sürüm: {mirror:bool} → sağ-sol aynalama
  if(settings.hud.mirror!==undefined && settings.hud.flipX===undefined) settings.hud.flipX=!!settings.hud.mirror;
  for(const k in DEF) if(settings.hud[k]===undefined) settings.hud[k]=Array.isArray(DEF[k])?DEF[k].slice():DEF[k];

  // Renkler: gece yansımasında göz almayan, siyah zeminde en okunaklı tonlar
  const COLORS={turkuaz:"#00e5ff", yesil:"#3dff8a", beyaz:"#ffffff", amber:"#ffb020"};
  const STYLES={klasik:"Klasik", serit:"Şerit", spor:"Sportif"};
  if(!STYLES[settings.hud.style]) settings.hud.style="klasik";
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
/* ---- ek parçalar (yalnız kendi stilinde görünür) ---- */
.hud-line,.hud-lights,.hud-rn,.hud-strip{display:none}
/* Şerit: dev ince hız, altında tek çizgi devir, en altta tek satır değerler */
.hud.st-serit .hud-top,.hud.st-serit .hud-rpm,.hud.st-serit .hud-row{display:none}
.hud.st-serit .hud-in{grid-template-rows:1fr auto;padding:4vh 6vw 6vh}
.hud.st-serit .hud-spd{font-weight:600;letter-spacing:-.02em;font-size:min(72vw,44vh)}
.hud.st-serit .hud-spd.d3{font-size:min(50vw,36vh)}
.hud.st-serit .hud-line{display:block;width:min(80vw,60vh);height:max(6px,1.1vh);border-radius:99px;background:#1a1d1d;margin-top:1.6vh;overflow:hidden}
.hud.st-serit .hud-line[hidden]{display:none}
.hud-line i{display:block;height:100%;width:0;border-radius:99px;background:var(--hc)}
.hud-line.red i{background:#ff3b30}
.hud.st-serit .hud-u{font-weight:500;color:#bbb}
.hud.st-serit .hud-strip{display:flex;justify-content:center;flex-wrap:wrap;gap:1vh 5vw;font:600 min(4.6vw,3vh)/1.2 var(--f-body);color:#ddd;font-variant-numeric:tabular-nums;text-align:center}
.hud-strip span{white-space:nowrap}
.hud-strip b{font-family:var(--f-num);font-size:1.35em;font-weight:700;color:#fff;margin:0 .2em}
.hud-strip .bad,.hud-strip .bad b{color:#ff3b30}.hud-strip .warn,.hud-strip .warn b{color:#ffc400}
.hud.simple .hud-strip{visibility:hidden}
/* Sportif: üstte 10 vites ışığı, italik kalın hız, devir rakamı, kutulu değerler */
.hud.st-spor .hud-rpm{display:none}
.hud.st-spor .hud-lights{display:grid;grid-template-columns:repeat(10,1fr);gap:2vw;padding:0 2vw;align-items:center}
.hud-lights i{aspect-ratio:1;width:100%;max-width:7vh;justify-self:center;border-radius:50%;background:#141717;box-shadow:inset 0 0 0 2px #262b2b}
.hud-lights i.on.g{background:#35e07a;box-shadow:0 0 14px #35e07a}.hud-lights i.on.y{background:#ffc400;box-shadow:0 0 14px #ffc400}
.hud-lights i.on.r{background:#ff3b30;box-shadow:0 0 14px #ff3b30}
.hud-lights.shift i{background:#3d7dff;box-shadow:0 0 18px #3d7dff;animation:hudblue .16s steps(2) infinite}
@keyframes hudblue{50%{background:#061030;box-shadow:none}}
/* italik rakam sağa yaslanır görünür: sağ boşlukla ortaya çekilir */
.hud.st-spor .hud-spd{font-style:italic;font-weight:700;letter-spacing:-.04em;margin-right:.22em}
.hud.st-spor .hud-rn{display:block;font-style:italic;font-weight:700;font-size:min(8vw,5vh);color:#fff;font-variant-numeric:tabular-nums;margin-top:.8vh}
.hud.st-spor .hud-rn small{font-size:.5em;color:#9aa;margin-left:.3em;font-style:normal}
.hud.st-spor .hud-u{color:#9aa}
.hud.st-spor .hud-c{border:2px solid #2a3030;background:#070909;padding:1.4vh 0}
.hud.st-spor .hud-v{font-style:italic}
.hud.simple .hud-lights{visibility:hidden}
@media (orientation:landscape){
  .hud-in{grid-template-columns:1.3fr 1fr;grid-template-rows:auto auto 1fr;padding:2.5vh 3vw}
  .hud-top,.hud-rpm,.hud-lights{grid-column:1/-1}
  .hud.st-serit .hud-in{grid-template-columns:1fr;grid-template-rows:1fr auto}
  .hud.st-serit .hud-spd{font-size:min(40vw,64vh)}
  .hud.st-serit .hud-spd.d3{font-size:min(30vw,56vh)}
  .hud.st-serit .hud-line{width:min(50vw,90vh)}
  .hud.st-serit .hud-strip{font-size:min(3vw,5.6vh)}
  .hud-lights i{max-width:9vh}
  .hud.st-spor .hud-rn{font-size:min(4.4vw,8vh)}
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
@media (prefers-reduced-motion:reduce){.hud.alarm,.hud-rpm.shift i,.hud-lights.shift i{animation:none}}
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
    const lights=mk("div","hud-lights"), lamps=[]; lights.setAttribute("aria-hidden","true");
    for(let i=0;i<10;i++){ const l=mk("i"); lights.appendChild(l); lamps.push(l); }
    const main=mk("div","hud-main"), spd=mk("div","hud-spd","—");
    const line=mk("div","hud-line"), lineI=mk("i"); line.appendChild(lineI); line.setAttribute("aria-hidden","true");
    const rn=mk("div","hud-rn","");
    const sub=mk("div","hud-sub"), u=mk("span","hud-u","km/sa"), lim=mk("span","hud-lim","");
    lim.setAttribute("aria-label","Hız uyarı sınırı"); sub.append(lim,u); main.append(spd,line,sub,rn);
    const alert=mk("div","hud-alert"); alert.hidden=true;
    const row=mk("div","hud-row"), slots=[];
    for(let i=0;i<3;i++){
      const c=mk("div","hud-c"), v=mk("div","hud-v","—"), l=mk("div","hud-l","");
      c.append(v,l); row.appendChild(c); slots.push({c,v,l});
      c.addEventListener("click",e=>{ if(!H.edit) return; e.stopPropagation(); cycleSlot(i); showBar(); });
    }
    const strip=mk("div","hud-strip"), stripEls=[];
    for(let i=0;i<3;i++){ const sp=mk("span"); strip.appendChild(sp); stripEls.push(sp); }
    inn.append(top,rpm,lights,main,row,strip,alert); o.appendChild(inn);

    const bar=mk("div","hud-bar"); bar.hidden=true;
    const bY=btn("Ön cam yansıması",()=>{ settings.hud.flipY=!settings.hud.flipY; save(); applyView(); });
    const bX=btn("Sağ-sol aynala",()=>{ settings.hud.flipX=!settings.hud.flipX; save(); applyView(); });
    const bB=btn("",()=>{ const k=["oto","gunduz","aksam","gece"]; settings.hud.bright=k[(k.indexOf(settings.hud.bright)+1)%k.length]; save(); applyView(); });
    const bC=btn("Renk",()=>{ const k=Object.keys(COLORS); settings.hud.color=k[(k.indexOf(settings.hud.color)+1)%k.length]; save(); applyView(); });
    const bE=btn("Değerleri seç",()=>{ H.edit=!H.edit; applyView(); });
    const bS=btn("Sade",()=>{ settings.hud.simple=!settings.hud.simple; save(); applyView(); });
    const bT=btn("",()=>{ const k=Object.keys(STYLES); settings.hud.style=k[(k.indexOf(settings.hud.style)+1)%k.length]; save(); applyView(); });
    const bK=btn("Kapat",()=>close());
    const hint=mk("p","hint","Torpidoda düz yatan telefonda \"Ön cam yansıması\"nı aç. \"Değerleri seç\" açıkken alttaki değerlere dokunarak değiştir.");
    bar.append(bY,bX,bB,bC,bE,bS,bT,bK,hint);
    // 3 sütunda 8 düğme: Kapat son satırda iki hücre kaplar
    bK.style.gridColumn="span 2";
    o.appendChild(bar);
    o.addEventListener("click",showBar);
    Object.assign(H,{el:o, inn, bar, segs, rpmEl:rpm, slots, lights, lamps, line, lineI, rn, stripEls, alertEl:alert, limEl:lim, clock, trip,
      vals:{spd}, btns:{bY,bX,bB,bC,bE,bS,bT}});
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
    b.bT.textContent="Stil: "+STYLES[settings.hud.style];
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

  // Hız sınırı: yolun sınırı açıksa oradan (features/speedlimit.js), değilse ayardaki
  const spdMax=()=>{ try{ const w=window.SPEEDLIM; if(w && w.now) return w.now().v; }catch(e){} return settings.lim["0D"] && settings.lim["0D"].max; };
  function update(){
    if(!H.open) return;
    const sp=cur("0D"), rpm=cur("0C"), lim=spdMax();
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
    // Şerit: tek çizgi; kırmızı bölgede kırmızı
    H.line.hidden=(rpm==null);
    if(rpm!=null){ H.lineI.style.width=(Math.min(1,rpm/full)*100).toFixed(1)+"%"; H.line.className="hud-line"+(rpm>=red?" red":""); }
    // Sportif: vites noktasının %60'ından itibaren 10 ışık dolar (4 yeşil, 3 sarı, 3 kırmızı); vites noktasında hepsi mavi yanıp söner
    const from=shift*0.6, nl=rpm==null ? 0 : Math.max(0,Math.min(10,Math.round((rpm-from)/(shift-from)*10)));
    H.lamps.forEach((l,i)=>{ l.className=(i<nl?"on ":"")+(i<4?"g":i<7?"y":"r"); });
    H.lights.className="hud-lights"+(rpm!=null && rpm>=shift?" shift":"");
    H.lit=nl;
    H.rn.innerHTML=rpm==null ? "" : fmt(rpm,0)+"<small>d/dk</small>";
    // alt satır
    settings.hud.slots.forEach((pid,i)=>{
      const s=H.slots[i]; if(!s) return;
      s.v.textContent=slotValue(pid); s.l.textContent=slotLabel(pid);
      s.c.className="hud-c "+slotState(pid);
      // Şerit: "Su 90 °C" biçiminde tek satır
      const e=H.stripEls[i]; if(e){
        const lb=slotLabel(pid), m=lb.match(/^(.*?) \((.*)\)$/);
        e.className=slotState(pid);
        e.innerHTML=""; e.append((m?m[1]:lb)+" "); e.appendChild(mk("b",null,slotValue(pid))); if(m) e.append(m[2]);
        e.setAttribute("aria-label",(m?m[1]:lb)+" "+slotValue(pid)+(m?" "+m[2]:""));
      }
    });
    // saat ve sürüş
    const d=new Date(); H.clock.textContent=d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    const t=REC.trip; H.trip.textContent = t ? `${fmt((t.odo||0),1)} km · ${fmtDur(Date.now()-t.start).replace(/ \d+ sn$/,"")}` : "";
    // süren tehlike
    const txt=alertText();
    H.alertEl.hidden=!txt; if(txt) H.alertEl.textContent=txt;
    const cls="hud st-"+settings.hud.style+(txt?" alarm":"")+(H.edit?" edit":"")+(settings.hud.simple?" simple":"");
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
  on("speedLimit",update);
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
    STYLES, get lit(){ return H.lit; }, get line(){ return H.line; }, get strip(){ return H.stripEls; }, get rn(){ return H.rn; }, get lights(){ return H.lights; },
    get isOpen(){ return H.open; }, get vals(){ return H.vals; }, get slots(){ return H.slots; }, get el(){ return H.el; }, get rpmEl(){ return H.rpmEl; }, get limEl(){ return H.limEl; },
    set edit(v){ H.edit=!!v; }};
})();
