require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); console.log("  tamam:",m); };
  // Deneme aracı: 44. saniyede kayıtlı P0301, bekleyen P0171, arıza lambası yanık, donmuş kare var
  const demo=new DemoLink(); demo.t0=Date.now()-44000;
  settings.record=true; settings.gps=false;
  Maint.setOdo(148230,"manual"); Maint.setItem("yag",{lastKm:133500,lastDate:"2025-09-01"});
  await start(demo); await wait(7000);
  S.batt={time:Date.now(), rows:[["Dinlenme voltajı","12,52 V"],["Marşta en düşük","10,10 V"]], notes:["Akü dolu görünüyor."], bad:false};
  stop(); await wait(800);
  const d=await Report.collect();
  ok(d.mil===true, "arıza lambası durumu alındı");
  ok(d.dtc.some(x=>x.code==="P0301"&&x.kind==="stored"&&x.severe) && d.dtc.some(x=>x.code==="P0171"&&x.kind==="pending"), "kodlar: "+d.dtc.map(x=>x.code+"/"+x.kind).join(", "));
  ok(d.freeze && d.freeze.length>2, "donmuş kare satırı: "+(d.freeze&&d.freeze.length));
  ok(d.ready && d.ready.items.length>0 && d.counters && d.counters.length>0, "muayene hazırlığı ve sayaçlar");
  ok(d.trip && d.trip.dur>5000 && d.trip.crit.length>0, "son sürüş: "+Math.round(d.trip.dur/1000)+" sn, "+d.trip.crit.length+" kritik uyarı");
  ok(d.maint.some(x=>x.name==="Motor yağı + filtre"), "bakım özeti");
  const h=Report.html(d);
  for(const s of ["Araç arıza raporu","P0301","1. silindirde tekleme","YANIYOR","Bekleyen (henüz kesinleşmedi)","Donmuş kare","Muayene hazırlığı","Şase no (VIN)","NMTK33BE5R0045678","Dinlenme voltajı","Son sürüş","Bakım durumu","Motor yağı + filtre","148.230 km","Kesin teşhis değildir"])
    if(!h.includes(s)) throw new Error("raporda yok: "+s);
  console.log("  tamam: rapor içeriği tam ("+h.length+" karakter)");
  ok(!/<script/i.test(Report.html({...d, car:"<script>x</script>"})), "araç adı kaçışlı yazılıyor");
  // Hiç bağlanılmamışken de rapor çıkar
  const empty=Report.html({now:Date.now(),dtc:[],mil:null,maint:null,trip:null,vehicle:null,freeze:null,ready:null,counters:null,batt:null,odo:null});
  ok(empty.includes("Arıza taraması yapılmadı") && empty.includes("Akü testi yapılmadı"), "boş veriyle rapor");
  await Report.open({print:false}); Report.close(); console.log("  tamam: rapor açıldı / kapandı");
`);
