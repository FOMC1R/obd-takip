// OBD cihazı: STN çipli cihaz tanınır ve başka beyin okuması STPX ile yapılır (ATSH gönderilmez), sonuçlar aynıdır;
// STPX'i anlamayan cihazda bir kez eski yola dönülür; sıradan ELM327'de STPX hiç denenmez
require("./harness")(String.raw`
  settings.sysEvery=600;
  const L=DIAGPACK.LOG, cmds=m=>[...L.first,...L.last].slice(m).map(e=>e.cmd);
  // 1) OBDLink
  const d=new DemoLink(); d.stn=true;
  await start(d);
  for(let i=0;i<60 && !SYS.st.probed;i++) await wait(250);
  if(!S.stn || !/^STN2120/.test(S.stn.fw) || S.adapter.name!=="OBDLink MX+ r3.2.1") throw new Error("STN tanınmadı: "+JSON.stringify(S.adapter));
  if(!SYS.tcm()) throw new Error("STPX ile şanzıman bulunamadı");
  let m=L.first.length+L.last.length;
  await SYS.readRound();
  const c1=cmds(m);
  if(c1.some(c=>/^ATSH7E1/.test(c)) || !c1.some(c=>/^STPX H:7E1, D:0105/i.test(c))) throw new Error("STPX kullanılmadı: "+c1.join(" "));
  if(!(SYS.live["7E1"] && SYS.live["7E1"]["05"])) throw new Error("STPX ile değer okunmadı");
  // 2) STPX'i anlamayan STN: bir kez eski yola dön
  const o=DemoLink.prototype.reply; DemoLink.prototype.reply=function(cmd){ return /^STPX/.test(cmd) ? "?" : o.call(this,cmd); };
  SYS.live["7E1"]={}; m=L.first.length+L.last.length;
  await SYS.readRound();
  const c2=cmds(m);
  if(S.stn.stpx!==false || !c2.includes("ATSH7E1") || !(SYS.live["7E1"]["05"])) throw new Error("eski yola dönülmedi: "+c2.join(" "));
  m=L.first.length+L.last.length; await SYS.readRound();
  if(cmds(m).some(c=>/^STPX/.test(c))) throw new Error("başarısız STPX yeniden denendi");
  DemoLink.prototype.reply=o;
  stop(); await wait(400);
  // 3) sıradan ELM327
  await start(new DemoLink()); for(let i=0;i<60 && !SYS.st.probed;i++) await wait(250);
  if(S.stn) throw new Error("sıradan cihaz STN sanıldı");
  m=L.first.length+L.last.length; await SYS.readRound();
  if(cmds(m).some(c=>/^STPX/.test(c))) throw new Error("sıradan cihazda STPX denendi");
  stop(); await wait(400);
  console.log("cihaz: STN tanıma, STPX okuma, eski yola dönüş, sıradan ELM327 tamam");
`);
