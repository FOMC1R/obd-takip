
require("./harness")(String.raw`
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(8000);
  await flush(REC.trip); const smp=await getSamples(REC.trip.id); const last=smp[smp.length-1];
  const keys=new Set(); smp.forEach(x=>Object.keys(x.v).forEach(k=>keys.add(k)));
  console.log("kayda giren değerler ("+keys.size+"):", [...keys].sort().map(k=>GBY[k].name+(GBY[k].hide?"*":"")).join(", "));
  console.log("örnek katalizör/lambda/pedal:", last.v["3C"], last.v["44"], last.v["49"], "| GPS:", last.lat!=null);
  console.log("devir okuma/sn:", (S.g["0C"].hist.length/8).toFixed(1));
  settings.recAll=false; const c0=S.g["3C"].hist.length; await wait(4000); console.log("tümü kapalıyken katalizör okunuyor mu:", S.g["3C"].hist.length>c0);
  stop(); await wait(300);
`);
