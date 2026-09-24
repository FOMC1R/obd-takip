// Sürüş CSV'si: ekranda görünen her olay (uyarılar + sürüş puanı olayları) CSV'nin "Olay" sütununda olmalı
global.Blob=class{ constructor(p){ global.__csv=p.join(""); } };
global.URL.createObjectURL=()=>"blob:x"; global.URL.revokeObjectURL=()=>{};
require("./harness")(String.raw`
  const d=new DemoLink(); d.t0=Date.now()-5000;
  await start(d); await wait(2000);
  raise("gX","crit","Deneme uyarı",false);
  // sürüş puanı: ani hız düşüşü → sert fren
  const s=S.g["0D"]; const t0=Date.now();
  SCORE.feedSpeed; s.v=60; s.ts=t0; emit("tick"); await wait(1100);
  s.v=40; s.ts=Date.now(); emit("tick"); await wait(1500);
  stop(); await wait(800);
  const tr=(await getTrips())[0];
  console.log("olay listesi ("+tr.events.length+"):", tr.events.map(e=>e.text).join(" | "));
  if(!tr.events.some(e=>e.text.includes("Sert fren"))) throw new Error("sert fren olay listesine yazılmadı");
  await openTrip(tr.id);
  __els.vCsv.ev.click();
  const csv=global.__csv;
  const cells=csv.split(String.fromCharCode(13,10)).slice(1).map(l=>l.split(";").pop()).filter(x=>x!=='""');
  console.log("CSV olay hücreleri:", cells.join(" || "));
  const missing=tr.events.filter(e=>!csv.includes(e.text.replace(/"/g,"'")));
  if(missing.length) throw new Error("CSV'de eksik olay: "+missing.map(e=>e.text).join(", "));
  // eski kayıt: olay yalnızca satırda (row.ev) → CSV'ye yine girmeli
  if((csv.match(/Sert fren/g)||[]).length!==1) throw new Error("sert fren CSV'de tekrarlandı");
  const smp=V.samples; smp[smp.length-1].ev="hiz"; __els.vCsv.ev.click();
  if(!global.__csv.includes("Hız aşımı")) throw new Error("satırdaki olay CSV'ye girmedi");
  console.log("tüm olaylar CSV'de");
`);
