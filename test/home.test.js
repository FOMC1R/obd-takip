// Ana sayfa: açılışta ana sayfa sekmesi, menü kutucukları, sürüm numarası, kutucuğun ilgili sekmeyi açması,
// bağlıyken canlı özet (motor sıcaklığı, vites), araçta bulunan ek sistemin kendi kutucuğu
require("./harness")(String.raw`
  if(typeof HOME==="undefined") throw new Error("HOME yok");
  if(settings.tab!=="ana") throw new Error("açılış sekmesi ana sayfa değil: "+settings.tab);
  if($("homeVer").textContent!=="Sürüm "+APP_VERSION) throw new Error("sürüm yazısı yok: "+$("homeVer").textContent);
  const names=()=>HOME.tiles().map(t=>t.name);
  for(const n of ["Motor","Şanzıman","Arızalar","Sürüşler","İstatistik","Gösterge paneli","Ön cam (HUD)","Bakım","Masraf","Ayarlar"])
    if(!names().includes(n)) throw new Error("kutucuk yok: "+n+" | "+names());
  const tile=n=>HOME.tiles().find(t=>t.name===n);
  tile("Arızalar").go(); if(settings.tab!=="ariza") throw new Error("Arızalar sekmesi açılmadı");
  tile("Şanzıman").go(); if(settings.tab!=="sanziman") throw new Error("Şanzıman sekmesi açılmadı");
  tile("Motor").go(); if(settings.tab!=="canli") throw new Error("Motor → Canlı açılmadı");
  // bağlı değilken özet
  if(tile("Motor").sub()[0]!=="Canlı değerler") throw new Error("bağlı değilken motor özeti: "+tile("Motor").sub());
  // bağlıyken canlı özet
  await start(new DemoLink()); await wait(2500);
  const m=tile("Motor").sub()[0]; if(!/°C/.test(m)) throw new Error("motor özetinde sıcaklık yok: "+m);
  for(let i=0;i<40 && !SYS.st.probed;i++) await wait(250);
  const tr=tile("Şanzıman").sub()[0]; if(!tr) throw new Error("şanzıman özeti boş");
  // araçta şanzıman dışında sistem olursa kendi kutucuğu çıkar
  SYS.store()["7E2"]={tx:"7E2", rx:"7EA", pids:["05"], ecu:"HPCM-HybridPtCtl", name:"Hibrit sistem"};
  if(!names().includes("Hibrit sistem")) throw new Error("ek sistem kutucuğu yok: "+names());
  delete SYS.store()["7E2"];
  HOME.render();
  stop(); await wait(400);
  showTab("ana"); if(settings.tab!=="ana") throw new Error("ana sayfaya dönülmedi");
  // başlık: çerçeve yok; üst çubuktaki ad ve bağlantı durumu tekrar edilmez; araç ve uyarı yoksa hiç görünmez
  { const keepV=settings.activeVehicle; settings.activeVehicle=null; S.alarms.clear(); const keepT=REC.trip; REC.trip=null; HOME.render();
    if(!$("homeHead").hidden) throw new Error("boş başlık görünüyor");
    if(/card/.test(HOME.section.innerHTML.split("home-grid")[0])) throw new Error("başlık hâlâ çerçeveli");
    if(/homeState/.test(HOME.section.innerHTML)) throw new Error("bağlantı durumu tekrar ediliyor");
    S.alarms.set("x",{level:"warn",text:"deneme"}); HOME.render();
    if($("homeHead").hidden || !/1 uyarı/.test($("homeChips").innerHTML)) throw new Error("uyarı etiketi görünmüyor");
    S.alarms.clear(); settings.activeVehicle=keepV; REC.trip=keepT; HOME.render(); }
  console.log("ana sayfa: açılış, kutucuklar, sürüm, sekme geçişi, canlı özet ("+m+" · "+tr+"), ek sistem tamam");
`);
