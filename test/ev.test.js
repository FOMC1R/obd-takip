// Elektrikli araç eklentisi: formül çözücü, CSV, başlık değiştirip geri yükleme, EV deneme modu uçtan uca
require("./harness")(String.raw`
  const eq=(a,b,msg)=>{ if(!(a===b || (typeof a==="number" && typeof b==="number" && Math.abs(a-b)<1e-9))) throw new Error(msg+": "+a+" != "+b); };
  const E=EVA.evalExpr;

  // 1) Formül çözücü: öncelik, işaretli değerler, bitler, eksik bayt
  eq(E("2+3*4",[]),14,"öncelik");            eq(E("(2+3)*4",[]),20,"parantez");
  eq(E("-A+B",[1,5]),4,"tekli eksi");        eq(E("A-B-C",[10,3,2]),5,"soldan sağa");
  eq(E("A/B/2",[16,4]),2,"bölme soldan");    eq(E("(A*256+B)/512",[0xA9,0x0C]),84.5234375,"e-208 SOC");
  eq(E("Signed(A)",[0xFF]),-1,"Signed");     eq(E("signed(a)*256+b",[0xFF,0xFE]),-2,"küçük harf + işaretli 16 bit");
  eq(E("Int16(A,B)/10",[0x80,0x00]),-3276.8,"Int16"); eq(E("ShortSigned(A,B)",[0x7F,0xFF]),32767,"ShortSigned");
  eq(E("{A:7}+{A:0}",[0x81]),2,"bit");       eq(E("GetBit(A,1)",[2]),1,"GetBit");
  eq(E("AA",new Array(27).fill(0).map((_,i)=>i)),26,"AA = 27. bayt");
  eq(E("A/B",[1,0]),null,"sıfıra bölme");    eq(E("A+D",[1,2]),null,"eksik bayt");
  eq(E("((A*16777216+B*65536+C*256+D)-76800)*0.018",[0,1,0x2C,0xAF]),3.15,"e-208 akım (sürüş +)");
  eq(E("1.5e1+.5",[]),15.5,"ondalık/üs");
  // 2) Kötü niyetli ya da bozuk girdi: hepsi reddedilmeli
  const bad=["constructor","A;alert(1)","process.exit()","this","A[0]","\x60x\x60","a=1","__proto__","Signed(A","A+","(A","Foo(A)","A B","toString()","A.constructor","'x'","A**2","Signed(A,B)","{A:9}","x".repeat(201)];
  for(const s of bad){ let ok=false; try{ EVA.compile(s); }catch(e){ ok=true; } if(!ok) throw new Error("reddedilmedi: "+s); }
  console.log("formül çözücü: tamam ("+bad.length+" kötü girdi reddedildi)");

  // 3) CSV (Torque başlıklı + Car Scanner ek sütunlu + tırnaklı ad + hatalı satırlar)
  const csv=[
    "Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header",
    "SOC,SOC,0x22D410,(A*256+B)/512,0,100,%,6B4:694",
    '"Voltaj, HV",HVV,22d815,(a*256+b)/16,200,450,V,6B4:694,,,1',
    "000_Battery Current,Batt Current,0x220101,((Signed(K)*256)+L)/10,-230,230,A,7E4",
    "Hız,SPD,010D,A,0,200,km/h,auto",
    "Kötü,BAD,0x22D410,A;alert(1),0,1,x,6B4",
    "Yazma,W,0x2EF190,A,0,1,x,7E0",
    "Başlık,H,0x22D410,A,0,1,x,ZZZ",
  ].join("\n");
  const P=EVA.parseCsv(csv);
  console.log("CSV satır:", P.rows.length, "hata:", P.errors.length, "|", P.rows.map(r=>r.cmd+"@"+(r.header||"-")+(r.rx?">"+r.rx:"")).join(" "));
  if(P.rows.length!==4 || P.errors.length!==3) throw new Error("CSV ayrıştırma yanlış");
  if(P.rows[1].name!=="Voltaj, HV" || P.rows[1].rx!=="694" || P.rows[2].header!=="7E4" || P.rows[3].header!=="") throw new Error("CSV alanları yanlış");
  const r1=EVA.importCsv(csv), cp=EVA.customPid(P.rows[0]);
  if(r1.added!==4 || !GBY[cp] || settings.lim[cp].show!==false) throw new Error("CSV içe aktarma göstergeleri yanlış");
  if(EVA.importCsv(csv).added!==0) throw new Error("aynı satır iki kez eklendi");
  EVA.removeCustom(EVA.customPid(P.rows[3]));
  if(settings.customPids.length!==3 || GBY[EVA.customPid(P.rows[3])]) throw new Error("kaldırma çalışmadı");
  console.log("CSV içe aktarma: 4 eklendi, tekrar 0, biri kaldırıldı -> kalan", settings.customPids.length);

  // 4) EV deneme: Corsa-e profili otomatik bulunmalı, başlık değişip geri gelmeli
  settings.record=true; settings.fuel="elektrik"; settings.evProfile="auto"; buildSettings();
  if(settings.lim.FL.show || settings.lim.FK.show || settings.lim["0C"].show) throw new Error("EV'de yakıt/motor göstergeleri gizlenmedi");
  const d=new DemoLink(); d.ev=true; d.t0=Date.now()-3000;
  await start(d); await wait(7000);
  console.log("profil:", EVA.profileKey(), "| SOC", S.g.EV_SOC.v&&S.g.EV_SOC.v.toFixed(1), "| V", S.g.EV_V.v&&S.g.EV_V.v.toFixed(1),
    "| I", S.g.EV_I.v&&S.g.EV_I.v.toFixed(1), "| P kW", S.g.EVP.v&&S.g.EVP.v.toFixed(1), "| kWh/100", S.g.EVK.v&&S.g.EVK.v.toFixed(1),
    "| SOH", S.g.EV_SOH.v, "| hücre", S.g.EV_CMIN.v, S.g.EV_CMAX.v, "| 5B", S.g["5B"].v&&S.g["5B"].v.toFixed(0), "| km", S.g.A6.v);
  if(EVA.profileKey()!=="corsae") throw new Error("profil bulunamadı");
  if(!(S.g.EV_SOC.v>70 && S.g.EV_SOC.v<73)) throw new Error("SOC yanlış");
  if(!(S.g.EV_V.v>380 && S.g.EV_V.v<450)) throw new Error("voltaj yanlış");
  const pCalc=cur("EV_V")*cur("EV_I")/1000;
  if(S.g.EVP.v==null || Math.abs(EVA.powerKw()-pCalc)>1e-9) throw new Error("güç = V×I/1000 değil");
  if(S.g.EVK.v==null) throw new Error("kWh/100 km hesaplanmadı");
  if(S.g.EV_SOH.v!==97.5 || !(S.g.A6.v>12345)) throw new Error("SOH/km yanlış");
  if(!settings.lim.EV_SOC.show || !settings.lim.EVP.show) throw new Error("EV göstergeleri görünmüyor");
  S.paused=true; await wait(1500);   // döngü elindeki bloğu bitirsin
  const at=d.at.join(" ");
  if(!/ATSH6B4/.test(at) || !/ATCRA694/.test(at) || !/ATFCSM1/.test(at) || !/ATFCSM0/.test(at) || !/ATSH7DF/.test(at)) throw new Error("başlık komutları eksik: "+at);
  console.log("başlık sonrası cihaz: hdr", d.hdr, "filtre", d.filter, "| motor filtresi", S.cra);
  if(d.hdr!=="7DF" || d.filter!==S.cra || S.cra!=="7E8") throw new Error("başlık/filtre geri yüklenmedi");
  // blok sürerken araya giren istek motor adresine gitmeli (6B4'e değil)
  let other=null;
  const blk=EVA.withHeader("6B4","694", async send=>{ await wait(150); return send("22D410"); });
  other=S.elm.send("010D");
  const [inBlk, o]=await Promise.all([blk, other]);
  console.log("blok içi:", inBlk.trim(), "| araya giren 010D:", o.trim(), "| sonra hdr", d.hdr);
  if(!/^62D410/.test(inBlk.trim()) || !/^410D/.test(o.trim()) || d.hdr!=="7DF") throw new Error("kilit çalışmadı");
  S.paused=false;

  // 5) Şarj: hız 0, akım eksi
  d.charging=true; await wait(3500);
  const cs=EVA.chargeState(); console.log("şarj:", cs.text, "| şarj cihazı kodu", S.g.EV_CHG.v);
  if(cs.k!=="chg" || !/Şarj oluyor · 7,\d kW/.test(cs.text)) throw new Error("şarj algılanmadı");
  d.charging=false; await wait(1500);

  // 6) Sürüş kaydı: harcanan kWh ve kWh/100 km
  const id=REC.trip.id; stop(); await wait(800);
  const t=(await getTrips()).find(x=>x.id===id);
  console.log("sürüş: kWh", t.kwh, "| km", t.odo&&t.odo.toFixed(3), "| kWh/100", t.kwh100, "| şarj kWh", t.kwhCharged&&t.kwhCharged.toFixed(4), "| %", t.socStart&&t.socStart.toFixed(1), "->", t.socEnd&&t.socEnd.toFixed(1));
  if(!(t.kwh>0) || !(t.kwhCharged>0) || t.socStart==null) throw new Error("sürüş enerjisi kaydedilmedi");
  // 7) Benzine dönünce eski görünüm
  settings.fuel="benzin"; buildSettings();
  if(!settings.lim.FL.show || !settings.lim["0C"].show || settings.lim.EV_SOC.show) throw new Error("benzine dönünce göstergeler geri gelmedi");
  console.log("benzine dönüş: yakıt göstergeleri geri geldi, EV göstergeleri gizlendi");
`);
