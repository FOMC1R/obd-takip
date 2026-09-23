// Ön cam görünümü (HUD — telefonu torpidoya koyup ön camdaki yansımasını okumak için):
// siyah zemin üzerinde çok büyük hız, altında devir, su sıcaklığı ve anlık tüketim.
// Kalıcı ayar: settings.hud = {mirror:bool} (yansıma için yatay aynalama).
(function(){
  if(settings.hud===undefined) settings.hud={mirror:false};

  const css=document.createElement("style");
  css.textContent=`
.hud{position:fixed;inset:0;z-index:1000;background:#000;color:#fff;display:grid;overflow:hidden;
  font-family:var(--f-num);user-select:none;-webkit-user-select:none;touch-action:manipulation;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.hud-in{display:grid;grid-template-rows:1fr auto;align-items:center;justify-items:center;padding:4vh 4vw 8vh;gap:2vh;min-height:0}
.hud-in.mirror{transform:scaleX(-1)}
.hud-main{display:grid;justify-items:center;line-height:.85}
.hud-spd{font-size:min(58vw,42vh);font-weight:700;color:#00e5ff;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.hud-u{font-size:min(7vw,5vh);color:#fff;font-weight:600;letter-spacing:.06em}
.hud-row{display:grid;grid-template-columns:repeat(3,1fr);gap:3vw;width:100%}
.hud-c{display:grid;justify-items:center;line-height:1}
.hud-v{font-size:min(10vw,9vh);font-weight:700;font-variant-numeric:tabular-nums;color:#fff}
.hud-l{font-size:min(4.2vw,3vh);color:#fff;font-family:var(--f-body);font-weight:600;margin-top:.4em;text-align:center}
.hud.alarm{box-shadow:inset 0 0 0 10px #ff1f1f;animation:hudflash .7s steps(2) infinite}
.hud.alarm .hud-spd,.hud.alarm .hud-v{color:#ff3b30}
@keyframes hudflash{50%{box-shadow:inset 0 0 0 10px #000}}
.hud-bar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);display:flex;gap:10px}
.hud-bar button{min-height:52px;min-width:110px;background:#111;color:#fff;border:1px solid #666;font-size:17px;font-weight:600}
.hud-bar button[aria-pressed="true"]{border-color:#00e5ff;color:#00e5ff}
@media (orientation:landscape){
  .hud-in{grid-template-rows:none;grid-template-columns:1.5fr 1fr;padding:3vh 4vw}
  .hud-spd{font-size:min(30vw,72vh)}
  .hud-u{font-size:min(3vw,7vh)}
  .hud-row{grid-template-columns:none;grid-template-rows:repeat(3,auto);gap:4vh}
  .hud-v{font-size:min(8vw,15vh)}
  .hud-l{font-size:min(2.2vw,5vh)}
}
`;
  document.head.appendChild(css);

  const H={open:false, el:null, inn:null, bar:null, vals:{}, timer:null, barT:null, pushed:false, fs:false};
  const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };

  function build(){
    const o=mk("div","hud"); o.setAttribute("role","dialog"); o.setAttribute("aria-label","Ön cam görünümü");
    const inn=mk("div","hud-in");
    const main=mk("div","hud-main"), spd=mk("div","hud-spd","—"); main.appendChild(spd); main.appendChild(mk("div","hud-u","km/sa"));
    const row=mk("div","hud-row"), vals={spd};
    for(const [k,label] of [["rpm","Devir (d/dk)"],["cool","Su sıcaklığı (°C)"],["fuel","Tüketim"]]){
      const c=mk("div","hud-c"), v=mk("div","hud-v","—"), l=mk("div","hud-l",label);
      c.appendChild(v); c.appendChild(l); row.appendChild(c); vals[k]=v; vals[k+"L"]=l;
    }
    inn.appendChild(main); inn.appendChild(row); o.appendChild(inn);
    const bar=mk("div","hud-bar"); bar.hidden=true;
    const bm=mk("button",null,"Aynala"); bm.type="button"; bm.setAttribute("aria-pressed",String(!!settings.hud.mirror));
    const bc=mk("button",null,"Kapat"); bc.type="button";
    bm.addEventListener("click",e=>{ e.stopPropagation(); setMirror(!settings.hud.mirror); showBar(); });
    bc.addEventListener("click",e=>{ e.stopPropagation(); close(); });
    bar.appendChild(bm); bar.appendChild(bc); o.appendChild(bar);
    o.addEventListener("click",showBar);
    Object.assign(H,{el:o, inn, bar, vals, bm});
  }

  function showBar(){
    if(!H.bar) return;
    H.bar.hidden=false; clearTimeout(H.barT);
    H.barT=setTimeout(()=>{ if(H.bar) H.bar.hidden=true; },3000);
  }
  function setMirror(on){
    settings.hud.mirror=!!on; save();
    if(H.inn) H.inn.className="hud-in"+(on?" mirror":"");
    if(H.bm) H.bm.setAttribute("aria-pressed",String(!!on));
  }

  function update(){
    if(!H.open) return;
    const V=H.vals, sp=cur("0D"), rpm=cur("0C"), cool=cur("05"), fk=cur("FK"), fl=cur("FL");
    V.spd.textContent=fmt(sp,0);
    V.rpm.textContent=fmt(rpm,0);
    V.cool.textContent=fmt(cool,0);
    if(fk!=null){ V.fuel.textContent=fmt(fk,1); V.fuelL.textContent="Tüketim (L/100 km)"; }
    else { V.fuel.textContent=fmt(fl,1); V.fuelL.textContent="Tüketim (L/sa)"; }
    const crit=[...S.alarms.values()].some(a=>a.level==="crit");
    const cls="hud"+(crit?" alarm":"");
    if(H.el.className!==cls) H.el.className=cls;
  }

  function open(){
    if(H.open) return;
    if(!H.el) build();
    setMirror(!!settings.hud.mirror);
    document.body.appendChild(H.el); H.open=true; H.fs=false;
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

  window.HUD={open, close, update, setMirror, get isOpen(){ return H.open; }, get vals(){ return H.vals; }, get el(){ return H.el; }};
})();
