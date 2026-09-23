// Ön cam görünümü: değerler, devir çubuğu, hız sınırı rengi, süren tehlikede uyarı yazısı,
// yansıma ayarları, değer seçimi ve kapatma
require("./harness")(String.raw`
  const HUD=window.HUD;
  settings.record=false;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d);
  HUD.open();
  if(!HUD.isOpen) throw new Error("açılmadı");
  await wait(4000);
  HUD.update();
  const sl=HUD.slots.map(s=>s.l.textContent+"="+s.v.textContent);
  console.log("HUD hız:", HUD.vals.spd.textContent, "| alt:", sl.join(" · "));
  if(HUD.vals.spd.textContent!==fmt(cur("0D"),0)) throw new Error("hız çekirdekle aynı değil");
  if(HUD.slots.some(s=>s.v.textContent==="—")) throw new Error("alt değerlerden biri boş");
  if(!/Su/.test(HUD.slots[0].l.textContent) || !/Tüketim/.test(HUD.slots[1].l.textContent) || !/Akü/.test(HUD.slots[2].l.textContent)) throw new Error("varsayılan alt değerler yanlış");

  // hız sınırı rengi
  const lim=settings.lim["0D"].max; const st=S.g["0D"];
  st.v=lim+5; st.ts=Date.now(); HUD.update(); if(!HUD.vals.spd.className.includes("over")) throw new Error("sınır aşımında kırmızı değil");
  st.v=lim-2; st.ts=Date.now(); HUD.update(); if(!HUD.vals.spd.className.includes("near")) throw new Error("sınıra yakınken sarı değil");

  // uyarılar: kayıtlı arıza kodu yazı çıkarmaz; sınırı aşan değer yazıyla çıkar
  [...S.alarms.keys()].forEach(k=>S.alarms.delete(k)); HUD.update();
  if(HUD.el.className.includes("alarm") || HUD.alertText()) throw new Error("uyarı yokken kırmızı");
  raise("dtcP0301","crit","deneme kod",false); HUD.update();
  if(HUD.el.className.includes("alarm")) throw new Error("arıza kodu uyarısında kırmızı yandı");
  drop("dtcP0301");
  raise("g05","crit","Soğutma suyu sıcaklığı: 112 °C (üst sınır 110)",false); HUD.update();
  const at=HUD.alertText(); console.log("uyarı yazısı:", at);
  if(!HUD.el.className.includes("alarm") || at!=="SOĞUTMA SUYU SICAKLIĞI 112 °C") throw new Error("değer uyarısı yazısı yanlış");
  drop("g05"); HUD.update();
  if(HUD.el.className.includes("alarm")) throw new Error("alarm kalktı ama görünüm kırmızı");

  // yansıma: ön cam (yukarı-aşağı) ve eski aynalama uyumu
  settings.hud.flipY=true; settings.hud.flipX=false; HUD.applyView();
  const tr=HUD.el.firstChild; // hud-in
  HUD.setMirror(true);
  if(!settings.hud.flipX) throw new Error("aynalama kaydedilmedi");

  // değer seçimi: yinelenmeyen bir sonraki değere geçer
  const before=settings.hud.slots.slice(); HUD.cycleSlot(2);
  if(settings.hud.slots[2]===before[2] || new Set(settings.hud.slots).size!==3) throw new Error("değer değişmedi ya da yinelendi");
  console.log("değer seçimi:", before[2], "→", settings.hud.slots[2]);

  HUD.close();
  if(HUD.isOpen) throw new Error("kapanmadı");
  stop(); await wait(300);
  console.log("ön cam: değerler, sınır rengi, uyarı yazısı, yansıma, seçim, kapatma tamam");
`);
