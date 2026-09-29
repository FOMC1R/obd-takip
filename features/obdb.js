// ---------- OBDb çevirici: açık araç veritabanından elektrikli araç profilleri ----------
// OBDb (https://github.com/OBDb) her model için signalsets/v3/default.json tutar. Lisans CC-BY-SA 4.0: kaynak
// gösterilir; dosyalar uygulamaya gömülmez, açılışta GitHub'dan indirilip telefonda saklanır.
// Biçim (doğrulandı: SAEJ1979 dosyasında devir "01 0C", bix yok, len 16, div 4):
//   komut: hdr (istek adresi), rax (cevap adresi), cmd {servis: kimlik}, fcm1 (akış kontrolü, ATFCSM1)
//   sinyal fmt: bix = cevaptaki yankıdan ("62 0105") SONRA başlayan bit konumu (0 = ilk baytın en soldaki biti),
//   len (bit), blsb (baytlar küçükten büyüğe), sign (işaretli), mul/div/add (ölçek), unit; suggestedMetric = anlamı.
// Buradan features/ev.js'in profil biçimine çevrilir: {key, cmd, tx, rx, fc, decode(bayt dizisi)}.
// Anlam → gösterge: stateOfCharge→SOC, stateOfHealth→SOH, tractionBatteryVoltage→V, tractionBatteryCurrent→I,
// starterBatteryVoltage→AUX, isCharging→CHG. Hücre voltajları: signalGroups (batteryModulesVoltage) → batarya raporu.
// Kapsam Eylül 2026'da ölçüldü (docs/YOL-HARITASI.md 2.B). Hiçbiri bu uygulamayla gerçek araçta denenmedi.
const OBDB = (()=>{
  const RAW=r=>`https://raw.githubusercontent.com/OBDb/${r}/main/signalsets/v3/default.json`;
  const TTL=7*86400000;   // haftada bir tazele
  // repo: veri dolu (ölçüldü). similar: kendi dosyası boş, aynı altyapılı modelin verisiyle denenir.
  const CATALOG=[
    {id:"ioniq5",   name:"Hyundai IONIQ 5",        repo:"Hyundai-IONIQ-5"},
    {id:"ioniq6",   name:"Hyundai IONIQ 6",        repo:"Hyundai-IONIQ-6"},
    {id:"kona",     name:"Hyundai Kona Electric",  repo:"Hyundai-Kona-Electric"},
    {id:"ev6",      name:"Kia EV6",                repo:"Kia-EV6"},
    {id:"ev9",      name:"Kia EV9",                repo:"Kia-EV9"},
    {id:"niro",     name:"Kia Niro EV",            repo:"Kia-Niro-EV"},
    {id:"ev3",      name:"Kia EV3",                repo:"Kia-EV6", similar:"Kia EV6"},
    {id:"id4",      name:"Volkswagen ID.4",        repo:"Volkswagen-ID.4"},
    {id:"meb",      name:"VW ID.3 / Skoda Enyaq / Cupra Born", repo:"Volkswagen-ID.4", similar:"VW ID.4"},
    {id:"zoe",      name:"Renault ZOE",            repo:"Renault-ZOE"},
    {id:"mg4",      name:"MG4",                    repo:"MG-MG4"},
    {id:"mgzs",     name:"MG ZS EV",               repo:"MG-ZS-EV"},
    {id:"fiat500e", name:"Fiat 500e",              repo:"FIAT-500e"},
    {id:"mini",     name:"MINI Cooper SE",         repo:"MINI"},
    {id:"leaf",     name:"Nissan Leaf",            repo:"Nissan-Leaf"},
  ];
  const NODATA="BYD (Atto 3, Seal, Dolphin), Togg, Tesla, Volvo EX30, MINI Countryman (yeni), Renault Mégane E-Tech, Dacia Spring";
  const MET={stateOfCharge:"SOC", stateOfHealth:"SOH", tractionBatteryVoltage:"V", tractionBatteryCurrent:"I", starterBatteryVoltage:"AUX", isCharging:"CHG"};
  const pkey=id=>"obdb_"+id;

  // ---- çözüm ----
  function bitsOf(b, bix, len){   // büyük uçlu: bix 0 = ilk baytın en soldaki biti
    let v=0; for(let i=0;i<len;i++){ const p=bix+i, byte=b[p>>3]; if(byte==null) return null; v=v*2+((byte>>(7-(p&7)))&1); } return v; }
  function decoder(fmt){
    const bix=fmt.bix||0, len=fmt.len||8, mul=fmt.mul??1, div=fmt.div??1, add=fmt.add??0;
    return b=>{
      if(!b) return null;
      let raw;
      if(fmt.blsb && len%8===0 && bix%8===0){ const s=bix>>3, n=len>>3; if(b.length<s+n) return null; raw=0; for(let i=n-1;i>=0;i--) raw=raw*256+b[s+i]; }
      else raw=bitsOf(b,bix,len);
      if(raw==null) return null;
      if(fmt.sign && raw>=2**(len-1)) raw-=2**len;
      let v=raw*mul/div+add;
      if(fmt.unit==="miles") v*=1.609344;   // uygulama kilometre kullanır
      return Number.isFinite(v) ? v : null;
    };
  }
  const cmdOf=c=>{ const [s,p]=Object.entries(c.cmd||{})[0]||[]; return s ? (s+p).toUpperCase() : null; };
  const yearOk=c=>!c.filter || !c.filter.to || c.filter.to>=2024;   // model yılı bilinmiyor: yalnız "çok eski" olanları ele

  function toProfile(entry, json){
    const cmds=(json.commands||[]).filter(c=>cmdOf(c) && c.hdr);
    const items=[], seen=new Set();
    // Aynı anlam birden çok beyinde olabilir (ör. IONIQ 5: batarya beyninde ekran doluluğu "SOC_DISP" + başka beyinde ham).
    // Tercih: güncel model yılı > dosyada "battery" türlü beyin > adında DISP (ekrandaki değer) > dosyadaki sıra.
    const batt=new Set((json.ecu||[]).filter(e=>e.type==="battery").map(e=>e.hdr));
    const cand=[];
    cmds.forEach((c,ci)=>(c.signals||[]).forEach(s=>{ const key=MET[s.suggestedMetric]; if(key && s.fmt)
      cand.push({key, c, s, score:(yearOk(c)?4:0)+(batt.has(c.hdr)?2:0)+(/DISP/i.test(s.id)?1:0), ci}); }));
    cand.sort((a,b)=>b.score-a.score || a.ci-b.ci);
    for(const {key,c,s} of cand){
      if(seen.has(key)) continue; seen.add(key);
      items.push({key, cmd:cmdOf(c), tx:c.hdr, rx:c.rax||null, fc:!!c.fcm1, decode:decoder(s.fmt), src:s.id});
    }
    // hücre / modül voltajları (batarya raporu için)
    const cells=[];
    for(const g of json.signalGroups||[]){
      if(!/Voltage/i.test(g.suggestedMetricGroup||"") || !g.matchingRegex) continue;
      let re; try{ re=new RegExp("^"+g.matchingRegex+"$"); }catch(e){ continue; }
      for(const c of cmds) for(const s of c.signals||[]) if(re.test(s.id) && s.fmt)
        cells.push({cmd:cmdOf(c), tx:c.hdr, rx:c.rax||null, fc:!!c.fcm1, decode:decoder(s.fmt), id:s.id});
    }
    const odo=(()=>{ for(const c of cmds) for(const s of c.signals||[]) if(s.suggestedMetric==="odometer" && s.fmt) return {cmd:cmdOf(c), tx:c.hdr, rx:c.rax||null, fc:!!c.fcm1, decode:decoder(s.fmt)}; return null; })();
    const first=items[0]||{};
    return {name:entry.name+" (OBDb)", tx:first.tx, rx:first.rx, fc:first.fc, probe: seen.has("SOC")?"SOC":(items[0]&&items[0].key), items, cells, odo,
      source:`OBDb ${entry.repo} · CC-BY-SA 4.0`,
      note:(entry.similar?`Bu modelin kendi verisi yok; aynı altyapıdaki ${entry.similar} verisiyle deneniyor. `:"")+
        "Değerler açık OBDb veritabanından; bu uygulamayla gerçek araçta denenmedi."};
  }

  // ---- indir / sakla ----
  // Yalnız kullanılan komutlar saklanır (dosyalar yüzlerce KB; telefonda küçük kalsın)
  function trim(json){
    const keep=new Set(Object.keys(MET).concat("odometer"));
    const regs=(json.signalGroups||[]).filter(g=>/Voltage/i.test(g.suggestedMetricGroup||"")).map(g=>{ try{ return new RegExp("^"+g.matchingRegex+"$"); }catch(e){ return null; } }).filter(Boolean);
    const commands=(json.commands||[]).map(c=>({hdr:c.hdr, rax:c.rax, cmd:c.cmd, fcm1:c.fcm1, filter:c.filter,
      signals:(c.signals||[]).filter(s=>keep.has(s.suggestedMetric) || regs.some(r=>r.test(s.id))).map(s=>({id:s.id, fmt:s.fmt, suggestedMetric:s.suggestedMetric}))}))
      .filter(c=>c.signals.length);
    return {commands, signalGroups:json.signalGroups||[], ecu:json.ecu||[]};
  }
  const store=r=>"obdTakip.obdb."+r;
  function cachedJson(repo){ try{ const o=JSON.parse(localStorage.getItem(store(repo))||"null"); return o && o.json ? o : null; }catch(e){ return null; } }
  async function fetchJson(repo, force){
    const c=cachedJson(repo);
    if(c && !force && Date.now()-c.t<TTL) return c.json;
    try{
      const r=await fetch(RAW(repo),{cache:"no-cache"}); if(!r.ok) throw new Error("HTTP "+r.status);
      const j=trim(await r.json());
      try{ localStorage.setItem(store(repo), JSON.stringify({t:Date.now(), json:j})); }catch(e){}
      return j;
    }catch(e){ if(c) return c.json; throw e; }   // çevrimdışı: eski kopya
  }
  const byId=id=>CATALOG.find(c=>c.id===id)||null;
  function register(entry, json){
    const p=toProfile(entry, json);
    if(!p.items.length) return null;
    EVA.PROFILES[pkey(entry.id)]=p;
    return p;
  }
  async function ensure(id){
    const e=byId(id); if(!e) return null;
    if(EVA.PROFILES[pkey(id)]) return EVA.PROFILES[pkey(id)];
    return register(e, await fetchJson(e.repo));
  }

  // ---- ayarlar listesine ekle ----
  for(const e of CATALOG) EVA.PROFILE_NAMES[pkey(e.id)]=e.name+(e.similar?" (benzer model, OBDb)":" (OBDb)");
  const sel=$("evProfile");
  if(sel && sel.appendChild){
    const og=document.createElement("optgroup"); og.label="Açık veritabanı (OBDb, internet gerekir)";
    for(const e of CATALOG){ const o=document.createElement("option"); o.value=pkey(e.id); o.textContent=EVA.PROFILE_NAMES[pkey(e.id)]; og.appendChild(o); }
    sel.appendChild(og);
    if(settings.evProfile) sel.value=settings.evProfile;
  }
  const note=document.createElement("p"); note.className="sub"; note.id="obdbNote";
  note.textContent=`Açık veritabanında batarya verisi bulunmayanlar: ${NODATA}. Bu araçlarda yalnız genel değerler okunur.`;
  if(sel && sel.parentNode && sel.parentNode.appendChild) sel.parentNode.appendChild(note);

  async function activate(){
    const k=settings.evProfile||""; if(!k.startsWith("obdb_")) return;
    const id=k.slice(5);
    try{
      const p=await ensure(id);
      if(!p){ addLog("warn",`${byId(id)?byId(id).name:id}: açık veritabanında batarya verisi bulunamadı.`); return; }
      EVA.refreshView && EVA.refreshView();
      if(S.active && typeof buildGauges==="function"){ buildGauges(); }
    }catch(e){ addLog("warn","Araç verisi indirilemedi (internet gerekli): "+(e && e.message || e)); }
  }
  if(sel && sel.addEventListener) sel.addEventListener("change", activate);
  on("connect", activate);
  // Açılışta: telefonda saklı olanları hemen kaydet (çevrimdışı çalışsın), seçili olanı etkinleştir
  for(const e of CATALOG){ const c=cachedJson(e.repo); if(c) register(e, c.json); }
  activate();

  return {CATALOG, NODATA, decoder, bitsOf, toProfile, trim, ensure, register, fetchJson, byId, pkey};
})();
