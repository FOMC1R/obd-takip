// Uyarı şeridi: tek satırda en önemli uyarı + "+N", "Gördüm" uyarıyı S.alarms'tan silmez,
// uyarı kalkıp yeniden gelince yine görünür, liste açılıp kapanır
require("./harness")(String.raw`
  paintAlarms();
  const bar=$("alarmBar"), txt=$("alarmBarText"), more=$("alarmBarMore"), panel=$("alarmPanel");
  [...S.alarms.keys()].forEach(k=>drop(k));
  if(!bar.hidden) throw new Error("uyarı yokken şerit görünüyor");

  raise("g07","warn","Uzun süreli yakıt ayarı: 13,3 %",false);
  if(bar.hidden || txt.textContent!=="Uzun süreli yakıt ayarı: 13,3 %" || more.textContent!=="") throw new Error("tek uyarı şeridi yanlış: "+txt.textContent+" / "+more.textContent);
  if(!bar.className.includes("warn")) throw new Error("uyarı rengi yok");

  // kritik uyarı, sarının önüne geçer; sayı rozeti öbürlerini sayar
  raise("g05","crit","Soğutma suyu sıcaklığı: 114 °C",false);
  raise("mis","warn","Tekleme sayacı: 14",false);
  raise("dtcP0301","crit","Yeni arıza kodu: P0301",false);
  console.log("şerit:", txt.textContent, more.textContent, "|", bar.className);
  if(txt.textContent!=="Yeni arıza kodu: P0301" && txt.textContent!=="Soğutma suyu sıcaklığı: 114 °C") throw new Error("kritik uyarı önde değil");
  if(more.textContent!=="+3" || !bar.className.includes("crit")) throw new Error("+N ya da renk yanlış");
  const order=alarmOrder().map(([k])=>k);
  if(order.slice(0,2).some(k=>!["g05","dtcP0301"].includes(k))) throw new Error("sıralama yanlış: "+order);

  // Gördüm: şeritten iner, S.alarms'ta kalır
  const first=order[0];
  seeAlarm(first);
  if(!S.alarms.has(first)) throw new Error("Gördüm uyarıyı sildi");
  if(txt.textContent===S.alarms.get(first).text) throw new Error("görülen uyarı hâlâ şeritte");
  if(more.textContent!=="+3") throw new Error("görülen uyarı sayıdan düştü");
  order.forEach(seeAlarm);
  if(S.alarms.size!==4) throw new Error("hepsi görülünce uyarılar silindi");
  if(!bar.className.includes("quiet") || !/4 uyarı sürüyor/.test(txt.textContent) || bar.hidden) throw new Error("hepsi görülünce sakin şerit yok: "+txt.textContent);

  // kalkıp yeniden gelen uyarı yine görünür
  drop("g05"); raise("g05","crit","Soğutma suyu sıcaklığı: 115 °C",false);
  if(txt.textContent!=="Soğutma suyu sıcaklığı: 115 °C" || bar.className.includes("quiet")) throw new Error("yeniden gelen uyarı görünmedi");

  // liste: şeride dokununca açılır, Kapat ile kapanır; son uyarı kalkınca kendiliğinden kapanır
  $("alarmList")._kids=[];
  bar.ev.click();
  if(panel.hidden || bar.attrs["aria-expanded"]!=="true") throw new Error("liste açılmadı");
  const lis=$("alarmList")._kids;
  if(lis.length!==4) throw new Error("listede 4 uyarı yok: "+lis.length);
  if(lis.filter(l=>l.className.includes("seen")).length!==3) throw new Error("görüldü işaretleri yanlış");
  $("alarmClose").ev.click();
  if(!panel.hidden) throw new Error("Kapat çalışmadı");
  openAlarms(true);
  $("alarmSeenAll").ev.click();
  if(!panel.hidden || !bar.className.includes("quiet") || S.alarms.size!==4) throw new Error("Hepsini gördüm yanlış");
  openAlarms(true);
  [...S.alarms.keys()].forEach(k=>drop(k));
  if(!bar.hidden || !panel.hidden) throw new Error("uyarı kalmayınca şerit/liste kapanmadı");
  openAlarms(true); if(!panel.hidden) throw new Error("boşken liste açıldı");
  console.log("uyarı şeridi: tek satır, +N, gördüm, yeniden gelme, liste tamam");
`);
