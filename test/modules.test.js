// Diğer beyinler (ABS, hava yastığı…): yalnız okuma izin listesi, UDS ve KWP cevap çözümü, marka seçimi, deneme
// aracında tarama sonucu (etkin kod, kayıtlı kod, kod yok, eski protokol, sessiz beyin); yazan komut hiç gönderilmez
const fs=require("fs"), path=require("path");
const src=fs.readFileSync(path.join(__dirname,"..","features","modules.js"),"utf8");
// kaynakta yazan servislerin komut dizisi olarak geçmediğini de denetle (yorumlar hariç)
const code=src.replace(/\/\/.*$/gm,"");
for(const bad of ["\"14","'14","\"2E","\"31","\"27","\"11","\"28","\"85","\"2F","\"34","\"3B"]) if(new RegExp(bad+"[0-9A-F]{2,}\"").test(code)) { console.error("yazan komut kaynakta: "+bad); process.exit(1); }
require("./harness")(String.raw`
  const M=MODULES;
  for(const ok of ["1902AF","1902FF","17FF00","1802FF00","3E00","10C0","1003","ATSH740"]) M.safe(ok);
  for(const bad of ["14FFFFFF","2E1234AA","3101FF00","2701","1101","04","2F12340300","3400"]) { let t=false; try{ M.safe(bad); }catch(e){ t=true; } if(!t) throw new Error("izin listesi geçirdi: "+bad); }
  // UDS: 2 kod, biri etkin; KWP 17: 1 kod; olumsuz cevap
  const u=M.parse("5902FF40351109C1558708","uds");
  if(!u.ok || u.codes.length!==2 || u.codes[0].code!=="C0035" || u.codes[0].ftb!==0x11 || !u.codes[0].active || u.codes[1].code!=="U0155" || u.codes[1].active || !u.codes[1].stored)
    throw new Error("UDS çözümü: "+JSON.stringify(u));
  const mf=M.parse("00B\r0:5902FF403511\r1:09C1558708","uds");
  if(!mf.ok || mf.codes.length!==2) throw new Error("çok parçalı UDS: "+JSON.stringify(mf));
  const k=M.parse("57019012E0","kwp17");
  if(!k.ok || k.codes[0].code!=="B1012" || !k.codes[0].lamp) throw new Error("KWP çözümü: "+JSON.stringify(k));
  if(M.parse("7F1911","uds").neg!=="11" || M.parse("NO DATA","uds")!==null) throw new Error("olumsuz / boş cevap");
  if(M.BRAND_OF("Renault")!=="renault" || M.BRAND_OF("Škoda")!=="vag" || M.BRAND_OF("Opel (Stellantis)")!=="psa" || M.BRAND_OF("Kia")!=="hyundai") throw new Error("marka eşleme");
  // deneme aracında tarama (Renault seçili: oturum 10C0 dahil)
  settings.modBrand="renault";
  const L=DIAGPACK.LOG, mark=L.first.length+L.last.length;
  await start(new DemoLink()); await wait(1500);
  const res=await M.scan();
  const by=Object.fromEntries(res.map(x=>[x.tx,x]));
  if(by["740"].state!=="ok" || by["740"].codes.length!==2) throw new Error("ABS: "+JSON.stringify(by["740"]));
  if(by["752"].state!=="ok" || by["752"].codes.length) throw new Error("hava yastığı: "+JSON.stringify(by["752"]));
  if(by["743"].state!=="ok" || by["743"].via!=="17FF00" || by["743"].codes[0].code!=="B1012") throw new Error("KWP beyni: "+JSON.stringify(by["743"]));
  if(by["745"].state!=="silent") throw new Error("sessiz beyin: "+by["745"].state);
  if(!S.alarms.has("mods")) throw new Error("etkin kod uyarısı yok");
  const sent=[...L.first,...L.last].slice(mark).map(e=>e.cmd).filter(c=>!/^AT|^0[0-9]|^STI|^STDI/.test(c));
  const writes=sent.filter(c=>/^(14|2E|3B|31|27|11|28|85|2F|3[4-7])/.test(c));
  if(writes.length) throw new Error("yazan komut gönderildi: "+writes);
  if(!sent.includes("10C0")) throw new Error("Renault oturumu açılmadı");
  // motor okuması sürüyor (başlık geri alındı)
  const ts=S.g["0C"].ts; await wait(1200); if(!(S.g["0C"].ts>ts)) throw new Error("taramadan sonra motor okuması durdu");
  stop(); await wait(400);
  settings.modBrand="fiat"; M.paint(); if(!/29 bit/.test($("modBox").innerHTML)) throw new Error("Fiat açıklaması yok");
  console.log("diğer beyinler: izin listesi, UDS/KWP çözümü, marka, 4 beyin tarama, yazma yok tamam ("+sent.length+" okuma komutu)");
`);
