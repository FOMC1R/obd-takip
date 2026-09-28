// ---------- Açılış animasyonu (~3 sn) ----------
// Arabanın kontak açılışı gibi: veri sinyali çizilir ve bir noktaya çöker → nokta yanar, kadran çizgileri dizilir,
// uyarı lambaları yanıp söner → ibre sona fırlayıp geri iner, ortadaki hız sayar ve "HAZIR" olur →
// "OBD Takip" yazısı netleşir → kadranın merkezinden açılan halka ana sayfayı ortaya çıkarır.
// Yalnızca transform / opacity / stroke-dashoffset canlandırılır (telefonda akıcı). Dokununca atlanır.
// "Hareketi azalt" açık telefonda kısa bir solma. Kalıcı ayar: settings.splash (varsayılan açık).
const SPLASH = (()=>{
  if(settings.splash===undefined) settings.splash=true;
  const DUR=3000;   // toplam süre (ms)
  const ARC=376.99; // yay uzunluğu: r=80, 270°
  const CX=100, CY=100;

  // ---- ayar kartı ----
  const card=document.createElement("section"); card.className="card";
  card.innerHTML=`<h2>Açılış animasyonu</h2>
    <label class="check"><input type="checkbox" id="spOpt"> Uygulama açılırken kısa açılış animasyonunu göster</label>
    <div class="actions"><button id="spPlay">Şimdi oynat</button></div>`;
  $("ext-ayar").appendChild(card);
  $("spOpt").checked=settings.splash;
  $("spOpt").addEventListener("change",e=>{ settings.splash=e.target.checked; save(); });
  $("spPlay").addEventListener("click",()=>play(true));

  // ---- sahne ----
  function css(){
    if(document.getElementById("spCss")) return;
    const s=document.createElement("style"); s.id="spCss";
    s.textContent=`
@property --sp-r{syntax:"<percentage>";inherits:false;initial-value:0%}
.sp{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;overflow:hidden;cursor:pointer;
  background:radial-gradient(120% 80% at 50% 44%,#101a2a 0%,#070b12 55%,#030509 100%);color:#e9f1ff;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  --sp-acc:#f2a93b;--sp-blue:#39b8ff;--sp-red:#ff3b30;
  -webkit-mask:radial-gradient(circle at 50% 42%,transparent calc(var(--sp-r) - .5%),#000 var(--sp-r));
          mask:radial-gradient(circle at 50% 42%,transparent calc(var(--sp-r) - .5%),#000 var(--sp-r));
  animation:sp-iris .62s cubic-bezier(.7,0,.2,1) 2.38s forwards}
@keyframes sp-iris{to{--sp-r:150%}}
.sp *{box-sizing:border-box}
.sp-stage{position:relative;width:min(78vw,46vh,360px);display:grid;justify-items:center;gap:min(3.2vh,22px);transform:translateY(-3vh);
  animation:sp-out .6s cubic-bezier(.6,0,.2,1) 2.38s forwards}
@keyframes sp-out{to{transform:translateY(-3vh) scale(1.18);opacity:0;filter:blur(6px)}}
.sp svg{width:100%;height:auto;overflow:visible;display:block}

/* arka plan: kayan veri satırları */
.sp-rain{position:absolute;inset:-10% 0;display:flex;justify-content:space-around;opacity:.07;pointer-events:none;
  font:500 12px/1.7 var(--f-num);letter-spacing:.12em;color:var(--sp-blue);mask:linear-gradient(transparent,#000 30%,#000 70%,transparent)}
.sp-rain div{white-space:pre;animation:sp-rain 3s linear forwards}
.sp-rain div:nth-child(even){animation-duration:3.6s;animation-direction:reverse}
@keyframes sp-rain{from{transform:translateY(-6%)}to{transform:translateY(6%)}}
.sp-glow{position:absolute;left:50%;top:42%;width:120vmin;height:120vmin;transform:translate(-50%,-50%) scale(.2);border-radius:50%;
  background:radial-gradient(circle,rgba(242,169,59,.16),rgba(57,184,255,.06) 40%,transparent 65%);opacity:0;
  animation:sp-glow 1.6s cubic-bezier(.2,.8,.2,1) .78s forwards}
@keyframes sp-glow{to{transform:translate(-50%,-50%) scale(1);opacity:1}}

/* 1) sinyal */
.sp-wave{fill:none;stroke:var(--sp-blue);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:420;stroke-dashoffset:420;filter:drop-shadow(0 0 3px var(--sp-blue));
  transform-box:view-box;transform-origin:100px 100px;
  animation:sp-draw .55s cubic-bezier(.4,0,.2,1) .1s forwards, sp-collapse .18s cubic-bezier(.7,0,1,.4) .64s forwards}
@keyframes sp-draw{to{stroke-dashoffset:0}}
@keyframes sp-collapse{to{transform:scaleX(0);opacity:.2}}

/* 2) kontak */
.sp-dot{fill:#fff;transform-box:view-box;transform-origin:100px 100px;transform:scale(0);
  animation:sp-dot .5s cubic-bezier(.2,1.6,.4,1) .78s forwards}
@keyframes sp-dot{to{transform:scale(1)}}
.sp-ring{fill:none;stroke:var(--sp-acc);stroke-width:1.2;transform-box:view-box;transform-origin:100px 100px;transform:scale(.05);opacity:0;
  animation:sp-ring .7s cubic-bezier(.1,.7,.3,1) .8s forwards}
.sp-ring.b{stroke:var(--sp-blue);animation-delay:.9s}
@keyframes sp-ring{0%{opacity:.9}100%{transform:scale(1.25);opacity:0}}
.sp-track{fill:none;stroke:rgba(255,255,255,.07);stroke-width:7;stroke-linecap:round;stroke-dasharray:${ARC};stroke-dashoffset:${ARC};
  animation:sp-track .5s cubic-bezier(.3,0,.2,1) .8s forwards}
@keyframes sp-track{to{stroke-dashoffset:0}}
.sp-tick{stroke:#cfe0ff;stroke-width:1.6;stroke-linecap:round;opacity:0;animation:sp-tick .25s ease-out forwards}
.sp-tick.maj{stroke-width:2.6}
.sp-tick.red{stroke:var(--sp-red)}
@keyframes sp-tick{from{opacity:0}to{opacity:.9}}
.sp-lamps{display:flex;gap:min(4.5vw,18px);justify-content:center;height:22px;margin-top:-4px;animation:sp-lampsout .35s ease-in 1.85s forwards}
@keyframes sp-lampsout{to{opacity:0;transform:translateY(6px)}}
.sp-lamps svg{width:22px;height:22px;opacity:0;fill:currentColor;color:#6d7b93;animation:sp-lamp .7s steps(1,end) .95s forwards}
.sp-lamps svg.r{--on:var(--sp-red)}.sp-lamps svg.a{--on:var(--sp-acc)}.sp-lamps svg.g{--on:#35d07f}
@keyframes sp-lamp{0%{opacity:1;color:var(--on);filter:drop-shadow(0 0 5px var(--on))}100%{opacity:.12;color:#6d7b93;filter:none}}
.sp-lamps svg.g{animation:sp-lampg 1.4s ease-out .95s forwards}
@keyframes sp-lampg{0%,55%{opacity:1;color:#35d07f;filter:drop-shadow(0 0 5px #35d07f)}100%{opacity:.85;color:#35d07f;filter:none}}

/* 3) ibre testi */
.sp-fill{fill:none;stroke:url(#spGrad);stroke-width:7;stroke-linecap:round;stroke-dasharray:${ARC};stroke-dashoffset:${ARC};
  filter:drop-shadow(0 0 4px rgba(242,169,59,.7));animation:sp-fill .9s linear .85s forwards}
@keyframes sp-fill{
  0%{stroke-dashoffset:${ARC};animation-timing-function:cubic-bezier(.15,.85,.3,1)}
  55%{stroke-dashoffset:0;animation-timing-function:linear}
  62%{stroke-dashoffset:0;animation-timing-function:cubic-bezier(.6,0,.35,1)}
  100%{stroke-dashoffset:${ARC}}}
.sp-needle{transform-box:view-box;transform-origin:100px 100px;transform:rotate(-135deg);opacity:0;
  animation:sp-needle .9s linear .85s forwards}
@keyframes sp-needle{
  0%{transform:rotate(-135deg);opacity:1;animation-timing-function:cubic-bezier(.15,.85,.3,1)}
  55%{transform:rotate(135deg);animation-timing-function:linear}
  62%{transform:rotate(135deg);animation-timing-function:cubic-bezier(.6,0,.35,1)}
  100%{transform:rotate(-135deg);opacity:1}}
.sp-needle line{stroke:var(--sp-red);stroke-width:2.4;stroke-linecap:round;filter:drop-shadow(0 0 3px var(--sp-red))}
.sp-hub{fill:#0b1220;stroke:#8fa3c2;stroke-width:1.2;transform-box:view-box;transform-origin:100px 100px;transform:scale(0);
  animation:sp-dot .45s cubic-bezier(.2,1.6,.4,1) .74s forwards}
.sp-num{font:700 30px var(--f-num);fill:#fff;text-anchor:middle;dominant-baseline:central;letter-spacing:-.5px;opacity:0;
  animation:sp-num .2s ease-out .9s forwards, sp-numout .16s ease-in 1.7s forwards}
@keyframes sp-num{to{opacity:1}}@keyframes sp-numout{to{opacity:0;transform:translateY(-4px)}}
.sp-unit{font:600 7.5px var(--f-body);fill:#7d8ba3;text-anchor:middle;letter-spacing:2px;opacity:0;
  animation:sp-num .2s ease-out .9s forwards, sp-numout .16s ease-in 1.7s forwards}
.sp-ready{font:700 15px var(--f-num);fill:var(--sp-acc);text-anchor:middle;dominant-baseline:central;letter-spacing:5px;opacity:0;
  transform-box:view-box;transform-origin:100px 118px;transform:scale(.7);
  animation:sp-ready .45s cubic-bezier(.2,1.5,.4,1) 1.84s forwards}
@keyframes sp-ready{to{opacity:1;transform:scale(1)}}

/* 4) imza */
.sp-title{display:flex;align-items:baseline;gap:.28em;font:700 clamp(34px,11vw,54px)/1 var(--f-num);letter-spacing:.02em}
.sp-title span{display:inline-block;opacity:0;transform:translateY(.45em);filter:blur(8px);animation:sp-letter .6s cubic-bezier(.2,.8,.2,1) forwards}
.sp-title .w2 span{color:var(--sp-acc)}
@keyframes sp-letter{to{opacity:1;transform:none;filter:blur(0)}}
.sp-tag{font:500 clamp(13px,3.8vw,16px)/1.3 var(--f-body);color:#9fb0c9;letter-spacing:.14em;text-transform:uppercase;opacity:0;
  clip-path:inset(0 100% 0 0);animation:sp-tag .5s cubic-bezier(.6,0,.2,1) 1.78s forwards}
@keyframes sp-tag{to{opacity:1;clip-path:inset(0 0 0 0)}}
.sp-ver{position:absolute;right:16px;bottom:max(16px,env(safe-area-inset-bottom));font:500 12px var(--f-num);letter-spacing:.14em;color:#55647c;opacity:0;
  animation:sp-num .4s ease-out 1.2s forwards}
.sp-skip{position:absolute;left:16px;bottom:max(16px,env(safe-area-inset-bottom));font:500 12px var(--f-body);color:#55647c;opacity:0;animation:sp-num .4s ease-out 1.2s forwards}
.sp.fast{animation:sp-fade .25s ease-in .35s forwards;-webkit-mask:none;mask:none}
.sp.fast *{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important;stroke-dashoffset:0!important}
.sp.fast .sp-wave,.sp.fast .sp-num,.sp.fast .sp-unit,.sp.fast .sp-ring,.sp.fast .sp-rain,.sp.fast .sp-glow{display:none}
.sp.fast .sp-needle{transform:rotate(-135deg)!important}
.sp.fast .sp-fill{stroke-dashoffset:${ARC}!important}
.sp.bye{animation:sp-fade .2s ease-in forwards!important}
@keyframes sp-fade{to{opacity:0}}
`;
    document.head.appendChild(s);
  }

  const pt=(deg,r)=>{ const a=deg*Math.PI/180; return [CX+r*Math.cos(a), CY+r*Math.sin(a)]; };
  function ticks(){
    let out="";
    for(let i=0;i<=27;i++){
      const deg=135+i*10, maj=i%3===0, red=i>=23;
      const [x1,y1]=pt(deg, maj?66:70), [x2,y2]=pt(deg,76);
      out+=`<line class="sp-tick${maj?" maj":""}${red?" red":""}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" style="animation-delay:${(0.8+i*0.013).toFixed(3)}s"/>`;
    }
    return out;
  }
  function rain(){
    const hex=()=>"0123456789ABCDEF"[Math.random()*16|0]+"0123456789ABCDEF"[Math.random()*16|0];
    const pids=["41 0C","41 0D","41 05","41 0F","41 11","41 04","41 42","49 02","43 01"];
    let cols="";
    for(let c=0;c<7;c++){ let t=""; for(let i=0;i<40;i++) t+=`${pids[(c*7+i)%pids.length]} ${hex()} ${hex()}\n`; cols+=`<div>${t}</div>`; }
    return cols;
  }
  // Ayarlar, gösterge lambalarıyla aynı dil: motor, akü, yağ, hararet, hazır
  const LAMPS=[
    ["r",'<path d="M4 9h3V7h7v2h3l2 3v5h-2v2H8v-2H4z"/>'],
    ["r",'<path d="M3 8h18v11H3z M6 5h3v3H6z M15 5h3v3h-3z" fill-rule="evenodd"/><path d="M6 13h4M16 11v4M14 13h4" stroke="#070b12" stroke-width="1.6"/>'],
    ["a",'<path d="M3 12l5-2 3 2h6l4-3v3l-4 3H8z"/><circle cx="20" cy="17" r="1.6"/>'],
    ["r",'<path d="M11 3h2v10.3a3.5 3.5 0 1 1-2 0z"/><path d="M3 20c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0" fill="none" stroke="currentColor" stroke-width="1.6"/>'],
    ["g",'<path d="M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/>'],
  ];

  function markup(){
    const [sx,sy]=pt(135,80), [ex,ey]=pt(45,80);
    const arc=`M${sx.toFixed(2)} ${sy.toFixed(2)} A80 80 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    // veri sinyali: sakin çizgi, ortada bir kalp atışı gibi sıçrama, sonra kare dalga (CAN verisi)
    const wave="M-60 100 H40 L48 100 L54 86 L60 114 L66 72 L72 124 L78 100 H96 V92 H104 V108 H112 V92 H120 V100 H260";
    const title=(w,cls,d0)=>`<span class="${cls}">${[...w].map((ch,i)=>`<span style="animation-delay:${(d0+i*0.05).toFixed(2)}s">${ch}</span>`).join("")}</span>`;
    return `<div class="sp-rain" aria-hidden="true">${rain()}</div><div class="sp-glow" aria-hidden="true"></div>
      <div class="sp-stage" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <defs><linearGradient id="spGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#39b8ff"/><stop offset=".55" stop-color="#f2a93b"/><stop offset="1" stop-color="#ff3b30"/></linearGradient></defs>
          <path class="sp-track" d="${arc}"/>
          <path class="sp-fill" d="${arc}"/>
          ${ticks()}
          <path class="sp-wave" d="${wave}"/>
          <circle class="sp-ring" cx="100" cy="100" r="80"/><circle class="sp-ring b" cx="100" cy="100" r="80"/>
          <text class="sp-num" x="100" y="128" id="spNum">0</text>
          <text class="sp-unit" x="100" y="146">KM/SA</text>
          <text class="sp-ready" x="100" y="136">HAZIR</text>
          <g class="sp-needle"><line x1="100" y1="112" x2="100" y2="34"/></g>
          <circle class="sp-hub" cx="100" cy="100" r="6.5"/>
          <circle class="sp-dot" cx="100" cy="100" r="2.6"/>
        </svg>
        <div class="sp-lamps">${LAMPS.map(([c,d])=>`<svg viewBox="0 0 24 24" class="${c}">${d}</svg>`).join("")}</div>
        <div class="sp-title">${title("OBD","w1",1.5)}${title("Takip","w2",1.68)}</div>
        <div class="sp-tag">Aracının nabzı avucunda</div>
      </div>
      <div class="sp-skip">Geçmek için dokun</div>
      <div class="sp-ver">SÜRÜM ${typeof APP_VERSION!=="undefined"?APP_VERSION:""}</div>`;
  }

  // Hız rakamı ibreyle aynı eğride sayar (CSS'teki sp-needle anahtar kareleriyle eş)
  const bez=(x1,y1,x2,y2)=>t=>{   // cubic-bezier(x1,y1,x2,y2) → t'ye karşılık y (Newton yöntemi)
    let u=t; for(let i=0;i<6;i++){ const x=3*(1-u)*(1-u)*u*x1+3*(1-u)*u*u*x2+u*u*u-t, dx=3*(1-u)*(1-u)*x1+6*(1-u)*u*(x2-x1)+3*u*u*(1-x2); if(Math.abs(dx)<1e-6) break; u=Math.min(1,Math.max(0,u-x/dx)); }
    return 3*(1-u)*(1-u)*u*y1+3*(1-u)*u*u*y2+u*u*u; };
  const UP=bez(.15,.85,.3,1), DOWN=bez(.6,0,.35,1);
  function needleAt(ms){   // 0..1 (0 = en sol, 1 = en sağ)
    const t=(ms-850)/900; if(t<=0) return 0; if(t>=1) return 0;
    if(t<.55) return UP(t/.55); if(t<.62) return 1; return 1-DOWN((t-.62)/.38);
  }

  let el=null, raf=null, timer=null;
  function finish(){
    if(!el) return;
    cancelAnimationFrame(raf); clearTimeout(timer);
    const e=el; el=null; e.classList.add("bye");
    setTimeout(()=>e.remove(), 220);
  }
  function play(force){
    if(el || (!force && !settings.splash) || typeof requestAnimationFrame!=="function"){ document.documentElement.classList.remove("sp-boot"); return false; }
    css();
    el=document.createElement("div"); el.className="sp"; el.setAttribute("role","presentation");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduce) el.classList.add("fast");
    el.innerHTML=markup();
    document.body.appendChild(el);
    document.documentElement.classList.remove("sp-boot");   // sahne üstte; altındaki uygulama görünebilir
    el.addEventListener("pointerdown", finish, {once:true});
    if(reduce){ timer=setTimeout(finish, 650); return true; }
    const num=el.querySelector("#spNum"), t0=performance.now();
    let buzzed=false, last=-1;
    const step=now=>{
      if(!el) return;
      const ms=now-t0, v=Math.round(needleAt(ms)*260);
      if(v!==last){ num.textContent=String(v); last=v; }
      if(!buzzed && ms>850+900*.55){ buzzed=true; if(settings.vibrate && navigator.vibrate) try{ navigator.vibrate(12); }catch(e){} }
      if(ms<1800) raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    timer=setTimeout(()=>{ if(el){ const e=el; el=null; e.remove(); } }, DUR+80);
    return true;
  }

  // Belirli bir ana dondur (görsel kontrol ve test için): tüm canlandırmalar durur, o milisaniyeye gider
  function seek(ms){
    if(!el) play(true);
    if(!el) return false;
    cancelAnimationFrame(raf); clearTimeout(timer);
    (el.getAnimations ? el.getAnimations({subtree:true}) : []).forEach(a=>{ a.pause(); a.currentTime=ms; });
    const n=el.querySelector("#spNum"); if(n) n.textContent=String(Math.round(needleAt(ms)*260));
    return true;
  }

  // Açılışta (sayfa ön plandaysa)
  if(document.visibilityState!=="hidden") play(false);
  return {play, finish, seek, needleAt, get el(){ return el; }};
})();
