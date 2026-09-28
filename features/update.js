// ---------- Yeni sürüm uyarısı ----------
// Açılışta, uygulamaya her dönüşte ve 30 dakikada bir yayındaki index.html'in sürümüne (APP_VERSION) bakılır.
// Çalışan sürümden yeniyse üstte "Yeni sürüm hazır — Yenile" çıkar. Bağlıyken yenileme bağlantıyı keseceği için
// bu da yazılır; kullanıcı istediği an yeniler (kendiliğinden yenilenmez).
const UPDATE = (()=>{
  const EVERY = 30*60*1000;
  const num = v=>String(v||"").split(".").map(Number);
  const newer = (a,b)=>{ const x=num(a), y=num(b); for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d>0; } return false; };
  const st = {latest:null, last:0, busy:false};

  const box=document.createElement("div"); box.className="notice"; box.id="updNotice"; box.hidden=true; box.setAttribute("role","status");
  box.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap";
  box.innerHTML=`<span id="updText" style="flex:1 1 180px"></span><button class="primary" id="updBtn">Yenile</button><button id="updLater">Sonra</button>`;
  const anchor=$("btNotice");
  if(anchor && anchor.parentNode && anchor.parentNode.insertBefore) anchor.parentNode.insertBefore(box, anchor); else document.body.appendChild(box);

  function paint(){
    if(!st.latest || !newer(st.latest, APP_VERSION)) { box.hidden=true; return; }
    $("updText").textContent = `Yeni sürüm hazır: ${st.latest} (şu an ${APP_VERSION}).`
      + (S.active ? " Yenilersen araç bağlantısı kesilir; sürüş kaydı kaydedilir." : "");
    box.hidden=false;
  }
  async function check(force){
    if(st.busy || (!force && Date.now()-st.last<60000)) return;
    if(location.protocol==="file:") return;
    st.busy=true; st.last=Date.now();
    try{
      const r=await fetch("index.html?surum="+Date.now(), {cache:"no-store"});
      if(r.ok){ const m=(await r.text()).match(/const APP_VERSION = "([\d.]+)"/); if(m) st.latest=m[1]; }
    }catch(e){ /* çevrimdışı: sessiz geç */ }
    finally{ st.busy=false; }
    paint();
  }
  async function reload(){
    try{ if(S.active) stop(); }catch(e){}
    try{ const reg=navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if(reg) await reg.update(); }catch(e){}
    setTimeout(()=>location.reload(), 300);
  }
  $("updBtn").addEventListener("click", reload);
  $("updLater").addEventListener("click", ()=>{ box.hidden=true; });
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") check(false); });
  setInterval(()=>check(false), EVERY);
  on("connect", paint); on("disconnect", paint);
  setTimeout(()=>check(true), 4000);   // açılışı yavaşlatmasın
  return {check, newer, paint, st};
})();
