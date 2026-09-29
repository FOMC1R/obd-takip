// Başlık kilidi: arıza taraması (ATAR … ATCRA) ile başka beyin okuması (ATSH7E1 …) aynı anda başlasa da
// komutlar iç içe geçmez; kaybolan arıza kodu "bildirildi" listesinden çıkar, geri gelince yeniden uyarılır
require("./harness")(String.raw`
  settings.sysEvery=600;   // zamanlayıcı araya girmesin; okumayı test başlatsın
  const d=new DemoLink(); d.t0=Date.now()-44000;   // deneme cihazı kodları göstersin
  await start(d);
  for(let i=0;i<60 && !SYS.st.probed;i++) await wait(250);
  if(!SYS.tcm()) throw new Error("şanzıman bulunamadı");
  const L=DIAGPACK.LOG, mark=L.first.length+L.last.length;
  // En riskli an: tarama süzgeci kaldırdıktan (ATAR) hemen sonra şanzıman okuması başlasın
  const seen=c=>[...L.first,...L.last].slice(mark).some(e=>e.cmd===c);
  const p1=scanDtc();
  for(let i=0;i<400 && !seen("ATAR");i++) await new Promise(r=>setTimeout(r,2));
  if(!seen("ATAR")) throw new Error("tarama başlamadı");
  await Promise.all([p1, SYS.readRound()]);
  await Promise.all([scanDtc(), SYS.readRound()]);
  const cmds=[...L.first,...L.last].slice(mark).map(e=>e.cmd);
  // her ATAR ile sonraki ATCRA7E8 arasında ATSH olmamalı; her ATSH7E1 ile ATSH7DF arasında ATAR/03/07/0A olmamalı
  let inScan=false, inHdr=false;
  for(const c of cmds){
    if(c==="ATAR"){ if(inHdr) throw new Error("tarama başlık bloğunun içine girdi: "+cmds.join(" ")); inScan=true; }
    else if(c==="ATCRA7E8" && inScan) inScan=false;
    else if(/^ATSH7E[1-7]$/.test(c)){ if(inScan) throw new Error("başlık bloğu taramanın içine girdi: "+cmds.join(" ")); inHdr=true; }
    else if(c==="ATSH7DF") inHdr=false;
    else if(/^0[37A]$/.test(c) && inHdr) throw new Error("arıza sorgusu şanzımana gitti: "+cmds.join(" "));
  }
  if(!cmds.includes("ATAR") || !cmds.includes("ATSH7E1")) throw new Error("iki iş de çalışmadı: "+cmds.join(" "));
  // kaybolan kod listeden çıkar
  S.known.add("storedP9999");
  await scanDtc();
  if(S.known.has("storedP9999")) throw new Error("kaybolan kod bildirildi listesinde kaldı");
  if(![...S.known].some(k=>/P0301/.test(k))) throw new Error("mevcut kod listeden düştü: "+[...S.known]);
  stop(); await wait(400);
  console.log("başlık kilidi: tarama ve şanzıman okuması iç içe geçmedi ("+cmds.length+" komut), kod listesi tamam");
`);
