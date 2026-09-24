// İstatistik sekmesi: dönem süzme, deneme hariç tutma, özet ve önceki dönem karşılaştırması,
// sürüş ölçüleri (tripEnd kancasıyla ve eski kayıtlar için arka planda), eğilim yorumu eşiği, araç süzgeci, görünüm.
require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); console.log("  tamam:",m); };
  const near=(a,b,e=1e-6)=>a!=null && Math.abs(a-b)<=e;
  const MIN=60000, DAY=86400000;

  // Sentetik sürüş: 5 sn arayla satırlar. İlk %20 rölanti (hız 0, devir 800), sonra 50 km/sa, devir 2000.
  // Su sıcaklığı cool0'dan dakikada rise °C artar, 90'da sabitlenir. Voltaj ve yakıt ayarı sabit.
  function synth({start, min=20, cool0=20, rise=6, volt=14.1, lt=2, id=null}){
    const rows=[], n=min*12;
    for(let i=0;i<n;i++){
      const t=start+i*5000, idle=i<n*0.2;
      rows.push({trip:id, t, v:{"0C":idle?800:2000, "0D":idle?0:50, "05":Math.min(90,cool0+rise*i*5/60), "42":volt, "07":lt}});
    }
    return rows;
  }
  function trip(o){
    const km=o.km??10, min=o.min??20;
    return Object.assign({start:o.start, end:o.start+min*MIN, demo:!!o.demo, samples:0, distance:km*1000, odo:km, fuel:o.fuel??km*0.07,
      stats:{"0D":{min:0,max:o.vmax??90,sum:0,n:0}}, events:o.events||[], dtcs:o.dtcs||[]}, o.extra||{});
  }

  // --- 1) Boş durum: 3'ten az gerçek sürüş ---
  await putTrip(trip({start:Date.now()-2*DAY, demo:true}));
  await STATS.render();
  ok(/Henüz yeterli sürüş yok/.test(STATS.section.innerHTML), "3'ten az gerçek sürüşte açıklama gösterilir (deneme sayılmaz)");
  ok(!/<svg/.test(STATS.section.innerHTML), "boş durumda grafik yok");

  // --- 2) Dönemler (sabit an: Perşembe 24 Eylül 2026 12:00) ---
  const NOW=+new Date(2026,8,24,12,0,0);
  const pw=STATS.period("hafta",NOW);
  ok(pw.from===+new Date(2026,8,21) && pw.prevFrom===+new Date(2026,8,14) && pw.prevTo===+new Date(2026,8,17,12), "bu hafta: pazartesiden; önceki: geçen haftanın aynı günleri");
  const pm=STATS.period("ay",NOW);
  ok(pm.from===+new Date(2026,8,1) && pm.prevFrom===+new Date(2026,7,1) && pm.prevTo===+new Date(2026,7,24,12), "bu ay; önceki: 1–24 Ağustos 12:00");
  const p3=STATS.period("3ay",NOW); ok(p3.to-p3.from===90*DAY && p3.prevTo===p3.from, "son 3 ay ve önceki 3 ay");
  const py=STATS.period("yil",NOW); ok(py.from===+new Date(2026,0,1) && py.prevFrom===+new Date(2025,0,1), "bu yıl");
  ok(STATS.period("tumu",NOW).prevFrom===null, "tümü: karşılaştırma yok");
  ok(STATS.period("ay",+new Date(2026,2,31,10)).prevTo===+new Date(2026,2,1), "31 Mart: önceki dönem Mart'a taşmaz");

  // --- 3) Süzme + özet + karşılaştırma (bellekteki sürüşlerle) ---
  settings.price=50;
  const L=[
    trip({start:+new Date(2026,8,2,8), km:20, fuel:1.4, extra:{price:40, score:80}}),     // bu ay, kendi fiyatı 40
    trip({start:+new Date(2026,8,10,18), km:30, fuel:2.1, extra:{score:90}}),              // bu ay, ayar fiyatı 50
    trip({start:+new Date(2026,8,23,7), km:10, fuel:0.8, min:30}),                         // bu ay
    trip({start:+new Date(2026,8,12,9), km:500, fuel:50, demo:true}),                     // deneme: sayılmaz
    trip({start:+new Date(2026,7,5,9), km:40, fuel:2.8}),                                 // geçen ay, karşılaştırmaya girer
    trip({start:+new Date(2026,7,28,9), km:99, fuel:9}),                                  // geçen ay 24'ünden sonra: girmez
  ];
  L.forEach((t,i)=>t.id=1000+i);
  const sel=STATS.select(L,"ay",NOW,"*");
  ok(sel.cur.length===3 && sel.cur.every(t=>!t.demo), "bu ay 3 sürüş, deneme hariç");
  ok(sel.prev.length===1 && sel.prev[0].id===1004, "önceki dönem: yalnızca 1–24 Ağustos");
  const s=STATS.summary(sel.cur), pv=STATS.summary(sel.prev);
  ok(near(s.km,60) && near(s.fuel,4.3) && near(s.l100,4.3/60*100), "toplam 60 km, 4,3 L, "+s.l100.toFixed(2)+" L/100");
  ok(near(s.cost,1.4*40+2.1*50+0.8*50), "maliyet: sürüşün kendi fiyatı, yoksa ayar fiyatı ("+s.cost+" TL)");
  ok(near(s.ms,70*MIN) && near(s.speed,60/(70/60)), "süre 70 dk, ortalama hız "+s.speed.toFixed(1)+" km/sa");
  ok(s.score===85, "ortalama puan 85");
  ok(near(STATS.pct(s.km,pv.km),50), "önceki döneme göre yol +%50");
  ok(STATS.pct(5,0)===null, "önceki değer 0 ise yüzde yok");
  // EV
  const e=STATS.summary([trip({start:NOW-DAY, km:50, fuel:0, extra:{kwh:8, priceKwh:4}}), trip({start:NOW-2*DAY, km:50, fuel:0, extra:{kwh:7}})]);
  ok(e.hasKwh && near(e.kwh,15) && near(e.kwh100,15) && e.ecost>=32, "EV: 15 kWh, 15 kWh/100 km, maliyet "+e.ecost);

  // --- 4) Ölçüler: tripEnd kancasıyla (sample kancasından toplanan) ---
  const live={id:777, start:Date.now()-20*MIN, end:Date.now(), samples:1, fuel:1.2, stats:{}, events:[], dtcs:[]};
  const rows=synth({start:live.start, min:20, cool0:20, rise:6, volt:14.1, lt:2, id:777});
  rows.forEach(r=>emit("sample", r, live));
  emit("tripEnd", live);
  const m=live.metrics;
  console.log("  ölçüler:", JSON.stringify(m));
  ok(m && m.vRun===14.1 && m.ltft===2 && m.coolMax===90 && m.coolStart===20, "tripEnd: voltaj, yakıt ayarı, en yüksek su");
  ok(near(m.warmupMin,10,0.1), "ısınma süresi 20→80 °C, 6 °C/dk: 10 dk ("+m.warmupMin+")");
  ok(near(m.idlePct,20,1), "rölanti payı ~%20 ("+m.idlePct+")");
  ok(JSON.stringify(STATS.metricsFrom(rows))===JSON.stringify(m), "kanca ile geriye dönük hesap aynı sonucu verir");
  ok(STATS.metricsFrom(synth({start:0, cool0:60})).warmupMin===null, "sıcak çalıştırmada ısınma süresi yok");
  ok(live.price===50, "sürüş günündeki fiyat sürüşe yazılır");

  // --- 5) Ölçüler: eski kayıtlar için arka planda (getSamples → putTrip) ---
  const base=Date.now()-40*DAY, ids=[];
  const volts=[14.3,14.28,14.25,14.2,14.18,14.12,14.1,14.05,14.02,14.0];   // 10 sürüşte 0,3 V düşüş
  for(let i=0;i<volts.length;i++){
    const t=trip({start:base+i*3*DAY, km:5+i*4, fuel:(5+i*4)*0.065, events:i===7?[{t:0,level:"warn",text:"2. silindirde tekleme artıyor (+3, bu sürüşte 3)"}]:[],
      dtcs:i===2||i===8?["P0301"]:[], extra:{score:70+i}});
    t.id=await putTrip(t); ids.push(t.id);
    const r=synth({start:t.start, min:12, volt:volts[i], lt:2+i*0.1, id:t.id}); t.samples=r.length; await addSamples(r); await putTrip(t);
  }
  const d=trip({start:base+DAY, km:80}); d.demo=true; d.id=await putTrip(d);
  const dr=synth({start:d.start, id:d.id}); d.samples=dr.length; await addSamples(dr); await putTrip(d);
  if(STATS.st.backfill.promise) await STATS.st.backfill.promise;   // açılıştaki arka plan işi bitsin
  const n=await STATS.backfill({fast:true});
  const after=await getTrips();
  ok(n===10 && ids.every(id=>after.find(t=>t.id===id).metrics), "arka plan: 10 eski sürüşün ölçüsü hesaplanıp saklandı");
  ok(!after.find(t=>t.id===d.id).metrics, "deneme sürüşü için ölçü hesaplanmaz");
  ok(near(after.find(t=>t.id===ids[3]).metrics.vRun,14.2), "saklanan voltaj doğru");
  ok(await STATS.backfill({fast:true})===0, "ikinci kez çalışınca yeniden hesaplamaz");

  // --- 6) Eğilim yorumu eşiği ---
  let v=STATS.verdict("vRun",[14.3,14.2,14.1,14.0]);
  ok(v.level==="info" && /en az 5/.test(v.text) && !/düştü/.test(v.text), "4 sürüşte yorum yok: "+v.text);
  v=STATS.verdict("vRun",volts);
  ok(v.level==="no" && /Son 10 sürüşte şarj voltajı ortalama 0,3 V düştü/.test(v.text), "10 sürüşte düşüş: "+v.text);
  v=STATS.verdict("vRun",[14.1,14.2,14.1,14.15,14.1,14.12,14.08,14.1]);
  ok(v.level==="ok", "dalgalı ama sabit voltaj: "+v.text);
  v=STATS.verdict("vRun",[14.2,14.18,14.15,14.14,14.12]);
  ok(v.level==="ok", "0,08 V'luk küçük düşüş alarm vermez");
  v=STATS.verdict("vRun",[12.8,12.7,12.9,12.8,12.8]);
  ok(v.level==="no" && /düşük/.test(v.text), "düşük şarj voltajı: "+v.text);
  v=STATS.verdict("ltft",[1,2,3,4,5,6,7,8]);
  ok(v.level==="no" && /kaydı/.test(v.text), "yakıt ayarı kayması: "+v.text);
  v=STATS.verdict("coolMax",[92,93,91,92,94,93]);
  ok(v.level==="ok", "normal su sıcaklığı");

  // --- 7) Araç süzgeci ---
  const V=[trip({start:NOW-DAY,extra:{vehicle:"WVWZZZ1KZAW"}}), trip({start:NOW-DAY,extra:{vehicle:"VF15RBF0A5"}}), trip({start:NOW-DAY})];
  ok(STATS.currentVeh()==="*" && STATS.scope(V).length===3, "profil yoksa tüm sürüşler");
  settings.vehicles=[{id:"WVWZZZ1KZAW", name:"Golf", vin:"WVWZZZ1KZAW123456"},{id:"VF15RBF0A5", name:"Clio"}];
  settings.activeVehicle="WVWZZZ1KZAW";
  ok(STATS.currentVeh()==="WVWZZZ1KZAW" && STATS.scope(V).length===1 && STATS.scope(V)[0].vehicle==="WVWZZZ1KZAW", "etkin araç süzülür; araçsız eski kayıt iki araç varken dışarıda");
  ok(STATS.scope(V,"*").length===3, "Tüm araçlar");
  settings.vehicles=[{id:"WVWZZZ1KZAW", name:"Golf"}];
  ok(STATS.scope(V).length===2, "tek araç varken profil öncesi kayıt ona sayılır");
  settings.vehicles={"WVWZZZ1KZAW":{name:"Golf"}, "VF15RBF0A5":{name:"Clio"}};
  ok(STATS.vehicles().length===2 && STATS.scope(V).length===1, "vehicles nesne biçiminde de çalışır");

  // --- 8) Görünüm ---
  settings.statsPeriod="3ay"; await STATS.render();
  let h=STATS.section.innerHTML;
  ok(/Tüm araçlar/.test(h) && /<select id="st-veh">/.test(h), "araç seçimi görünür");
  ok(/Bu dönemde sürüş yok/.test(h) || /Henüz yeterli/.test(h), "etkin aracın sürüşü yoksa bilgi");
  STATS.st.veh="*"; await STATS.render(); h=STATS.section.innerHTML;
  const need=["Özet","Toplam yol","Yakıt maliyeti","göre yol","Tüketim (L/100 km)","Ne zaman sürüyorsun","Sürüş uzunlukları",
    "Araç sağlığı eğilimleri","Şarj voltajı","0,3 V düştü","Isınma süresi","Tekleme ve uyarılar","Rekorlar","En uzun sürüş","P0301","Tekleme","Tablo olarak göster"];
  const miss=need.filter(x=>!h.includes(x));
  ok(!miss.length, "görünüm bölümleri tamam"+(miss.length?" — eksik: "+miss.join(", "):""));
  ok(!/NaN|undefined|Infinity/.test(h), "görünümde NaN/undefined yok");
  ok(!/500[,.]0 km|80 km/.test(h.replace(/<[^>]+>/g," ").match(/En uzun sürüş.{0,80}/)[0]), "rekorlarda deneme sürüşü yok");
  console.log("  özet:", (h.match(/<div class="st-tiles">[\s\S]*?<\/section>/)||[""])[0].replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,300));
  settings.statsPeriod="hafta"; await STATS.render();
  ok(!/NaN|undefined/.test(STATS.section.innerHTML), "haftalık görünüm");
  settings.statsPeriod="tumu"; await STATS.render();
  ok(/Aylara göre yol/.test(STATS.section.innerHTML), "tümü: aylık çubuklar");
  // Sekme
  ok(STATS.button.dataset.tab==="istatistik" && STATS.section.dataset.tab==="istatistik" && STATS.section.className==="tab", "sekme düğmesi ve bölümü");
  showTab("istatistik"); ok(settings.tab==="istatistik", "showTab yeni sekmeyi tanır");
  // Uçtan uca: gerçek kayıt döngüsü (deneme cihazı) sürüş bitince ölçüyü yazar
  const dl=new DemoLink(); dl.t0=Date.now()-44000;
  await start(dl); await wait(4500); const tid=REC.trip.id; stop(); await wait(800);
  const dt=(await getTrips()).find(x=>x.id===tid);
  console.log("  deneme sürüşü ölçüsü:", JSON.stringify(dt.metrics));
  ok(dt.metrics && dt.metrics.mv===STATS.MV && dt.metrics.coolMax!=null, "kayıt döngüsünde tripEnd ölçüsü yazıldı");
  console.log("istatistik: tamam");
`);
