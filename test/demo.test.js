// Deneme modu gerçek kayıtlarla karışmamalı: varsayılan olarak sürüş kaydı yok, şerit görünür, uyarılar "Deneme:" ile başlar
require("./harness")(String.raw`
  settings.recordDemo=false;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(3000);
  if(REC.trip) throw new Error("deneme modunda sürüş kaydı başladı");
  if(__els.demoBanner.hidden) throw new Error("deneme şeridi görünmüyor");
  const deneme=S.log.filter(e=>/P0301/.test(e.text));
  console.log("geçmişte:", deneme.map(e=>e.text).join(" | "));
  if(!deneme.length || !deneme.every(e=>e.text.startsWith("Deneme: "))) throw new Error("deneme uyarısı işaretsiz");
  stop(); await wait(500);
  if(!__els.demoBanner.hidden) throw new Error("şerit kapanmadı");
  if((await getTrips()).length) throw new Error("deneme sürüşü kaydedilmiş");
  // eski deneme kayıtlarını silme
  settings.recordDemo=true; const d2=new DemoLink(); await start(d2); await wait(2500); stop(); await wait(600);
  await putTrip({start:Date.now()-9e5,end:Date.now()-6e5,demo:false,samples:1,distance:0,stats:{},events:[],dtcs:[]});
  await renderTrips(); const before=await getTrips();
  __els.btnDelDemo.ev.click(); await wait(400);
  const after=await getTrips();
  console.log("kayıt:", before.length, "→", after.length, "gerçek kalan:", after.every(t=>!t.demo));
  if(after.some(t=>t.demo) || after.length!==before.filter(t=>!t.demo).length) throw new Error("deneme kayıtları silinmedi ya da gerçek kayıt silindi");
  console.log("deneme modu ayrımı tamam");
`);
