require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); console.log("  tamam:",m); };
  const p2=n=>String(n).padStart(2,"0"), d=new Date(), today=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate());
  settings.expenses=[];
  ok(Expenses.add({type:"Bakım",amount:""})===null, "tutarsız kayıt eklenmez");
  // Depo dolumları: ilk kısmi alım (tam dolumdan önce) hesaba girmez
  Expenses.add({date:today,type:"Yakıt",amount:900, km:9800, litre:11, full:false});
  Expenses.add({date:today,type:"Yakıt",amount:3200,km:10000,litre:40, full:true});
  Expenses.add({date:today,type:"Yakıt",amount:1200,km:10300,litre:15, full:false});
  Expenses.add({date:today,type:"Yakıt",amount:1760,km:10600,litre:22, full:true});
  let r=Expenses.realEconomy(); ok(r && r.dist===600 && Math.abs(r.l100-37/600*100)<1e-9, "iki tam dolum arası (kısmi dahil): "+r.l100.toFixed(2)+" L/100 km");
  Expenses.add({date:today,type:"Yakıt",amount:2080,km:11000,litre:26,full:true,note:"Shell"});
  r=Expenses.realEconomy(); ok(r.dist===1000 && Math.abs(r.l100-6.3)<1e-9 && r.segs===2, "üç tam dolum: 6,3 L/100 km");
  // Uygulamanın tahmini: deneme ve çok kısa sürüşler hariç
  const trips=[{fuel:3.3,odo:60},{fuel:2.2,odo:40},{fuel:0.2,odo:0.5},{fuel:9,odo:50,demo:true}];
  const est=Expenses.estEconomy(trips); ok(est && Math.abs(est.l100-5.5)<1e-9, "tahmini ortalama 5,5 L/100 km");
  ok(Expenses.suggestCalib(r,est,100)===115, "düzeltme önerisi: 100 × 6,3 / 5,5 → 115");
  ok(Expenses.suggestCalib(r,{l100:6.25},100)===null, "fark %3'ten azsa öneri yok");
  ok(Expenses.suggestCalib({l100:6,dist:50},est,100)===null, "yol azsa öneri yok");
  // Toplamlar
  Expenses.add({date:today,type:"Otopark-Köprü",amount:95.5});
  Expenses.add({date:"2001-01-05",type:"Vergi",amount:500});
  const t=Expenses.totals();
  ok(t.month===900+3200+1200+1760+2080+95.5 && t.year===t.month, "bu ay / bu yıl: "+t.month);
  ok(t.span===1200 && Math.abs(t.perKm-(3200+1200+1760+2080+95.5)/1200)<1e-9, "km başına: "+t.perKm.toFixed(2)+" TL");
  // CSV
  const c=Expenses.csv(); ok(c.includes("Tarih;Tür;Tutar (TL);Km;Litre;Depo dolu;Not") && c.includes(";95,5;") && c.includes('"Shell"'), "CSV başlık ve virgüllü ondalık");
  // Silme
  const n=settings.expenses.length; Expenses.remove(settings.expenses[0].id); ok(settings.expenses.length===n-1, "silindi");
`);
