// Gösterge paneli: yeni arabalardaki ekran gösterge paneli gibi — solda hız, sağda devir (elektrikli araçta güç)
// saati, ortada seçilebilir bilgi sayfası ve küçük göstergeler (su, yakıt/batarya, akü), üstte uyarı lambaları.
// Kadranlar <canvas> ile çizilir; rakamlar ve sayfalar düz yazıdır (keskin ve test edilebilir).
// Kalıcı ayar: settings.cluster = {bright:"oto"|"gunduz"|"gece", accent, page}
(function(){
  const DEF={bright:"oto", accent:"buz", page:0};
  if(settings.cluster===undefined) settings.cluster={};
  for(const k in DEF) if(settings.cluster[k]===undefined) settings.cluster[k]=DEF[k];

  // Renkler: koyu lacivert-siyah zemin, soğuk beyaz rakamlar, tek vurgu rengi; sarı/kırmızı yalnızca uyarıda
  const ACCENTS={buz:"#42c8ff", nane:"#34e0b4", mor:"#a08cff", beyaz:"#e6edf7"};
  const ACCENT_NAME={buz:"Buz mavisi", nane:"Nane", mor:"Mor", beyaz:"Beyaz"};
  const C={ink:"#e8eef7", mute:"#7d8ba3", dim:"rgba(170,190,220,.32)", amber:"#ffb020", red:"#ff3b30", green:"#35d07f"};
  const BRIGHT={gunduz:1, gece:.6};
  const BRIGHT_NAME={oto:"Otomatik", gunduz:"Gündüz", gece:"Gece"};
  const PAGES=["Yolculuk","Tüketim","Motor","Saat"];

  const css=document.createElement("style");
  css.textContent=`
.cl{position:fixed;inset:0;z-index:1001;overflow:hidden;color:#e8eef7;user-select:none;-webkit-user-select:none;touch-action:manipulation;
  background:radial-gradient(120% 90% at 50% 45%,#0e1a2e 0%,#070c17 55%,#03050a 100%);font-family:var(--f-num);--ca:#42c8ff}
.cl-in{position:absolute;inset:0;display:grid;padding:calc(env(safe-area-inset-top,0px) + 6px) calc(env(safe-area-inset-right,0px) + 12px) calc(env(safe-area-inset-bottom,0px) + 8px) calc(env(safe-area-inset-left,0px) + 12px);
  grid-template-columns:1fr;grid-template-rows:auto 1fr auto auto auto 1fr;grid-template-areas:"top" "." "spd" "al" "mid" ".";justify-items:center;align-items:center;gap:10px}
.cl-top{grid-area:top;width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;min-height:34px}
.cl-clock{font-size:20px;font-weight:600;color:#c9d4e4;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.cl-out{justify-self:end;font-size:18px;font-weight:600;color:#7d8ba3;font-variant-numeric:tabular-nums}
.cl-tt{display:flex;gap:6px;justify-content:center}
.cl-tt i{display:block;width:30px;height:30px;color:rgba(160,180,210,.12);transition:color .2s}
.cl-tt i svg{width:100%;height:100%;display:block}
.cl-tt i.amber{color:#ffb020;filter:drop-shadow(0 0 5px rgba(255,176,32,.55))}
.cl-tt i.red{color:#ff3b30;filter:drop-shadow(0 0 5px rgba(255,59,48,.6))}
.cl-tt i[hidden]{display:none}
.cl-dial{position:relative;aspect-ratio:1;container-type:inline-size}
.cl-dial canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.cl-spd{grid-area:spd;width:min(94vw,47vh)}
.cl-mid{grid-area:mid;width:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"rpm panel" "mini mini";gap:14px 10px;align-items:center}
.cl-rpm{width:100%}
.cl-read{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;line-height:1;pointer-events:none}
.cl-num{font-size:25cqw;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:#f2f6fc;text-shadow:0 0 18px rgba(120,190,255,.18)}
.cl-rpm .cl-num{font-size:19cqw}
.cl-unit{font-size:6.6cqw;font-weight:600;color:#7d8ba3;letter-spacing:.08em;margin-top:1.4cqw;font-family:var(--f-body)}
.cl-num.near{color:#ffb020}.cl-num.over{color:#ff3b30}.cl-num.regen{color:#35d07f}
.cl-lim{position:absolute;left:50%;bottom:9cqw;transform:translateX(-50%);width:13cqw;height:13cqw;border-radius:50%;box-sizing:border-box;
  border:1.5cqw solid #ff3b30;background:#f4f6fa;color:#0a0f18;display:grid;place-items:center;font-weight:700;font-size:5.4cqw;font-variant-numeric:tabular-nums}
.cl-sub{position:absolute;left:0;right:0;bottom:12cqw;text-align:center;font:600 5.6cqw/1 var(--f-body);color:#7d8ba3;letter-spacing:.08em;text-transform:uppercase}
.cl-sub.regen{color:#35d07f}
/* orta bilgi sayfası */
.cl-panel{position:relative;width:100%;min-height:150px;box-sizing:border-box;padding:12px 12px 22px;border-radius:18px;cursor:pointer;
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(160,190,230,.10);display:grid;align-content:center;gap:8px}
.cl-ph{font:600 12px/1 var(--f-body);letter-spacing:.16em;text-transform:uppercase;color:var(--ca)}
.cl-kv{display:grid;grid-template-columns:1fr 1fr;gap:10px 10px}
.cl-kv div{min-width:0}
.cl-kv b{display:block;font-size:26px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;color:#eef3fa}
.cl-kv b small{font-size:13px;color:#7d8ba3;font-weight:600;margin-left:3px}
.cl-kv span{display:block;font:500 11px/1.2 var(--f-body);color:#7d8ba3;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-big{font-size:44px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;color:#f2f6fc}
.cl-big small{font-size:15px;color:#7d8ba3;margin-left:4px}
.cl-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden}
.cl-bar i{display:block;height:100%;border-radius:4px;background:var(--ca);box-shadow:0 0 10px var(--ca)}
.cl-note{font:500 12px/1.3 var(--f-body);color:#7d8ba3}
.cl-time{font-size:58px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;text-align:center;color:#f2f6fc}
.cl-date{font:500 14px/1.3 var(--f-body);color:#9aa8bd;text-align:center}
.cl-dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:6px}
.cl-dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.16)}
.cl-dots i.on{background:var(--ca)}
/* küçük göstergeler */
.cl-mini{width:100%;display:flex;justify-content:center;gap:10px}
.cl-m{flex:1 1 0;max-width:120px;min-width:0;display:grid;justify-items:center;line-height:1}
.cl-m svg{width:100%;height:auto;display:block;overflow:visible}
.cl-m b{font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:3px;color:#e8eef7}
.cl-m span{font:600 10px/1 var(--f-body);letter-spacing:.12em;text-transform:uppercase;color:#7d8ba3;margin-top:4px}
.cl-m.warn b{color:#ffb020}.cl-m.bad b{color:#ff3b30}
.cl-m[hidden]{display:none}
/* süren tehlike: ortada kırmızı yazı */
.cl-alert{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 46px);transform:translateX(-50%);width:max-content;max-width:88vw;z-index:3;
  background:#e0201a;color:#fff;border-radius:14px;padding:12px 22px;font:700 22px/1.2 var(--f-body);text-align:center;box-shadow:0 0 0 4px rgba(0,0,0,.6),0 0 40px rgba(255,40,30,.45)}
.cl.alarm{box-shadow:inset 0 0 0 4px #ff3b30}
/* kontrol çubuğu (dokununca 4 sn) */
.cl-ctl{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:4;display:grid;grid-template-columns:1fr 1fr;gap:8px;
  background:rgba(8,12,22,.94);padding:10px;border-radius:16px;border:1px solid rgba(160,190,230,.18);backdrop-filter:blur(6px)}
.cl-ctl button{min-height:52px;background:#121a2a;color:#e8eef7;border:1px solid rgba(160,190,230,.2);border-radius:12px;font:600 15px/1.15 var(--f-body);padding:6px 4px}
.cl-ctl button.x{border-color:var(--ca);color:var(--ca)}
@media (orientation:landscape){
  .cl-in{grid-template-columns:1fr minmax(0,auto) 1fr;grid-template-rows:auto 1fr;grid-template-areas:"top top top" "spd mid rpm";column-gap:0;row-gap:0;padding-top:calc(env(safe-area-inset-top,0px) + 4px)}
  .cl-top{min-height:32px}
  .cl-spd{width:min(37vw,calc(100vh - 52px));justify-self:end}
  .cl-mid{display:contents}
  .cl-rpm{grid-area:rpm;width:min(37vw,calc(100vh - 52px));justify-self:start}
  .cl-center{grid-area:mid;width:min(23vw,240px);display:grid;gap:10px;align-content:start;align-self:start;margin-top:3vh}
  .cl-ctl{grid-template-columns:repeat(4,1fr);left:50%;right:auto;transform:translateX(-50%);width:min(94vw,760px)}
  /* yatayda iki kadranın arasındaki alt boşluk: rakamları kapatmaz */
  .cl-alert{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);max-width:44vw;font-size:21px;padding:10px 18px}
}
@media (orientation:portrait){ .cl-alert{grid-area:al;position:static;transform:none;max-width:100%;font-size:20px;padding:10px 16px}
  .cl-center{display:contents} .cl-rpm{grid-area:rpm} .cl-panel{grid-area:panel} .cl-mini{grid-area:mini} }
`;
  document.head.appendChild(css);

  // ---------- Uyarı lambaları (basit simgeler; renk currentColor) ----------
  const ICON={
    mil:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M14 14h8v-3h-5V8h14v3h-5v3h7l4 4h3v-3h4v14h-4v-3h-3v7l-5 5H14l-3-3H8v4H4V21h4v4h3v-8z"/></svg>',
    batt:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M9 13h7v-3h6v3h4v-3h6v3h7a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3zm2 9v3h8v-3zm18 0v3h3v3h3v-3h3v-3h-3v-3h-3v3z"/></svg>',
    temp:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M22 5h4v4h6v3h-6v4h6v3h-6v4.3a6 6 0 1 1-4 0zM6 35c3 0 3 2 6 2s3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2v3c-3 0-3 2-6 2s-3-2-6-2-3 2-6 2-3-2-6-2-3 2-6 2-3-2-6-2z"/></svg>',
    oil:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M4 20l4-3 6 4h4v-4h-4v-3h12v3h-4v4h6l6-3 8-3 1 3-9 12H15l-4-6H4zm38 8c0 3-2 5-3 5s-3-2-3-5c0-2 3-6 3-6s3 4 3 6z"/></svg>',
    fuel:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M10 7h18a2 2 0 0 1 2 2v14h2a4 4 0 0 1 4 4v7a1.5 1.5 0 0 0 3 0V19l-4-4 2-2 5 5v16a4.5 4.5 0 0 1-9 0v-7a1 1 0 0 0-1-1h-2v14h2v3H6v-3h2V9a2 2 0 0 1 2-2zm2 4v9h14v-9z"/></svg>',
    link:'<svg viewBox="0 0 48 48"><path fill="currentColor" d="M20 6h3v7h2V6h3v7h3v9a8 8 0 0 1-6 7.7V34h-4v-4.3A8 8 0 0 1 15 22v-9h5zm-9 29l3-3 23 23-3 3zM17 38h6v4h-6z"/></svg>',
  };
  const TT_ORDER=["mil","batt","temp","oil","fuel","link"];
  const TT_NAME={mil:"Motor arıza lambası", batt:"Şarj / akü", temp:"Su sıcaklığı", oil:"Yağ sıcaklığı", fuel:"Yakıt azaldı", link:"Bağlantı koptu"};

  const H={open:false, el:null, pushed:false, fs:false, barT:null, timer:null, raf:null, lastDraw:0, mil:false,
    dials:{}, reduce:false, font:"", onResize:null, swipe:null};
  const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const btn=(txt,fn,cls)=>{ const b=mk("button",cls||null,txt); b.type="button"; b.addEventListener("click",e=>{ e.stopPropagation(); fn(b); showBar(); }); return b; };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const isEv=()=>typeof EVA!=="undefined" && EVA.isEv ? EVA.isEv() : settings.fuel==="elektrik";
  const accent=()=>ACCENTS[settings.cluster.accent]||ACCENTS.buz;
  const lim=pid=>settings.lim[pid]||{};
  const rafFn=typeof requestAnimationFrame==="function" ? requestAnimationFrame : (f=>setTimeout(()=>f(Date.now()),33));
  const cafFn=typeof cancelAnimationFrame==="function" ? cancelAnimationFrame : clearTimeout;

  // ---------- Değerler ----------
  function socNow(){ const a=cur("EV_SOC"); return a!=null ? a : cur("5B"); }
  function speedState(sp){
    const L=lim("0D").max; if(sp==null || !L) return "";
    return sp>L ? "over" : sp>L-5 ? "near" : "";
  }
  function redline(){ return lim("0C").max || 6200; }
  // Kadran ölçekleri (açı: saat yönünde, 0 = sağ; 135° sol alt → 405° sağ alt, 270° tarama)
  function scale(kind){
    if(kind==="spd") return {min:0, max:220, major:20, minor:10, label:v=>String(v)};
    if(kind==="pow") return {min:-50, max:150, major:50, minor:10, zero:0, label:v=>String(v)};
    const top=Math.max(8000, Math.ceil(redline()*1.12/1000)*1000);
    return {min:0, max:top, major:1000, minor:500, red:redline(), label:v=>String(v/1000)};
  }
  const A0=Math.PI*0.75, SWEEP=Math.PI*1.5;
  const ang=(s,v)=>A0+SWEEP*(clamp(v,s.min,s.max)-s.min)/(s.max-s.min);

  // Uyarı lambaları: hangisi, hangi renkte yanıyor
  function telltales(){
    const al=S.alarms, ev=isEv(), out={};
    const stored=S.dtc && S.dtc.stored ? S.dtc.stored.length : 0;
    out.mil = (al.has("mil") || H.mil || stored>0) ? "amber" : "";
    const v=cur("42"), rpm=cur("0C"), running=ev ? S.active : (rpm!=null && rpm>400);
    out.batt = (al.has("g42") || (running && v!=null && v<13.0)) ? "red" : "";
    const w=cur("05"), wm=lim("05").max;
    out.temp = (al.has("g05") || (w!=null && wm!=null && w>=wm)) ? "red" : "";
    out.oil = cur("5C")==null && !al.has("g5C") ? null : (al.has("g5C") ? "red" : "");
    const lvl=ev ? socNow() : cur("2F"), lmin=ev ? (lim("EV_SOC").min ?? lim("5B").min ?? 10) : (lim("2F").min ?? 10);
    out.fuel = lvl==null ? null : (lvl<=lmin ? "amber" : "");
    out.link = (al.has("link") || !S.active) ? "red" : "";
    return out;
  }
  // Süren tehlike (yalnızca canlı değer uyarıları ve bağlantı): HUD ile aynı kısa yazı
  function alertText(){
    const now=[...S.alarms.entries()].filter(([k,a])=>a.level==="crit" && (k.startsWith("g") || k==="link"));
    if(!now.length) return null;
    const [k,a]=now[now.length-1];
    if(k==="link") return "BAĞLANTI KOPTU";
    // son kelime (birim) tek başına alt satıra düşmesin
    return a.text.replace(/\s*\(.*\)\s*$/,"").replace(":","").replace(/ (\S+)$/,"\u00a0$1").toLocaleUpperCase("tr-TR");
  }

  // ---------- Kurulum ----------
  function dial(cls){
    const w=mk("div","cl-dial "+cls), cv=mk("canvas"); cv.setAttribute("aria-hidden","true");
    const rd=mk("div","cl-read"), num=mk("div","cl-num","—"), unit=mk("div","cl-unit","");
    rd.append(num,unit); w.append(cv,rd);
    return {w, cv, num, unit, rd, shown:null, target:null, face:null, faceKey:"", size:0};
  }
  function build(){
    const o=mk("div","cl"); o.setAttribute("role","dialog"); o.setAttribute("aria-label","Gösterge paneli");
    const inn=mk("div","cl-in");
    const top=mk("div","cl-top"), clock=mk("div","cl-clock",""), tt=mk("div","cl-tt"), outT=mk("div","cl-out","");
    const tts={};
    for(const k of TT_ORDER){ const i=mk("i"); i.innerHTML=ICON[k]; i.setAttribute("role","img"); i.setAttribute("aria-label",TT_NAME[k]); i.title=TT_NAME[k]; tt.appendChild(i); tts[k]=i; }
    top.append(clock,tt,outT);
    const spd=dial("cl-spd"), rpm=dial("cl-rpm"); spd.kind="spd"; rpm.kind="rpm";
    const limEl=mk("div","cl-lim",""); limEl.setAttribute("aria-label","Hız uyarı sınırı"); spd.w.appendChild(limEl);
    spd.unit.textContent="km/sa";
    const sub=mk("div","cl-sub",""); rpm.w.appendChild(sub);
    const panel=mk("div","cl-panel"); panel.setAttribute("role","button"); panel.setAttribute("aria-label","Bilgi sayfasını değiştir");
    const pbody=mk("div"); pbody.style.display="grid"; pbody.style.gap="8px";
    const dots=mk("div","cl-dots"), dotEls=PAGES.map(()=>{ const d=mk("i"); dots.appendChild(d); return d; });
    panel.append(pbody,dots);
    panel.addEventListener("click",e=>{ e.stopPropagation(); cyclePage(1); });
    // kaydırma: sola/sağa sürükle
    panel.addEventListener("pointerdown",e=>{ H.swipe={x:e.clientX, y:e.clientY}; });
    panel.addEventListener("pointerup",e=>{
      const s=H.swipe; H.swipe=null; if(!s) return;
      const dx=e.clientX-s.x; if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(e.clientY-s.y)){ H.swiped=true; cyclePage(dx<0?1:-1); }
    });
    panel.addEventListener("click",e=>{ if(H.swiped){ H.swiped=false; e.stopImmediatePropagation && e.stopImmediatePropagation(); } },true);
    const mini=mk("div","cl-mini"), minis={};
    for(const k of ["w","f","v"]){ const m=mk("div","cl-m"); mini.appendChild(m); minis[k]={el:m, key:""}; }
    const center=mk("div","cl-center"); center.append(panel,mini);
    const mid=mk("div","cl-mid"); mid.append(rpm.w,center);
    const alert=mk("div","cl-alert"); alert.hidden=true; alert.setAttribute("role","alert");
    inn.append(top,spd.w,mid,alert); o.appendChild(inn);

    const bar=mk("div","cl-ctl"); bar.hidden=true;
    const bK=btn("Kapat",()=>close(),"x");
    const bB=btn("",()=>{ const k=["oto","gunduz","gece"]; settings.cluster.bright=k[(k.indexOf(settings.cluster.bright)+1)%k.length]; save(); applyView(); });
    const bP=btn("Bilgi sayfası",()=>cyclePage(1));
    const bC=btn("",()=>{ const k=Object.keys(ACCENTS); settings.cluster.accent=k[(k.indexOf(settings.cluster.accent)+1)%k.length]; save(); applyView(); });
    bar.append(bK,bB,bP,bC); o.appendChild(bar);
    o.addEventListener("click",showBar);
    Object.assign(H,{el:o, inn, bar, clock, outT, tts, limEl, sub, panel, pbody, dotEls, minis, alertEl:alert, btns:{bB,bP,bC}});
    H.dials={spd, rpm};
  }

  function brightness(){
    if(settings.cluster.bright!=="oto") return BRIGHT[settings.cluster.bright]||1;
    const h=new Date().getHours(); return (h>=20 || h<7) ? BRIGHT.gece : BRIGHT.gunduz;
  }
  function applyView(){
    if(!H.el) return;
    H.inn.style.filter = brightness()<1 ? `brightness(${brightness()})` : "";
    if(H.el.style.setProperty) H.el.style.setProperty("--ca", accent());
    H.btns.bB.textContent="Parlaklık: "+BRIGHT_NAME[settings.cluster.bright];
    H.btns.bC.textContent="Renk: "+(ACCENT_NAME[settings.cluster.accent]||"");
    for(const d of Object.values(H.dials)) d.faceKey="";   // yüz yeniden çizilsin (vurgu rengi)
    update(); kick(true);
  }
  function showBar(){
    if(!H.bar) return;
    H.bar.hidden=false; clearTimeout(H.barT);
    H.barT=setTimeout(()=>{ if(H.bar) H.bar.hidden=true; },4000);
  }
  function cyclePage(n){
    settings.cluster.page=((settings.cluster.page|0)+n+PAGES.length)%PAGES.length; save(); renderPage();
  }

  // ---------- Orta sayfa ----------
  const kvHtml=rows=>`<div class="cl-kv">${rows.map(([v,u,l])=>`<div><b>${v}${u?`<small>${u}</small>`:""}</b><span>${l}</span></div>`).join("")}</div>`;
  function pageData(){
    const p=settings.cluster.page|0, ev=isEv(), t=REC.trip;
    if(p===0){   // Yolculuk
      if(!t) return {head:"Yolculuk", html:`<div class="cl-note">Kayıt yok. Sürüş kaydı başlayınca yol, süre ve ortalamalar burada görünür.</div>`};
      const odo=t.odo||0, ms=Date.now()-t.start, hr=ms/3600000;
      const avgSp = hr>0.005 ? odo/hr : null;
      const avgC = ev ? (t.kwh!=null && odo>0.5 ? t.kwh/odo*100 : null) : (t.fuel && odo>0.5 ? t.fuel/odo*100 : null);
      const dur=fmtDur(ms).replace(/ \d+ sn$/,"");
      return {head:"Yolculuk", html:kvHtml([[fmt(odo,1),"km","Yol"],[dur,"","Süre"],[fmt(avgSp,0),"km/sa","Ortalama hız"],
        [fmt(avgC,1), ev?"kWh":"L", ev?"Ortalama / 100 km":"Ortalama / 100 km"]])};
    }
    if(p===1){   // Tüketim
      if(ev){
        const k=cur("EVK"), pw=cur("EVP"), avg=t && t.kwh!=null && (t.odo||0)>0.5 ? t.kwh/t.odo*100 : null;
        const w=k==null ? 0 : clamp(k/40*100,0,100);
        return {head:"Enerji tüketimi", html:`<div class="cl-big">${fmt(k,1)}<small>kWh/100 km</small></div><div class="cl-bar"><i style="width:${w.toFixed(0)}%"></i></div>`
          +kvHtml([[fmt(avg,1),"kWh/100","Yolculuk ort."],[fmt(pw,0),"kW","Anlık güç"]])};
      }
      const fk=cur("FK"), fl=cur("FL"), useK=fk!=null, val=useK?fk:fl, max=useK?20:6;
      const avg=t && t.fuel && (t.odo||0)>0.5 ? t.fuel/t.odo*100 : null;
      const w=val==null ? 0 : clamp(val/max*100,0,100);
      return {head:"Tüketim", html:`<div class="cl-big">${fmt(val,1)}<small>${useK?"L/100 km":"L/sa"}</small></div><div class="cl-bar"><i style="width:${w.toFixed(0)}%"></i></div>`
        +kvHtml([[fmt(avg,1),"L/100","Yolculuk ort."],[fmt(t && t.fuel,1),"L","Harcanan"]])};
    }
    if(p===2){   // Motor (elektrikte batarya)
      if(ev) return {head:"Batarya", html:kvHtml([[fmt(cur("EV_T"),0),"°C","Batarya sıcaklığı"],[fmt(cur("EV_V"),0),"V","Batarya voltajı"],
        [fmt(cur("EV_I"),0),"A","Akım"],[fmt(cur("42"),1),"V","12 V akü"]])};
      return {head:"Motor", html:kvHtml([[fmt(cur("04"),0),"%","Motor yükü"],[fmt(cur("11"),0),"%","Gaz kelebeği"],
        [fmt(cur("0F"),0),"°C","Emme havası"],[fmt(cur("42"),1),"V","Akü"]])};
    }
    const d=new Date();
    const date=d.toLocaleDateString("tr-TR",{weekday:"long", day:"numeric", month:"long"});
    const out=cur("46");
    return {head:"Saat", html:`<div class="cl-time">${d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</div><div class="cl-date">${date}${out!=null?` · dışarısı ${fmt(out,0)} °C`:""}</div>`};
  }
  function renderPage(){
    if(!H.open) return;
    const p=settings.cluster.page|0, d=pageData();
    const html=`<div class="cl-ph">${d.head}</div>${d.html}`;
    if(H.pageHtml!==html){ H.pageHtml=html; H.pbody.innerHTML=html; }
    H.dotEls.forEach((e,i)=>{ e.className=i===p?"on":""; });
    H.page={index:p, head:d.head, html};
  }

  // ---------- Küçük göstergeler (yarım daire, SVG) ----------
  // lo..hi ölçek; band: [a,b] normal aralık (ince çizgi); mark: kırmızı sınır çizgisi
  function miniSvg({lo,hi,v,band,mark,left,right,color}){
    const R=40, cx=50, cy=48, P=(x)=>{ const f=clamp((x-lo)/(hi-lo),0,1), a=Math.PI*(1+f); return [cx+R*Math.cos(a), cy+R*Math.sin(a)]; };
    const arc=(a,b)=>{ const [x1,y1]=P(a), [x2,y2]=P(b); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    let s=`<svg viewBox="0 0 100 58" aria-hidden="true"><path d="${arc(lo,hi)}" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    if(band) s+=`<path d="${arc(band[0],band[1])}" stroke="rgba(255,255,255,.16)" stroke-width="7" fill="none"/>`;
    if(v!=null) s+=`<path d="${arc(lo,clamp(v,lo,hi))}" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 3px ${color})"/>`;
    if(mark!=null){ const f=clamp((mark-lo)/(hi-lo),0,1), a=Math.PI*(1+f), c=Math.cos(a), n=Math.sin(a);
      s+=`<line x1="${(cx+(R-7)*c).toFixed(1)}" y1="${(cy+(R-7)*n).toFixed(1)}" x2="${(cx+(R+7)*c).toFixed(1)}" y2="${(cy+(R+7)*n).toFixed(1)}" stroke="#ff3b30" stroke-width="2.5"/>`; }
    s+=`<text x="${cx-R}" y="${cy+10}" text-anchor="middle" fill="#7d8ba3" font-size="10" font-weight="600" font-family="Barlow,sans-serif">${left}</text>`;
    s+=`<text x="${cx+R}" y="${cy+10}" text-anchor="middle" fill="#7d8ba3" font-size="10" font-weight="600" font-family="Barlow,sans-serif">${right}</text></svg>`;
    return s;
  }
  function setMini(m, cfg){
    if(!cfg){ m.el.hidden=true; m.state=null; return; }
    m.el.hidden=false;
    const key=JSON.stringify(cfg);
    if(m.key!==key){ m.key=key;
      m.el.innerHTML=miniSvg(cfg)+`<b>${cfg.text}</b><span>${cfg.label}</span>`;
    }
    m.el.className="cl-m"+(cfg.state?" "+cfg.state:"");
    m.state=cfg;
  }
  function renderMinis(){
    const a=accent(), ev=isEv();
    // Su: C…H; normal bant 75 °C ile sınırın 5 altı arası
    const w=cur("05"), wm=lim("05").max ?? 110;
    const ws = w==null ? "" : (S.alarms.has("g05") || w>=wm) ? "bad" : w>=wm-5 ? "warn" : "";
    if(w==null && ev) setMini(H.minis.w, null); else setMini(H.minis.w, {lo:50, hi:130, v:w==null?null:Math.round(w), band:[75,wm-5], mark:wm, left:"C", right:"H",
      color: ws==="bad"?C.red:ws==="warn"?C.amber:a, text:w==null?"—":fmt(w,0)+" °C", label:"Su", state:ws});
    // Yakıt seviyesi (araç veriyorsa) ya da elektrikte batarya doluluğu
    const f=ev ? socNow() : cur("2F"), fmin=ev ? (lim("EV_SOC").min ?? 10) : (lim("2F").min ?? 10);
    if(f==null) setMini(H.minis.f, null);
    else { const fs=f<=fmin ? "warn" : "";
      setMini(H.minis.f, {lo:0, hi:100, v:Math.round(f), band:null, mark:null, left:ev?"0":"E", right:ev?"100":"F",
        color: fs?C.amber:(ev?C.green:a), text:"%"+fmt(f,0), label:ev?"Batarya":"Yakıt", state:fs}); }
    // Akü voltajı
    const v=cur("42"), L=lim("42");
    const vs = v==null ? "" : S.alarms.has("g42") ? "bad" : ((L.min!=null && v<L.min) || (L.max!=null && v>L.max)) ? "warn" : "";
    setMini(H.minis.v, {lo:10, hi:16, v:v==null?null:Math.round(v*10)/10, band:[12.4,14.8], mark:null, left:"10", right:"16",
      color: vs==="bad"?C.red:vs==="warn"?C.amber:a, text:v==null?"—":fmt(v,1)+" V", label:"Akü", state:vs});
  }

  // ---------- Güncelleme (her okuma turu ve saniyede bir) ----------
  function update(){
    if(!H.open) return;
    const ev=isEv(), d=H.dials;
    // hız
    const sp=cur("0D"), ss=speedState(sp), L=lim("0D").max;
    d.spd.num.textContent=fmt(sp,0);
    d.spd.num.className="cl-num"+(ss?" "+ss:"");
    d.spd.target=sp; d.spd.state=ss;
    H.limEl.hidden=!L; H.limEl.textContent=L?String(L):"";
    // devir ya da güç
    d.rpm.kind = ev ? "pow" : "rpm";
    if(ev){
      const p=cur("EVP");
      d.rpm.num.textContent=fmt(p,0); d.rpm.unit.textContent="kW";
      const regen=p!=null && p<-0.5;
      d.rpm.num.className="cl-num"+(regen?" regen":"");
      H.sub.textContent = p==null ? "" : regen ? "Şarj" : "Güç";
      H.sub.className="cl-sub"+(regen?" regen":"");
      d.rpm.target=p; d.rpm.state=regen?"regen":"";
    } else {
      const r=cur("0C"), red=redline();
      d.rpm.num.textContent=fmt(r,0); d.rpm.unit.textContent="d/dk";
      const rs = r==null ? "" : r>=red ? "over" : "";
      d.rpm.num.className="cl-num"+(rs?" "+rs:"");
      H.sub.textContent="×1000"; H.sub.className="cl-sub";
      d.rpm.target=r; d.rpm.state=rs;
    }
    // uyarı lambaları
    const tt=telltales(); H.tt=tt;
    for(const k of TT_ORDER){ const e=H.tts[k], s=tt[k]; e.hidden=(s===null); e.className=s||""; }
    // üst satır
    const now=new Date();
    H.clock.textContent=now.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    const out=cur("46"); H.outT.textContent = out!=null ? fmt(out,0)+" °C" : "";
    renderMinis(); renderPage();
    // süren tehlike
    const txt=alertText();
    H.alertEl.hidden=!txt; if(txt) H.alertEl.textContent=txt;
    const cls="cl"+(txt?" alarm":"");
    if(H.el.className!==cls) H.el.className=cls;
    kick(false);
  }

  // ---------- Kadran çizimi ----------
  function fontFam(){
    if(H.font) return H.font;
    let f=""; try{ f=getComputedStyle(document.documentElement).getPropertyValue("--f-num"); }catch(e){}
    H.font=(f && f.trim() && f.indexOf("#")<0) ? f.trim() : '"Barlow Condensed","Arial Narrow",sans-serif';
    return H.font;
  }
  function lgrad(ctx,x0,y0,x1,y1,stops){
    const g=ctx.createLinearGradient && ctx.createLinearGradient(x0,y0,x1,y1);
    if(!g || !g.addColorStop) return stops[0][1];
    stops.forEach(([o,c])=>g.addColorStop(o,c)); return g;
  }
  function rgrad(ctx,x,y,r0,r1,stops){
    const g=ctx.createRadialGradient && ctx.createRadialGradient(x,y,r0,x,y,r1);
    if(!g || !g.addColorStop) return stops[0][1];
    stops.forEach(([o,c])=>g.addColorStop(o,c)); return g;
  }
  function sizeCanvas(d){
    const r=d.w.getBoundingClientRect ? d.w.getBoundingClientRect() : {width:300};
    const css=Math.max(60, Math.round(Math.min(r.width, r.height||r.width) || 300));
    const dpr=Math.min(3, (typeof window!=="undefined" && window.devicePixelRatio) || 1);
    const px=Math.round(css*dpr);
    if(d.cv.width!==px || d.cv.height!==px){ d.cv.width=px; d.cv.height=px; d.faceKey=""; }
    d.size=px;
  }
  // Sabit yüz (çentikler, rakamlar, kırmızı bölge) ayrı tuvale bir kez çizilir
  function drawFace(d){
    const s=scale(d.kind), px=d.size, key=[d.kind,px,s.max,s.red,accent(),lim("0D").max].join("|");
    if(d.faceKey===key && d.face) return d.face;
    const f=d.face || mk("canvas"); f.width=px; f.height=px;
    const ctx=f.getContext && f.getContext("2d"); d.face=f; d.faceKey=key;
    if(!ctx) return f;
    const c=px/2, R=px/2*0.96;
    ctx.clearRect(0,0,px,px);
    // çerçeve: üstte ışık alan ince halka
    ctx.lineWidth=Math.max(1,R*0.012);
    ctx.strokeStyle=lgrad(ctx,0,c-R,0,c+R,[[0,"rgba(190,215,255,.30)"],[.5,"rgba(120,150,200,.08)"],[1,"rgba(120,150,200,.02)"]]);
    ctx.beginPath(); ctx.arc(c,c,R,A0-0.12,A0+SWEEP+0.12); ctx.stroke();
    // iç disk: rakamın durduğu koyu cam
    ctx.fillStyle=rgrad(ctx,c,c*0.9,R*0.05,R*0.56,[[0,"rgba(30,48,80,.55)"],[1,"rgba(6,10,18,.0)"]]);
    ctx.beginPath(); ctx.arc(c,c,R*0.56,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(170,200,240,.07)"; ctx.lineWidth=Math.max(1,R*0.008);
    ctx.beginPath(); ctx.arc(c,c,R*0.55,0,Math.PI*2); ctx.stroke();
    // ilerleme yolu
    ctx.lineWidth=R*0.045; ctx.strokeStyle="rgba(255,255,255,.055)"; ctx.lineCap="butt";
    ctx.beginPath(); ctx.arc(c,c,R*0.85,A0,A0+SWEEP); ctx.stroke();
    // kırmızı bölge (devir) / geri kazanım bölgesi (güç)
    if(s.red!=null){
      ctx.strokeStyle="rgba(255,59,48,.75)"; ctx.lineWidth=R*0.055;
      ctx.beginPath(); ctx.arc(c,c,R*0.955,ang(s,s.red),A0+SWEEP); ctx.stroke();
    }
    if(s.zero!=null){
      ctx.strokeStyle="rgba(53,208,127,.55)"; ctx.lineWidth=R*0.03;
      ctx.beginPath(); ctx.arc(c,c,R*0.955,A0,ang(s,0)); ctx.stroke();
    }
    // çentikler
    for(let v=s.min; v<=s.max+1e-6; v+=s.minor){
      const a=ang(s,v), major=Math.abs((v-s.min)%s.major)<1e-6 || Math.abs(v)%s.major<1e-6;
      const r0=R*(major?0.895:0.925), r1=R*0.985;
      const hot=(s.red!=null && v>=s.red) || (s.zero!=null && v<0);
      ctx.strokeStyle= hot ? (s.zero!=null?"rgba(120,230,170,.9)":"rgba(255,120,110,.95)") : major ? "rgba(225,235,248,.92)" : "rgba(170,190,220,.38)";
      ctx.lineWidth=R*(major?0.018:0.009);
      ctx.beginPath(); ctx.moveTo(c+r0*Math.cos(a),c+r0*Math.sin(a)); ctx.lineTo(c+r1*Math.cos(a),c+r1*Math.sin(a)); ctx.stroke();
    }
    // rakamlar
    const fs=R*(d.kind==="spd"?0.105:0.13);
    ctx.font=`600 ${fs.toFixed(1)}px ${fontFam()}`; ctx.textAlign="center"; ctx.textBaseline="middle";
    for(let v=s.min; v<=s.max+1e-6; v+=s.major){
      const a=ang(s,v), rr=R*0.735;
      const hot=(s.red!=null && v>=s.red);
      ctx.fillStyle= hot ? "#ff6a60" : (s.zero!=null && v<0) ? "#6fe0a4" : "rgba(226,235,248,.9)";
      ctx.fillText(s.label(v), c+rr*Math.cos(a), c+rr*Math.sin(a)+fs*0.04);
    }
    // hız sınırı işareti: dış kenarda küçük üçgen
    if(d.kind==="spd" && lim("0D").max){
      const a=ang(s,lim("0D").max), r0=R*1.0, r1=R*0.9;
      ctx.fillStyle=C.red;
      ctx.beginPath();
      ctx.moveTo(c+r1*Math.cos(a),c+r1*Math.sin(a));
      ctx.lineTo(c+r0*Math.cos(a-0.035),c+r0*Math.sin(a-0.035));
      ctx.lineTo(c+r0*Math.cos(a+0.035),c+r0*Math.sin(a+0.035));
      ctx.closePath(); ctx.fill();
    }
    return f;
  }
  function colorFor(d){
    if(d.state==="over") return C.red;
    if(d.state==="near") return C.amber;
    if(d.state==="regen") return C.green;
    return accent();
  }
  function drawDial(d){
    const ctx=d.cv.getContext && d.cv.getContext("2d"); if(!ctx) return;
    const px=d.size, c=px/2, R=px/2*0.96, s=scale(d.kind), face=drawFace(d);
    ctx.clearRect(0,0,px,px);
    try{ ctx.drawImage(face,0,0); }catch(e){}
    if(d.shown==null) return;
    const v=clamp(d.shown,s.min,s.max), col=colorFor(d);
    const from = s.zero!=null ? ang(s,0) : A0, to=ang(s,v);
    // parlayan ilerleme yayı
    ctx.save();
    ctx.lineCap="butt"; ctx.lineWidth=R*0.045; ctx.strokeStyle=col;
    ctx.shadowColor=col; ctx.shadowBlur=R*0.09;
    ctx.globalAlpha=0.95;
    ctx.beginPath(); ctx.arc(c,c,R*0.85,Math.min(from,to),Math.max(from,to)); ctx.stroke();
    ctx.restore();
    // ibre: dıştan içe incelen parlak çubuk (ortadaki rakamı kapatmaz)
    const a=to, ca=Math.cos(a), sa=Math.sin(a), nx=-sa, ny=ca;
    const r0=R*0.58, r1=R*1.0, w0=R*0.012, w1=R*0.028;
    ctx.save();
    ctx.shadowColor=col; ctx.shadowBlur=R*0.08;
    ctx.fillStyle=col;
    ctx.beginPath();
    ctx.moveTo(c+r0*ca+nx*w0, c+r0*sa+ny*w0);
    ctx.lineTo(c+r1*ca+nx*w1*0.5, c+r1*sa+ny*w1*0.5);
    ctx.lineTo(c+r1*ca-nx*w1*0.5, c+r1*sa-ny*w1*0.5);
    ctx.lineTo(c+r0*ca-nx*w0, c+r0*sa-ny*w0);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle="rgba(255,255,255,.92)";
    ctx.beginPath();
    ctx.moveTo(c+(r0+R*0.08)*ca+nx*w0*0.35, c+(r0+R*0.08)*sa+ny*w0*0.35);
    ctx.lineTo(c+r1*ca+nx*w1*0.18, c+r1*sa+ny*w1*0.18);
    ctx.lineTo(c+r1*ca-nx*w1*0.18, c+r1*sa-ny*w1*0.18);
    ctx.lineTo(c+(r0+R*0.08)*ca-nx*w0*0.35, c+(r0+R*0.08)*sa-ny*w0*0.35);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Ibre animasyonu: hedefe yumuşak yaklaşma, en çok ~30 kare/sn, yalnız açıkken ve değer değişirken
  function kick(force){
    if(!H.open) return;
    if(force) H.force=true;
    if(H.raf==null) H.raf=rafFn(frame);
  }
  function frame(ts){
    H.raf=null;
    if(!H.open) return;
    const now=Date.now();
    if(!H.force && now-H.lastDraw<30){ H.raf=rafFn(frame); return; }
    const dt=H.lastDraw ? Math.min(200, now-H.lastDraw) : 33;
    let moving=false;
    for(const d of Object.values(H.dials)){
      const s=scale(d.kind);
      if(d.target==null){ d.shown=null; }
      else if(d.shown==null || H.reduce){ d.shown=d.target; }
      else {
        const k=1-Math.exp(-dt/110);
        d.shown+= (d.target-d.shown)*k;
        if(Math.abs(d.target-d.shown) < (s.max-s.min)*0.0015) d.shown=d.target; else moving=true;
      }
      sizeCanvas(d); drawDial(d);
    }
    H.lastDraw=now; H.force=false;
    if(moving) H.raf=rafFn(frame);
  }

  // ---------- Aç / kapat ----------
  function open(){
    if(H.open) return;
    if(!H.el) build();
    document.body.appendChild(H.el); H.open=true; H.fs=false; H.lastDraw=0; H.pageHtml=null;
    for(const d of Object.values(H.dials)){ d.shown=null; d.faceKey=""; }
    try{ H.reduce=!!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ H.reduce=false; }
    H.onResize=()=>{ for(const d of Object.values(H.dials)) d.faceKey=""; kick(true); };
    try{ window.addEventListener("resize",H.onResize); }catch(e){}
    try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ if(H.open) H.onResize(); }); }catch(e){}
    applyView();
    try{ if(typeof history!=="undefined" && history.pushState){ history.pushState({cluster:1},""); H.pushed=true; } }catch(e){}
    try{
      if(H.el.requestFullscreen){
        const p=H.el.requestFullscreen({navigationUI:"hide"});
        if(p && p.then) p.then(()=>{ H.fs=true; },()=>{});
      }
    }catch(e){}
    try{ if(typeof keepAwake==="function") keepAwake(); }catch(e){}
    update(); showBar();
    H.timer=setInterval(update,1000);
  }
  function close(fromPop){
    if(!H.open) return;
    H.open=false;
    clearInterval(H.timer); H.timer=null;
    clearTimeout(H.barT); H.barT=null;
    if(H.raf!=null){ cafFn(H.raf); H.raf=null; }
    try{ if(H.onResize) window.removeEventListener("resize",H.onResize); }catch(e){}
    H.onResize=null;
    try{ H.el.remove(); }catch(e){}
    try{ if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{}); }catch(e){}
    if(H.pushed){ H.pushed=false; if(!fromPop) try{ history.back(); }catch(e){} }
    const b=$("btnCluster"); if(b && b.focus) b.focus();
  }

  on("tick",update);
  on("dtc",(dtc,mil)=>{ H.mil=!!mil; update(); });
  on("disconnect",()=>{ H.mil=false; update(); });
  window.addEventListener("popstate",()=>{ if(H.open){ H.pushed=false; close(true); } });
  document.addEventListener("keydown",e=>{ if(H.open && e.key==="Escape") close(); });
  document.addEventListener("fullscreenchange",()=>{
    if(!H.open) return;
    if(document.fullscreenElement) H.fs=true;
    else if(H.fs) close();   // telefonun geri hareketi tam ekrandan çıkınca panel de kapansın
  });

  // Düğme: "Ön cam (HUD)" düğmesinin yanında
  let t=document.getElementById("canliTools");
  if(!t){
    const row=$("gTitle") && $("gTitle").parentNode;
    if(row && row.parentNode){ t=document.createElement("div"); t.id="canliTools"; t.className="canli-tools"; row.parentNode.insertBefore(t,row.nextSibling); }
  }
  if(t){
    const b=document.createElement("button"); b.type="button"; b.id="btnCluster"; b.textContent="Gösterge paneli";
    b.setAttribute("aria-label","Gösterge panelini aç: hız ve devir saati, uyarı lambaları");
    b.addEventListener("click",open);
    const hb=document.getElementById("btnHud");
    if(hb && hb.parentNode===t && hb.nextSibling!==undefined && t.insertBefore) t.insertBefore(b,hb.nextSibling);
    else t.appendChild(b);
  }

  window.CLUSTER={open, close, update, applyView, cyclePage, telltales, alertText, scale, ang,
    get isOpen(){ return H.open; }, get dials(){ return H.dials; }, get minis(){ return H.minis; }, get page(){ return H.page; },
    get el(){ return H.el; }, get limEl(){ return H.limEl; }, get sub(){ return H.sub; }, get tts(){ return H.tts; },
    get timers(){ return {interval:H.timer, raf:H.raf, bar:H.barT, resize:H.onResize}; }, frame:()=>{ H.force=true; if(H.raf!=null){ cafFn(H.raf); H.raf=null; } frame(); }};
})();
