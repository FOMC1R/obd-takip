
require("./harness")(String.raw`
  settings.record=false;
  // 1) Eski davranış: filtre yok (ATCRA'yı tanımayan cihaz gibi) -> birleşim yine tam liste vermeli
  let d=new DemoLink(); d.t0=Date.now()-44000; const orig=d.reply.bind(d); d.reply=c=>c.startsWith("ATCRA")?"?":orig(c);
  await start(d); await wait(1500);
  console.log("ATCRA yok  -> filtre:", S.cra, "desteklenen:", [...S.supported].join(","));
  stop(); await wait(300);
  // 2) Normal: motor filtresi
  d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(3000);
  console.log("ATCRA var  -> filtre:", S.cra, "desteklenen:", [...S.supported].join(","));
  console.log("gaz, MAF, trim:", S.g["11"].v, S.g["10"].v, S.g["06"].v, "| DTC:", JSON.stringify(S.dtc.stored), "| cihaz filtresi geri:", d.filter);
  stop(); await wait(300);
`);
