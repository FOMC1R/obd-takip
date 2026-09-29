// Markaya özel deneysel değerler: izin listesi (yalnız 21/22 okuma), OBDb formüllerinin çözümü, deneme aracında
// bağlantıda bir kez arama, yalnız cevap verenlerin gösterilmesi, satıra kayıt, motor okumasının sürmesi
const fs=require("fs"), path=require("path");
const src=fs.readFileSync(path.join(__dirname,"..","features","brandlive.js"),"utf8").replace(/\/\/.*$/gm,"");
for(const bad of ["\"14","\"2E","\"31","\"27","\"11","\"28","\"85","\"2F","\"34","\"3B"]) if(new RegExp(bad+"[0-9A-F]{2,}\"").test(src)) { console.error("yazan komut kaynakta: "+bad); process.exit(1); }
require("./harness")(String.raw`
  const B=BRANDLIVE;
  for(const ok of ["22704E","2103","ATSH7E1"]) B.safe(ok);
  for(const bad of ["2E704E00","14FFFFFF","3101FF00","1902FF","2701"]) { let t=false; try{ B.safe(bad); }catch(e){ t=true; } if(!t) throw new Error("izin listesi geçirdi: "+bad); }
  // her tanım izin listesinden geçiyor
  for(const k in B.SIG) for(const s of B.SIG[k]) B.safe(s.cmd);
  // çözüm: Ford °F → °C, Toyota /256, aralık dışı değer atılır
  const ford=B.SIG.ford[0], toy=B.SIG.toyota[0], vw=B.SIG.vag[0];
  if(Math.round(B.decode(ford,[0x05,0x80]))!==80) throw new Error("Ford °F: "+B.decode(ford,[0x05,0x80]));
  if(B.decode(toy,[0x78,0x00])!==80) throw new Error("Toyota: "+B.decode(toy,[0x78,0x00]));
  if(B.decode(vw,[0xFF])!==null) throw new Error("aralık dışı (205 °C) atılmadı");
  // deneme aracı (Peugeot): ilk iki numara cevap verir, üçüncüsü "desteklenmiyor"
  settings.modBrand="psa";
  const L=DIAGPACK.LOG, mark=L.first.length+L.last.length;
  await start(new DemoLink()); await wait(1500);
  await B.probe();
  if(B.st.found.join()!=="atf,soot") throw new Error("bulunan: "+B.st.found);
  if(B.st.live.atf.v!==80 || B.st.live.soot.v!==20) throw new Error("değerler: "+JSON.stringify(B.st.live));
  B.paint(); if($("blCard").hidden || !/80 °C/.test($("blBox").innerHTML) || /yakma/i.test($("blBox").innerHTML)) throw new Error("kart: "+$("blBox").innerHTML);
  const row={t:Date.now()}; emit("sample", row, {id:1});
  if(!row.b || row.b.atf!==80 || row.b.soot!==20) throw new Error("kayıt: "+JSON.stringify(row.b));
  const sent=[...L.first,...L.last].slice(mark).map(e=>e.cmd).filter(c=>/^2[12]/.test(c));
  if(sent.some(c=>!/^(22[0-9A-F]{4}|21[0-9A-F]{2})$/.test(c))) throw new Error("izin dışı: "+sent);
  const ts0=Object.fromEntries(Object.entries(S.g).map(([k,g])=>[k,g.ts||0])); await wait(1500);
  // motor değerleri sırayla okunur; o pencerede hangisi gelirse (devir, hız, sıcaklık…) okuma sürüyor demektir
  if(!Object.entries(S.g).some(([k,g])=>(g.ts||0)>ts0[k])) throw new Error("okumadan sonra motor okuması durdu");
  stop(); await wait(400);
  console.log("markaya özel: izin listesi, formüller, arama, kart, kayıt tamam ("+sent.length+" okuma)");
`);
