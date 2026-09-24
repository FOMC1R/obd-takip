// Sürüş başlayınca gösterge panelini ya da ön cam (HUD) görünümünü kendiliğinden açar.
// Kalıcı ayar: settings.autoView = "off" | "cluster" | "hud", settings.autoViewClose = true/false
// Kullanıcı elle kapatırsa aynı sürüşte yeniden açılmaz; araç bir süre durunca ya da yeni bağlantıda yeniden kurulur.
(function(){
  const ON_KMH=15, ON_MS=5000;         // bu hızın üstünde bu kadar süre kalınca aç
  const STOP_KMH=3;                    // bunun altı "duruyor"
  const REARM_MS=60000;                // elle kapatıldıysa: bu kadar durduktan sonra yeniden açılabilir
  const CLOSE_MS=120000;               // "durunca kapat" seçiliyse: bu kadar duruştan sonra kapat
  const GPS_MS=5000;                   // GPS hızı en fazla bu kadar eski olabilir

  if(settings.autoView===undefined) settings.autoView="off";
  if(settings.autoViewClose===undefined) settings.autoViewClose=false;

  const VIEW={
    cluster:()=>window.CLUSTER,
    hud:()=>window.HUD,
  };
  const isOpen=k=>{ const v=VIEW[k] && VIEW[k](); return !!(v && v.isOpen); };
  const anyOpen=()=>isOpen("cluster") || isOpen("hud");

  const A={moveSince:null, stopSince:null, dismissed:false, opened:null, closing:false};
  function reset(){ A.moveSince=null; A.stopSince=null; A.dismissed=false; A.opened=null; }

  // Hız: araçtan; yoksa taze GPS hızı
  function speed(now){
    const v=cur("0D"); if(v!=null) return v;
    const f=typeof REC!=="undefined" && REC.fix;
    return f && f.gs!=null && now-f.t<=GPS_MS ? f.gs : null;
  }

  function check(now=Date.now()){
    if(!S.active){ reset(); return; }
    // Açtığımız görünüm bizden habersiz kapandıysa kullanıcı kapatmıştır: bu sürüşte tekrar açma
    if(A.opened && !isOpen(A.opened)){ A.opened=null; A.dismissed=true; }
    const sp=speed(now);
    if(sp==null){ A.moveSince=null; return; }
    if(sp<STOP_KMH){ if(A.stopSince==null) A.stopSince=now; } else A.stopSince=null;
    const stoppedFor = A.stopSince==null ? 0 : now-A.stopSince;
    if(stoppedFor>=REARM_MS) A.dismissed=false;
    // Durunca kapat
    if(settings.autoViewClose && A.opened && stoppedFor>=CLOSE_MS){
      const v=VIEW[A.opened](); A.opened=null;
      try{ v && v.close && v.close(); }catch(e){}
      return;
    }
    if(sp>=ON_KMH){ if(A.moveSince==null) A.moveSince=now; } else A.moveSince=null;
    const mode=settings.autoView;
    if(!VIEW[mode] || A.dismissed || A.moveSince==null || now-A.moveSince<ON_MS) return;
    if(anyOpen() || (typeof document!=="undefined" && document.visibilityState==="hidden")) return;
    const v=VIEW[mode](); if(!v || !v.open) return;
    try{ v.open(); }catch(e){ return; }
    if(isOpen(mode)) A.opened=mode;
  }

  on("connect",reset);
  on("disconnect",reset);
  let timer=setInterval(()=>check(),1000);

  // ---- Ayarlar kartı ----
  const card=document.createElement("section"); card.className="card"; card.id="autoViewCard";
  card.innerHTML=`<h2>Sürüşte otomatik aç</h2>
    <p class="sub">Araç ${ON_MS/1000} saniye boyunca ${ON_KMH} km/sa üstünde gidince seçtiğin görünüm kendiliğinden açılır. Elle kapatırsan araç 1 dakika durana kadar yeniden açılmaz.</p>
    <div class="field"><label for="autoView">Ne açılsın?</label>
      <select id="autoView">
        <option value="off">Kapalı</option>
        <option value="cluster">Gösterge paneli</option>
        <option value="hud">Ön cam (HUD)</option>
      </select></div>
    <label class="check"><input type="checkbox" id="autoViewClose"> Araç 2 dakika durunca kapat</label>
    <p class="sub">Uygulama telefon ekranında açık olmalı; arka plandayken ya da ekran kapalıyken açılamaz. Tam ekran olmayabilir, görünüm yine de ekranı kaplar.</p>`;
  $("ext-ayar").appendChild(card);
  const sel=card.querySelector("#autoView") || $("autoView"), chk=card.querySelector("#autoViewClose") || $("autoViewClose");
  if(sel.setAttribute) sel.setAttribute("style","font:inherit;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--text);width:100%");
  function paint(){ sel.value=settings.autoView; chk.checked=!!settings.autoViewClose; }
  sel.addEventListener("change",e=>{ settings.autoView=e.target.value; save(); A.dismissed=false; });
  chk.addEventListener("change",e=>{ settings.autoViewClose=e.target.checked; save(); });
  paint();

  window.AUTOVIEW={check, reset, paint, get state(){ return {...A}; }, stopTimer(){ clearInterval(timer); timer=null; },
    ON_KMH, ON_MS, STOP_KMH, REARM_MS, CLOSE_MS};
})();
