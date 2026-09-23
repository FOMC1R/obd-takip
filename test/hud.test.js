// Ön cam görünümü: deneme cihazıyla değerler güncelleniyor mu, aynalama kalıcı mı, alarm yanıp sönüyor mu
require("./harness")(String.raw`
  const HUD=window.HUD;
  settings.record=false;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d);
  HUD.open();
  if(!HUD.isOpen) throw new Error("açılmadı");
  await wait(4000);
  HUD.update(); const V=HUD.vals, txt={hız:V.spd.textContent, devir:V.rpm.textContent, su:V.cool.textContent, tüketim:V.fuel.textContent+" "+V.fuelL.textContent};
  console.log("HUD:", JSON.stringify(txt));
  if(txt.hız!==fmt(cur("0D"),0) || txt.devir!==fmt(cur("0C"),0)) throw new Error("hız/devir çekirdekle aynı değil");
  for(const k of ["devir","su"]) if(txt[k]==="—") throw new Error(k+" boş");
  if(V.fuel.textContent==="—") throw new Error("tüketim boş");
  // alarm: kritik uyarı varken kırmızı (deneme aracının kendi arıza uyarılarını önce kaldır)
  [...S.alarms.keys()].forEach(k=>S.alarms.delete(k)); HUD.update();
  if(HUD.el.className.includes("alarm")) throw new Error("uyarı yokken kırmızı");
  raise("t1","crit","deneme",false); HUD.update();
  if(!HUD.el.className.includes("alarm")) throw new Error("alarm görünmedi");
  drop("t1"); HUD.update();
  if(HUD.el.className.includes("alarm")) throw new Error("alarm kalktı ama görünüm kırmızı");
  // aynalama kalıcı
  HUD.setMirror(true);
  if(!settings.hud.mirror) throw new Error("aynalama kaydedilmedi");
  HUD.close();
  if(HUD.isOpen) throw new Error("kapanmadı");
  stop(); await wait(300);
  console.log("ön cam: değerler, alarm, aynalama, kapatma tamam");
`);
