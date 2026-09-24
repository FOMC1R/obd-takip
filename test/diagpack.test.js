// Tanılama paketi: bağlantı, desteklenen değerler, ham konuşma, araç durumu, sürüşler; gizli alanlar dışarıda
require("./harness")(String.raw`
  settings.aiKey="sk-ant-GIZLI"; settings.expenses=[{id:1,date:"2026-09-01",type:"Diğer",amount:100,km:null,liters:null,full:false,note:"özel"}];
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(6000); stop(); await wait(600);
  // gerçek sürüş gibi bir kayıt (deneme olmayan) ekle
  const id=await putTrip({start:Date.now()-6e5,end:Date.now()-3e5,demo:false,samples:2,distance:1200,stats:{},events:[{t:Date.now(),level:"warn",text:"Deneme olay"}],dtcs:[]});
  await addSamples([{trip:id,t:1,v:{"0C":800},lat:40.9,lon:29.3,gs:0,acc:5},{trip:id,t:2,v:{"0C":900},lat:40.9,lon:29.3,gs:1,acc:5}]);
  const p=await DIAGPACK.build({withSamples:true});
  const txt=JSON.stringify(p);
  console.log("bölümler:", Object.keys(p).join(", "));
  console.log("bağlantı:", JSON.stringify(p.baglanti).slice(0,160));
  console.log("ELM konuşma: ilk", p.elmKonusma.ilk.length, "son", p.elmKonusma.son.length, "| örnek:", JSON.stringify(p.elmKonusma.ilk.find(e=>e.cmd==="0100")));
  if(!p.destekleyenPIDler || !p.destekleyenPIDler.includes("0C")) throw new Error("desteklenen PID yok");
  if(!p.elmKonusma.ilk.some(e=>e.cmd==="ATZ")) throw new Error("ham konuşma kaydedilmedi");
  if(txt.includes("sk-ant-GIZLI")) throw new Error("API anahtarı pakette");
  if(txt.includes("özel")) throw new Error("masraf notu pakette");
  if(/"lat"|"lon"/.test(txt)) throw new Error("konum pakette");
  if(!p.sonGercekSurus || p.sonGercekSurus.satirlar.length!==2) throw new Error("son gerçek sürüş eksik");
  if(p.aracDurumu.vin && !p.aracDurumu.vin.includes("gizlendi")) throw new Error("VIN varsayılan olarak açık");
  console.log("boyut:", Math.round(txt.length/1024), "KB | tanılama paketi tamam");
`);
