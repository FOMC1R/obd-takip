// Gösterge düzeni: sıra/boy kaydı, yeniden kurulumdan sonra uygulanması, hazır düzenler
global.__store={};
global.__ls={getItem:k=>__store[k]??null,setItem:(k,v)=>{__store[k]=String(v);},removeItem:k=>{delete __store[k];}};
require("./harness")(String.raw`
  const LAYOUT=window.LAYOUT;
  const box=__els.gauges;
  const lastOrder=()=>{ const n=LAYOUT.visible().length; return (box._kids||[]).slice(-n).map(e=>e.id.slice(1)); };
  const eq=(a,b,msg)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(msg+": "+JSON.stringify(a)+" != "+JSON.stringify(b)); };

  const v0=LAYOUT.visible();
  eq(v0.slice(0,3),["0C","0D","05"],"varsayılan sıra");
  // Hız'ı bir yukarı al, devri geniş yap
  LAYOUT.move("0D",-1); LAYOUT.toggleSize("0C");
  eq(LAYOUT.visible().slice(0,2),["0D","0C"],"taşıma");
  eq(settings.layout.size,{"0C":"wide"},"boy kaydı");
  // Kalıcı mı?
  const saved=JSON.parse(__store[STORE_KEY]);
  eq(saved.layout.order.slice(0,2),["0D","0C"],"kayıttaki sıra");
  eq(saved.layout.size["0C"],"wide","kayıttaki boy");
  // Çekirdek yeniden kurunca düzen yine uygulanıyor mu?
  buildGauges();
  eq(lastOrder().slice(0,2),["0D","0C"],"yeniden kurulumdan sonra DOM sırası");
  eq(__els.g0C.dataset.size,"wide","geniş işaret");
  eq(__els.g0D.dataset.size,"","normal işaret");
  // Sınırda taşıma bir şey yapmaz
  if(LAYOUT.move(LAYOUT.visible()[0],-1)!==false) throw new Error("ilk öğe yukarı taşındı");
  // Yeni (bilinmeyen) gösterge sona eklenir
  addGauge({pid:"X9", name:"Yeni", unit:"", lo:0, hi:1, dec:0, read:async()=>1}); buildSettings(); buildGauges();
  eq(LAYOUT.visible().slice(-1),["X9"],"yeni gösterge sonda");
  // Gizle
  LAYOUT.setShown("42",false);
  if(settings.lim["42"].show || LAYOUT.visible().includes("42")) throw new Error("gizleme çalışmadı");
  // Düzenleme modunda denetimler ekleniyor, büyütme tıklaması engelleniyor
  LAYOUT.setEdit(true);
  if(!__els.g0D._layCtl || box.dataset.edit!=="1") throw new Error("düzenleme denetimleri yok");
  const cap=box.ev.click; let stopped=false;
  cap({target:{closest:()=>null}, stopPropagation(){ stopped=true; }, preventDefault(){}});
  if(!stopped) throw new Error("düzenlemede dokunuş çekirdeğe gitti");
  LAYOUT.setEdit(false);
  // Hazır düzenler
  LAYOUT.preset("surus");
  eq(LAYOUT.visible(),["0D","0C","05","FL","42"],"Sürüş");
  eq(lastOrder(),["0D","0C","05","FL","42"],"Sürüş DOM sırası");
  eq(settings.layout.size,{"0D":"wide"},"Sürüş boyu");
  LAYOUT.preset("teshis");
  eq(LAYOUT.visible(),["06","07","0B","10","0E","0F","05"],"Teşhis");
  LAYOUT.preset("tumu");
  const def=GAUGES.filter(g=>!g.hide).map(g=>g.pid);
  eq(LAYOUT.visible(),def,"Tümü");
  console.log("düzen: taşıma, boy, kayıt, yeniden kurulum, gizleme, hazır düzenler tamam");
`);
