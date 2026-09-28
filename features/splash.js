// ---------- Açılış animasyonu (~3 sn) ----------
// Arabanın kontak açılışı gibi: veri sinyali çizilir ve bir noktaya çöker → ufuk ışığı çakar, kadranın çerçevesi,
// yüzü, çizgileri ve rakamları dizilir, uyarı lambaları yanıp söner → ibre sona fırlayıp geri iner, ortadaki hız
// sayar → çizgilerin üstünden ışık geçer, "HAZIR" → "OBD Takip" imzası gelir → sahne büyüyerek solar, altından ana sayfa çıkar.
// Çıkış yalnızca opacity + transform ile (telefonun grafik birimi yapar, takılmaz). Dokununca atlanır.
// "Hareketi azalt" açık telefonda kısa bir solma. Kalıcı ayar: settings.splash (varsayılan açık).
const SPLASH = (()=>{
  if(settings.splash===undefined) settings.splash=true;
  const DUR=3000;   // toplam süre (ms)
  const ARC=376.99; // yay uzunluğu: r=80, 270°
  const CX=100, CY=100;
  // Ölçek: 0-240 km/sa, 270° yay, 10 km/sa'da bir çizgi, 40'ta bir rakam; 200 üstü kırmızı bölge
  const VMAX=240, STEP=10, N=VMAX/STEP;
  const degOf=v=>135+270*v/VMAX;

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
.sp{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;overflow:hidden;cursor:pointer;will-change:opacity;
  background:radial-gradient(130% 90% at 50% 40%,#0f1a2c 0%,#070c15 52%,#020308 100%);color:#e9f1ff;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  --sp-acc:#f2a93b;--sp-blue:#39b8ff;--sp-red:#ff3b30;
  animation:sp-fade .36s cubic-bezier(.2,0,.2,1) 2.62s forwards}
.sp::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 80% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%)}
.sp *{box-sizing:border-box}
.sp-stage{position:relative;z-index:1;width:min(80vw,46vh,360px);display:grid;justify-items:center;gap:min(2.6vh,18px);transform:translateY(-2vh);
  will-change:transform,opacity;animation:sp-out .28s cubic-bezier(.3,0,.6,1) 2.34s forwards}
@keyframes sp-out{to{transform:translateY(-2vh) scale(1.14);opacity:0}}
.sp svg{width:100%;height:auto;overflow:visible;display:block}

/* arka plan */
.sp-rain{position:absolute;inset:-10% 0;display:flex;justify-content:space-around;opacity:.05;pointer-events:none;
  font:500 11px/1.8 var(--f-num);letter-spacing:.14em;color:var(--sp-blue);
  -webkit-mask:linear-gradient(transparent,#000 25%,#000 75%,transparent);mask:linear-gradient(transparent,#000 25%,#000 75%,transparent)}
.sp-rain div{white-space:pre;animation:sp-rain 3s linear forwards}
.sp-rain div:nth-child(even){animation-duration:3.6s;animation-direction:reverse}
@keyframes sp-rain{from{transform:translateY(-5%)}to{transform:translateY(5%)}}
.sp-glow{position:absolute;left:50%;top:40%;width:130vmin;height:130vmin;transform:translate(-50%,-50%) scale(.2);border-radius:50%;
  background:radial-gradient(circle,rgba(242,169,59,.14),rgba(57,184,255,.07) 38%,transparent 64%);opacity:0;
  animation:sp-glow 1.6s cubic-bezier(.2,.8,.2,1) .78s forwards}
@keyframes sp-glow{to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.sp-hz{transform-box:view-box;transform-origin:100px 100px;transform:scaleX(0);opacity:0;filter:drop-shadow(0 0 2px #39b8ff);
  animation:sp-horizon .7s cubic-bezier(.2,.8,.2,1) .7s forwards}
@keyframes sp-horizon{0%{transform:scaleX(0);opacity:1}35%{transform:scaleX(1);opacity:.9}100%{transform:scaleX(1);opacity:0}}
.sp-radar{fill:none;stroke:rgba(140,180,255,.08);stroke-width:.6;opacity:0;animation:sp-in .9s ease-out 1s forwards}
@keyframes sp-in{to{opacity:1}}

/* 1) sinyal */
.sp-wave{fill:none;stroke:var(--sp-blue);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:420;stroke-dashoffset:420;filter:drop-shadow(0 0 3px var(--sp-blue));
  transform-box:view-box;transform-origin:100px 100px;
  animation:sp-draw .55s cubic-bezier(.4,0,.2,1) .1s forwards, sp-collapse .16s cubic-bezier(.7,0,1,.4) .64s forwards}
@keyframes sp-draw{to{stroke-dashoffset:0}}
@keyframes sp-collapse{to{transform:scaleX(0);opacity:.3}}

/* 2) kontak: çerçeve, yüz, çizgiler, rakamlar */
.sp-pop{transform-box:view-box;transform-origin:100px 100px;transform:scale(0);animation:sp-pop .5s cubic-bezier(.2,1.5,.4,1) .74s forwards}
@keyframes sp-pop{to{transform:scale(1)}}
.sp-ring{fill:none;stroke:var(--sp-acc);stroke-width:1;transform-box:view-box;transform-origin:100px 100px;transform:scale(.05);opacity:0;
  animation:sp-ring .75s cubic-bezier(.1,.7,.3,1) .78s forwards}
.sp-ring.b{stroke:var(--sp-blue);animation-delay:.9s}
@keyframes sp-ring{0%{opacity:.9}100%{transform:scale(1.3);opacity:0}}
.sp-bezel{fill:none;stroke:url(#spBezel);stroke-width:1.6;stroke-dasharray:597;stroke-dashoffset:597;transform-box:view-box;transform-origin:100px 100px;transform:rotate(90deg);
  animation:sp-bezel .7s cubic-bezier(.3,0,.1,1) .8s forwards}
@keyframes sp-bezel{to{stroke-dashoffset:0}}
.sp-face{fill:url(#spFace);stroke:rgba(255,255,255,.06);stroke-width:.6;opacity:0;transform-box:view-box;transform-origin:100px 100px;transform:scale(.85);
  animation:sp-face .6s cubic-bezier(.2,.8,.2,1) .82s forwards}
@keyframes sp-face{to{opacity:1;transform:scale(1)}}
.sp-track{fill:none;stroke:rgba(255,255,255,.07);stroke-width:5;stroke-dasharray:${ARC};stroke-dashoffset:${ARC};
  animation:sp-track .5s cubic-bezier(.3,0,.2,1) .82s forwards}
.sp-track.red{stroke:rgba(255,59,48,.35)}
@keyframes sp-track{to{stroke-dashoffset:0}}
.sp-tick{stroke:#d7e4fa;stroke-width:.9;stroke-linecap:round;opacity:0;animation:sp-tick .22s ease-out forwards, sp-sweep .5s ease-out forwards}
.sp-tick.maj{stroke-width:2.1}
.sp-tick.red{stroke:var(--sp-red)}
@keyframes sp-tick{to{opacity:.85}}
@keyframes sp-sweep{0%{opacity:.85}30%{opacity:1;stroke:#fff}100%{opacity:.85}}
.sp-lbl{font:600 9.5px var(--f-num);fill:#a9b8cf;text-anchor:middle;dominant-baseline:central;opacity:0;animation:sp-tick .3s ease-out forwards}
.sp-lbl.red{fill:#ff6a60}

/* 3) ibre testi */
.sp-fill{fill:none;stroke:url(#spGrad);stroke-width:5;stroke-dasharray:${ARC};stroke-dashoffset:${ARC};
  filter:drop-shadow(0 0 3px rgba(242,169,59,.8));animation:sp-fill .9s linear .85s forwards}
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
.sp-needle path{fill:url(#spNeedle)}
.sp-needle circle{fill:#fff;filter:drop-shadow(0 0 3px var(--sp-red))}
.sp-hub{fill:url(#spHub);stroke:#9fb3d3;stroke-width:.8}
.sp-cap{fill:var(--sp-acc)}
.sp-num{font:700 34px var(--f-num);fill:#fff;text-anchor:middle;dominant-baseline:central;letter-spacing:-.5px;opacity:0;
  animation:sp-in .2s ease-out .9s forwards, sp-numout .16s ease-in 1.7s forwards}
@keyframes sp-numout{to{opacity:0;transform:translateY(-4px)}}
.sp-unit{font:600 6.5px var(--f-body);fill:#7d8ba3;text-anchor:middle;letter-spacing:2.4px;opacity:0;
  animation:sp-in .2s ease-out .9s forwards, sp-numout .16s ease-in 1.7s forwards}
.sp-ready{font:700 14px var(--f-num);fill:var(--sp-acc);text-anchor:middle;dominant-baseline:central;letter-spacing:5px;opacity:0;
  transform-box:view-box;transform-origin:100px 132px;transform:scale(.7);
  animation:sp-ready .45s cubic-bezier(.2,1.5,.4,1) 1.84s forwards}
@keyframes sp-ready{to{opacity:1;transform:scale(1)}}
.sp-readyline{stroke:var(--sp-acc);stroke-width:1;stroke-linecap:round;transform-box:view-box;transform-origin:100px 143px;transform:scaleX(0);
  animation:sp-grow .45s cubic-bezier(.2,.8,.2,1) 1.92s forwards}
@keyframes sp-grow{to{transform:scaleX(1)}}

/* lambalar: cam şerit */
.sp-lamps{display:flex;gap:min(4vw,16px);justify-content:center;align-items:center;padding:7px 16px;border-radius:999px;margin-top:2px;
  background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.09);
  opacity:0;transform:translateY(6px);animation:sp-strip .4s cubic-bezier(.2,.8,.2,1) .9s forwards, sp-lampsout .35s ease-in 1.85s forwards}
@keyframes sp-strip{to{opacity:1;transform:none}}
@keyframes sp-lampsout{to{opacity:0;transform:translateY(6px)}}
.sp-lamps svg{width:20px;height:20px;fill:currentColor;color:#334158;animation:sp-lamp .75s steps(1,end) .95s forwards}
.sp-lamps svg.r{--on:#ff4a3d}.sp-lamps svg.a{--on:#ffb020}.sp-lamps svg.g{--on:#35d07f}
@keyframes sp-lamp{0%{color:var(--on);filter:drop-shadow(0 0 4px var(--on))}100%{color:#334158;filter:none}}
.sp-lamps svg.g{animation:sp-lampg 1.2s ease-out .95s forwards}
@keyframes sp-lampg{0%,60%{color:#35d07f;filter:drop-shadow(0 0 4px #35d07f)}100%{color:#35d07f;filter:none}}

/* 4) imza */
.sp-brand{display:grid;justify-items:center;gap:10px;margin-top:2px}
.sp-title{display:flex;align-items:baseline;gap:.22em;font:700 clamp(38px,12vw,58px)/1 var(--f-num);letter-spacing:.01em}
.sp-title>span>span{display:inline-block;opacity:0;transform:translateY(.55em);animation:sp-letter .55s cubic-bezier(.2,.9,.2,1) forwards}
.sp-title .w1 span{color:#f4f8ff}
.sp-title .w2 span{color:var(--sp-acc)}
@keyframes sp-letter{to{opacity:1;transform:none}}
.sp-rule{width:min(46vw,180px);height:1px;transform:scaleX(0);background:linear-gradient(90deg,transparent,var(--sp-acc),transparent);
  animation:sp-grow .6s cubic-bezier(.2,.8,.2,1) 1.8s forwards}
.sp-tag{font:500 clamp(11px,3.3vw,13px)/1.3 var(--f-body);color:#9fb0c9;letter-spacing:.3em;text-transform:uppercase;opacity:0;padding-left:.3em;
  transform:translateY(4px);animation:sp-tagin .5s cubic-bezier(.2,.8,.2,1) 1.9s forwards}
@keyframes sp-tagin{to{opacity:1;transform:none}}
.sp-ver,.sp-skip{position:absolute;z-index:1;bottom:max(16px,env(safe-area-inset-bottom));font:500 11px var(--f-num);letter-spacing:.18em;color:#4b5a72;opacity:0;animation:sp-in .4s ease-out 1.2s forwards}
.sp-ver{right:16px}.sp-skip{left:16px;font-family:var(--f-body);letter-spacing:.04em}

/* hareketi azalt / atla */
.sp.fast{animation:sp-fade .25s ease-in .35s forwards}
.sp.fast *{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;stroke-dashoffset:0!important}
.sp.fast .sp-wave,.sp.fast .sp-num,.sp.fast .sp-unit,.sp.fast .sp-ring,.sp.fast .sp-rain,.sp.fast .sp-glow,.sp.fast .sp-hz,.sp.fast .sp-lamps{display:none}
.sp.fast .sp-needle{transform:rotate(-135deg)!important}
.sp.fast .sp-bezel{transform:rotate(90deg)!important}
.sp.fast .sp-fill{stroke-dashoffset:${ARC}!important}
.sp.bye{animation:sp-fade .22s ease-in forwards!important}
@keyframes sp-fade{to{opacity:0}}
`;
    document.head.appendChild(s);
  }

  const pt=(deg,r)=>{ const a=deg*Math.PI/180; return [CX+r*Math.cos(a), CY+r*Math.sin(a)]; };
  const f2=n=>n.toFixed(2);
  const arcPath=(r,v0,v1)=>{ const [x0,y0]=pt(degOf(v0),r), [x1,y1]=pt(degOf(v1),r), big=(degOf(v1)-degOf(v0))>180?1:0;
    return `M${f2(x0)} ${f2(y0)} A${r} ${r} 0 ${big} 1 ${f2(x1)} ${f2(y1)}`; };
  function ticks(){
    let out="";
    for(let i=0;i<=N;i++){
      const v=i*STEP, deg=degOf(v), maj=v%40===0, red=v>=200, d=(0.82+i*0.014).toFixed(3), sw=(1.76+i*0.012).toFixed(3);
      const [x1,y1]=pt(deg, maj?70:73.5), [x2,y2]=pt(deg,77);
      out+=`<line class="sp-tick${maj?" maj":""}${red?" red":""}" x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" style="animation-delay:${d}s,${sw}s"/>`;
      if(maj){ const [lx,ly]=pt(deg,60); out+=`<text class="sp-lbl${red?" red":""}" x="${f2(lx)}" y="${f2(ly)}" style="animation-delay:${(+d+0.05).toFixed(3)}s">${v}</text>`; }
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
  // Gösterge lambaları: motor arıza, akü, yağ basıncı, hararet, hazır
  const LAMPS=[
    ["a",'<path d="M7 7h6v2h2.5l1.5 2h2v-1.5h2V16h-2v-1.5h-2L15 17H8l-2-2H4v2H2v-7h2v2h2V9h1z"/>'],
    ["r",'<path d="M3 7h18v12H3zM6 4.5h3V7H6zM15 4.5h3V7h-3z"/><path d="M6 13h4M16 11v4M14 13h4" stroke="#0a0f18" stroke-width="1.6"/>'],
    ["r",'<path d="M3 11l4-1.5 2 1.5h6l5-3v2.5L16 15H7l-2-2H3z"/><path d="M20.5 13.2c.8 1.1 1.2 1.8 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.5.4-1.2 1.2-2.3z"/>'],
    ["r",'<path d="M11 2.5h2V5h2.5v1.5H13V8h2.5v1.5H13v4a3.2 3.2 0 1 1-2 0z"/><path d="M2.5 20c1.9-1.2 3.8-1.2 5.7 0s3.8 1.2 5.7 0 3.8-1.2 5.7 0" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ["g",'<path d="M5 11l2-5h10l2 5v6h-2v2h-2v-2H9v2H7v-2H5zM7.4 10h9.2l-1.2-3H8.6zM7.5 12.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" fill-rule="evenodd"/>'],
  ];

  function markup(){
    const arc=arcPath(80,0,VMAX), red=arcPath(80,200,VMAX);
    // veri sinyali: sakin çizgi, ortada bir kalp atışı gibi sıçrama, sonra kare dalga (CAN verisi)
    const wave="M-60 100 H40 L48 100 L54 86 L60 114 L66 72 L72 124 L78 100 H96 V92 H104 V108 H112 V92 H120 V100 H260";
    const title=(w,cls,d0)=>`<span class="${cls}">${[...w].map((ch,i)=>`<span style="animation-delay:${(d0+i*0.045).toFixed(3)}s">${ch}</span>`).join("")}</span>`;
    return `<div class="sp-rain" aria-hidden="true">${rain()}</div><div class="sp-glow" aria-hidden="true"></div>
      <div class="sp-stage" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <defs>
            <linearGradient id="spGrad" gradientUnits="userSpaceOnUse" x1="20" y1="170" x2="180" y2="60"><stop offset="0" stop-color="#39b8ff"/><stop offset=".55" stop-color="#f2a93b"/><stop offset="1" stop-color="#ff3b30"/></linearGradient>
            <linearGradient id="spBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f0ff"/><stop offset=".45" stop-color="#5c6b85"/><stop offset=".55" stop-color="#2a3448"/><stop offset="1" stop-color="#8fa3c2"/></linearGradient>
            <radialGradient id="spFace" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#15223a"/><stop offset="1" stop-color="#070b14"/></radialGradient>
            <radialGradient id="spHub" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5a6a86"/><stop offset="1" stop-color="#0b1220"/></radialGradient>
            <linearGradient id="spNeedle" gradientUnits="userSpaceOnUse" x1="100" y1="112" x2="100" y2="26"><stop offset="0" stop-color="#8a1a14"/><stop offset=".35" stop-color="#ff3b30"/><stop offset="1" stop-color="#ff8a80"/></linearGradient>
            <linearGradient id="spHz" x1="0" x2="1"><stop offset="0" stop-color="#39b8ff" stop-opacity="0"/><stop offset=".3" stop-color="#39b8ff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff"/><stop offset=".7" stop-color="#39b8ff" stop-opacity=".9"/><stop offset="1" stop-color="#39b8ff" stop-opacity="0"/></linearGradient>
          </defs>
          <rect class="sp-hz" x="-300" y="99.6" width="800" height=".8" fill="url(#spHz)"/>
          <circle class="sp-radar" cx="100" cy="100" r="118"/><circle class="sp-radar" cx="100" cy="100" r="146"/><circle class="sp-radar" cx="100" cy="100" r="178"/>
          <circle class="sp-face" cx="100" cy="100" r="86"/>
          <circle class="sp-bezel" cx="100" cy="100" r="95"/>
          <path class="sp-track" d="${arc}"/>
          <path class="sp-track red" d="${red}"/>
          <path class="sp-fill" d="${arc}"/>
          ${ticks()}
          <path class="sp-wave" d="${wave}"/>
          <circle class="sp-ring" cx="100" cy="100" r="86"/><circle class="sp-ring b" cx="100" cy="100" r="86"/>
          <text class="sp-num" x="100" y="136" id="spNum">0</text>
          <text class="sp-unit" x="100" y="154">KM/SA</text>
          <text class="sp-ready" x="100" y="132">HAZIR</text>
          <line class="sp-readyline" x1="84" y1="143" x2="116" y2="143"/>
          <g class="sp-needle"><path d="M98.6 112 L101.4 112 L100.7 27 L99.3 27 Z"/><circle cx="100" cy="28" r="1.6"/></g>
          <g class="sp-pop"><circle class="sp-hub" cx="100" cy="100" r="7"/><circle class="sp-cap" cx="100" cy="100" r="2.2"/></g>
        </svg>
        <div class="sp-lamps">${LAMPS.map(([c,d])=>`<svg viewBox="0 0 24 24" class="${c}">${d}</svg>`).join("")}</div>
        <div class="sp-brand">
          <div class="sp-title">${title("OBD","w1",1.5)}${title("Takip","w2",1.64)}</div>
          <div class="sp-rule"></div>
          <div class="sp-tag">Aracının nabzı avucunda</div>
        </div>
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
    setTimeout(()=>e.remove(), 240);
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
      const ms=now-t0, v=Math.round(needleAt(ms)*VMAX);
      if(v!==last){ num.textContent=String(v); last=v; }
      if(!buzzed && ms>850+900*.55){ buzzed=true; if(settings.vibrate && navigator.vibrate) try{ navigator.vibrate(12); }catch(e){} }
      if(ms<1800) raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    // Solma 2,98 sn'de biter; öğe ondan sonra kaldırılır (kaldırma anında görünür bir sıçrama olmasın)
    timer=setTimeout(()=>{ if(el){ const e=el; el=null; e.remove(); } }, DUR+80);
    return true;
  }

  // Belirli bir ana dondur (görsel kontrol ve test için): tüm canlandırmalar durur, o milisaniyeye gider
  function seek(ms){
    if(!el) play(true);
    if(!el) return false;
    cancelAnimationFrame(raf); clearTimeout(timer);
    (el.getAnimations ? el.getAnimations({subtree:true}) : []).forEach(a=>{ a.pause(); a.currentTime=ms; });
    const n=el.querySelector("#spNum"); if(n) n.textContent=String(Math.round(needleAt(ms)*VMAX));
    return true;
  }

  // Açılışta (sayfa ön plandaysa)
  if(document.visibilityState!=="hidden") play(false);
  return {play, finish, seek, needleAt, get el(){ return el; }};
})();
