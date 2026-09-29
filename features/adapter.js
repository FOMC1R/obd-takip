// ---------- OBD cihazını tanıma ----------
// OBDLink gibi STN çipli cihazlar "STI" komutuna çip/sürüm ("STN2120 v5.10.3"), "STDI"ya cihaz adı
// ("OBDLink MX+ r3.2.1") ile cevap verir (OBDLink Family Reference and Programming Manual). Böyle bir cihazda
// başka beyinlere okuma STPX ile yapılır (features/ev.js withHeader) — daha az komut, daha hızlı.
// Ucuz "v2.1" kopyalar bazı komutları eksik/hatalı yanıtlar: bir kez uyarılır.
// Sonuç: S.stn = {fw, name, stpx} ya da null; S.adapter = {elm, stn, name, clone}.
const ADAPTER = (()=>{
  on("connect", async info=>{
    if(S.resuming) return;
    S.stn=null; S.adapter=null;
    if(!S.elm) return;
    const txt=r=>String(r||"").replace(/[\r\n>]+/g," ").trim();
    let elm="", fw="", name="";
    try{ elm=txt(await S.elm.send("ATI",2000)); }catch(e){}
    try{ fw=txt(await S.elm.send("STI",1500)); }catch(e){}
    if(/^STN\w+/i.test(fw)){
      try{ name=txt(await S.elm.send("STDI",1500)); }catch(e){}
      S.stn={fw, name: /\?|NO DATA/.test(name) ? "" : name, stpx:true};
    }
    const clone=!S.stn && /v2\.1/i.test(elm);
    S.adapter={elm, stn:S.stn?S.stn.fw:null, name:S.stn?S.stn.name:"", clone};
    if(S.stn) addLog("info", `Kaliteli cihaz tanındı: ${S.stn.name||S.stn.fw}. Başka beyinlere okuma hızlı yoldan yapılacak.`);
    else if(clone && !(info && info.demo)) addLog("warn","Bu cihaz ucuz bir kopya olabilir (ELM327 v2.1). Bazı değerler ve çoklu beyin okuması güvenilmez olabilir.");
    emit("adapter", S.adapter);
  });

  // ---- deneme modu: d.stn=true ise OBDLink gibi davran (systems.js'ten sonra yüklenir: STPX şanzıman taklidine ulaşsın) ----
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    if(!this.stn) return cmd==="STI"||cmd==="STDI" ? "?" : o.call(this,cmd);
    if(cmd==="STI") return "STN2120 v5.10.3";
    if(cmd==="STDI") return "OBDLink MX+ r3.2.1";
    const m=/^STPX H:([0-9A-F]{3}), D:([0-9A-F]+), R:1$/i.exec(cmd);
    if(m){ (this.stpxLog=this.stpxLog||[]).push(cmd); const keep=this.hdr; o.call(this,"ATSH"+m[1].toUpperCase()); const r=o.call(this,m[2].toUpperCase()); this.hdr=keep; return r; }
    return o.call(this,cmd);
  };
  return {};
})();
