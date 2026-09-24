// ---------- Anonim kullanım istatistiği (GoatCounter) ----------
// Amaç: uygulamayı kaç kişinin, ne sıklıkla ve hangi bölümleriyle kullandığını görmek.
// Gönderilen: sayfa açılışı, ekran boyutu ve kaba olay adları ("baglanti/klasik", "gun/4-7" gibi).
// Gönderilmeyen: kimlik numarası, çerez, konum, şase numarası, cihaz adı, değerler, arıza kodları.
// GoatCounter IP ve tarayıcı bilgisini diske yazmaz; ziyaretçiyi 8 saatlik geçici oturumla ayırır.
// Harici betik yüklenmez: her sayım https://<kod>.goatcounter.com/count adresine tek bir resim isteğidir.
// Kullanım sıklığı telefonda sayılır (kaç farklı gün açıldı, son açılıştan bu yana kaç gün) ve
// yalnızca aralık olarak gönderilir; kişiyi ayırt eden bir kimlik yoktur.
const USAGE = (()=>{
  const CODE="obd-takip";
  const ENDPOINT=`https://${CODE}.goatcounter.com/count`;
  const KEY="obdTakip.usage";          // {days, last, first, queue:[]}
  const QMAX=50;
  if(settings.usageStats===undefined) settings.usageStats=true;

  // Yerel geliştirme, dosyadan açma ve testlerde gönderme
  const live = ()=>{ if(typeof window!=="undefined" && window.__usageLive) return true;   // yalnız testler
    try{ return location.protocol==="https:" && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname); }catch(e){ return false; } };
  const load = ()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||"null")||{}; }catch(e){ return {}; } };
  const store = st=>{ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} };
  const sent=new Set();   // bu açılışta gönderilen olaylar (her olay oturumda bir kez)

  function url(p, ev, extra){
    const q=new URLSearchParams({p, rnd:String(Math.random()).slice(2,10)});
    if(ev) q.set("e","true");
    if(extra) for(const k in extra) q.set(k, extra[k]);
    return ENDPOINT+"?"+q.toString();
  }
  function fire(u){
    try{ const i=new Image(); i.referrerPolicy="no-referrer"; i.src=u; return true; }catch(e){ return false; }
  }
  // Çevrimdışıysa kuyruğa al, bağlantı gelince gönder
  function send(u){
    if(!settings.usageStats) return false;
    if(typeof navigator!=="undefined" && navigator.onLine===false){
      const st=load(); st.queue=(st.queue||[]).concat(u).slice(-QMAX); store(st); return false;
    }
    return fire(u);
  }
  function flush(){
    if(!settings.usageStats || !live()) return;
    const st=load(); if(!st.queue || !st.queue.length) return;
    const q=st.queue; st.queue=[]; store(st);
    q.forEach(fire);
  }
  // Olay: yalnızca küçük harf, rakam, "/", "-"; oturumda bir kez
  function event(name){
    name=String(name).toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g,c=>({ç:"c",ğ:"g",ı:"i",ö:"o",ş:"s",ü:"u"}[c])).replace(/[^a-z0-9\/-]+/g,"-");
    if(sent.has(name)) return false;
    sent.add(name);
    if(!live()) return false;
    return send(url(name, true));
  }

  const bucket=(n,edges)=>{ for(const [max,label] of edges) if(n<=max) return label; return edges[edges.length-1][1]; };
  // Günde bir kez: toplam kaç farklı gün kullanıldı ve iki kullanım arası kaç gün geçti
  function daily(now=Date.now()){
    const st=load(), today=new Date(now).toDateString();
    if(st.last===today) return null;
    const prev=st.lastT, first=!st.days;
    st.days=(st.days||0)+1; st.last=today; st.lastT=now; if(!st.first) st.first=now;
    store(st);
    const out=[];
    out.push(first ? "kullanim/ilk-gun" : "kullanim/gun-"+bucket(st.days,[[2,"2"],[3,"3"],[7,"4-7"],[14,"8-14"],[30,"15-30"],[90,"31-90"],[Infinity,"90+"]]));
    if(prev){ const gap=Math.round((now-prev)/86400000);
      out.push("kullanim/ara-"+bucket(gap,[[1,"1-gun"],[3,"2-3-gun"],[7,"4-7-gun"],[30,"8-30-gun"],[Infinity,"30+-gun"]])); }
    return out;
  }

  function linkKind(){
    if(typeof DemoLink!=="undefined" && S.link instanceof DemoLink) return "deneme";
    if(typeof SerialLink!=="undefined" && S.link instanceof SerialLink) return "klasik";
    if(typeof BleLink!=="undefined" && S.link instanceof BleLink) return "ble";
    return "diger";
  }
  function brand(){
    try{ const v=(settings.vehicles||{})[settings.activeVehicle]; return v && v.marka ? v.marka : "bilinmiyor"; }catch(e){ return "bilinmiyor"; }
  }

  // ---- açılış ----
  function start(){
    if(!live() || !settings.usageStats) return;
    let s=""; try{ s=[screen.width, screen.height, window.devicePixelRatio||1].join(","); }catch(e){}
    send(url("/", false, {t:"OBD Takip", s}));
    (daily()||[]).forEach(event);
    try{ if(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) event("kurulum/ana-ekrandan"); }catch(e){}
    flush();
  }

  // ---- olaylar ----
  on("connect", info=>{
    const k=linkKind(); event("baglanti/"+k);
    if(k==="deneme") return;
    event("arac/yakit-"+(settings.fuel||"bilinmiyor"));
    event("arac/marka-"+brand());
    if(S.isCan!=null) event("arac/"+(S.isCan?"can":"eski-protokol"));
  });
  on("tripEnd", t=>{
    if(t && t.demo) return;
    const km=(t && t.odo) || 0;
    event("surus/"+bucket(km,[[5,"0-5-km"],[20,"5-20-km"],[60,"20-60-km"],[Infinity,"60+-km"]]));
  });
  on("dtc", (dtc)=>{ if(S.link && typeof DemoLink!=="undefined" && S.link instanceof DemoLink) return;
    const n=dtc && dtc.stored ? dtc.stored.length : 0; event(n ? "ariza/kod-var" : "ariza/kod-yok"); });
  // Bölümler: alt çubuktaki sekmeler
  document.querySelectorAll("#tabbar button").forEach(b=>b.addEventListener("click",()=>event("bolum/"+b.dataset.tab)));
  // Panel ve HUD: açılış fonksiyonlarını sar (stil sayımı da)
  function wrap(obj, name, ev){
    if(!obj || typeof obj[name]!=="function") return;
    const o=obj[name]; obj[name]=function(){ const r=o.apply(this, arguments); try{ ev(); }catch(e){} return r; };
  }
  wrap(window.CLUSTER, "open", ()=>event("ekran/panel-"+((settings.cluster||{}).style||"modern")));
  wrap(window.HUD, "open", ()=>event("ekran/hud-"+((settings.hud||{}).style||"klasik")));

  // ---- Ayarlar kartı ----
  const card=document.createElement("section"); card.className="card"; card.id="usageCard";
  card.innerHTML=`<h2>Kullanım istatistiği</h2>
    <label class="check"><input type="checkbox" id="usageOn"> Anonim kullanım istatistiği gönder</label>
    <p class="sub">Uygulamayı geliştirmek için yalnızca kaç kişinin, ne sıklıkla ve hangi bölümleri kullandığı sayılır
    (ör. "bugün 12 kişi açtı, 5'i HUD'u kullandı"). Kimlik, konum, şase numarası, araç değerleri ve arıza kodları
    gönderilmez; çerez kullanılmaz. Sayaç: GoatCounter (açık kaynak, reklamsız).</p>`;
  const host=$("ext-ayar"); if(host && host.appendChild) host.appendChild(card);
  const cb=$("usageOn");
  if(cb){ cb.checked=!!settings.usageStats;
    cb.addEventListener("change",e=>{ settings.usageStats=e.target.checked; save();
      if(!settings.usageStats){ const st=load(); st.queue=[]; store(st); } }); }

  try{ window.addEventListener("online", flush); }catch(e){}
  start();
  return {event, daily, url, flush, live, get sent(){ return sent; }, CODE};
})();
