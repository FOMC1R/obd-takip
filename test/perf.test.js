// Performans ölçümü: ara değer (interpolasyon) birim kontrolleri + deneme modunda uçtan uca 0-100 ve 80-120
require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); };
  const near=(a,b,e)=>Math.abs(a-b)<=e;
  // --- birim ---
  ok(PERF.cross({t:0,v:90},{t:100,v:110},100)===50, "doğrusal geçiş");
  ok(PERF.launch({t:0,v:0},{t:100,v:2},{t:200,v:6})===50, "kalkış geri uzatma");
  ok(PERF.launch({t:0,v:0},{t:100,v:10},{t:200,v:11})===0, "kalkış a'dan önceye taşmasın");
  // sabit 10 km/sa/sn ivme, 10 Hz tamsayı okuma: gerçek 0-100 = 10,0 sn; ölçüm ±aralığın yarısı içinde olmalı
  const mk=(f,hz,off=0.037)=>Array.from({length:hz*16},(_,i)=>{ const t=i/hz+off; return {t:t*1000, v:Math.floor(f(t))}; });
  const lin=t=>t<1?0:(t-1)*10;
  const a=PERF.analyze(mk(lin,10),"0-100"); ok(a && near(a.sec,10,0.1) && a.prec>=0.05 && a.prec<0.15, "0-100 doğrusal: "+JSON.stringify(a));
  const b=PERF.analyze(mk(lin,10),"80-120"); ok(b && near(b.sec,4,0.1), "80-120 doğrusal: "+JSON.stringify(b));
  // 2,5 Hz (normal döngü hızı) ile hata daha büyük ama yine de ±aralık içinde
  const c=PERF.analyze(mk(lin,2.5),"0-100"); ok(c && near(c.sec,10,0.4), "2,5 Hz: "+JSON.stringify(c));
  ok(PERF.analyze([{t:0,v:0},{t:100,v:50}],"0-100")===null, "hedefe varılmadıysa sonuç yok");
  console.log("birim kontroller tamam:", a.sec.toFixed(3), b.sec.toFixed(3), c.sec.toFixed(3));

  // --- uçtan uca: deneme modu ---
  settings.record=false;
  const d=new DemoLink(); await start(d); await wait(1500);
  const rpmBefore=S.g["0C"].hist.length;
  const truth={"0-100":8.2*Math.log(3), "80-120":8.2*Math.log(70/30)};
  for(const key of ["0-100","80-120"]){
    const p=PERF.run(key); await wait(600);
    ok(S.paused && PERF.running, "ölçüm sırasında canlı okuma durmalı");
    await p;
    const r=PERF.last[key]; ok(r, key+" sonuç yok");
    console.log(key, "ölçülen:", r.sec.toFixed(3), "gerçek:", truth[key].toFixed(3), "±", r.prec.toFixed(3), "okuma/sn:", r.hz.toFixed(1));
    ok(near(r.sec,truth[key],r.prec+0.05), key+" ölçüm ± belirsizlik dışında");   // +0,05: zamanlayıcı oynaması payı
    ok(!S.paused, "ölçüm sonrası canlı okuma geri gelmeli");
    ok(!settings.perf[key], "deneme sonucu en iyilere yazılmamalı");
  }
  await wait(1200); ok(S.g["0C"].hist.length>rpmBefore, "döngü devam etmeli");
  // bağlantı koparsa: ölçüm iptal, paused geri
  const p=PERF.run("0-100"); await wait(700); stop(); await p;
  ok(!S.paused && !PERF.running, "kopunca temizlenmeli");
  console.log("performans ölçümü: tamam");
`);
