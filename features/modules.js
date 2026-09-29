// ---------- Diğer beyinler: ABS, hava yastığı, gösterge, gövde — arıza kodu okuma (YALNIZ OKUMA) ----------
// Standart OBD arıza komutları (03/07/0A) yalnız motor ve şanzımanın emisyonla ilgili kodlarını verir. ABS, hava yastığı
// ve gövde beyinleri markaya özel adreste durur; onlara adres verip (ATSH/ATCRA, akış kontrolü) arıza kodu sorulur:
//   UDS "19 02 <maske>" (Read DTC by status) → 59 02 <mevcut maske> [kod(3 bayt) durum]*
//   eski KWP2000: "17 FF 00" (Renault) → 57 <adet> [kod(2) durum]* · "18 02 FF 00" → 58 <adet> [kod(2) durum]*
// İZİN LİSTESİ: bu dosya yalnız okuma komutları gönderir (safe()). Asla: 14 (silme), 2E/3B (yazma), 31 (rutin),
// 27 (güvenlik), 11 (yeniden başlatma), 28/85 (iletişim/kayıt kapatma), 2F (parça çalıştırma), 34–37 (yazılım yükleme).
// Adresler: docs/YOL-HARITASI.md 2.C (PyRen, OBDb, arduino-psa-diag; olgu olarak). Hiçbiri gerçek araçta denenmedi.
const MODULES = (()=>{
  // Kod içinde yalnız bu komutlar geçebilir; başka bir şey gönderilmeye çalışılırsa hata (test de denetler)
  const ALLOWED=/^(AT|3E00$|1001$|1003$|10C0$|1902[0-9A-F]{2}$|17FF00$|1802FF00$)/;
  function safe(cmd){ if(!ALLOWED.test(cmd)) throw new Error("izin listesinde olmayan komut engellendi: "+cmd); return cmd; }
  const vw=tx=>(parseInt(tx,16)+0x6A).toString(16).toUpperCase();   // VW UDS: cevap = istek + 0x6A
  const p8=tx=>(parseInt(tx,16)+8).toString(16).toUpperCase();
  const BRANDS={
    renault:{name:"Renault / Dacia", session:"10C0", mods:[
      {tx:"740",rx:"760",name:"ABS / ESP (fren)"},{tx:"752",rx:"772",name:"Hava yastığı"},
      {tx:"743",rx:"763",name:"Gösterge paneli"},{tx:"745",rx:"765",name:"Gövde beyni (UCH)"}]},
    vag:{name:"Volkswagen / Skoda / Seat / Audi", mods:[
      {tx:"713",rx:vw("713"),name:"ABS / ESP (fren)"},{tx:"715",rx:vw("715"),name:"Hava yastığı"},
      {tx:"714",rx:vw("714"),name:"Gösterge paneli"},{tx:"710",rx:vw("710"),name:"Ağ geçidi"},{tx:"746",rx:vw("746"),name:"Konfor / klima"}]},
    hyundai:{name:"Hyundai / Kia", mods:[
      {tx:"7D1",rx:p8("7D1"),name:"ABS / ESC (fren)"},{tx:"7D2",rx:p8("7D2"),name:"Hava yastığı"},
      {tx:"7C6",rx:p8("7C6"),name:"Gösterge paneli"},{tx:"7A0",rx:p8("7A0"),name:"Gövde beyni"}]},
    psa:{name:"Peugeot / Citroën / Opel (yeni) / DS", mods:[
      {tx:"6AD",rx:"68D",name:"ABS / ESP (fren)"},{tx:"744",rx:"644",name:"Hava yastığı"},
      {tx:"75F",rx:"65F",name:"Gösterge paneli"},{tx:"752",rx:"652",name:"Gövde beyni (BSI)"}]},
    ford:{name:"Ford", mods:[
      {tx:"760",rx:p8("760"),name:"ABS / ESP (fren)"},{tx:"720",rx:p8("720"),name:"Gösterge paneli"},{tx:"726",rx:p8("726"),name:"Gövde beyni"}]},
    toyota:{name:"Toyota / Lexus", mods:[
      {tx:"7B0",rx:p8("7B0"),name:"ABS / VSC (fren)"},{tx:"780",rx:p8("780"),name:"Hava yastığı"},{tx:"7C0",rx:p8("7C0"),name:"Gösterge paneli"}]},
    fiat:{name:"Fiat / Tofaş", unsupported:"Fiat beyinleri uzun (29 bit) adres kullanıyor; bu tarama henüz yalnız kısa adreslerde çalışıyor. Egea'da bazı modüller ek ara kablo da istiyor."},
  };
  const BRAND_OF=m=>{ m=String(m||"").toLowerCase();
    if(/renault|dacia/.test(m)) return "renault"; if(/volkswagen|\bvw\b|skoda|škoda|seat|cupra|audi/.test(m)) return "vag";
    if(/hyundai|kia/.test(m)) return "hyundai"; if(/peugeot|citro|opel|\bds\b|vauxhall/.test(m)) return "psa";
    if(/ford/.test(m)) return "ford"; if(/toyota|lexus/.test(m)) return "toyota"; if(/fiat|tofa/.test(m)) return "fiat"; return null; };
  if(settings.modBrand===undefined) settings.modBrand="auto";
  function brandKey(){
    if(settings.modBrand && settings.modBrand!=="auto") return settings.modBrand;
    const v=settings.vehicles && settings.activeVehicle && settings.vehicles[settings.activeVehicle];
    return BRAND_OF(v && v.marka) || (S.vin && typeof WMI!=="undefined" ? BRAND_OF(WMI[S.vin.slice(0,3)]) : null);
  }

  // ---- arıza türü (FTB, SAE J2012'deki yaygın olanlar) ----
  const FTB={0x01:"genel elektrik arızası",0x11:"şaseye kısa devre",0x12:"artıya (akü) kısa devre",0x13:"kopuk devre",0x14:"şaseye kısa devre ya da kopuk",
    0x15:"artıya kısa devre ya da kopuk",0x16:"devre voltajı düşük",0x17:"devre voltajı yüksek",0x1C:"voltaj aralık dışında",0x29:"sinyal geçersiz",
    0x31:"sinyal yok",0x62:"sinyal karşılaştırma hatası",0x64:"sinyal makul değil",0x71:"hareket eden parça takıldı",0x87:"mesaj gelmedi",
    0x92:"performans ya da yanlış çalışma",0x96:"iç arıza",0x98:"aşırı sıcaklık"};
  const hex=b=>b.toString(16).toUpperCase().padStart(2,"0");
  function name(b1,b2){ return decodeDtc(hex(b1)+hex(b2)); }   // ilk iki bayt: harf + 4 hane (OBD ile aynı düzen)
  function status(s){ return {active:!!(s&0x01), pending:!!(s&0x04), stored:!!(s&0x08), lamp:!!(s&0x80)}; }
  function hexOf(resp){
    const ls=lines(resp||"").filter(l=>!/SEARCHING|BUSINIT/.test(l)), mf=ls.filter(l=>/^[0-9A-F]:/.test(l));
    return mf.length ? mf.map(l=>l.slice(2)).join("") : ls.filter(l=>/^[0-9A-F]+$/.test(l) && !/^[0-9A-F]{3}$/.test(l)).join("");
  }
  const bytes=h=>(h.match(/.{2}/g)||[]).map(x=>parseInt(x,16));
  // → {ok:true, codes:[...]} | {neg:"7F…"} | null (cevap yok)
  function parse(resp, kind){
    const h=hexOf(resp); if(!h) return null;
    const neg=h.match(/7F(19|17|18)([0-9A-F]{2})/); if(neg) return {neg:neg[2]};
    let i, b, out=[];
    if(kind==="uds"){ i=h.indexOf("5902"); if(i<0) return null; b=bytes(h.slice(i+6));
      for(let k=0;k+4<=b.length;k+=4){ if(!b[k] && !b[k+1] && !b[k+2]) continue; const st=status(b[k+3]); if(!(st.active||st.stored||st.pending)) continue;
        out.push({code:name(b[k],b[k+1]), ftb:b[k+2], ...st}); } }
    else { const head=kind==="kwp17"?"57":"58"; i=h.indexOf(head); if(i<0) return null; b=bytes(h.slice(i+2)); const n=b[0]||0;
      for(let k=1;k+3<=b.length && out.length<n;k+=3){ if(!b[k] && !b[k+1]) continue; out.push({code:name(b[k],b[k+1]), ftb:null, ...status(b[k+2]), stored:true}); } }
    return {ok:true, codes:out};
  }

  const st={busy:false, res:null, brand:null, at:0};
  async function scanModule(m, session){
    return EVA.withHeader(m.tx, m.rx, async send=>{
      const s=c=>send(safe(c), 2500);
      if(session) await s(session);
      const tries=[["1902AF","uds"],["1902FF","uds"],["17FF00","kwp17"],["1802FF00","kwp18"]];
      let answered=false;
      for(const [cmd,kind] of tries){
        let r=await s(cmd);
        for(let w=0; w<3 && r && /7F..78/.test(hexOf(r)); w++){ await wait(400); r=await s(cmd); }   // 78: meşgul, bekle
        const p=parse(r, kind);
        if(p && p.ok) return {state:"ok", codes:p.codes, via:cmd};
        if(p && p.neg) answered=true;   // beyin var ama bu servisi desteklemiyor: sıradakini dene
      }
      return {state: answered ? "unsupported" : "silent"};
    }, true);
  }
  async function scan(){
    if(!S.active || st.busy) return;
    const k=brandKey(), B=BRANDS[k];
    st.brand=k; st.res=null;
    if(!B || B.unsupported){ paint(); return; }
    if(!(S.isCan && (S.proto==="6"||S.proto==="8"))){ st.res="nocan"; paint(); return; }
    st.busy=true; paint();
    const res=[];
    try{
      for(const m of B.mods){
        if(!S.active) break;
        while(S.paused && S.active) await wait(300);
        let r; try{ r=await scanModule(m, B.session); }catch(e){ r={state:"error", err:e.message}; }
        res.push({...m, ...r});
        paint(res);
        await wait(80);   // beyinler arası kısa bekleme
      }
      st.res=res; st.at=Date.now();
      const bad=res.flatMap(x=>(x.codes||[]).filter(c=>c.active||c.lamp).map(c=>`${x.name}: ${c.code}`));
      if(bad.length) raise("mods","warn",`Diğer beyinlerde ${bad.length} etkin arıza: ${bad[0]}`,"Diğer beyinlerde etkin arıza var"); else drop("mods");
      S.diag={...(S.diag||{}), modules:{brand:k, res:res.map(x=>({name:x.name, tx:x.tx, state:x.state, codes:(x.codes||[]).map(c=>c.code)}))}};
    }finally{ st.busy=false; paint(); }
    return res;
  }

  // ---- kart ----
  const card=document.createElement("section"); card.className="card"; card.id="modCard";
  card.innerHTML=`<div class="row"><h2 style="margin-right:auto">Diğer beyinler</h2><button id="modBtn" disabled>Tara</button></div>
    <p class="sub">ABS (fren), hava yastığı, gösterge paneli ve gövde beyinlerindeki arıza kodlarını okur. <b>Yalnız okur</b>; kod silmez, ayar değiştirmez.
    Araç duruyorken, kontak açıkken tara.</p>
    <div class="field"><label for="modBrand">Marka</label><select id="modBrand"><option value="auto">Otomatik (şase numarasından)</option>
      ${Object.entries(BRANDS).map(([k,b])=>`<option value="${k}">${escHtml(b.name)}</option>`).join("")}</select></div>
    <div id="modBox"><p class="empty">Bağlanınca tarayabilirsin.</p></div>`;
  $("ext-ariza").appendChild(card);
  $("modBrand").value=settings.modBrand;
  $("modBrand").addEventListener("change",e=>{ settings.modBrand=e.target.value; save(); st.res=null; paint(); });
  $("modBtn").addEventListener("click",scan);
  const chip=c=>[c.lamp?'<span class="chip crit">Lamba</span>':"", c.active?'<span class="chip crit">Etkin</span>':"", !c.active&&c.stored?'<span class="chip warn">Kayıtlı</span>':"", c.pending?'<span class="chip info">Bekleyen</span>':""].join("");
  function paint(partial){
    $("modBtn").disabled=!S.active || st.busy;
    $("modBtn").textContent=st.busy?"Taranıyor…":"Tara";
    const box=$("modBox"), k=brandKey(), B=BRANDS[k];
    if(!B){ box.innerHTML='<p class="empty">Marka anlaşılamadı. Yukarıdan markayı seç.</p>'; return; }
    if(B.unsupported){ box.innerHTML=`<p class="empty">${escHtml(B.unsupported)}</p>`; return; }
    if(st.res==="nocan"){ box.innerHTML='<p class="empty">Bu araç eski bir iletişim türü kullanıyor; diğer beyinler bu yolla okunamıyor.</p>'; return; }
    const res=partial||st.res;
    if(!res){ box.innerHTML=`<p class="empty">${escHtml(B.name)} için ${B.mods.length} beyin taranacak.</p>`; return; }
    box.innerHTML=res.map(x=>{
      const head=`<div class="row"><b style="margin-right:auto">${escHtml(x.name)}</b><span class="sub">${escHtml(x.tx)}</span></div>`;
      if(x.state==="silent") return `<div class="m6-g">${head}<p class="sub">Cevap vermedi (bu araçta bu adreste beyin yok ya da kontak kapalı).</p></div>`;
      if(x.state==="unsupported") return `<div class="m6-g">${head}<p class="sub">Beyin cevap verdi ama arıza okuma isteğini kabul etmedi.</p></div>`;
      if(x.state==="error") return `<div class="m6-g">${head}<p class="sub">Okunamadı.</p></div>`;
      if(!x.codes.length) return `<div class="m6-g">${head}<p class="sub" style="color:var(--ok)">Arıza kodu yok.</p></div>`;
      return `<div class="m6-g">${head}${x.codes.map(c=>{ const i=dtcInfo(c.code);
        return `<div class="m6-t"><span><b>${escHtml(c.code)}</b>${c.ftb!=null?`-${hex(c.ftb)}`:""} — ${escHtml(i.desc)}${c.ftb!=null&&FTB[c.ftb]?` · ${escHtml(FTB[c.ftb])}`:""}</span><span>${chip(c)}</span></div>`; }).join("")}</div>`;
    }).join("") + (st.busy?'<p class="empty">Taranıyor…</p>':"");
  }
  on("connect",()=>{ st.res=null; paint(); }); on("disconnect",()=>{ drop("mods"); paint(); }); on("diag",()=>paint());
  paint();

  // ---- deneme modu: seçili markanın 1. beyninde (ABS) 2 kod, 2. beyinde kod yok, 3. beyin eski protokol (KWP), gerisi sessiz ----
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    const B=BRANDS[brandKey()]; const i=B && B.mods ? B.mods.findIndex(m=>m.tx===this.hdr) : -1;
    if(i<0 || cmd.startsWith("AT")) return o.call(this,cmd);
    if(i===0) return /^1902/.test(cmd) ? "5902FF"+"403511"+"09"+"C15587"+"08" : "7F"+cmd.slice(0,2)+"11";   // C0035-11 etkin; U0155-87 kayıtlı
    if(i===1) return /^1902/.test(cmd) ? "5902FF" : "NO DATA";
    if(i===2) return /^19/.test(cmd) ? "7F1911" : cmd==="17FF00" ? "5701"+"9012"+"E0" : /^10/.test(cmd) ? "50C0" : "NO DATA";   // B1012 (KWP)
    return "NO DATA";
  };
  return {scan, parse, safe, BRANDS, BRAND_OF, brandKey, FTB, st, paint};
})();
