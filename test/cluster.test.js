// Gösterge paneli: açılış, rakamların çekirdek değerlerle aynılığı, uyarı lambaları (arıza lambası, şarj, su),
// hız sınırı rengi, süren tehlike yazısı, bilgi sayfaları, elektrikli kipte güç ve batarya, kapatınca sayaçların durması
require("./harness")(String.raw`
  const CL=window.CLUSTER;
  if(!CL) throw new Error("CLUSTER yok");
  settings.record=true;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d);
  CL.open();
  if(!CL.isOpen) throw new Error("açılmadı");
  const tm=CL.timers; if(tm.interval==null || tm.resize==null) throw new Error("açılışta sayaç kurulmadı");
  await wait(4000);
  CL.update(); CL.frame();
  const D=CL.dials;
  console.log("hız:", D.spd.num.textContent, "| devir:", D.rpm.num.textContent, D.rpm.unit.textContent, "| su:", CL.minis.w.state.text, "| yakıt:", CL.minis.f.state&&CL.minis.f.state.text, "| akü:", CL.minis.v.state.text);
  if(D.spd.num.textContent!==fmt(cur("0D"),0)) throw new Error("hız çekirdekle aynı değil");
  if(D.rpm.num.textContent!==fmt(cur("0C"),0) || D.rpm.kind!=="rpm") throw new Error("devir çekirdekle aynı değil");
  if(CL.minis.w.state.text!==fmt(cur("05"),0)+" °C") throw new Error("su sıcaklığı yanlış");
  if(CL.minis.v.state.text!==fmt(cur("42"),1)+" V") throw new Error("akü yanlış");
  if(cur("2F")==null || CL.minis.f.el.hidden || CL.minis.f.state.text!=="%"+fmt(cur("2F"),0)) throw new Error("yakıt seviyesi yanlış");
  // ibre animasyonu hedefe varır (canlı değer değişmeden)
  S.paused=true; await wait(1200);
  for(let i=0;i<40;i++) CL.frame();
  if(Math.abs(D.spd.shown-D.spd.target)>0.5) throw new Error("ibre hedefe varmadı: "+D.spd.shown+" / "+D.spd.target);
  // ölçek: 0-220 km/sa, 20'şer; devir kırmızı bölgesi ayardan
  const sc=CL.scale("spd"), rc=CL.scale("rpm");
  if(sc.max!==220 || sc.major!==20 || rc.red!==settings.lim["0C"].max || rc.max<8000) throw new Error("ölçek yanlış");
  if(Math.abs(CL.ang(sc,110)-Math.PI*1.5)>1e-9) throw new Error("110 km/sa tepe noktasında değil");

  // hız sınırı rengi
  const lim=settings.lim["0D"].max, st=S.g["0D"];
  st.v=lim+5; st.ts=Date.now(); CL.update();
  if(!D.spd.num.className.includes("over") || D.spd.state!=="over") throw new Error("sınır aşımında kırmızı değil");
  st.v=lim-2; st.ts=Date.now(); CL.update();
  if(!D.spd.num.className.includes("near")) throw new Error("sınıra yakınken sarı değil");
  st.v=lim-30; st.ts=Date.now(); CL.update();
  if(D.spd.num.className!=="cl-num") throw new Error("normal hızda renkli");
  if(CL.limEl.textContent!==String(lim)) throw new Error("sınır işareti yok");

  // uyarı lambaları
  [...S.alarms.keys()].forEach(k=>S.alarms.delete(k)); S.dtc.stored=[]; emit("dtc",S.dtc,false); CL.update();
  let tt=CL.telltales(); console.log("lambalar (temiz):", JSON.stringify(tt));
  if(tt.mil || tt.batt || tt.temp || tt.link) throw new Error("uyarı yokken lamba yanıyor");
  // arıza lambası: MIL uyarısı, dtc kancası ya da kayıtlı kod
  raise("mil","crit","Motor arıza lambası yandı",false); CL.update();
  if(CL.telltales().mil!=="amber" || CL.tts.mil.className!=="amber") throw new Error("MIL uyarısında arıza lambası yanmadı");
  drop("mil"); CL.update(); if(CL.telltales().mil) throw new Error("MIL kalkınca sönmedi");
  emit("dtc",S.dtc,true); if(CL.telltales().mil!=="amber") throw new Error("dtc kancasında MIL yanmadı");
  emit("dtc",S.dtc,false);
  S.dtc.stored=["P0301"]; if(CL.telltales().mil!=="amber") throw new Error("kayıtlı kodda lamba yanmadı");
  S.dtc.stored=[];
  // şarj: motor çalışırken 13 V altı
  const sv=S.g["42"], sr=S.g["0C"];
  sr.v=900; sr.ts=Date.now(); sv.v=12.6; sv.ts=Date.now(); CL.update();
  if(CL.telltales().batt!=="red") throw new Error("şarj yokken akü lambası yanmadı");
  sr.v=0; sr.ts=Date.now(); if(CL.telltales().batt) throw new Error("motor dururken akü lambası yandı");
  sr.v=900; sv.v=14.1; sv.ts=Date.now(); if(CL.telltales().batt) throw new Error("şarj varken akü lambası yandı");
  raise("g42","crit","Akü / şarj voltajı: 11,2 V (alt sınır 12)",false); if(CL.telltales().batt!=="red") throw new Error("voltaj uyarısında lamba yanmadı");
  drop("g42");
  // su sıcaklığı: uyarı ya da sınırın üstü; uyarı yazısı ortada
  const sw=S.g["05"]; sw.v=90; sw.ts=Date.now(); CL.update();
  if(CL.telltales().temp) throw new Error("normal suda lamba yandı");
  if(CL.minis.w.state.state!=="") throw new Error("normal su renkli");
  raise("g05","crit","Soğutma suyu sıcaklığı: 112 °C (üst sınır 110)",false); sw.v=112; sw.ts=Date.now(); CL.update();
  const at=CL.alertText(); console.log("uyarı yazısı:", at, "| panel sınıfı:", CL.el.className);
  if(CL.telltales().temp!=="red" || CL.tts.temp.className!=="red") throw new Error("su uyarısında lamba yanmadı");
  if(at!=="SOĞUTMA SUYU SICAKLIĞI 112"+String.fromCharCode(160)+"°C" || !CL.el.className.includes("alarm")) throw new Error("uyarı yazısı yok");
  if(CL.minis.w.state.state!=="bad") throw new Error("su göstergesi kırmızı değil");
  drop("g05"); sw.v=90; CL.update();
  if(CL.el.className.includes("alarm")) throw new Error("uyarı kalktı ama panel kırmızı");
  // arıza kodu uyarısı ortada yazı çıkarmaz (yalnızca lamba)
  raise("dtcP0301","crit","deneme kod",false); CL.update();
  if(CL.alertText()) throw new Error("arıza kodu uyarısı ortada yazı çıkardı"); drop("dtcP0301");
  // bağlantı koptu
  raise("link","crit","Bağlantı koptu",false); CL.update();
  if(CL.telltales().link!=="red" || CL.alertText()!=="BAĞLANTI KOPTU") throw new Error("bağlantı lambası/yazısı yok");
  drop("link"); CL.update();

  // bilgi sayfaları: dört sayfa sırayla
  settings.cluster.page=0; CL.update();
  const heads=[]; for(let i=0;i<4;i++){ heads.push(CL.page.head); CL.cyclePage(1); }
  console.log("sayfalar:", heads.join(" → "), "| dönüş:", CL.page.head);
  if(heads.join(",")!=="Yolculuk,Tüketim,Motor,Saat" || CL.page.index!==0) throw new Error("sayfalar yanlış");
  if(!/km/.test(CL.page.html) || !/Ortalama hız/.test(CL.page.html)) throw new Error("yolculuk sayfası eksik");
  CL.cyclePage(1); if(!/L\/(100 km|sa)/.test(CL.page.html)) throw new Error("tüketim sayfası birimi yok");
  CL.cyclePage(1); if(!/Motor yükü/.test(CL.page.html) || !/Akü/.test(CL.page.html)) throw new Error("motor sayfası eksik");
  CL.cyclePage(-2);
  // gece parlaklığı: iç kısım kısılır
  settings.cluster.bright="gece"; CL.applyView();
  if(CL.el._kids[0].style.filter!=="brightness(0.6)") throw new Error("gece parlaklığı uygulanmadı");
  settings.cluster.bright="oto"; CL.applyView();

  // kapat: sayaçlar durur
  S.paused=false;
  CL.close();
  const t2=CL.timers;
  if(CL.isOpen || t2.interval!=null || t2.raf!=null || t2.bar!=null || t2.resize!=null) throw new Error("kapanınca sayaç kaldı: "+JSON.stringify(t2));
  stop(); await wait(600);

  // elektrikli kip: devir saati → güç (kW), yakıt → batarya (%), tüketim → kWh/100 km
  settings.fuel="elektrik"; settings.evProfile="auto"; buildSettings();
  const e=new DemoLink(); e.ev=true; e.t0=Date.now()-3000;
  await start(e); await wait(7000);
  S.paused=true; await wait(1500);   // döngü elindeki bloğu bitirsin; deneme güç değeri 1 sn'de bir gelmeyebilir
  if(S.g.EVP.v==null) throw new Error("deneme EV gücü hiç okunmadı");
  S.g.EVP.v=23.4; S.g.EVP.ts=Date.now();
  CL.open(); CL.update(); CL.frame();
  const pw=cur("EVP"), soc=cur("EV_SOC")??cur("5B");
  console.log("EV: güç", D.rpm.num.textContent, D.rpm.unit.textContent, "| batarya", CL.minis.f.state&&CL.minis.f.state.text, CL.minis.f.state&&CL.minis.f.state.label, "| alt yazı", CL.sub.textContent);
  if(D.rpm.kind!=="pow" || D.rpm.unit.textContent!=="kW" || D.rpm.num.textContent!==fmt(pw,0)) throw new Error("güç göstergesine geçmedi");
  const pc=CL.scale("pow"); if(pc.min!==-50 || pc.max!==150) throw new Error("güç ölçeği yanlış");
  if(soc==null || CL.minis.f.state.label!=="Batarya" || CL.minis.f.state.text!=="%"+fmt(soc,0)) throw new Error("yakıt → batarya geçmedi");
  settings.cluster.page=1; CL.update();
  if(!/kWh\/100 km/.test(CL.page.html)) throw new Error("tüketim sayfası kWh/100 km değil");
  // geri kazanım (eksi güç) yeşil
  const gp=S.g.EVP; gp.v=-12; gp.ts=Date.now(); CL.update();
  if(D.rpm.state!=="regen" || !D.rpm.num.className.includes("regen") || CL.sub.textContent!=="Şarj") throw new Error("geri kazanım yeşil değil");
  if(CL.telltales().batt) throw new Error("EV'de 12 V normalken akü lambası yandı");
  CL.close(); S.paused=false;
  if(CL.timers.interval!=null || CL.timers.raf!=null) throw new Error("EV kapanışında sayaç kaldı");
  stop(); await wait(600);
  settings.fuel="benzin"; buildSettings();
  console.log("gösterge paneli: değerler, ibre, sınır rengi, lambalar, uyarı, sayfalar, EV, kapatma tamam");
`);
