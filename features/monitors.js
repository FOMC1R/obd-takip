// ---------- Aracın kendi test sonuçları (OBD mod 06) — Arıza sekmesi ----------
// Motor beyni katalizör, oksijen sensörü, EGR, yakıt sistemi gibi parçaları sürüş sırasında kendisi test eder ve
// her testin ölçülen değerini, alt/üst sınırını saklar. Değer sınırın dışındaysa test kalmıştır; arıza lambası
// henüz yanmadan önce görülebilir (erken uyarı). Yalnız okuma. Yalnız CAN'li araçlar (eski protokollerde biçim farklı).
// Cevap çözümü features/misfire.js'teki m6Messages / m6Records / m6Support ile ortak (9 baytlık kayıtlar).
// Test grubu (MID) ve test (TID) adları, birim ve ölçek (UAS ID) tablosu: SAE J1979 / ISO 15031-5
// (python-OBD'nin UnitsAndScaling ve mod 06 listesiyle karşılaştırıldı; kod kopyalanmadı).
const MONITORS = (()=>{
  const st={status:"idle", at:0, groups:null, busy:false, done:false};
  const h2=n=>n.toString(16).toUpperCase().padStart(2,"0");

  // ---- test grubu adları ----
  const B=(mid,base)=>{ const i=mid-base; return `${Math.floor(i/4)+1}. sıra`+(base===0x01||base===0x41?`, ${i%4+1}. sensör`:""); };
  function midName(m){
    if(m>=0x01 && m<=0x10) return `Oksijen sensörü (${B(m,0x01)})`;
    if(m>=0x21 && m<=0x24) return `Katalizör (${m-0x20}. sıra)`;
    if(m>=0x31 && m<=0x34) return `EGR — egzoz gazı geri besleme (${m-0x30}. sıra)`;
    if(m>=0x35 && m<=0x38) return `Değişken supap zamanlaması (${m-0x34}. sıra)`;
    if(m===0x39) return "Yakıt buharı sızdırmazlığı (depo kapağı açık / 0,150\")";
    if(m===0x3A) return "Yakıt buharı sızdırmazlığı (0,090\" delik)";
    if(m===0x3B) return "Yakıt buharı sızdırmazlığı (0,040\" delik)";
    if(m===0x3C) return "Yakıt buharı sızdırmazlığı (0,020\" delik)";
    if(m===0x3D) return "Yakıt buharı boşaltma akışı";
    if(m>=0x41 && m<=0x50) return `Oksijen sensörü ısıtıcısı (${B(m,0x41)})`;
    if(m>=0x61 && m<=0x64) return `Isıtmalı katalizör (${m-0x60}. sıra)`;
    if(m>=0x71 && m<=0x74) return `İkincil hava sistemi ${m-0x70}`;
    if(m>=0x81 && m<=0x84) return `Yakıt sistemi (${m-0x80}. sıra)`;
    if(m===0x85 || m===0x86) return `Turbo basınç kontrolü (${m-0x84}. sıra)`;
    if(m===0x90 || m===0x91) return `NOx tutucu (${m-0x8F}. sıra)`;
    if(m===0x98 || m===0x99) return `NOx katalizörü (${m-0x97}. sıra)`;
    if(m===0xB0 || m===0xB1) return `Partikül filtresi — DPF (${m-0xAF}. sıra)`;
    return `Test grubu ${h2(m)}`;
  }
  const TID={1:"Zengin→fakir eşik voltajı",2:"Fakir→zengin eşik voltajı",3:"Geçiş süresi için düşük voltaj",4:"Geçiş süresi için yüksek voltaj",
    5:"Zengin→fakir geçiş süresi",6:"Fakir→zengin geçiş süresi",7:"Test çevrimindeki en düşük voltaj",8:"Test çevrimindeki en yüksek voltaj",
    9:"Geçişler arası süre",10:"Sensör periyodu",11:"Son 10 sürüşün ortalama tekleme sayısı",12:"Bu sürüşteki tekleme sayısı"};
  const tidName=t=>TID[t] || (t>=0x80 ? `Üreticiye özel test (${h2(t)})` : `Test ${h2(t)}`);

  // ---- birim ve ölçek (UAS ID): [ölçek, birim, ek, işaretli] ----
  const U={0x01:[1,""],0x02:[0.1,""],0x03:[0.01,""],0x04:[0.001,""],0x05:[0.0000305,""],0x06:[0.000305,""],0x07:[0.25,"d/dk"],
    0x08:[0.01,"km/sa"],0x09:[1,"km/sa"],0x0A:[0.122,"mV"],0x0B:[0.001,"V"],0x0C:[0.01,"V"],0x0D:[0.00390625,"mA"],0x0E:[0.001,"A"],
    0x0F:[0.01,"A"],0x10:[1,"ms"],0x11:[100,"ms"],0x12:[1,"sn"],0x13:[1,"mΩ"],0x14:[1,"Ω"],0x15:[1,"kΩ"],0x16:[0.1,"°C",-40],
    0x17:[0.01,"kPa"],0x18:[0.0117,"kPa"],0x19:[0.079,"kPa"],0x1A:[1,"kPa"],0x1B:[10,"kPa"],0x1C:[0.01,"°"],0x1D:[0.5,"°"],
    0x1E:[0.0000305,""],0x1F:[0.05,""],0x20:[0.00390625,""],0x21:[1,"mHz"],0x22:[1,"Hz"],0x23:[1,"kHz"],0x24:[1,"adet"],0x25:[1,"km"],
    0x26:[0.1,"mV/ms"],0x27:[0.01,"g/sn"],0x28:[1,"g/sn"],0x29:[0.25,"Pa/sn"],0x2A:[0.001,"kg/sa"],0x2B:[1,"adet"],0x2C:[0.01,"g"],
    0x2D:[0.01,"mg"],0x2F:[0.01,"%"],0x30:[0.001526,"%"],0x31:[0.001,"L"],0x32:[0.0000305,"inç"],0x33:[0.00024414,""],0x34:[1,"dk"],
    0x35:[10,"ms"],0x36:[0.01,"g"],0x37:[0.1,"g"],0x38:[1,"g"],0x39:[0.01,"%",-327.68],0x3A:[0.001,"g"],0x3B:[0.0001,"g"],0x3C:[0.1,"µs"],
    0x3D:[0.01,"mA"],0x3E:[0.00006103516,"mm²"],0x3F:[0.01,"L"],0x40:[1,"ppm"],0x41:[0.01,"µA"],
    0x81:[1,"",0,1],0x82:[0.1,"",0,1],0x83:[0.01,"",0,1],0x84:[0.001,"",0,1],0x85:[0.0000305,"",0,1],0x86:[0.000305,"",0,1],0x87:[1,"ppm",0,1],
    0x8A:[0.122,"mV",0,1],0x8B:[0.001,"V",0,1],0x8C:[0.01,"V",0,1],0x8D:[0.00390625,"mA",0,1],0x8E:[0.001,"A",0,1],0x90:[1,"ms",0,1],
    0x96:[0.1,"°C",0,1],0x99:[0.1,"kPa",0,1],0x9C:[0.01,"°",0,1],0x9D:[0.5,"°",0,1],0xA8:[1,"g/sn",0,1],0xA9:[0.25,"Pa/sn",0,1],
    0xAD:[0.01,"mg",0,1],0xAE:[0.1,"mg",0,1],0xAF:[0.01,"%",0,1],0xB0:[0.003052,"%",0,1],0xB1:[2,"mV/sn",0,1],
    0xFC:[0.01,"kPa",0,1],0xFD:[0.001,"kPa",0,1],0xFE:[0.25,"Pa",0,1]};
  function scale(uas, raw){
    const u=U[uas]; if(!u) return null;
    const v = u[3] && raw>=0x8000 ? raw-0x10000 : raw;
    return v*u[0]+(u[2]||0);
  }
  const decOf=uas=>{ const s=(U[uas]||[1])[0]; return s>=1?0:s>=0.1?1:s>=0.01?2:3; };

  // Sonuç: geçti / sınırda (sınır aralığının %10'u içinde) / kaldı. Değer = sınır da geçer sayılır.
  function judge(r){
    // SAE J1979: test henüz tamamlanmadıysa sınırlar (ve çoğu zaman değer) 0 bildirilir. Bu "kaldı" değil "yapılmadı":
    // gerçek veride kodlar silindikten sonra katalizör testi her sürüş başında 0/0 sınırla "sınır dışı" görünüyordu.
    if(r.min===0 && r.max===0 && r.uas!==0x2E) return {state:"notrun"};
    if(r.uas===0x2E) return {state: r.val ? "ok" : "fail"};
    const v=scale(r.uas,r.val), lo=scale(r.uas,r.min), hi=scale(r.uas,r.max);
    if(v==null) return {state:"unknown"};
    if(v<lo || v>hi) return {state:"fail", v, lo, hi};
    const span=hi-lo, margin=span>0 ? Math.min(v-lo, hi-v)/span : 1;
    return {state: margin<0.1 && span>0 ? "near" : "ok", v, lo, hi};
  }

  async function read(){
    if(!S.elm || !S.active || st.busy) return;
    if(S.paused){ setTimeout(read, 3000); return; }   // ölçüm (0-100, akü testi) sürüyor: araya girme, sonra dene
    st.busy=true; st.status="busy"; paint();
    try{
      if(!S.isCan){ st.status="nocan"; st.groups=null; return; }
      const sup=new Set();
      for(let base=0; base<=0xE0; base+=0x20){
        const r=await q("06"+h2(base),4000); if(!r) break;
        const s=m6Support(r,base); s.forEach(x=>sup.add(x));
        if(!s.has(base+0x20)) break;
      }
      const mids=[...sup].filter(m=>m%0x20!==0 && !(m>=0xA1 && m<=0xAD)).sort((a,b)=>a-b);   // tekleme ayrı kartta
      const groups=[];
      for(const mid of mids){
        while(S.paused && S.active) await wait(300);   // ölçüm başladıysa bitmesini bekle
        const r=await q("06"+h2(mid),4000); if(!r) continue;
        const tests=m6Records(r).filter(x=>x.mid===mid).map(x=>({...x, name:tidName(x.tid), unit:(U[x.uas]||[0,""])[1], dec:decOf(x.uas), ...judge(x)}));
        if(tests.length) groups.push({mid, name:midName(mid), tests});
      }
      st.groups=groups; st.at=Date.now(); st.status=groups.length?"ok":"none";
      const fails=groups.flatMap(g=>g.tests.filter(t=>t.state==="fail").map(t=>`${g.name}: ${t.name}`));
      const near=groups.flatMap(g=>g.tests.filter(t=>t.state==="near").map(t=>`${g.name}: ${t.name}`));
      S.diag={...(S.diag||{}), monitors:{groups:groups.length, tests:groups.reduce((s,g)=>s+g.tests.length,0), fails, near}};
      if(fails.length) raise("m06","warn",`Aracın kendi testinde ${fails.length} sonuç sınır dışı: ${fails[0]}`, "Aracın kendi testlerinden biri sınırın dışında");
      else drop("m06");
    }catch(e){ console.error("mod 06:", e); st.status="err"; }
    finally{ st.busy=false; paint(); }
  }

  // ---- kart ----
  const css=document.createElement("style");
  css.textContent=`
.m6-g{border-top:1px solid var(--line);padding-top:8px;margin-top:8px}
.m6-g h3{margin:0 0 6px;font-size:15px}
.m6-t{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 0}
.m6-t span{font-size:14px}.m6-t small{grid-column:1/2;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.m6-t .chip{grid-row:1/3;grid-column:2;align-self:center}
.m6-sum{font-weight:600}`;
  document.head.appendChild(css);
  const card=document.createElement("section"); card.className="card"; card.id="m6Card";
  card.innerHTML=`<div class="row"><h2 style="margin-right:auto">Aracın kendi test sonuçları</h2><button id="m6Btn" disabled>Oku</button></div>
    <p class="sub">Motor beyni katalizör, oksijen sensörü, EGR gibi parçaları sürüş sırasında kendisi test eder. Değer sınırın dışındaysa o parça
    zayıflıyor olabilir; arıza lambası yanmadan önce görülebilir. Sonuçlar son tamamlanan teste aittir.</p>
    <div id="m6Box"><p class="empty">Bağlanınca okunur.</p></div>`;
  $("ext-ariza").appendChild(card);
  $("m6Btn").addEventListener("click",read);
  const chip={ok:'<span class="chip info">Geçti</span>', near:'<span class="chip warn">Sınırda</span>', fail:'<span class="chip crit">Kaldı</span>', notrun:'<span class="chip">Henüz yapılmadı</span>', unknown:'<span class="chip">?</span>'};
  const num=(v,d)=>v==null?"–":fmt(v,d);
  function paint(){
    $("m6Btn").disabled=!S.active || st.busy;
    const box=$("m6Box");
    if(st.status==="busy"){ box.innerHTML='<p class="empty">Okunuyor…</p>'; return; }
    if(st.status==="nocan"){ box.innerHTML='<p class="empty">Bu araç eski bir iletişim türü kullanıyor; test sonuçları bu yolla okunamıyor.</p>'; return; }
    if(st.status==="none"){ box.innerHTML='<p class="empty">Araç test sonucu vermedi. Bazı araçlar bunu desteklemez ya da testler henüz tamamlanmamıştır.</p>'; return; }
    if(st.status==="err"){ box.innerHTML='<p class="empty">Okunamadı. Tekrar dene.</p>'; return; }
    if(!st.groups){ box.innerHTML=`<p class="empty">${S.active?"Oku düğmesine bas.":"Bağlanınca okunur."}</p>`; return; }
    const all=st.groups.flatMap(g=>g.tests), f=all.filter(t=>t.state==="fail").length, n=all.filter(t=>t.state==="near").length,
      z=all.filter(t=>t.state==="notrun").length;
    let h=`<p class="m6-sum">${all.length} test: ${all.length-f-n-z} geçti${n?`, ${n} sınırda`:""}${f?`, <span style="color:var(--crit)">${f} kaldı</span>`:""}${z?`, ${z} henüz yapılmadı`:""}.</p>`;
    if(z) h+=`<p class="sub">"Henüz yapılmadı": araç bu testi son kod silmeden ya da akü sökülmesinden beri tamamlamamış. Birkaç normal sürüşte kendiliğinden yapılır.</p>`;
    for(const g of st.groups){
      h+=`<div class="m6-g"><h3>${escHtml(g.name)}</h3>`;
      for(const t of g.tests){
        const u=t.unit?" "+escHtml(t.unit):"";
        h+=`<div class="m6-t"><span>${escHtml(t.name)}</span>${chip[t.state]||""}<small>${t.state==="notrun"?"sonuç yok":t.uas===0x2E?(t.val?"tamam":"değil"):`${num(t.v,t.dec)}${u} · sınır ${num(t.lo,t.dec)} – ${num(t.hi,t.dec)}${u}`}</small></div>`;
      }
      h+=`</div>`;
    }
    box.innerHTML=h;
  }
  // Bağlantıdaki ilk araç bilgisi taramasından sonra bir kez oku
  on("connect",()=>{ st.done=false; st.groups=null; st.status="idle"; paint(); });
  on("diag",()=>{ if(S.active && !st.done){ st.done=true; setTimeout(read, 800); } });
  on("disconnect",()=>{ drop("m06"); paint(); });
  paint();

  // ---- deneme modu: oksijen sensörü, katalizör (sınırda), EGR, ısıtıcı, yakıt sistemi ----
  const o=DemoLink.prototype.reply;
  const w=n=>h2((n>>8)&255)+h2(n&255);
  const rec=(mid,tid,uas,v,lo,hi)=>h2(mid)+h2(tid)+h2(uas)+w(v)+w(lo)+w(hi);
  const isoTp=d=>{ const n=d.length/2, out=[n.toString(16).toUpperCase().padStart(3,"0")]; let i=0,k=0;
    while(i<d.length){ const take=(k===0?6:7)*2; out.push(k.toString(16).toUpperCase()+":"+d.slice(i,i+take).padEnd(take,"0")); i+=take; k++; } return out.join("\r"); };
  const DEMO={
    0x01:[[0x01,0x0A,3688,3000,4000],[0x05,0x10,62,0,100],[0x06,0x10,70,0,100]],     // 450 mV eşik; geçiş süreleri
    0x02:[[0x07,0x0A,820,0,1640],[0x08,0x0A,6150,4100,8200]],
    0x21:[[0x80,0x1E,30800,0,32768]],                                                  // katalizör verimi oranı: sınıra yakın
    0x31:[[0x80,0x27,420,300,900]],
    0x41:[[0x81,0x14,6,3,12]],
    0x81:[[0x80,0x39,32768+410,32768-2500,32768+2500]]                                  // yakıt ayarı % (ofsetli)
  };
  DemoLink.prototype.reply=function(cmd){
    const m=/^06([0-9A-F]{2})$/.exec(cmd); if(!m) return o.call(this,cmd);
    const mid=parseInt(m[1],16), d=DEMO[mid];
    if(!d) return o.call(this,cmd);
    const body="46"+d.map(r=>rec(mid,...r)).join("");
    return body.length>14 ? isoTp(body) : body;
  };

  return {read, judge, scale, midName, tidName, st, paint};
})();
