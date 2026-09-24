// Gösterge paneli: yeni arabalardaki ekran gösterge paneli gibi — solda hız, sağda devir (elektrikli araçta güç)
// saati, ortada seçilebilir bilgi sayfası ve küçük göstergeler (su, yakıt/batarya, akü), üstte uyarı lambaları.
// Kadranlar <canvas> ile çizilir; rakamlar ve sayfalar düz yazıdır (keskin ve test edilebilir).
// Kalıcı ayar: settings.cluster = {bright:"oto"|"gunduz"|"gece", accent, page, style}
// Stiller: modern (parlayan yay + kısa ibre), klasik (ortadan dönen ibre, krom çerçeve),
// spor (bölmeli ışık çubuğu, ibre yok), sade (ince yay, çentiksiz; gece için)
(function(){
  const DEF={bright:"oto", accent:"buz", page:0, style:"modern", check:true};
  if(settings.cluster===undefined) settings.cluster={};
  for(const k in DEF) if(settings.cluster[k]===undefined) settings.cluster[k]=DEF[k];

  // Renkler: koyu lacivert-siyah zemin, soğuk beyaz rakamlar, tek vurgu rengi; sarı/kırmızı yalnızca uyarıda
  const ACCENTS={buz:"#42c8ff", nane:"#34e0b4", mor:"#a08cff", turuncu:"#ff8a1f", beyaz:"#e6edf7"};
  const ACCENT_NAME={buz:"Buz mavisi", nane:"Nane", mor:"Mor", turuncu:"Turuncu", beyaz:"Beyaz"};
  const STYLES=["modern","klasik","spor","sade"];
  const STYLE_NAME={modern:"Modern", klasik:"Klasik", spor:"Spor", sade:"Sade"};
  const style=()=>STYLES.includes(settings.cluster.style) ? settings.cluster.style : "modern";
  const C={ink:"#e8eef7", mute:"#7d8ba3", dim:"rgba(170,190,220,.32)", amber:"#ffb020", red:"#ff3b30", green:"#35d07f"};
  const BRIGHT={gunduz:1, gece:.6};
  const BRIGHT_NAME={oto:"Otomatik", gunduz:"Gündüz", gece:"Gece"};
  const PAGES=["Yolculuk","Tüketim","Motor","Saat"];

  const css=document.createElement("style");
  css.textContent=`
/* Tek ölçü birimi --u: tüm panel (kadranlar, orta alan, lambalar, yazılar) ekranla orantılı büyür/küçülür.
   Dikey düzen 100u × 190u, yatay düzen 226u × 100u kutuya sığacak şekilde hesaplanır (.cl kutusuna göre). */
@property --u{syntax:"<length>";inherits:true;initial-value:4px}
.cl{position:fixed;inset:0;z-index:1001;overflow:hidden;color:#e8eef7;user-select:none;-webkit-user-select:none;touch-action:manipulation;container-type:size;
  background:radial-gradient(120% 90% at 50% 45%,#0e1a2e 0%,#070c17 55%,#03050a 100%);font-family:var(--f-num);--ca:#42c8ff}
.cl-in{position:absolute;inset:0;display:grid;box-sizing:border-box;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);
  --u:min(calc(96cqw / 100), calc(96cqh / 190));
  grid-template-columns:calc(var(--u)*96);grid-template-areas:"top" "spd" "al" "mid";
  justify-content:center;align-content:center;justify-items:center;align-items:center;gap:calc(var(--u)*2.4)}
.cl-top{grid-area:top;width:100%;display:grid;grid-template-columns:1fr auto;grid-template-areas:"c o" "t t";align-items:center;row-gap:calc(var(--u)*2)}
.cl-clock{grid-area:c;font-size:calc(var(--u)*4.6);font-weight:600;color:#c9d4e4;font-variant-numeric:tabular-nums;letter-spacing:.02em;display:flex;align-items:center;gap:calc(var(--u)*2)}
.cl-rec{font:700 calc(var(--u)*2.6)/1 var(--f-body);color:#ff5b50;letter-spacing:.1em}
.cl-rec::before{content:"";display:inline-block;width:.8em;height:.8em;border-radius:50%;background:#ff3b30;margin-right:.35em;vertical-align:-.05em}
.cl-out{grid-area:o;justify-self:end;font-size:calc(var(--u)*4.2);font-weight:600;color:#7d8ba3;font-variant-numeric:tabular-nums}
.cl-tt{grid-area:t;display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.6);justify-content:center;min-height:calc(var(--u)*8)}
.cl-tt i{display:grid;place-items:center;width:calc(var(--u)*8);height:calc(var(--u)*8);color:rgba(160,180,210,.2);transition:color .2s}
.cl-tt i svg{width:100%;height:100%;display:block}
.cl-tt i b{font:800 calc(var(--u)*2.5)/1 var(--f-body);letter-spacing:.04em}
.cl-tt i.amber{color:#ffb020;filter:drop-shadow(0 0 5px rgba(255,176,32,.55))}
.cl-tt i.red{color:#ff3b30;filter:drop-shadow(0 0 5px rgba(255,59,48,.6))}
.cl-tt i.blue{color:#3d8bff;filter:drop-shadow(0 0 5px rgba(61,139,255,.6))}
.cl-tt i.green{color:#35d07f;filter:drop-shadow(0 0 5px rgba(53,208,127,.55))}
.cl-tt i.flash{animation:clflash .5s steps(2) infinite}
@keyframes clflash{50%{color:rgba(160,180,210,.2);filter:none}}
@media (prefers-reduced-motion:reduce){.cl-tt i.flash{animation:none}}
.cl-tt i[hidden]{display:none}
.cl-dial{position:relative;aspect-ratio:1;container-type:inline-size}
.cl-dial canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.cl-spd{grid-area:spd;width:calc(var(--u)*84)}
.cl-mid{grid-area:mid;width:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"rpm panel" "mini mini";gap:calc(var(--u)*3) calc(var(--u)*2.4);align-items:center}
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
.cl-panel{position:relative;width:100%;min-height:calc(var(--u)*34);box-sizing:border-box;padding:calc(var(--u)*2.8) calc(var(--u)*2.8) calc(var(--u)*5);border-radius:calc(var(--u)*4);cursor:pointer;
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(160,190,230,.10);display:grid;align-content:center;gap:calc(var(--u)*1.8)}
.cl-ph{font:600 calc(var(--u)*2.7)/1 var(--f-body);letter-spacing:.16em;text-transform:uppercase;color:var(--ca)}
.cl-kv{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2.2)}
.cl-kv div{min-width:0}
.cl-kv b{display:block;font-size:calc(var(--u)*5.8);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;color:#eef3fa}
.cl-kv b small{font-size:.5em;color:#7d8ba3;font-weight:600;margin-left:.2em}
.cl-kv span{display:block;font:500 calc(var(--u)*2.5)/1.2 var(--f-body);color:#7d8ba3;margin-top:calc(var(--u)*.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-big{font-size:calc(var(--u)*10);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;color:#f2f6fc}
.cl-big small{font-size:.34em;color:#7d8ba3;margin-left:.25em}
.cl-bar{height:calc(var(--u)*1.8);border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
.cl-bar i{display:block;height:100%;border-radius:99px;background:var(--ca);box-shadow:0 0 10px var(--ca)}
.cl-note{font:500 calc(var(--u)*2.8)/1.3 var(--f-body);color:#7d8ba3}
.cl-time{font-size:calc(var(--u)*13);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;text-align:center;color:#f2f6fc}
.cl-date{font:500 calc(var(--u)*3.1)/1.3 var(--f-body);color:#9aa8bd;text-align:center}
.cl-dots{position:absolute;left:0;right:0;bottom:calc(var(--u)*1.8);display:flex;justify-content:center;gap:calc(var(--u)*1.4)}
.cl-dots i{width:calc(var(--u)*1.4);height:calc(var(--u)*1.4);border-radius:50%;background:rgba(255,255,255,.16)}
.cl-dots i.on{background:var(--ca)}
/* küçük göstergeler */
.cl-mini{width:100%;display:flex;justify-content:center;gap:calc(var(--u)*2.4)}
.cl-m{flex:1 1 0;max-width:calc(var(--u)*27);min-width:0;display:grid;justify-items:center;line-height:1}
.cl-m svg{width:100%;height:auto;display:block;overflow:visible}
.cl-m b{font-size:calc(var(--u)*4.4);font-weight:600;font-variant-numeric:tabular-nums;margin-top:calc(var(--u)*.7);color:#e8eef7}
.cl-m span{font:600 calc(var(--u)*2.3)/1 var(--f-body);letter-spacing:.12em;text-transform:uppercase;color:#7d8ba3;margin-top:calc(var(--u)*.9)}
.cl-m.warn b{color:#ffb020}.cl-m.bad b{color:#ff3b30}
.cl-m[hidden]{display:none}
/* süren tehlike: ortada kırmızı yazı */
.cl-alert{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 46px);transform:translateX(-50%);width:max-content;max-width:88vw;z-index:3;
  background:#e0201a;color:#fff;border-radius:calc(var(--u)*3);padding:calc(var(--u)*2.4) calc(var(--u)*4.6);font:700 calc(var(--u)*4.8)/1.2 var(--f-body);text-align:center;box-shadow:0 0 0 4px rgba(0,0,0,.6),0 0 40px rgba(255,40,30,.45)}
.cl.alarm{box-shadow:inset 0 0 0 4px #ff3b30}
/* kontrol çubuğu (dokununca 4 sn) */
.cl-ctl{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:4;display:grid;grid-template-columns:1fr 1fr;gap:8px;
  background:rgba(8,12,22,.94);padding:10px;border-radius:16px;border:1px solid rgba(160,190,230,.18);backdrop-filter:blur(6px)}
.cl-ctl button{min-height:52px;background:#121a2a;color:#e8eef7;border:1px solid rgba(160,190,230,.2);border-radius:12px;font:600 15px/1.15 var(--f-body);padding:6px 4px}
.cl-ctl button.x{border-color:var(--ca);color:var(--ca)}
/* stiller */
.cl.st-klasik{background:radial-gradient(110% 85% at 50% 40%,#171a21 0%,#0a0c11 60%,#030405 100%)}
.cl.st-klasik .cl-read{place-content:start center;padding-top:60cqw}
.cl.st-klasik .cl-num,.cl.st-klasik .cl-rpm .cl-num{font-size:13cqw;text-shadow:none}
.cl.st-klasik .cl-unit{font-size:4.6cqw;margin-top:.8cqw}
.cl.st-klasik .cl-lim{bottom:auto;top:25cqw;width:11cqw;height:11cqw;font-size:4.6cqw;border-width:1.2cqw}
.cl.st-klasik .cl-sub{bottom:auto;top:30cqw;font-size:4.4cqw}
.cl.st-klasik .cl-panel{border-radius:10px;border-color:rgba(200,210,225,.16)}
.cl.st-spor{background:radial-gradient(120% 90% at 50% 45%,#1f1113 0%,#0c0708 55%,#030202 100%)}
.cl.st-spor .cl-num{font-style:italic;font-weight:700;text-shadow:0 0 22px rgba(255,120,80,.16)}
.cl.st-spor .cl-kv b,.cl.st-spor .cl-big,.cl.st-spor .cl-time{font-style:italic;font-weight:700}
.cl.st-spor .cl-panel{border-radius:6px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01));border-color:rgba(255,255,255,.09);border-left:3px solid var(--ca)}
.cl.st-sade{background:#000}
.cl.st-sade .cl-num{font-weight:500;text-shadow:none}
.cl.st-sade .cl-panel{background:none;border-color:rgba(255,255,255,.07)}
.cl.st-sade .cl-bar i{box-shadow:none}
.cl.st-sade .cl-m svg path{filter:none!important}
@media (orientation:landscape){
  .cl-in{--u:min(calc(97cqw / 226), calc(97cqh / 100));
    grid-template-columns:calc(var(--u)*84) calc(var(--u)*54) calc(var(--u)*84);grid-template-rows:auto calc(var(--u)*84);
    grid-template-areas:"top top top" "spd mid rpm";column-gap:calc(var(--u)*2);row-gap:calc(var(--u)*2)}
  .cl-top{grid-template-columns:1fr auto 1fr;grid-template-areas:"c t o"}
  .cl-tt{gap:calc(var(--u)*1.4);min-height:calc(var(--u)*7)}
  .cl-tt i{width:calc(var(--u)*7);height:calc(var(--u)*7)}
  .cl-tt i b{font-size:calc(var(--u)*2.2)}
  .cl-spd{width:100%}
  .cl-mid{display:contents}
  .cl-rpm{grid-area:rpm;width:100%}
  .cl-center{grid-area:mid;width:100%;height:100%;display:grid;grid-template-rows:1fr auto;gap:calc(var(--u)*3);padding-block:calc(var(--u)*3) calc(var(--u)*13);box-sizing:border-box}
  .cl-ctl{grid-template-columns:repeat(6,1fr);left:50%;right:auto;transform:translateX(-50%);width:min(94vw,960px)}
  /* yatayda iki kadranın arasındaki alt boşluk: rakamları kapatmaz */
  .cl-alert{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + var(--u)*2);max-width:calc(var(--u)*110);font-size:calc(var(--u)*4.2)}
}
@media (orientation:portrait){ .cl-alert{grid-area:al;position:static;transform:none;max-width:100%}
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
  ICON.serv='<svg viewBox="0 0 48 48"><path fill="currentColor" d="M31 5a11 11 0 0 0-10.4 14.6L6.3 33.9a4.5 4.5 0 0 0 6.4 6.4l14.3-14.3A11 11 0 0 0 42 17l-6.3 6.3-6.4-1.7-1.7-6.4L34 9a11 11 0 0 0-3-4z"/></svg>';
  ICON.ready='<b>READY</b>';
  const TT_ORDER=["mil","batt","temp","oil","fuel","serv","ready","link"];
  const TT_NAME={mil:"Motor arıza lambası (yanıp sönüyorsa tekleme)", batt:"Şarj / akü", temp:"Motor sıcaklığı (mavi: soğuk, kırmızı: hararet)", oil:"Yağ sıcaklığı",
    fuel:"Yakıt azaldı", serv:"Servis: bekleyen arıza kodu ya da bakım zamanı", ready:"Elektrikli araç sürüşe hazır", link:"Bağlantı koptu"};
  // Açılış gösterge kontrolü: her lamba kendi renginde yanar, ibreler sona gidip döner
  const CHECK_COLOR={mil:"amber", batt:"red", temp:"red", oil:"red", fuel:"amber", serv:"amber", ready:"green", link:"red"};
  const CHECK_MS=2200, SWEEP_UP_MS=900;

  const H={open:false, el:null, pushed:false, fs:false, barT:null, timer:null, raf:null, lastDraw:0, mil:false,
    dials:{}, reduce:false, font:"", onResize:null, swipe:null};
  const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const btn=(txt,fn,cls)=>{ const b=mk("button",cls||null,txt); b.type="button"; b.addEventListener("click",e=>{ e.stopPropagation(); fn(b); showBar(); }); return b; };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const isEv=()=>typeof EVA!=="undefined" && EVA.isEv ? EVA.isEv() : settings.fuel==="elektrik";
  const accent=()=>ACCENTS[settings.cluster.accent]||ACCENTS.buz;
  const lim=pid=>settings.lim[pid]||{};
  // Hız sınırı: bulunduğun yolun sınırı (features/speedlimit.js) varsa o, yoksa elle girilen
  const spdMax=()=>{ try{ const w=window.SPEEDLIM; if(w && w.now) return w.now().v; }catch(e){} return lim("0D").max; };
  const rafFn=typeof requestAnimationFrame==="function" ? requestAnimationFrame : (f=>setTimeout(()=>f(Date.now()),33));
  const cafFn=typeof cancelAnimationFrame==="function" ? cancelAnimationFrame : clearTimeout;

  // ---------- Değerler ----------
  function socNow(){ const a=cur("EV_SOC"); return a!=null ? a : cur("5B"); }
  function speedState(sp){
    const L=spdMax(); if(sp==null || !L) return "";
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
    const misfire=[...al.keys()].some(k=>k.startsWith("misfire"));
    // gerçek araçlardaki gibi: tekleme sürerken arıza lambası yanıp söner
    out.mil = misfire ? "amber flash" : (al.has("mil") || H.mil || stored>0) ? "amber" : "";
    const v=cur("42"), rpm=cur("0C"), running=ev ? S.active : (rpm!=null && rpm>400);
    // motor çalışırken şarj yok: kırmızı; motor dururken akü zayıf (12,2 V altı): sarı
    out.batt = (al.has("g42") || (running && v!=null && v<13.0)) ? "red" : (!running && !ev && v!=null && v<12.2) ? "amber" : "";
    const w=cur("05"), wm=lim("05").max;
    out.temp = (al.has("g05") || (w!=null && wm!=null && w>=wm)) ? "red" : (running && w!=null && w<50) ? "blue" : "";
    const pending=S.dtc && S.dtc.pending ? S.dtc.pending.length : 0;
    out.serv = (pending>0 || al.has("maint")) ? "amber" : "";
    out.ready = ev ? (S.active ? "green" : "") : null;
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
    const recEl=mk("span","cl-rec","KAYIT"); recEl.hidden=true; recEl.title="Sürüş kaydediliyor";
    const clockT=mk("span",null,""); clock.append(clockT,recEl);
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
    const bS=btn("",()=>{ settings.cluster.style=STYLES[(STYLES.indexOf(style())+1)%STYLES.length]; save(); applyView(); });
    const bT=btn("",()=>{ settings.cluster.check=!settings.cluster.check; save(); applyView(); if(settings.cluster.check) startCheck(); });
    bar.append(bS,bC,bB,bP,bT,bK); o.appendChild(bar);
    o.addEventListener("click",showBar);
    Object.assign(H,{el:o, inn, bar, clock:clockT, recEl, outT, tts, limEl, sub, panel, pbody, dotEls, minis, alertEl:alert, btns:{bB,bP,bC,bS,bT}});
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
    H.btns.bS.textContent="Stil: "+STYLE_NAME[style()];
    H.btns.bT.textContent="Açılış testi: "+(settings.cluster.check?"Açık":"Kapalı");
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
    const sp=cur("0D"), ss=speedState(sp), L=spdMax();
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
    const chk=checking();
    for(const k of TT_ORDER){ const e=H.tts[k], s=tt[k];
      if(chk && s!==null){ e.hidden=false; e.className=CHECK_COLOR[k]; continue; }   // araçta olmayan lamba (ör. benzinlide READY) testte de yanmaz
      e.hidden=(s===null); e.className=s||""; }
    H.recEl.hidden=!(REC.trip && S.active);
    // üst satır
    const now=new Date();
    H.clock.textContent=now.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    const out=cur("46"); H.outT.textContent = out!=null ? fmt(out,0)+" °C" : "";
    renderMinis(); renderPage();
    // süren tehlike
    const txt=alertText();
    H.alertEl.hidden=!txt; if(txt) H.alertEl.textContent=txt;
    const cls="cl st-"+style()+(txt?" alarm":"");
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
    const s=scale(d.kind), px=d.size, st=style(), key=[st,d.kind,px,s.max,s.red,accent(),spdMax()].join("|");
    if(d.faceKey===key && d.face) return d.face;
    const f=d.face || mk("canvas"); f.width=px; f.height=px;
    const ctx=f.getContext && f.getContext("2d"); d.face=f; d.faceKey=key;
    if(!ctx) return f;
    const c=px/2, R=px/2*0.96;
    ctx.clearRect(0,0,px,px);
    if(st==="klasik") faceKlasik(ctx,d,s,c,R);
    else if(st==="spor") faceSpor(ctx,d,s,c,R);
    else if(st==="sade") faceSade(ctx,d,s,c,R);
    else faceModern(ctx,d,s,c,R);
    if(st!=="sade") limMark(ctx,d,s,c,R);
    return f;
  }
  // hız sınırı işareti: dış kenarda küçük üçgen
  function limMark(ctx,d,s,c,R){
    if(d.kind!=="spd" || !spdMax()) return;
    const a=ang(s,spdMax()), r0=R*1.0, r1=R*0.9;
    ctx.fillStyle=C.red;
    ctx.beginPath();
    ctx.moveTo(c+r1*Math.cos(a),c+r1*Math.sin(a));
    ctx.lineTo(c+r0*Math.cos(a-0.035),c+r0*Math.sin(a-0.035));
    ctx.lineTo(c+r0*Math.cos(a+0.035),c+r0*Math.sin(a+0.035));
    ctx.closePath(); ctx.fill();
  }
  const isMajor=(s,v)=>Math.abs((v-s.min)%s.major)<1e-6 || Math.abs(v)%s.major<1e-6;
  function ticks(ctx,s,c,R,{maj0,min0,r1,majW,minW,majC,minC,hotC,skipMinor}){
    for(let v=s.min; v<=s.max+1e-6; v+=s.minor){
      const a=ang(s,v), major=isMajor(s,v);
      if(skipMinor && !major) continue;
      const hot=(s.red!=null && v>=s.red) || (s.zero!=null && v<0);
      ctx.strokeStyle= hot ? (s.zero!=null?"rgba(120,230,170,.9)":hotC) : major ? majC : minC;
      ctx.lineWidth=R*(major?majW:minW);
      const r0=R*(major?maj0:min0);
      ctx.beginPath(); ctx.moveTo(c+r0*Math.cos(a),c+r0*Math.sin(a)); ctx.lineTo(c+R*r1*Math.cos(a),c+R*r1*Math.sin(a)); ctx.stroke();
    }
  }
  function numbers(ctx,d,s,c,R,{rr,size,weight,italic,col}){
    const fs=R*size;
    ctx.font=`${italic?"italic ":""}${weight} ${fs.toFixed(1)}px ${fontFam()}`; ctx.textAlign="center"; ctx.textBaseline="middle";
    for(let v=s.min; v<=s.max+1e-6; v+=s.major){
      const a=ang(s,v);
      ctx.fillStyle= (s.red!=null && v>=s.red) ? "#ff6a60" : (s.zero!=null && v<0) ? "#6fe0a4" : col;
      ctx.fillText(s.label(v), c+R*rr*Math.cos(a), c+R*rr*Math.sin(a)+fs*0.04);
    }
  }
  // Klasik: koyu kadran, krom çerçeve, uzun çentikler, ortadan dönen ibre
  function faceKlasik(ctx,d,s,c,R){
    ctx.fillStyle=rgrad(ctx,c,c*0.85,R*0.1,R,[[0,"#1b212c"],[.7,"#0d1017"],[1,"#07080c"]]);
    ctx.beginPath(); ctx.arc(c,c,R*0.97,0,Math.PI*2); ctx.fill();
    ctx.lineWidth=R*0.035;
    ctx.strokeStyle=lgrad(ctx,0,c-R,0,c+R,[[0,"#e3e9f2"],[.35,"#7c8594"],[.7,"#3a404a"],[1,"#9aa3b1"]]);
    ctx.beginPath(); ctx.arc(c,c,R*0.975,0,Math.PI*2); ctx.stroke();
    if(s.red!=null){ ctx.strokeStyle="rgba(230,40,30,.85)"; ctx.lineWidth=R*0.06;
      ctx.beginPath(); ctx.arc(c,c,R*0.895,ang(s,s.red),A0+SWEEP); ctx.stroke(); }
    if(s.zero!=null){ ctx.strokeStyle="rgba(53,208,127,.6)"; ctx.lineWidth=R*0.04;
      ctx.beginPath(); ctx.arc(c,c,R*0.895,A0,ang(s,0)); ctx.stroke(); }
    ctx.lineCap="butt";
    ticks(ctx,s,c,R,{maj0:0.8,min0:0.87,r1:0.93,majW:0.022,minW:0.01,majC:"#f1f4f8",minC:"rgba(220,228,240,.55)",hotC:"#ff7a70"});
    numbers(ctx,d,s,c,R,{rr:0.68,size:d.kind==="spd"?0.11:0.14,weight:600,col:"#f1f4f8"});
  }
  // Spor: bölmeli ışık çubuğu; sönük bölmeler yüzde, yananlar her karede
  const SEG=44;
  function segs(ctx,s,c,R,col,from,to,dim){
    const step=SWEEP/SEG, gap=step*0.28;
    for(let i=0;i<SEG;i++){
      const a0=A0+i*step, a1=a0+step-gap, mid=s.min+(s.max-s.min)*(i+0.5)/SEG;
      if(!dim && (a1<from-1e-6 || a0>to+1e-6)) continue;
      const hot=s.red!=null && mid>=s.red;
      ctx.strokeStyle= dim ? (hot?"rgba(255,59,48,.22)":"rgba(255,255,255,.07)") : (hot?C.red:col);
      ctx.beginPath(); ctx.arc(c,c,R*0.81,a0,a1); ctx.stroke();
    }
  }
  function faceSpor(ctx,d,s,c,R){
    ctx.lineCap="butt"; ctx.lineWidth=R*0.12;
    segs(ctx,s,c,R,null,0,0,true);
    ctx.strokeStyle="rgba(255,255,255,.14)"; ctx.lineWidth=Math.max(1,R*0.01);
    ctx.beginPath(); ctx.arc(c,c,R*0.955,A0,A0+SWEEP); ctx.stroke();
    ticks(ctx,s,c,R,{maj0:0.92,min0:0.92,r1:0.99,majW:0.02,minW:0,majC:"rgba(240,244,250,.9)",minC:"transparent",hotC:"#ff6a60",skipMinor:true});
    numbers(ctx,d,s,c,R,{rr:0.6,size:d.kind==="spd"?0.1:0.125,weight:700,italic:true,col:"rgba(236,240,246,.85)"});
  }
  // Sade: yalnızca ince yol ve kırmızı bölge
  function faceSade(ctx,d,s,c,R){
    ctx.lineCap="round"; ctx.lineWidth=R*0.02; ctx.strokeStyle="rgba(255,255,255,.09)";
    ctx.beginPath(); ctx.arc(c,c,R*0.88,A0,A0+SWEEP); ctx.stroke();
    if(s.red!=null){ ctx.strokeStyle="rgba(255,59,48,.6)"; ctx.beginPath(); ctx.arc(c,c,R*0.88,ang(s,s.red),A0+SWEEP); ctx.stroke(); }
    if(d.kind==="spd" && spdMax()){ const a=ang(s,spdMax()); ctx.fillStyle=C.red;
      ctx.beginPath(); ctx.arc(c+R*0.96*Math.cos(a),c+R*0.96*Math.sin(a),R*0.022,0,Math.PI*2); ctx.fill(); }
  }
  function faceModern(ctx,d,s,c,R){
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
    const from = s.zero!=null ? ang(s,0) : A0, to=ang(s,v), st=style();
    if(st==="klasik"){   // ortadan dönen, uca doğru incelen ibre + göbek
      const ca=Math.cos(to), sa=Math.sin(to), nx=-sa, ny=ca, r0=-R*0.16, r1=R*0.9, w0=R*0.032, w1=R*0.007;
      ctx.save(); ctx.shadowColor="rgba(0,0,0,.6)"; ctx.shadowBlur=R*0.03; ctx.fillStyle=col;
      ctx.beginPath();
      ctx.moveTo(c+r0*ca+nx*w0, c+r0*sa+ny*w0); ctx.lineTo(c+r1*ca+nx*w1, c+r1*sa+ny*w1);
      ctx.lineTo(c+r1*ca-nx*w1, c+r1*sa-ny*w1); ctx.lineTo(c+r0*ca-nx*w0, c+r0*sa-ny*w0);
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle=rgrad(ctx,c,c-R*0.02,0,R*0.075,[[0,"#5b6472"],[1,"#15181e"]]);
      ctx.beginPath(); ctx.arc(c,c,R*0.075,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="rgba(220,228,240,.35)"; ctx.lineWidth=Math.max(1,R*0.008);
      ctx.beginPath(); ctx.arc(c,c,R*0.075,0,Math.PI*2); ctx.stroke();
      return;
    }
    if(st==="spor"){   // yanan bölmeler
      ctx.save(); ctx.lineCap="butt"; ctx.lineWidth=R*0.12; ctx.shadowColor=col; ctx.shadowBlur=R*0.05;
      segs(ctx,s,c,R,col,Math.min(from,to),Math.max(from,to),false); ctx.restore();
      return;
    }
    if(st==="sade"){   // ince yay ve uçta nokta
      ctx.save(); ctx.lineCap="round"; ctx.lineWidth=R*0.02; ctx.strokeStyle=col;
      ctx.beginPath(); ctx.arc(c,c,R*0.88,Math.min(from,to),Math.max(from,to)); ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(c+R*0.88*Math.cos(to),c+R*0.88*Math.sin(to),R*0.035,0,Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
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
    const chk=checking(), up=chk && !H.reduce && now-H.checkT<SWEEP_UP_MS;
    for(const d of Object.values(H.dials)){
      const s=scale(d.kind);
      // açılış testi: önce ölçeğin sonuna, sonra gerçek değere (değer yoksa sıfıra)
      const tg = up ? s.max : (chk && !H.reduce && d.target==null) ? (s.zero!=null?0:s.min) : d.target;
      if(tg==null){ d.shown=null; }
      else if(d.shown==null && chk && !H.reduce){ d.shown=s.zero!=null?0:s.min; moving=true; }
      else if(d.shown==null || H.reduce){ d.shown=tg; }
      else {
        const k=1-Math.exp(-dt/(chk?160:110));
        d.shown+= (tg-d.shown)*k;
        if(Math.abs(tg-d.shown) < (s.max-s.min)*0.0015) d.shown=tg; else moving=true;
      }
      sizeCanvas(d); drawDial(d);
    }
    H.lastDraw=now; H.force=false;
    if(moving || chk) H.raf=rafFn(frame);
  }
  function checking(){ return H.checkT!=null && Date.now()-H.checkT<CHECK_MS; }
  function startCheck(){
    if(!H.open || !settings.cluster.check) return;
    H.checkT=Date.now();
    for(const d of Object.values(H.dials)) d.shown=null;
    clearTimeout(H.checkTimer);
    H.checkTimer=setTimeout(()=>{ H.checkT=null; H.checkTimer=null; update(); kick(true); }, CHECK_MS+50);
    update(); kick(true);
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
    startCheck();
  }
  function close(fromPop){
    if(!H.open) return;
    H.open=false;
    clearInterval(H.timer); H.timer=null;
    clearTimeout(H.barT); H.barT=null;
    clearTimeout(H.checkTimer); H.checkTimer=null; H.checkT=null;
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
  on("connect",()=>startCheck());   // panel açıkken bağlanınca: kontak açılışı gibi
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

  window.CLUSTER={open, close, update, applyView, cyclePage, telltales, alertText, scale, ang, STYLES, startCheck,
    get checking(){ return checking(); }, get recEl(){ return H.recEl; },
    get btns(){ return H.btns; },
    get isOpen(){ return H.open; }, get dials(){ return H.dials; }, get minis(){ return H.minis; }, get page(){ return H.page; },
    get el(){ return H.el; }, get limEl(){ return H.limEl; }, get sub(){ return H.sub; }, get tts(){ return H.tts; },
    get timers(){ return {interval:H.timer, raf:H.raf, bar:H.barT, resize:H.onResize, check:H.checkTimer}; }, frame:()=>{ H.force=true; if(H.raf!=null){ cafFn(H.raf); H.raf=null; } frame(); }};
})();
