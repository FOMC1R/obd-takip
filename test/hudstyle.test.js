// Ön cam stilleri: Klasik / Şerit / Sportif — sınıf, düğme yazısı, değerlerin çekirdekle aynılığı,
// Şerit'te devir çizgisi ve tek satır değerler, Sportif'te vites ışıkları ve devir rakamı
require("./harness")(String.raw`
  const HUD=window.HUD;
  if(settings.hud.style!=="klasik") throw new Error("varsayılan stil klasik değil: "+settings.hud.style);
  settings.record=false;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d);
  HUD.open(); await wait(4000); S.paused=true; await wait(800);
  const styleBtn=[...HUD.el._kids[1]._kids].find(b=>/^Stil:/.test(b.textContent));
  if(!styleBtn) throw new Error("stil düğmesi yok");
  const seen=[];
  for(const st of Object.keys(HUD.STYLES)){
    if(settings.hud.style!==st) throw new Error("sıra bozuk: "+settings.hud.style+" / "+st);
    HUD.update();
    if(!HUD.el.className.split(" ").includes("st-"+st)) throw new Error(st+": sınıf yok ("+HUD.el.className+")");
    if(styleBtn.textContent!=="Stil: "+HUD.STYLES[st]) throw new Error(st+": düğme yazısı "+styleBtn.textContent);
    if(HUD.vals.spd.textContent!==fmt(cur("0D"),0)) throw new Error(st+": hız çekirdekle aynı değil");
    seen.push(st);
    styleBtn.ev.click({stopPropagation(){}});   // sonraki stile geç
  }
  if(settings.hud.style!=="klasik") throw new Error("döngü klasiğe dönmedi");
  console.log("stiller:", seen.map(s=>HUD.STYLES[s]).join(" → "));

  // Şerit: tek satır değerler çekirdekle aynı; devir çizgisi oranı
  settings.hud.style="serit"; HUD.applyView();
  const txt=HUD.strip.map(e=>e.getAttribute("aria-label"));
  console.log("şerit satırı:", txt.join(" · "));
  if(!/^Su /.test(txt[0]) || !txt[0].includes(fmt(cur("05"),0)) || !txt[2].includes(fmt(cur("42"),1)+" V")) throw new Error("şerit değerleri yanlış");
  const red=settings.lim["0C"].max, rs=S.g["0C"];
  rs.v=red*0.55; rs.ts=Date.now(); HUD.update();
  if(HUD.line.hidden || HUD.line._kids[0].style.width!==(red*0.55/(red*1.1)*100).toFixed(1)+"%" || HUD.line.className!=="hud-line") throw new Error("devir çizgisi yanlış: "+HUD.line._kids[0].style.width);
  rs.v=red+100; HUD.update(); if(HUD.line.className!=="hud-line red") throw new Error("kırmızı bölgede çizgi kırmızı değil");

  // Sportif: ışıklar vites noktasına doğru dolar; vites noktasında yanıp söner; devir rakamı
  settings.hud.style="spor"; HUD.applyView();
  const shift=red-700;
  rs.v=shift*0.5; HUD.update(); if(HUD.lit!==0 || HUD.lights.className!=="hud-lights") throw new Error("düşük devirde ışık yandı: "+HUD.lit);
  rs.v=shift*0.8; HUD.update(); if(HUD.lit!==5) throw new Error("orta devirde ışık sayısı: "+HUD.lit);
  rs.v=shift+50; HUD.update(); if(HUD.lit!==10 || HUD.lights.className!=="hud-lights shift") throw new Error("vites noktasında yanıp sönmüyor");
  if(!HUD.rn.innerHTML.startsWith(fmt(rs.v,0))) throw new Error("devir rakamı yanlış: "+HUD.rn.innerHTML);
  // uyarı, sade kip ve yansıma stil ile birlikte
  raise("g05","crit","Soğutma suyu sıcaklığı: 112 °C (üst sınır 110)",false); settings.hud.simple=true; settings.hud.flipY=true; HUD.applyView();
  const c=HUD.el.className.split(" ");
  if(!c.includes("st-spor") || !c.includes("alarm") || !c.includes("simple")) throw new Error("stil+uyarı+sade sınıfları: "+HUD.el.className);
  if(HUD.el.firstChild!==undefined && HUD.el._kids[0].style.transform!=="scale(1,-1)") throw new Error("yansıma stil ile bozuldu");
  drop("g05"); settings.hud.simple=false; settings.hud.flipY=false;
  settings.hud.style="klasik";
  HUD.close(); S.paused=false; stop(); await wait(300);
  console.log("ön cam stilleri: sınıf, düğme, şerit, sportif ışıklar, uyarı+sade+yansıma tamam");
`);
