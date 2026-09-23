// Sürüş puanı: eşik birim kontrolleri + deneme modunda uçtan uca (sert fren yakalanıyor mu, puan, görünüm)
require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); };
  // --- birim: eşikler ---
  ok(Math.abs(SCORE.ACC_MAX-2.943)<0.01 && Math.abs(SCORE.BRK_MIN+3.924)<0.01, "eşikler");
  const run=(pts,lim)=>{ const d=SCORE.detector(), ev=[]; pts.forEach(([t,v])=>ev.push(...SCORE.feedSpeed(d,t,v,lim))); return ev; };
  // 0,4 sn arayla (2,5 Hz) okunan hız dizisi; km/sa/sn cinsinden sabit eğim
  const ramp=(v0,slope,n,dt=400)=>Array.from({length:n},(_,i)=>[1e6+i*dt, Math.round(v0+slope*i*dt/1000)]);
  ok(run(ramp(100,-9,10)).length===0, "sakin fren (2,5 m/s²) olay saymamalı");
  const hb=run(ramp(100,-16,10)); ok(hb.length===1 && hb[0]==="fren", "sert fren (4,4 m/s²) tek olay: "+hb);
  ok(run(ramp(0,9,10)).length===0, "sakin hızlanma olay saymamalı");
  const ha=run(ramp(0,12,10)); ok(ha.length===1 && ha[0]==="hizlanma", "sert hızlanma tek olay: "+ha);
  // tek okumalık 1 km/sa'lik sıçrama (0,4 sn) gürültü sayılmamalı: pencere ≥0,8 sn
  ok(run([[0,50],[400,50],[800,48],[1200,50],[1600,50]]).length===0, "gürültü");
  // okuma boşluğu (3 sn) sonrası büyük fark olay değil
  ok(run([[0,0],[400,0],[3400,60],[3800,60]]).length===0, "boşluk sonrası olay sayılmamalı");
  // hız aşımı: 130 sınırında 12 sn 135 → bir olay; 9 sn → yok; iki ayrı bölüm → iki olay
  const over=(sec)=>Array.from({length:sec*2.5},(_,i)=>[i*400,135]);
  ok(run(over(12),130).filter(x=>x==="hiz").length===1, "12 sn aşım tek olay");
  ok(run(over(9),130).filter(x=>x==="hiz").length===0, "9 sn aşım olay değil");
  const ep=[...over(11), [0,120],[0,120],[0,120], ...over(11)].map(([t,v],i)=>[i*400,v]);   // arada 1,2 sn sınır altı
  ok(run(ep,130).filter(x=>x==="hiz").length===2, "iki ayrı aşım iki olay");
  // devir: 2 sn'den uzun sınır üstü
  { const d=SCORE.detector(); let n=0; for(let i=0;i<8;i++) n+=SCORE.feedRpm(d,i*400,6500,6200).length; ok(n===1,"yüksek devir"); }
  // puan formülü: 100 - ceza/(max(10,km)/10)
  ok(SCORE.compute({fren:2},5).score===90, "kısa sürüş 10 km sayılır");
  ok(SCORE.compute({fren:2,hizlanma:1},20).score===Math.round(100-13/2), "20 km'de yarı ceza");
  ok(SCORE.compute({fren:50},10).score===0, "alt sınır 0");
  console.log("birim kontroller tamam");

  // --- uçtan uca: deneme modu (her üç dalgadan birinde sert fren; t≈56 sn) ---
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(16000);
  const tid=REC.trip.id, liveTxt=SCORE.live.innerHTML;
  stop(); await wait(800);
  const t=(await getTrips()).find(x=>x.id===tid), smp=await getSamples(tid);
  console.log("olaylar:", JSON.stringify(t.scoreEvents), "puan:", t.score, "| canlı:", liveTxt.replace(/<[^>]+>/g,""));
  ok(t.scoreEvents && t.scoreEvents.fren>=1, "deneme modunda sert fren yakalanmadı");
  ok(t.scoreEvents.hizlanma===0, "sakinleştirilmiş denemede sert hızlanma olmamalı");
  ok(typeof t.score==="number" && t.score<100 && t.score>=0, "puan");
  const evRows=smp.filter(s=>s.ev); ok(evRows.some(s=>s.ev.includes("fren") && s.lat!=null), "kayıt satırında konumlu olay yok");
  ok(/Bu sürüş/.test(liveTxt), "canlı puan");
  // görünüm
  await openTrip(tid);
  const h=SCORE.card.innerHTML;
  ok(!SCORE.card.hidden && h.includes(">"+t.score+"<") && h.includes("Sert fren") && h.includes("Nasıl hesaplanır"), "görünüm");
  console.log("görünüm:", h.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,160));
  // eski kayıt (olay alanı yok)
  SCORE.render({start:0,end:0,events:[]}); ok(SCORE.card.innerHTML.includes("önce kaydedildi"),"eski kayıt");
  console.log("sürüş puanı: tamam, puan", t.score);
`);
