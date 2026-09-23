
require("./harness")(String.raw`
  const demo=new DemoLink(); demo.t0=Date.now()-5000;
  settings.record=false;
  const box=document.getElementById("battBox"); Object.defineProperty(box,"innerHTML",{set(v){ box._kids=[]; box.firstChild={set textContent(t){ console.log("  ekran:",t); }}; },get(){return "";}});
  await start(demo); await wait(1500);
  const before=S.g["0C"].hist.length;
  await batteryTest();
  const k=box._kids||[]; console.log("SONUÇ:", k[0]&&k[0].textContent); console.log("SATIRLAR:", (k[1]&&k[1]._kids||[]).map(x=>x.textContent).join(" | "));
  const during=S.g["0C"].hist.length-before; console.log("test sırasında devir okuma sayısı (az olmalı):", during);
  await wait(1500); console.log("test sonrası döngü devam ediyor:", S.g["0C"].hist.length-before>during, "paused:", S.paused);
  stop(); await wait(200);
`);
