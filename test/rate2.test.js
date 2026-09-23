
require("./harness")(String.raw`
  for(const all of [false,true]){
    settings.recAll=all; const d=new DemoLink(); d.t0=Date.now()-10000;
    await start(d); await wait(3000); const c0=S.g["0C"].hist.length; await wait(6000);
    console.log("tüm değerler kayıtta="+all+" -> devir okuma/sn:", ((S.g["0C"].hist.length-c0)/6).toFixed(1));
    stop(); await wait(300);
  }
`);
