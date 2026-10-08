// Gerçek veri (Fluence + ELM327 v1.5, 08.10.2026): kontak açılır açılmaz adaptör iki ATZ'ye cevap vermedi, uygulama
// vazgeçti. Şimdi 4 deneme: ilk 3 sessizlikten sonra bağlanır; 4'ü de sessizse anlaşılır bir hata verir.
// Ayrıca Mode 06: sınırları 0/0 olan test "kaldı" değil "henüz yapılmadı".
require("./harness")(String.raw`
  class SleepyLink extends DemoLink{
    constructor(n){ super(); this.silent=n; this.atz=0; }
    async write(text){ if(text.trim().toUpperCase()==="ATZ" && ++this.atz<=this.silent) return; return super.write(text); }
  }
  const l=new SleepyLink(3); const t0=Date.now();
  await start(l); await wait(1500);
  if(!S.active) throw new Error("3 sessiz denemeden sonra bağlanmadı: "+$("statusText").textContent);
  if(l.atz!==4) throw new Error("ATZ deneme sayısı: "+l.atz);
  stop(); await wait(400);
  const l2=new SleepyLink(9);
  await start(l2); await wait(300);
  if(S.active) throw new Error("hiç cevap yokken bağlı göründü");
  if(l2.atz!==4) throw new Error("vazgeçmeden önce deneme sayısı: "+l2.atz);
  if(!S.log.some(e=>/Cihaz cevap vermiyor/.test(e.text)) && !/Cihaz cevap vermiyor/.test($("btNotice").textContent+$("statusText").textContent))
    throw new Error("anlaşılır hata yok: "+$("statusText").textContent+" | "+S.log.slice(0,3).map(e=>e.text).join(" / "));
  // Mode 06: gerçek veriden katalizör satırı (MID 21, TID 0A, UAS 24, değer 0, sınır 0–0) ve sıfır sınırlı başka değer
  if(MONITORS.judge({mid:0x21, tid:0x0A, uas:0x24, val:0, min:0, max:0}).state!=="notrun") throw new Error("0/0 test 'yapılmadı' sayılmadı");
  if(MONITORS.judge({uas:0x24, val:7, min:0, max:0}).state!=="notrun") throw new Error("sıfır sınırlı değer 'kaldı' sayıldı");
  if(MONITORS.judge({uas:0x10, val:430, min:0, max:1500}).state!=="ok") throw new Error("normal test bozuldu");
  console.log("bağlantı: uykulu adaptör 4. denemede bağlandı ("+Math.round((Date.now()-t0)/1000)+" sn), hiç cevapsızda anlaşılır hata; Mode 06 yapılmadı tamam");
`);
