// ---------- Markaya özel canlı değerler (DENEYSEL, yalnız okuma) ----------
// Standart OBD (mod 01) şanzıman yağı sıcaklığı, partikül filtresi (DPF) doluluğu gibi değerleri vermez; üreticiler
// bunları kendi numaralarıyla sunar: "22 xxxx" (UDS, veri numarasıyla okuma) ya da eski "21 xx" (KWP, yerel numarayla okuma).
// Numaralar ve çözüm formülleri OBDb açık veritabanından (CC-BY-SA 4.0, github.com/OBDb/<Marka>) alındı; docs/YOL-HARITASI.md 2.E.
// Her araçta her numara olmayabilir: bağlantıda bir kez sorulur, yalnız makul bir değerle cevap verenler gösterilir
// ve "deneysel" diye etiketlenir. Hiçbiri gerçek araçta denenmedi.
// İZİN LİSTESİ: yalnız 22xxxx ve 21xx (okuma) gönderilir; yazma/silme servisleri engelli (safe()).
const BRANDLIVE = (()=>{
  const ALLOWED=/^(AT|22[0-9A-F]{4}$|21[0-9A-F]{2}$)/;
  function safe(cmd){ if(!ALLOWED.test(cmd)) throw new Error("izin listesinde olmayan komut engellendi: "+cmd); return cmd; }
  // lo/hi: bu aralığın dışındaki değer "bu araçta bu numara başka bir şey" sayılır ve gösterilmez
  const T={lo:-40, hi:180};
  const SIG={
    vag:[
      {key:"atf", name:"Şanzıman yağı", unit:"°C", tx:"7E1", rx:"7E9", fc:true, cmd:"22704E", fmt:{len:8, add:-50}, ...T},
      {key:"soot", name:"DPF is miktarı", unit:"g", tx:"7E0", rx:"7E8", cmd:"22114E", fmt:{len:16, div:100, sign:true}, lo:0, hi:100},
      {key:"dpfT", name:"DPF sıcaklığı", unit:"°C", tx:"7E0", rx:"7E8", cmd:"221044", fmt:{len:16, div:10, add:-273.1}, lo:-40, hi:1000}],
    toyota:[
      {key:"atf", name:"Şanzıman yağı", unit:"°C", tx:"701", rx:"709", cmd:"221627", fmt:{len:16, div:256, add:-40}, ...T},
      {key:"atf2", name:"Şanzıman yağı", unit:"°C", tx:"700", rx:"708", cmd:"221638", fmt:{len:8, add:-40}, ...T}],
    hyundai:[
      {key:"atf", name:"Şanzıman yağı", unit:"°C", tx:"7E1", rx:"7E9", cmd:"2201A0", fmt:{bix:104, len:8, add:-40}, ...T},
      {key:"dpfKm", name:"Son DPF yakmasından beri", unit:"km", tx:"7E0", rx:"7E8", cmd:"2103", fmt:{bix:424, len:32, div:1000}, lo:0, hi:5000}],
    psa:[
      {key:"atf", name:"Şanzıman yağı", unit:"°C", tx:"7E1", rx:"7E9", cmd:"2208DF", fmt:{len:8, add:-40}, ...T},
      {key:"soot", name:"DPF is yükü", unit:"g", tx:"7E0", rx:"7E8", cmd:"214D", fmt:{bix:8, len:16, div:128}, lo:0, hi:100},
      {key:"regen", name:"DPF yakması", unit:"", tx:"7E0", rx:"7E8", cmd:"2148", fmt:{bix:383, len:1}, lo:0, hi:1, onoff:true}],
    ford:[
      {key:"atf", name:"Şanzıman yağı", unit:"°C", tx:"7E0", rx:"7E8", cmd:"221674", fmt:{len:16, div:8}, fahrenheit:true, ...T}],
    renault:[
      {key:"oil", name:"Motor yağı (tahmini)", unit:"°C", tx:"7E0", rx:"7E8", cmd:"222007", fmt:{len:16, div:10, add:-273}, ...T}],
  };
  const decs=new Map();
  function decode(s, b){
    if(!decs.has(s)) decs.set(s, OBDB.decoder(s.fmt));
    let v=decs.get(s)(b); if(v==null) return null;
    if(s.fahrenheit) v=(v-32)*5/9;
    return v>=s.lo && v<=s.hi ? v : null;
  }
  const brand=()=>typeof MODULES!=="undefined" ? MODULES.brandKey() : null;
  const list=()=>SIG[brand()]||[];

  const st={probed:false, found:[], live:{}, busy:false, last:0, brand:null};
  // tek tur: bir başlık bloğunda o adrese giden tüm numaralar sorulur (başlık bir kez değişir)
  async function readSigs(sigs){
    const groups=new Map();
    for(const s of sigs){ const k=s.tx+"|"+s.rx+"|"+(s.fc?1:0); (groups.get(k)||groups.set(k,[]).get(k)).push(s); }
    for(const [,arr] of groups){
      if(!S.active || S.paused) break;
      await EVA.withHeader(arr[0].tx, arr[0].rx, async send=>{
        for(const s of arr){
          if(S.paused) break;   // ölçüm başladı: kilidi hemen bırak
          const r=await send(safe(s.cmd), 1500);
          const b=r && !failed(r) ? EVA.respBytes(r, s.cmd) : null;
          const v=b ? decode(s,b) : null;
          if(v!=null) st.live[s.key]={v, ts:Date.now()};
        }
      }, arr[0].fc);
    }
  }
  async function probe(){
    if(st.busy || !S.active) return;
    const sigs=list(); st.brand=brand(); st.probed=true;
    if(!sigs.length || !(S.isCan && (S.proto==="6"||S.proto==="8"))){ paint(); return; }
    st.busy=true;
    try{ await readSigs(sigs); st.found=sigs.filter(s=>st.live[s.key]).map(s=>s.key); st.last=Date.now(); }
    finally{ st.busy=false; paint(); }
  }
  async function round(){
    if(st.busy || !S.active || S.paused || !st.found.length) return;
    st.busy=true;
    try{ await readSigs(list().filter(s=>st.found.includes(s.key))); st.last=Date.now(); }
    finally{ st.busy=false; paint(); }
  }
  setInterval(()=>{ if(S.active && st.probed && Date.now()-st.last>=10000) round(); }, 1000);
  on("connect",()=>{ if(S.resuming) return; st.probed=false; st.found=[]; st.live={}; paint(); });
  on("diag",()=>{ if(S.active && !st.probed) setTimeout(()=>{ if(S.active) probe(); }, 3000); });
  on("disconnect",()=>paint());

  // ---- kayıt: row.b = {anahtar: değer} (20 sn'den eski değer yazılmaz) ----
  on("sample",row=>{
    const b={}; for(const k of st.found){ const x=st.live[k]; if(x && Date.now()-x.ts<20000) b[k]=Math.round(x.v*100)/100; }
    if(Object.keys(b).length) row.b=b;
  });

  // ---- kart (Canlı sekmesi) ----
  const card=document.createElement("section"); card.className="card"; card.id="blCard"; card.hidden=true;
  card.innerHTML=`<div class="row"><h2 style="margin-right:auto">Markaya özel</h2><span class="chip warn">Deneysel</span></div>
    <p class="sub">Aracın kendi numaralarıyla okunan değerler (açık veritabanı OBDb). Her araçta doğru olmayabilir; karar vermeden önce servisle doğrula.</p>
    <dl class="kv" id="blBox"></dl>`;
  $("ext-canli").appendChild(card);
  function paint(){
    const sigs=list().filter(s=>st.found.includes(s.key));
    card.hidden=!sigs.length;
    if(!sigs.length){ $("blBox").innerHTML=""; return; }
    $("blBox").innerHTML=sigs.map(s=>{ const x=st.live[s.key];
      const val=!x ? "—" : s.onoff ? (x.v?"Yakıyor":"Kapalı") : `${fmt(x.v, Math.abs(x.v)<10&&s.unit!=="°C"?1:0)} ${s.unit}`;
      return `<dt>${escHtml(s.name)}</dt><dd>${escHtml(val)}</dd>`; }).join("");
  }
  paint();

  // ---- deneme modu: seçili markanın ilk iki numarası makul değer verir, kalanlar "desteklenmiyor" ----
  const o=DemoLink.prototype.reply;
  DemoLink.prototype.reply=function(cmd){
    const sigs=list(), i=sigs.findIndex(s=>s.cmd===cmd && s.tx===this.hdr);
    if(i<0) return o.call(this,cmd);
    if(i>1) return "7F"+cmd.slice(0,2)+"31";
    const DEMO={
      "22704E":"62704E"+"82",            // 130-50 = 80 °C
      "22114E":"62114E"+"0514",          // 13.00 g
      "221627":"621627"+"7800",          // 120-40 = 80 °C
      "221638":"621638"+"78",
      "2201A0":"6201A0"+"000000000000000000000000"+"78"+"00",   // bayt 13 = 120 → 80 °C
      "2103":"6103"+"00".repeat(53)+"000A2C2A"+"00",          // 666.666 km
      "2208DF":"6208DF"+"78",
      "214D":"614D"+"00"+"0A00"+"00",   // 2560/128 = 20 g
      "221674":"621674"+"0580",          // 1408/8 = 176 °F = 80 °C
      "222007":"622007"+"0E42",          // 3650/10-273 = 92 °C
    };
    return DEMO[cmd] || "NO DATA";
  };
  return {SIG, safe, decode, probe, round, list, st, paint};
})();
