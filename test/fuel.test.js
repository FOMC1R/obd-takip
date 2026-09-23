
require("./harness")(String.raw`
  const demo=new DemoLink(); demo.t0=Date.now()-5000;
  await start(demo);
  for(let i=0;i<4;i++){ await wait(2000);
    console.log("MAF",S.g["10"].v, "hız",S.g["0D"].v, "trim",S.g["06"].v,S.g["07"].v, "-> L/sa",S.g.FL.v&&S.g.FL.v.toFixed(2), "L/100",S.g.FK.v&&S.g.FK.v.toFixed(1)); }
  console.log("sürüş: yakıt L", REC.trip.fuel&&REC.trip.fuel.toFixed(4), "km", REC.trip.odo&&REC.trip.odo.toFixed(3));
  // MAF yokmuş gibi: hız-yoğunluk yolu
  S.supported.delete("10"); S.g["10"].v=null;
  await wait(2500); console.log("MAF'sız L/sa:", S.g.FL.v&&S.g.FL.v.toFixed(2), "MAP",S.g["0B"].v,"rpm",S.g["0C"].v,"IAT",S.g["0F"].v);
  settings.fuel="dizel"; await wait(1500); console.log("dizel, 5E yok -> mümkün mü:", fuelPossible(), "FL ts eski mi:", cur("FL"));
  stop(); await wait(300);
`);
