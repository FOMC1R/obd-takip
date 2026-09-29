// Yedek: tüm veriler tek dosyada (gzip), API anahtarı istenmedikçe girmez; tamamen geri yükleme sürüşleri,
// satırları ve ayarları aynen getirir; birleştirme tekrar eklemez; bozuk / yabancı dosya reddedilir
require("./harness")(String.raw`
  await wait(1700);
  settings.aiKey="sk-gizli"; settings.expenses=[{id:"e1",date:"2026-09-01",kind:"yakit",amount:500}];
  await start(new DemoLink()); for(let i=0;i<40 && !(REC.trip && REC.trip.samples>=3);i++) await wait(250);
  stop(); await wait(600);
  await start(new DemoLink()); for(let i=0;i<40 && !(REC.trip && REC.trip.samples>=2);i++) await wait(250);
  stop(); await wait(600);
  const trips0=await getTrips(), rows0=(await idb((await os("samples")).getAll())).length;
  if(trips0.length<2 || rows0<5) throw new Error("yeterli kayıt oluşmadı: "+trips0.length+"/"+rows0);

  const o=await BACKUP.build({});
  if(o.ayarlar.aiKey) throw new Error("API anahtarı istenmeden yedeğe girdi");
  if((await BACKUP.build({withKey:true})).ayarlar.aiKey!=="sk-gizli") throw new Error("istenince anahtar girmedi");
  const {blob, ext, raw}=await BACKUP.pack(o);
  if(ext!=="json.gz" || !(blob.size<raw)) throw new Error("sıkıştırma çalışmadı: "+ext+" "+blob.size+"/"+raw);
  const back=await BACKUP.unpack(blob);
  if(back.suruslar.length!==trips0.length || back.satirlar.length!==rows0) throw new Error("dosyadan okuma eksik");

  // bozuk / yabancı dosya
  for(const [b,why] of [[new Blob(["{}"]),"yabancı"],[new Blob(["abc"]),"bozuk"],[new Blob([JSON.stringify({format:"obd-takip-yedek",surum:99,suruslar:[],satirlar:[],ayarlar:{}})]),"yeni sürüm"]]){
    let ok=false; try{ await BACKUP.unpack(b); }catch(e){ ok=true; } if(!ok) throw new Error(why+" dosya kabul edildi"); }

  // tamamen geri yükle: her şeyi sil, yedekten getir
  const d=await dbOpen(), tx=d.transaction(["trips","samples"],"readwrite"); tx.objectStore("trips").clear(); tx.objectStore("samples").clear(); await done(tx);
  settings.expenses=[]; settings.fuel="dizel";
  await BACKUP.replace(back);
  const trips1=await getTrips(), rows1=(await idb((await os("samples")).getAll())).length;
  if(trips1.length!==trips0.length || rows1!==rows0) throw new Error("geri yükleme eksik: "+trips1.length+"/"+rows1);
  for(const t of trips1){ const a=(await getSamples(t.id)).length, b=trips0.find(x=>x.id===t.id); if(!b || a!==(await Promise.resolve(back.satirlar.filter(s=>s.trip===t.id).length))) throw new Error("satırlar sürüşe bağlı değil"); }
  if(settings.expenses.length!==1 || settings.fuel!=="benzin") throw new Error("ayarlar geri gelmedi: "+settings.fuel);
  if(settings.aiKey!=="sk-gizli") throw new Error("yedekte olmayan anahtar korunmadı");

  // birleştir: aynı yedek tekrar eklemez; eksik sürüş eklenir
  const r1=await BACKUP.merge(back);
  if(r1.added!==0 || (await getTrips()).length!==trips0.length) throw new Error("birleştirme tekrar ekledi: "+r1.added);
  await deleteTrip(trips1[0].id);
  const r2=await BACKUP.merge(back);
  if(r2.added!==1 || (await getTrips()).length!==trips0.length || (await idb((await os("samples")).getAll())).length!==rows0) throw new Error("eksik sürüş eklenmedi: "+JSON.stringify(r2));
  console.log("yedek: "+trips0.length+" sürüş / "+rows0+" satır, gzip "+blob.size+"/"+raw+" bayt, anahtar, bozuk dosya, geri yükle, birleştir tamam");
`);
