require("./harness")(String.raw`
  const ok=(c,m)=>{ if(!c) throw new Error(m); console.log("  tamam:",m); };
  const DAY=86400000, now=Date.now(), ago=d=>Maint.isoDay(new Date(now-d*DAY));
  const alarms=[]; on("alarm",(k,l,t)=>alarms.push([k,l,t]));
  // 1) vade hesabı
  Maint.setOdo(50000,"manual");
  Maint.setItem("yag",{lastKm:34000,lastDate:ago(100)});
  let s=Maint.status(Maint.item("yag")); ok(s.remKm===-1000 && s.level==="over", "yağ 1.000 km gecikti: "+Maint.remText(s));
  Maint.setItem("yag",{lastKm:35200}); s=Maint.status(Maint.item("yag")); ok(s.remKm===200 && s.level==="soon", "yağ 200 km kaldı -> yaklaştı: "+Maint.remText(s));
  Maint.setItem("yag",{lastKm:45000,lastDate:ago(30)}); s=Maint.status(Maint.item("yag")); ok(s.level==="ok" && s.remKm===10000 && s.remDays>300, "yağ yeni yapıldı -> yeşil: "+Maint.remText(s));
  Maint.setItem("muayene",{lastDate:ago(720)}); s=Maint.status(Maint.item("muayene")); ok(s.level==="soon" && s.remKm===null && s.remDays<=15 && s.remDays>=0, "muayene tarihe göre yaklaştı: "+Maint.remText(s));
  Maint.setItem("trafik",{lastDate:ago(400)}); s=Maint.status(Maint.item("trafik")); ok(s.level==="over", "sigorta süresi geçti: "+Maint.remText(s));
  ok(Maint.status(Maint.item("kasko")).level==="unknown", "bilgi girilmeyen kalem: bilinmiyor");
  ok(Maint.status(Maint.item("fren")).remKm===null, "yalnızca aylık kalemde km yok");
  // 2) sürüş sonu sayaç artışı (deneme sürüşü sayılmaz)
  emit("tripEnd",{odo:12.5, demo:false}); ok(Math.abs(settings.maint.odo-50012.5)<1e-9, "sürüş sonu +12,5 km -> "+settings.maint.odo);
  emit("tripEnd",{odo:30, demo:true}); ok(Math.abs(settings.maint.odo-50012.5)<1e-9, "deneme sürüşü sayaca eklenmedi");
  // 3) Yapıldı: bugün + güncel km
  Maint.markDone("trafik"); s=Maint.status(Maint.item("trafik")); ok(s.level==="ok" && Maint.item("trafik").lastDate===Maint.isoDay(new Date()), "sigorta yapıldı -> yeşil");
  // 4) günde bir uyarı
  settings.maint.warnDay=null; alarms.length=0;
  ok(Maint.checkDue()===true && Maint.checkDue()===false, "ikinci kontrolde tekrar uyarmadı");
  ok(alarms.length===1 && alarms[0][1]==="warn", "uyarı: "+(alarms[0]&&alarms[0][2]));
  // 5) PID A6 destekleyen araç: bağlanınca sayaç araçtan okunur
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    if(cmd==="0140"){ const r=o.call(this,cmd); return r.slice(0,4)+((parseInt(r.slice(4),16)|1)>>>0).toString(16).toUpperCase().padStart(8,"0"); }
    if(cmd==="0160"||cmd==="0180") return "41"+cmd.slice(2)+"00000001";
    if(cmd==="01A0") return "41A004000000";
    if(cmd==="01A6") return "41A60012D687";   // 1.234.567 -> 123.456,7 km
    return o.call(this,cmd);
  };
  settings.record=false; settings.maint.warnDay=null;
  const d=new DemoLink(); await start(d); await wait(3000);
  ok(settings.maint.odo===123456.7 && settings.maint.odoSrc==="obd", "araçtan okunan km: "+settings.maint.odo);
  stop(); await wait(200);
`);
