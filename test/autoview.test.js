// Sürüşte otomatik açma: kapalıyken açmaz, kısa/yavaş sürüşte açmaz, 5 sn sonra seçileni açar,
// elle kapatınca aynı sürüşte açmaz, duruştan sonra yeniden açar, durunca kapatır, bağlantı kopunca sıfırlanır
require("./harness")(String.raw`
  const AV=window.AUTOVIEW, CL=window.CLUSTER, HD=window.HUD;
  if(!AV || !CL || !HD) throw new Error("AUTOVIEW/CLUSTER/HUD yok");
  AV.stopTimer();   // zamanı test yönetsin
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(1500);
  S.paused=true; await wait(800);   // canlı okuma hızı ezmesin
  let T=1e12;
  const sp=v=>{ S.g["0D"].v=v; S.g["0D"].ts=Date.now(); };
  const run=(v,ms,step=1000)=>{ for(let t=0;t<ms;t+=step){ sp(v); T+=step; AV.check(T); } };
  const anyOpen=()=>CL.isOpen||HD.isOpen;

  // 1) kapalı: açmaz
  settings.autoView="off"; run(60,10000);
  if(anyOpen()) throw new Error("kapalıyken açtı");
  // 2) eşik altı ve kısa süre: açmaz
  settings.autoView="cluster"; run(0,2000);
  run(10,10000); if(anyOpen()) throw new Error("eşik altında açtı");
  run(40,3000); if(anyOpen()) throw new Error("5 sn dolmadan açtı");
  run(10,1000); run(40,3000); if(anyOpen()) throw new Error("kesintili hızda açtı");
  // 3) 5 sn üstünde: panel açılır
  run(40,3000); if(!CL.isOpen || HD.isOpen) throw new Error("5 sn sonra panel açılmadı");
  console.log("açıldı:", AV.state.opened);
  // 4) elle kapat: aynı sürüşte açmaz
  CL.close(); run(60,20000);
  if(anyOpen() || !AV.state.dismissed) throw new Error("elle kapatınca yeniden açtı");
  // kısa duruş yetmez
  run(0,30000); run(60,8000); if(anyOpen()) throw new Error("kısa duruştan sonra açtı");
  // 5) 1 dk duruştan sonra yeniden açar
  run(0,61000); run(60,6000);
  if(!CL.isOpen) throw new Error("duruş sonrası yeniden açmadı");
  // 6) durunca kapat (seçiliyse)
  settings.autoViewClose=true; run(0,60000); if(!CL.isOpen) throw new Error("erken kapattı");
  run(0,61000); if(CL.isOpen) throw new Error("2 dk duruşta kapatmadı");
  if(AV.state.dismissed) throw new Error("otomatik kapatma elle kapatma sayıldı");
  settings.autoViewClose=false;
  // 7) HUD seçimi
  settings.autoView="hud"; run(50,6000);
  if(!HD.isOpen || CL.isOpen) throw new Error("HUD açılmadı");
  // zaten açıkken ikinciyi açmaz
  settings.autoView="cluster"; run(50,6000); if(CL.isOpen) throw new Error("HUD açıkken panel de açıldı");
  HD.close(); run(50,3000);
  if(!AV.state.dismissed) throw new Error("HUD elle kapatma algılanmadı");
  // 8) bağlantı kopunca sıfırlanır
  S.paused=false; stop(); await wait(600);
  AV.check(T+1000);
  const st=AV.state;
  if(st.dismissed || st.moveSince!=null || st.opened) throw new Error("bağlantı kopunca sıfırlanmadı: "+JSON.stringify(st));
  // bağlı değilken hız olsa bile açmaz
  sp(80); run(80,10000); if(anyOpen()) throw new Error("bağlı değilken açtı");
  // 9) GPS hızı (araç hızı yokken)
  const d2=new DemoLink(); d2.t0=Date.now()-44000; await start(d2); await wait(1500); S.paused=true; await wait(800);
  S.g["0D"].v=null; settings.autoView="cluster";
  for(let i=0;i<7;i++){ S.g["0D"].v=null; T+=1000; REC.fix={lat:0,lon:0,acc:5,gs:30,t:T}; AV.check(T); }
  if(!CL.isOpen) throw new Error("GPS hızıyla açılmadı");
  CL.close(); S.paused=false; stop(); await wait(600);
  settings.autoView="off";
  console.log("otomatik açma: kapalı, eşik, süre, elle kapatma, duruş, durunca kapat, HUD, sıfırlama, GPS tamam");
`);
