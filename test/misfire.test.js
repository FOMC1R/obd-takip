require("./harness")(String.raw`
  const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(m+": "+JSON.stringify(a)+" != "+JSON.stringify(b)); };
  // 1) Elle yazılmış çok parçalı yanıt: 2 kayıt (0B ve 0C), son parçada dolgu baytları
  const resp="SEARCHING...\r013\r0:46A40B240007\r1:0000FFFFA40C24\r2:00120000FFFF55\r\r";
  const rec=m6Records(resp);
  eq(rec.map(r=>[r.mid,r.tid,r.uas,r.val,r.min,r.max]), [[0xA4,0x0B,0x24,7,0,65535],[0xA4,0x0C,0x24,18,0,65535]], "çok parçalı");
  // Tek satırlık yanıt ve boşluklu biçim
  eq(m6Records("46 A2 0C 24 00 03 00 00 FF FF").map(r=>r.val), [3], "tek satır");
  // Destek maskesi: A1..A5
  eq([...m6Support("46A0F8000000",0xA0)].map(n=>n.toString(16)), ["a1","a2","a3","a4","a5"], "maske");
  eq(m6Records("NO DATA"), [], "veri yok");
  // Karar metni
  eq(misfireVerdict([{cyl:1,cur:0,avg:0},{cyl:2,cur:0,avg:0}]).text.startsWith("Tekleme yok"), true, "sıfır");
  eq(misfireVerdict([{cyl:1,cur:0,avg:0},{cyl:3,cur:20,avg:9}]).worst, 3, "tek silindir");
  eq(misfireVerdict([{cyl:1,cur:20,avg:0},{cyl:3,cur:18,avg:9}]).worst, null, "çok silindir");

  // 2) Deneme modu uçtan uca: bağlan → "diag" kancası → okuma
  const d=new DemoLink(); d.t0=Date.now()-44000; settings.record=false;
  await start(d);
  for(let i=0;i<100 && MISFIRE.status!=="ok";i++) await wait(100);
  console.log("durum:", MISFIRE.status, "| silindirler:", JSON.stringify(MISFIRE.cyls));
  if(MISFIRE.status!=="ok" || MISFIRE.cyls.length!==4) throw new Error("demo okunamadı");
  const v=misfireVerdict(MISFIRE.cyls); console.log("karar:", v.text);
  if(v.worst!==1) throw new Error("en kötü silindir 1 olmalı");
  // Artış uyarısı: önceki okumayı düşük göster, otomatik okumada uyarı çıkmalı
  MISFIRE.prev={1:0,2:0,3:0,4:0};
  await misfireRead(true);
  console.log("uyarı:", S.alarms.has("misfire1"), "| diğer silindir uyarısı:", S.alarms.has("misfire3"));
  if(!S.alarms.has("misfire1") || S.alarms.has("misfire3")) throw new Error("uyarı hatalı");
  stop(); await wait(300);
  if(S.alarms.has("misfire1") || MISFIRE.timer) throw new Error("kopunca temizlenmedi");
  console.log("tekleme sayacı tamam");
`);
