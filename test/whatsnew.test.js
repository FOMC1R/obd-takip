// Yenilikler penceresi: liste güncel sürümle başlıyor (yayında unutulmasın), sürüm karşılaştırma, atlanan sürümlerin
// birleşmesi, bir kez gösterim, ilk kurulumda gösterilmemesi
require("./harness")(String.raw`
  const W=WHATSNEW;
  if(W.CHANGES[0].v!==APP_VERSION) throw new Error("features/whatsnew.js CHANGES başında "+APP_VERSION+" yok (şu an "+W.CHANGES[0].v+"). Yayından önce yenilikleri yaz.");
  for(const c of W.CHANGES) if(!c.items.length || c.items.some(i=>!i || i.length>220)) throw new Error("madde boş ya da çok uzun: "+c.v);
  for(let i=1;i<W.CHANGES.length;i++) if(W.cmp(W.CHANGES[i-1].v, W.CHANGES[i].v)<=0) throw new Error("sıra yeniden eskiye olmalı");
  if(!(W.cmp("1.21","1.9")>0 && W.cmp("1.20","1.20")===0 && W.cmp("1.19","1.20")<0)) throw new Error("sürüm karşılaştırma");
  // harness'te ayar kaydı yok = ilk kurulum: gösterilmemeli
  if(!FIRST_RUN || settings.seenVersion!==APP_VERSION || W.unseen().length) throw new Error("ilk kurulumda yenilik gösterildi");
  // iki sürüm atlamış kullanıcı: maddeler birleşir, bir kez gösterilir
  settings.seenVersion="1.19";
  const u=W.unseen().map(c=>c.v); if(u.includes("1.19") || !u.includes(APP_VERSION)) throw new Error("atlanan sürümler: "+u);
  if(!W.show() || !W.open) throw new Error("pencere açılmadı");
  const html=$("wnBack").innerHTML; if(!html.includes("Sürüm "+APP_VERSION) || html.includes("Sürüm 1.19")) throw new Error("içerik: "+html.slice(0,200));
  W.close(); if(W.open || settings.seenVersion!==APP_VERSION || W.unseen().length) throw new Error("kapatınca görüldü sayılmadı");
  if(W.show()) throw new Error("ikinci kez gösterildi");
  if(!$("wnCard").innerHTML.includes("Sürüm 1.19")) throw new Error("Ayarlar'daki tam liste eksik");
  console.log("yenilikler: güncel sürüm listede, karşılaştırma, ilk kurulum, birleştirme, tek gösterim tamam");
`);
