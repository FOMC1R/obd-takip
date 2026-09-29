// Kayıt kaybı: gizlenince bekleyen satırlar hemen yazılır; yazma hatasında satırlar atılmaz, sonra yazılır;
// kopmada (yeniden bağlanma) bekleyen satırlar silinmez; çökme sonrası açık kalan sürüş özetiyle kapatılır
require("./harness")(String.raw`
  const dbRows=async id=>(await getSamples(id)).length;
  await wait(1700);   // açılıştaki kurtarma taraması geçsin
  await start(new DemoLink()); await wait(2500);
  const t=REC.trip; if(!t || !t.open) throw new Error("sürüş açık işaretli değil");

  // 1) gizlenme: bekleyen satırlar hemen yazılır
  const waitRows=async()=>{ for(let i=0;i<40 && !REC.buf.length;i++) await wait(250); };
  await waitRows();
  if(!REC.buf.length) throw new Error("bekleyen satır yok, sınanamadı");
  await persistNow();
  if(REC.buf.length || await dbRows(t.id)!==t.samples) throw new Error("gizlenince yazılmadı: db "+(await dbRows(t.id))+" / "+t.samples);

  // 2) yazma hatası: satırlar atılmaz, sonra yazılır
  await waitRows();
  const n0=REC.buf.length; if(!n0) throw new Error("hata testi için satır yok");
  const orig=addSamples; let fail=true;
  addSamples=async arr=>{ if(fail){ fail=false; throw new Error("disk dolu (test)"); } return orig(arr); };
  await flush(t);
  if(REC.buf.length<n0) throw new Error("yazma hatasında satırlar atıldı");
  await flush(t); addSamples=orig;
  if(REC.buf.length || await dbRows(t.id)!==t.samples) throw new Error("hatadan sonra yazılmadı");

  // 3) kopma + yeniden bağlanma: satırlar silinmez
  await waitRows();
  const before=t.samples;
  lost();
  await wait(300);
  if(await dbRows(t.id)!==before) throw new Error("kopmada bekleyen satırlar yazılmadı: "+(await dbRows(t.id))+" / "+before);
  for(let i=0;i<60 && BG.pending;i++) await wait(250);
  if(!S.active || REC.trip!==t) throw new Error("yeniden bağlanmadı");
  await wait(2200); await persistNow();
  if(await dbRows(t.id)!==t.samples) throw new Error("yeniden bağlanmadan sonra satır kaybı: "+(await dbRows(t.id))+" / "+t.samples);

  // 4) çökme: sürüş kapanmadan uygulama gider → sonraki açılışta kurtarılır
  await persistNow();
  const id=t.id; S.active=false; REC.trip=null;   // endRec çalışmadan (çökme)
  let ended=null; on("tripEnd", x=>{ if(x.id===id) ended=x; });
  const n=await recoverTrips();
  if(n!==1 || !ended) throw new Error("kurtarılmadı: "+n);
  const saved=(await getTrips()).find(x=>x.id===id);
  if(saved.open || !saved.recovered || !saved.events.some(e=>/kurtarıldı/.test(e.text))) throw new Error("kurtarılan sürüş işaretlenmedi");
  if(saved.score==null) throw new Error("sürüş sonu eklentileri çalışmadı (puan yok)");
  if(await recoverTrips()!==0) throw new Error("aynı sürüş iki kez kurtarıldı");
  console.log("kayıt kaybı: gizlenme, yazma hatası, kopma, çökme kurtarma tamam ("+saved.samples+" satır)");
`);
