// Arka planda çalışma: bağlantı kopunca aynı sürüşte yeniden bağlanır, "Durdur" denemeyi keser,
// ayar kapalıysa eski davranış (sürüş kapanır), vazgeçince kritik uyarı, ölçüm izi ve tanılama paketine girişi
require("./harness")(String.raw`
  if(typeof BG==="undefined") throw new Error("BG yok");
  if(settings.autoReconnect!==true || settings.autoPip!==true) throw new Error("varsayılan ayarlar yanlış");

  // 1) kopma → yeniden bağlanma, aynı sürüş
  await start(new DemoLink()); await wait(1500);
  if(!S.active || !REC.trip) throw new Error("bağlanmadı ya da kayıt yok");
  const tripId=REC.trip.id, link1=S.link;
  lost();
  if(S.active || !BG.pending) throw new Error("kopma yeniden bağlanma durumuna geçmedi");
  if(!REC.trip || REC.trip.id!==tripId) throw new Error("kopunca sürüş kapandı");
  if(!S.alarms.has("link")) throw new Error("kopma uyarısı yok");
  for(let i=0;i<60 && BG.pending;i++) await wait(250);
  if(!S.active) throw new Error("yeniden bağlanmadı");
  if(S.link===link1) throw new Error("eski bağlantı kullanıldı");
  if(!REC.trip || REC.trip.id!==tripId) throw new Error("yeni sürüş açıldı: "+(REC.trip&&REC.trip.id)+" != "+tripId);
  if(!REC.trip.events.some(e=>/Yeniden bağlandı/.test(e.text))) throw new Error("kesinti olaya yazılmadı");
  if(S.alarms.has("link")) throw new Error("bağlanınca kopma uyarısı kalkmadı");
  if(BG.pending) throw new Error("bekleyen deneme kaldı");
  const before=REC.trip.samples; await wait(2500);
  if(REC.trip.samples<=before) throw new Error("yeniden bağlanınca kayıt sürmüyor");
  console.log("yeniden bağlandı, sürüş", tripId, "sürüyor, satır", REC.trip.samples);

  // 2) deneme sırasında Durdur: bağlanmaz, sürüş kapanır
  lost(); if(!BG.pending) throw new Error("ikinci kopma algılanmadı");
  stop(); await wait(4000);
  if(S.active || BG.pending) throw new Error("Durdur'dan sonra yeniden bağlandı");
  if(REC.trip) throw new Error("Durdur sürüşü kapatmadı");

  // 3) ayar kapalı: eski davranış
  settings.autoReconnect=false;
  await start(new DemoLink()); await wait(1200);
  lost();
  if(BG.pending || S.active || REC.trip) throw new Error("ayar kapalıyken yeniden bağlanmaya çalıştı");
  if(!S.alarms.has("link") || S.alarms.get("link").level!=="crit") throw new Error("kapalıyken kritik uyarı yok");
  settings.autoReconnect=true;

  // 4) vazgeçme: kritik uyarı, sürüş kapanır
  await start(new DemoLink()); await wait(1200);
  lost(); BG.giveUp();
  if(BG.pending || S.active || REC.trip) throw new Error("vazgeçince durum temizlenmedi");
  if(S.alarms.get("link").level!=="crit") throw new Error("vazgeçince kritik uyarı yok");
  await wait(3000); if(S.active) throw new Error("vazgeçtikten sonra bağlandı");

  // 5) ölçüm: okuma boşluğu izi ve tanılama paketi
  BG.T.lastTick=Date.now()-6500; emit("tick");
  if(BG.T.maxGapMs<6000) throw new Error("okuma boşluğu ölçülmedi");
  const r=BG.report();
  if(!r.iz.some(e=>e.k==="okuma-boslugu") || !r.iz.some(e=>e.k==="yeniden-baglandi") || r.ozet.yenidenBaglandi<1 || r.ozet.vazgecildi<1)
    throw new Error("iz eksik: "+JSON.stringify(r.ozet));
  const pk=await DIAGPACK.build({});
  if(!pk.arkaPlan || !pk.arkaPlan.ozet) throw new Error("tanılama paketinde arka plan bilgisi yok");
  // küçük pencere çizimi hata vermemeli (test ortamında destek yok)
  BG.draw(); if(r.pipDestegi!==false) throw new Error("test ortamında pip desteği görünmemeli");
  console.log("arka plan: yeniden bağlanma, aynı sürüş, Durdur, ayar kapalı, vazgeçme, ölçüm, paket tamam");
`);
