require("./harness")(String.raw`
  const seen={}; ["connect","tick","sample","dtc","diag","alarm","disconnect","tripEnd"].forEach(n=>on(n,()=>{seen[n]=(seen[n]||0)+1;}));
  // eklenti göstergesi: özel okuma
  addGauge({pid:"X1", name:"Deneme özel", unit:"", lo:0, hi:10, dec:0, read:async()=>7, hide:true});
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(5000);
  console.log("özel gösterge:", S.g.X1.v, "| diag:", !!(S.diag&&S.diag.vehicle&&S.diag.ready&&S.diag.counters), "freeze:", S.diag.freeze&&S.diag.freeze.length);
  stop(); await wait(500);
  const need=["connect","tick","sample","dtc","diag","alarm","disconnect","tripEnd"].filter(n=>!seen[n]);
  console.log("tetiklenmeyen kanca:", need.length?need.join(","):"yok");
  if(need.length || S.g.X1.v!==7) throw new Error("kanca/özel gösterge çalışmadı");
`);
