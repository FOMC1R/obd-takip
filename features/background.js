// ---------- Arka planda çalışma ----------
// Telefonda sayfa arka plana geçince Chrome onu yavaşlatır ya da durdurur. Bu dosya üç şey yapar:
//  1) Küçük pencere (Picture-in-Picture): hız, devir, hararet ve en önemli uyarı, başka uygulamaya geçince
//     ekranın köşesinde kalır. Chrome görüntü oynatan sayfayı yavaşlatmaz; okuma sürer.
//  2) Kendiliğinden yeniden bağlanma: bağlantı koparsa aynı cihaza birkaç dakika boyunca yeniden bağlanmayı dener.
//     Başarırsa sürüş kaydı aynı sürüşte sürer, kesinti olaylara yazılır.
//  3) Ölçüm: arka plana geçiş, okuma boşlukları, geciken zamanlayıcılar, küçük pencere ve yeniden bağlanma
//     denemeleri bir iz listesine yazılır; tanılama paketine girer.
// Kalıcı ayarlar: settings.autoReconnect (varsayılan açık), settings.autoPip (varsayılan açık)
const BG = (()=>{
  const RETRY_FOR_MS = 3*60*1000;          // bu kadar süre yeniden bağlanmayı dene, sonra vazgeç
  const RETRY_STEPS = [1500, 3000, 5000, 8000, 12000, 15000];   // denemeler arası bekleme (sonuncusu tekrar eder)
  const OPEN_TIMEOUT = 12000;              // tek denemede cihazın açılmasını en fazla bu kadar bekle
  const GAP_MS = 4000;                     // okuma turları arası bundan uzunsa "boşluk" say
  const LATE_MS = 3000;                    // saniyelik zamanlayıcı bundan geç çalışırsa "gecikti" say
  const PIP_EVERY = 500;                   // küçük pencere çizim aralığı

  if(settings.autoReconnect===undefined) settings.autoReconnect=true;
  if(settings.autoPip===undefined) settings.autoPip=true;

  let navAt=0;   // navigasyon düğmesine en son basılan an (goNav)
  // ---- iz (ölçüm) ----
  const T = {list:[], hiddenAt:null, hiddenCount:0, longestHiddenMs:0, maxGapMs:0, maxLateMs:0, lastTick:0,
    pipOk:0, pipFail:0, reconnectOk:0, reconnectFail:0};
  function trace(k, extra){
    const e = {t:Date.now(), k, gizli:document.visibilityState==="hidden", pip:!!document.pictureInPictureElement, bagli:!!S.active, ...extra};
    T.list.push(e); if(T.list.length>300) T.list.shift();
    return e;
  }
  document.addEventListener("visibilitychange", ()=>{
    const now=Date.now();
    if(document.visibilityState==="hidden"){
      T.hiddenAt=now; T.hiddenCount++; trace("arka-plana-gecti");
      if(S.active) recEvent("info","Uygulama arka plana geçti");
      // navigasyon düğmesi küçük pencereyi az önce istediyse ikinci kez isteme
      if(settings.autoPip && S.active && !document.pictureInPictureElement && Date.now()-navAt>3000) openPip("otomatik");
    }else{
      const ms = T.hiddenAt ? now-T.hiddenAt : null; T.hiddenAt=null;
      if(ms!=null) T.longestHiddenMs=Math.max(T.longestHiddenMs, ms);
      trace("one-dondu", {ms});
      if(S.active && ms!=null) recEvent("info",`Uygulama öne döndü (${Math.round(ms/1000)} sn arka planda kaldı)`);
      if(R && !R.busy) attempt();   // kopmuşsa hemen dene
      paintCard();
    }
  });
  // Chrome'un sayfayı dondurup çözdüğü anlar (destekleyen sürümlerde)
  document.addEventListener("freeze", ()=>trace("donduruldu"));
  document.addEventListener("resume", ()=>trace("cozuldu"));
  window.addEventListener("pagehide", e=>trace("sayfa-gizlendi", {kalici:!!e.persisted}));
  window.addEventListener("pageshow", e=>{ if(e.persisted) trace("sayfa-geri-geldi"); });
  // Okuma turları arasındaki boşluk
  on("tick", ()=>{
    const now=Date.now();
    if(T.lastTick){ const ms=now-T.lastTick;
      if(ms>GAP_MS){ T.maxGapMs=Math.max(T.maxGapMs,ms); trace("okuma-boslugu", {ms}); } }
    T.lastTick=now;
  });
  on("connect", ()=>{ T.lastTick=0; });
  // Saniyelik zamanlayıcının gecikmesi: tarayıcının sayfayı ne kadar yavaşlattığını gösterir
  let beat=Date.now();
  setInterval(()=>{
    const now=Date.now(), late=now-beat-1000; beat=now;
    if(late>LATE_MS && S.active){ T.maxLateMs=Math.max(T.maxLateMs,late); trace("zamanlayici-gecikti", {ms:late}); }
  }, 1000);

  // ---- navigasyon uygulamaları (Android Chrome "intent:" adresi: paketi doğrudan açar; kurulu değilse Play Store) ----
  if(settings.navApp===undefined) settings.navApp="gmaps";
  const NAV={
    gmaps:{name:"Google Haritalar", pkg:"com.google.android.apps.maps"},
    yandex:{name:"Yandex Navigasyon", pkg:"ru.yandex.yandexnavi"},
    waze:{name:"Waze", pkg:"com.waze"},
    sor:{name:"Her seferinde sor (telefonun seçimi)", pkg:null},
  };
  function navUrl(k){
    const n=NAV[k]||NAV.gmaps;
    if(!n.pkg) return "geo:0,0";
    const store="https://play.google.com/store/apps/details?id="+n.pkg;
    return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${n.pkg};S.browser_fallback_url=${encodeURIComponent(store)};end`;
  }
  // Tek dokunuş: önce küçük pencere (dokunuş izniyle; Chrome'un kendiliğinden açmayı engellediği durumda da çalışır),
  // hemen ardından harita. İkisi aynı dokunuşun içinde başlar: bekleme yok (izin birkaç saniye geçerli).
  function goNav(why){
    navAt=Date.now();
    if(pipSupported && S.active && !document.pictureInPictureElement && vid.readyState>=1){
      vid.requestPictureInPicture().then(()=>{ T.pipOk++; trace("pip-acildi",{neden:"navigasyon"}); paintCard(); })
        .catch(e=>{ T.pipFail++; trace("pip-acilamadi",{neden:"navigasyon", hata:(e && e.name)||String(e)}); });
    }else if(pipSupported && S.active && !document.pictureInPictureElement) openPip("navigasyon");
    trace("navigasyon",{uygulama:settings.navApp, neden:why});
    try{ location.href=navUrl(settings.navApp); }catch(e){ trace("navigasyon-acilamadi",{hata:(e && e.name)||String(e)}); }
  }

  // ---- 1) küçük pencere ----
  const cv=document.createElement("canvas"); cv.width=640; cv.height=360;
  const vid=document.createElement("video");
  vid.muted=true; vid.playsInline=true; vid.setAttribute("aria-hidden","true");
  vid.style.cssText="position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none";
  const pipSupported = !!(document.pictureInPictureEnabled && cv.captureStream && vid.requestPictureInPicture);
  let pipTimer=null;

  const css = k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  function topAlarm(){
    let best=null;
    for(const a of (S.alarms||new Map()).values()) if(!best || (a.level==="crit" && best.level!=="crit")) best=a;
    return best;
  }
  function draw(){
    const x=cv.getContext("2d"); if(!x) return;
    const W=cv.width, H=cv.height, al=topAlarm();
    const bg=css("--bg")||"#111", text=css("--text")||"#fff", muted=css("--muted")||"#999";
    const crit=css("--crit")||"#e53935", warn=css("--warn")||"#f9a825";
    const numF=css("--f-num")||"sans-serif", bodyF=css("--f-body")||"sans-serif";
    x.fillStyle=bg; x.fillRect(0,0,W,H);
    const sp=cur("0D"), rpm=cur("0C"), cool=cur("05");
    // hız
    x.fillStyle=text; x.textAlign="left"; x.textBaseline="alphabetic";
    x.font=`700 150px ${numF}`; x.fillText(sp!=null?String(Math.round(sp)):"–", 28, 175);
    x.fillStyle=muted; x.font=`500 30px ${bodyF}`; x.fillText("km/sa", 34, 215);
    // sağ sütun: devir, hararet
    const row=(label,val,y,bad)=>{ x.textAlign="right"; x.fillStyle=muted; x.font=`500 26px ${bodyF}`; x.fillText(label, W-28, y-46);
      x.fillStyle=bad?crit:text; x.font=`700 54px ${numF}`; x.fillText(val, W-28, y); };
    row("devir", rpm!=null?String(Math.round(rpm)):"–", 95, S.g["0C"] && S.g["0C"].alarm);
    row("hararet", cool!=null?Math.round(cool)+"°":"–", 190, S.g["05"] && S.g["05"].alarm);
    // alt şerit: uyarı ya da bağlantı durumu
    let line, color=muted, fill=null;
    if(!S.active){ line = R ? "Bağlantı koptu · yeniden bağlanıyor…" : "Bağlı değil"; color=warn; }
    else if(al){ line=al.text; fill = al.level==="crit"?crit:warn; color="#fff"; }
    else line="Sorun yok";
    if(fill){ x.fillStyle=fill; x.fillRect(0,H-100,W,100); }
    x.fillStyle=color; x.textAlign="left"; x.font=`600 34px ${bodyF}`;
    const tw=t=>{ const m=x.measureText(t); return m ? m.width : 0; };
    let s=line; while(s.length>3 && tw(s)>W-56) s=s.slice(0,-2);
    if(s!==line) s=s.replace(/.$/,"…");
    x.fillText(s, 28, H-38);
  }
  function startDrawing(){ if(pipTimer) return; draw(); pipTimer=setInterval(draw, PIP_EVERY); }
  function stopDrawing(){ if(pipTimer){ clearInterval(pipTimer); pipTimer=null; } }
  async function prepare(){
    if(!vid.srcObject){ vid.srcObject=cv.captureStream(4); document.body.appendChild(vid); }
    startDrawing();
    if(vid.paused) await vid.play();
    if(vid.readyState<1) await new Promise(r=>vid.addEventListener("loadedmetadata",r,{once:true}));
  }
  async function openPip(why){
    if(!pipSupported){ trace("pip-desteklenmiyor",{neden:why}); return false; }
    try{
      await prepare();
      await vid.requestPictureInPicture();
      T.pipOk++; trace("pip-acildi",{neden:why}); paintCard(); return true;
    }catch(e){
      T.pipFail++; trace("pip-acilamadi",{neden:why, hata:(e && e.name)||String(e)});
      if(!document.pictureInPictureElement && !S.active) stopDrawing();
      paintCard(); return false;
    }
  }
  async function closePip(){ try{ if(document.pictureInPictureElement) await document.exitPictureInPicture(); }catch(e){} }
  vid.addEventListener("leavepictureinpicture", ()=>{ trace("pip-kapandi"); if(!S.active && !R) stopDrawing(); paintCard(); });
  // Chrome destekliyorsa: başka uygulamaya geçerken küçük pencereyi kendisi açar
  try{ navigator.mediaSession && navigator.mediaSession.setActionHandler("enterpictureinpicture", ()=>{ if(settings.autoPip && S.active) openPip("tarayici"); }); }
  catch(e){ trace("pip-otomatik-desteklenmiyor"); }
  // Bağlıyken görüntü oynasın: hem otomatik açılma için gerekli hem de pencere anında hazır olur
  on("connect", ()=>{ if(pipSupported) prepare().catch(e=>trace("pip-hazirlanamadi",{hata:(e && e.name)||String(e)})); });
  on("disconnect", ()=>{ if(!document.pictureInPictureElement) stopDrawing(); });

  // ---- 2) kendiliğinden yeniden bağlanma ----
  let R=null;   // {old, since, tries, busy, trip, timer}
  function reusable(l){
    return (typeof DemoLink!=="undefined" && l instanceof DemoLink)
      || (typeof SerialLink!=="undefined" && l instanceof SerialLink && l.port)
      || (typeof BleLink!=="undefined" && l instanceof BleLink && l.device);
  }
  function freshLink(old){
    if(old instanceof DemoLink){ const d=new DemoLink(); d.t0=old.t0; return d; }
    if(old instanceof SerialLink) return new SerialLink(old.port);
    return new BleLink(old.device);
  }
  const timeout=(p,ms)=>Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("zaman aşımı")),ms))]);

  const origLost = lost;
  lost = function(){
    if(!S.active) return;
    const old=S.link;
    if(!settings.autoReconnect || !reusable(old)) return origLost();
    if(ignitionOff()){ trace("kontak-kapandi",{}); return origLost(); }   // motor durmuştu: kopma değil, sürüşün sonu
    S.active=false;
    old.onLost=()=>{};   // eski bağlantının geç gelen kopma haberi yeni bağlantıyı düşürmesin
    try{ old.close(); }catch(e){}
    R={old, since:Date.now(), tries:0, busy:false, trip:REC.trip, timer:null};
    if(REC.trip) flush(REC.trip);   // bekleyen satırlar kopma sırasında kaybolmasın
    trace("baglanti-koptu",{tur:old.constructor.name});
    setStatus("busy","Bağlantı koptu · yeniden bağlanıyor…");
    raise("link","warn","OBD bağlantısı koptu, yeniden bağlanılıyor");
    paintCard();
    next();
  };
  function next(){
    if(!R) return;
    if(Date.now()-R.since > RETRY_FOR_MS) return giveUp();
    const ms=RETRY_STEPS[Math.min(R.tries, RETRY_STEPS.length-1)];
    clearTimeout(R.timer); R.timer=setTimeout(attempt, ms);
  }
  async function attempt(){
    if(!R || R.busy) return;
    const my=R; clearTimeout(my.timer); my.busy=true; my.tries++;
    const l=freshLink(my.old); let name;
    try{ name=await timeout(l.open(), OPEN_TIMEOUT); }
    catch(e){
      try{ l.close(); }catch(x){}
      trace("yeniden-baglanma-denemesi",{no:my.tries, sonuc:"acilamadi", hata:(e && e.message)||String(e)});
      my.busy=false; if(R===my) next(); return;
    }
    if(R!==my){ try{ l.close(); }catch(x){} return; }   // bu arada kullanıcı durdurdu
    l.open=async()=>name;   // cihaz açık; start() yeniden sormasın
    S.resuming=true;
    try{ await start(l); } finally{ S.resuming=false; }
    my.busy=false;
    if(R!==my) return;
    if(S.active){
      const gap=Math.round((Date.now()-my.since)/1000);
      trace("yeniden-baglandi",{no:my.tries, sn:gap}); T.reconnectOk++;
      recEvent("warn",`Yeniden bağlandı (${gap} sn kesinti)`);
      addLog("warn",`OBD cihazına yeniden bağlandı (${gap} sn kesinti)`);
      R=null; paintCard();
    }else{
      trace("yeniden-baglanma-denemesi",{no:my.tries, sonuc:"baslatilamadi"});
      setStatus("busy","Bağlantı koptu · yeniden bağlanıyor…"); $("btNotice").hidden=true;
      $("btnStop").hidden=false; $("btnConnect").hidden=true;   // deneme sürerken "Durdur" görünsün
      next();
    }
  }
  function giveUp(){
    const my=R; if(!my) return;
    clearTimeout(my.timer); R=null; T.reconnectFail++;
    trace("yeniden-baglanma-birakildi",{deneme:my.tries});
    setStatus("err","Bağlantı koptu"); drop("link");
    raise("link","crit","OBD cihazıyla bağlantı koptu");
    endRec(); uiIdle(); emit("disconnect");
    paintCard();
  }
  // Kullanıcı "Durdur"a basarsa (stop → disconnect) denemeyi bırak; sürüş kaydını stop() kapatır
  // (deneme o an sürüyorsa attempt() R'nin değiştiğini görüp açtığı bağlantıyı kapatır)
  on("disconnect", ()=>{ if(R){ clearTimeout(R.timer); trace("yeniden-baglanma-durduruldu"); R=null; paintCard(); } });
  // Yeniden bağlanınca yeni sürüş açma; kopan sürüş devam etsin
  const origStartRec = startRec;
  startRec = async function(device, demo){
    if(R && R.trip && REC.trip===R.trip){
      REC.lastFlush=Date.now(); REC.lastT=0;   // bekleyen satırlar (varsa) korunur, sonraki yazmada gider
      if(REC.gpsWatch==null && !REC.demo) startGps();
      $("recBadge").hidden=false;
      return;
    }
    return origStartRec(device, demo);
  };

  // ---- ayar kartı ----
  const card=document.createElement("section"); card.className="card"; card.setAttribute("aria-labelledby","bgTitle");
  card.innerHTML=`<h2 id="bgTitle">Navigasyon ve küçük pencere</h2>
    <p class="sub">Telefon, arka plandaki sayfayı yavaşlatır ya da durdurur. Başka uygulamaya (ör. harita) geçeceksen
    <b>küçük pencere</b>yi aç: hız, devir, hararet ve uyarılar köşede kalır, okuma sürer. Ekran kilitlenince okuma yine durur.
    Bağlıyken üst çubuktaki <b>navigasyon</b> düğmesi ikisini tek dokunuşta yapar: küçük pencereyi açar, seçtiğin haritaya geçer.</p>
    <div class="field"><label for="bgNav">Navigasyon uygulaması</label><select id="bgNav">
      ${Object.entries(NAV).map(([k,n])=>`<option value="${k}">${escHtml(n.name)}</option>`).join("")}</select></div>
    <div class="actions"><button class="primary" id="bgPip">Küçük pencereyi aç</button></div>
    <label class="check"><input type="checkbox" id="bgAutoPip"> Uygulamadan çıkınca küçük pencereyi kendiliğinden açmayı dene</label>
    <label class="check"><input type="checkbox" id="bgReconnect"> Bağlantı koparsa kendiliğinden yeniden bağlan (3 dakika dener)</label>
    <p class="sub" id="bgMsg" role="status"></p>`;
  $("ext-ayar").appendChild(card);
  $("bgAutoPip").checked=settings.autoPip; $("bgReconnect").checked=settings.autoReconnect;
  $("bgAutoPip").addEventListener("change",e=>{ settings.autoPip=e.target.checked; save(); });
  $("bgReconnect").addEventListener("change",e=>{ settings.autoReconnect=e.target.checked; save(); });
  $("bgPip").addEventListener("click",()=>{ document.pictureInPictureElement ? closePip() : openPip("dugme"); });

  $("bgNav").value=settings.navApp;
  $("bgNav").addEventListener("change",e=>{ settings.navApp=e.target.value; save(); });

  // Üst çubuk (her sekmede görünür): bağlıyken küçük pencere ve navigasyon simgeleri
  const SVG=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const mk=(id,label,icon)=>{ const b=document.createElement("button"); b.className="icon"; b.id=id; b.hidden=true;
    b.setAttribute("aria-label",label); b.title=label; b.innerHTML=SVG(icon); return b; };
  const bNav=mk("bgNavTop","Navigasyona geç",'<path d="M3 11l18-8-8 18-2-8z"/>'); bNav.hidden=false;   // her zaman görünür; bağlı değilken yalnız haritayı açar
  const bPip=mk("bgPipTop","Küçük pencere",'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor"/>');
  { const mute=$("btnMute"), top=mute && mute.parentNode; if(top && top.insertBefore){ top.insertBefore(bNav, mute); top.insertBefore(bPip, mute); } }
  bPip.addEventListener("click",()=>{ document.pictureInPictureElement ? closePip() : openPip("dugme"); });
  bNav.addEventListener("click",()=>goNav("ust-cubuk"));
  on("connect", ()=>paintCard()); on("disconnect", ()=>paintCard());

  function paintCard(){
    const inPip=!!document.pictureInPictureElement;
    $("bgPip").textContent = inPip ? "Küçük pencereyi kapat" : "Küçük pencereyi aç";
    $("bgPip").disabled = !pipSupported;
    bPip.hidden = !pipSupported || !(S.active || R); bPip.setAttribute("aria-pressed", String(inPip));
    const withPip = pipSupported && (S.active || R);
    bNav.setAttribute("aria-label", withPip ? "Navigasyona geç (küçük pencereyle)" : "Navigasyonu aç"); bNav.title=bNav.getAttribute("aria-label");
    const m=[];
    if(!pipSupported) m.push("Bu tarayıcı küçük pencereyi desteklemiyor.");
    if(R) m.push("Bağlantı koptu, yeniden bağlanılıyor…");
    if(T.hiddenCount) m.push(`Bu oturumda ${T.hiddenCount} kez arka plana geçti; en uzun ${Math.round(T.longestHiddenMs/1000)} sn.`
      + (T.maxGapMs ? ` En uzun okuma boşluğu ${Math.round(T.maxGapMs/1000)} sn.` : ""));
    if(T.reconnectOk || T.reconnectFail) m.push(`Yeniden bağlanma: ${T.reconnectOk} başarılı, ${T.reconnectFail} başarısız.`);
    $("bgMsg").textContent=m.join(" ");
  }
  paintCard();

  function report(){
    return {pipDestegi:pipSupported, otomatikPip:settings.autoPip, yenidenBaglan:settings.autoReconnect,
      ozet:{arkaPlanaGecis:T.hiddenCount, enUzunArkaPlanMs:T.longestHiddenMs, enUzunOkumaBoslukMs:T.maxGapMs,
        enUzunZamanlayiciGecikmesiMs:T.maxLateMs, pipAcildi:T.pipOk, pipAcilamadi:T.pipFail,
        yenidenBaglandi:T.reconnectOk, vazgecildi:T.reconnectFail},
      iz:T.list.map(e=>({...e, saat:new Date(e.t).toLocaleTimeString("tr-TR")}))};
  }

  return {trace, report, openPip, closePip, goNav, navUrl, NAV, buttons:{nav:bNav, pip:bPip}, draw, canvas:cv, video:vid, get pending(){ return R; }, attempt, giveUp, T};
})();
