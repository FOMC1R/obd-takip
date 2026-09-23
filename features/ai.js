// ---------- Yapay zekâ yorumu ----------
// Aracın o anki durumundan (arıza kodları, donmuş kare, muayene hazırlığı, akü testi, anlık değerler,
// son uyarılar, son sürüş) sade Türkçe bir soru metni hazırlar. Metin Claude ya da ChatGPT'de
// hazır açılır, kopyalanır ya da (API anahtarı girildiyse) uygulama içinde Claude'a sorulur.
// Konum (GPS) hiçbir zaman eklenmez; şase numarası yalnızca kullanıcı isterse eklenir.

const AI = {
  MAX: 5000,                      // metin adres satırına gidiyor; uzun adresler kesilebilir
  MODEL: "claude-opus-5",
  URL: "https://api.anthropic.com/v1/messages",
  mil: null, trip: null, vin: false, busy: false, lastPaint: 0, el: {},
};
if(settings.carModel===undefined) settings.carModel="";
if(settings.aiKey===undefined) settings.aiKey="";

const AI_ASK = [
  "Aşağıda aracımın OBD cihazıyla (ELM327) okunan verileri var. Araç konusunda uzman değilim.",
  "Lütfen sade Türkçeyle yaz; teknik bir terim kullanman gerekirse önce kısaca ne olduğunu söyle.",
  "1. Aracın genel durumunu 2-3 cümleyle özetle.",
  "2. Olası nedenleri en olasıdan başlayarak sırala ve kısaca neden öyle düşündüğünü söyle.",
  "3. Neyin acil olduğunu, neyin bekleyebileceğini ayır.",
  "4. Önce ucuz ve kolay kontrolleri öner (kendim ya da sanayide yaptırabileceğim).",
  "5. Uygunsa Türkiye'de yaklaşık onarım maliyeti aralığını TL olarak ver ve tahmin olduğunu belirt.",
  "6. Aracı hangi durumda hemen durdurup sürmeyi bırakmam gerektiğini açıkça yaz.",
  "Verilerde olmayan bir şeyi uydurma; emin olmadığın yerde bunu söyle.",
].join("\n");

// Anlık değerleri istenecek göstergeler (sırası önem sırası)
const AI_LIVE = ["0C","0D","05","5C","42","04","0B","10","06","07","0F","11","0E","14","15","44","2F","46","FL"];
const aiKind = {stored:"kayıtlı", pending:"bekleyen, henüz kesinleşmemiş", perm:"kalıcı"};

// Metni bölüm bölüm kur; her bölüm {key, head, lines}
function aiSections(){
  const out=[], sec=(key,head,lines)=>{ if(lines && lines.length) out.push({key,head,lines:[...lines]}); };
  const d=S.diag||{};
  const demo = S.link instanceof DemoLink;

  // Araç
  const veh=[];
  if(settings.carModel && settings.carModel.trim()) veh.push("Kullanıcının yazdığı: "+settings.carModel.trim().slice(0,120));
  (d.vehicle||[]).forEach(([k,v])=>{
    if(/VIN/.test(k)){ if(AI.vin && S.vin) veh.push(`${k}: ${v}`); return; }
    veh.push(`${k}: ${v}`);
  });
  const fuel = {benzin:"Benzin",lpg:"LPG",dizel:"Dizel"}[settings.fuel];
  if(fuel) veh.push(`Yakıt: ${fuel}${d.ready&&d.ready.diesel?" (araç dizel bildiriyor)":""}`);
  if(demo) veh.push("Not: bu veriler uygulamanın deneme modundan, gerçek araç değil.");
  sec("vehicle","Araç",veh);

  // Arıza lambası ve kodlar
  const mil = AI.mil!=null ? AI.mil : S.alarms.has("mil");
  sec("mil","Arıza lambası",[S.lastDtc ? (mil?"YANIYOR":"Sönük") : "Henüz taranmadı"]);
  // Arıza ekranıyla aynı: kayıtlı olan kod bekleyen/kalıcı listesinde tekrar yazılmaz
  const codes=[], seen=new Set();
  for(const kind of ["stored","pending","perm"]) for(const c of (S.dtc&&S.dtc[kind])||[]){
    if(seen.has(c)) continue; seen.add(c);
    const i=dtcInfo(c); codes.push(`${c} (${aiKind[kind]}${i.severe?", ciddi olabilir":""}): ${i.desc}`);
  }
  sec("dtc","Arıza kodları", codes.length ? codes : [S.lastDtc ? "Kayıtlı arıza kodu yok" : "Henüz taranmadı"]);

  // Donmuş kare
  if(d.freeze) sec("freeze","Donmuş kare (kod oluştuğu andaki motor durumu)", d.freeze.map(([k,v])=>`${k}: ${v}`));

  // Muayene hazırlığı
  if(d.ready) sec("ready","Muayene hazırlığı (emisyon öz testleri)",
    [`${d.ready.open} test tamamlanmadı`, ...d.ready.items.map(([n,ok])=>`${n}: ${ok?"tamam":"bekliyor"}`)]);

  // Sayaçlar
  if(d.counters && d.counters.length) sec("counters","Sayaçlar", d.counters.map(([k,v])=>`${k}: ${v}`));

  // Akü testi
  if(S.batt) sec("batt",`Akü testi (${fmtDate(S.batt.time)})`, [...S.batt.rows.map(([k,v])=>`${k}: ${v}`), "Uygulamanın yorumu: "+S.batt.notes.join(" ")]);

  // Anlık değerler
  const live=[];
  for(const pid of AI_LIVE){ const g=GBY[pid]; if(!g) continue; const v=cur(pid); if(v==null) continue;
    live.push(`${g.name}: ${fmt(v,g.dec)} ${g.unit}`); }
  sec("live","Şu anki değerler", live.length ? live : [S.active ? "Henüz okunmadı" : "Araca bağlı değil"]);

  // Uyarılar
  const al=[...S.alarms.values()].map(a=>`Şu an: ${a.text}`);
  const seenTxt=new Set(al.map(x=>x.slice(7)));
  S.log.filter(e=>!seenTxt.has(e.text)).slice(0,8).forEach(e=>al.push(`${e.t.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})} ${e.text}`));
  if(al.length) sec("log","Son uyarılar",al);

  // Son sürüş
  const t=AI.trip;
  if(t){
    const st=t.stats||{}, L=[`${fmtDate(t.start)}, ${fmtDur(t.end-t.start)}, ${km(t.distance||((t.odo||0)*1000))}${t.demo?" (deneme)":""}`];
    if(st["0D"]) L.push(`En yüksek hız: ${fmt(st["0D"].max,0)} km/sa`);
    if(st["0C"]) L.push(`En yüksek devir: ${fmt(st["0C"].max,0)} d/dk`);
    if(st["05"]) L.push(`Soğutma suyu: en düşük ${fmt(st["05"].min,0)}, en yüksek ${fmt(st["05"].max,0)} °C`);
    if(st["42"]) L.push(`Voltaj: en düşük ${fmt(st["42"].min,1)}, en yüksek ${fmt(st["42"].max,1)} V`);
    if(st["07"]) L.push(`Uzun süreli yakıt ayarı ortalaması: %${fmt(st["07"].sum/Math.max(1,st["07"].n),1)}`);
    if(t.fuel) L.push(`Yakıt: ${fmt(t.fuel,1)} L`);
    if(t.dtcs&&t.dtcs.length) L.push(`Görülen kodlar: ${t.dtcs.join(", ")}`);
    (t.events||[]).slice(-5).forEach(e=>L.push(`Olay: ${e.text}`));
    sec("trip","Son sürüş",L);
  }
  return out;
}

// Kısaltma sırası: en az önemliden başla. Araç, lamba ve kodlar en son kısalır.
const AI_TRIM = ["log","trip","counters","live","batt","ready","freeze","vehicle","dtc"];
function aiPrompt(){
  const secs=aiSections();
  const head = AI_ASK+"\n\nTarih: "+new Date().toLocaleString("tr-TR");
  const render=()=>head+"\n"+secs.map(s=>`\n## ${s.head}\n`+s.lines.map(l=>"- "+l).join("\n")).join("\n");
  let txt=render();
  for(const key of AI_TRIM){
    const s=secs.find(x=>x.key===key); if(!s) continue;
    while(txt.length>AI.MAX && s.lines.length){ s.lines.pop(); txt=render(); }
    if(!s.lines.length){ secs.splice(secs.indexOf(s),1); txt=render(); }
    if(txt.length<=AI.MAX) break;
  }
  if(txt.length>AI.MAX) txt=txt.slice(0,AI.MAX-1)+"…";
  return txt;
}
const aiClaudeUrl = p=>"https://claude.ai/new?q="+encodeURIComponent(p);
const aiGptUrl = p=>"https://chatgpt.com/?q="+encodeURIComponent(p);

// ---------- Panoya kopyala (eski tarayıcıda seçip kopyalama yedeği) ----------
async function aiCopy(text){
  try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); return true; } }catch(e){}
  try{
    const ta=document.createElement("textarea"); ta.value=text; ta.setAttribute("readonly","");
    ta.style.position="fixed"; ta.style.top="0"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select(); const ok=document.execCommand("copy"); ta.remove(); return !!ok;
  }catch(e){ return false; }
}

// ---------- Uygulama içinde Claude'a sor (Messages API, tarayıcıdan doğrudan) ----------
const AI_SYSTEM = "Sen deneyimli, dürüst bir oto tamircisisin. Araç sahibine sade Türkçeyle, kısa paragraflar ve maddelerle yazarsın. Güvenlik riski varsa bunu en başta söylersin.";
function aiErrText(status, body){
  const m=(body&&body.error&&body.error.message)||"";
  if(status===401) return "Anahtar geçersiz. Ayarlar'daki Claude API anahtarını kontrol et.";
  if(status===403) return "Bu anahtarın bu işlem için izni yok. Anthropic hesabındaki anahtar ayarlarını kontrol et.";
  if(status===429) return "Çok sık istek gönderildi ya da hesabın sınırı doldu. Birkaç dakika sonra tekrar dene.";
  if(status===400 && /credit/i.test(m)) return "Anthropic hesabında kredi kalmamış. Hesabına bakiye yükleyip tekrar dene.";
  if(status===529 || status>=500) return "Anthropic sunucuları şu an yoğun ya da ulaşılamıyor. Biraz sonra tekrar dene.";
  return `İstek kabul edilmedi (kod ${status}).${m?" Ayrıntı: "+m:""}`;
}
async function aiAsk(prompt){
  const key=(settings.aiKey||"").trim();
  if(!key) return {ok:false, error:"Önce Ayarlar'da Claude API anahtarını gir."};
  const ctl = typeof AbortController!=="undefined" ? new AbortController() : null;
  const timer = ctl && setTimeout(()=>ctl.abort(),150000);
  let res;
  try{
    res = await fetch(AI.URL,{method:"POST", signal:ctl&&ctl.signal, headers:{
      "content-type":"application/json",
      "x-api-key":key,
      "anthropic-version":"2023-06-01",
      "anthropic-dangerous-direct-browser-access":"true",   // tarayıcıdan doğrudan erişim izni
      "anthropic-beta":"server-side-fallback-2026-07-01",   // model reddederse sunucu önerilen modelle yeniden dener
    }, body:JSON.stringify({
      model:AI.MODEL, max_tokens:6000, fallbacks:"default",
      output_config:{effort:"medium"},
      system:AI_SYSTEM,
      messages:[{role:"user", content:prompt}],
    })});
  }catch(e){
    return {ok:false, error: e&&e.name==="AbortError" ? "Yanıt çok gecikti. İnternet bağlantını kontrol edip tekrar dene."
      : "İnternete bağlanılamadı ya da Anthropic sunucusuna ulaşılamadı. Bağlantını kontrol et."};
  }finally{ if(timer) clearTimeout(timer); }
  let body=null; try{ body=await res.json(); }catch(e){}
  if(!res.ok) return {ok:false, status:res.status, error:aiErrText(res.status, body)};
  if(!body) return {ok:false, error:"Yanıt okunamadı."};
  if(body.stop_reason==="refusal") return {ok:false, error:"Model bu isteği yanıtlamadı. Metni Claude'da açmayı dene."};
  const text=(body.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
  if(!text) return {ok:false, error:"Boş yanıt geldi. Tekrar dene."};
  return {ok:true, text, cut: body.stop_reason==="max_tokens", model: body.model};
}

// Model yanıtını güvenli çiz: yalnızca textContent; başlık ve madde işaretleri basitçe ayrılır
function aiRender(box, text){
  box.innerHTML="";
  const clean = s=>s.replace(/\*\*(.+?)\*\*/g,"$1").replace(/__(.+?)__/g,"$1").replace(/`([^`]+)`/g,"$1");
  for(const raw of text.split(/\n/)){
    const line=raw.trimEnd(); if(!line.trim()) continue;
    let el;
    const h=line.match(/^\s*#{1,6}\s+(.*)$/), b=line.match(/^\s*[-*•]\s+(.*)$/), n=line.match(/^\s*(\d+[.)])\s+(.*)$/);
    if(h){ el=document.createElement("h3"); el.textContent=clean(h[1]); }
    else if(b){ el=document.createElement("p"); el.className="ai-li"; el.textContent="• "+clean(b[1]); }
    else if(n){ el=document.createElement("p"); el.className="ai-li"; el.textContent=n[1]+" "+clean(n[2]); }
    else if(/^\s*(-{3,}|\*{3,})\s*$/.test(line)) continue;
    else { el=document.createElement("p"); el.textContent=clean(line); }
    box.appendChild(el);
  }
}

// ---------- Arayüz ----------
{
  const css=document.createElement("style");
  css.textContent=`
.ai-links{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ai-links a,.ai-links button{display:flex;align-items:center;justify-content:center;text-align:center;min-height:48px;padding:10px 12px;border-radius:10px;
  font-weight:600;text-decoration:none;border:1px solid var(--line);background:var(--panel-2);color:var(--text);line-height:1.2}
.ai-links a.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ai-links a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.ai-links .wide{grid-column:1/-1}
.ai-card details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600;color:var(--accent)}
.ai-card pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 var(--f-body);background:var(--panel-2);border:1px solid var(--line);
  border-radius:10px;padding:10px;max-height:320px;overflow:auto}
.ai-out{display:grid;gap:6px;font-size:15px;padding:12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line)}
.ai-out p{margin:0}
.ai-out .ai-li{padding-left:1em;text-indent:-1em}
.ai-out h3{margin:6px 0 0}
.ai-err{border-color:var(--crit);background:var(--crit-bg)}
.ai-card p:empty{display:none}
.ai-key{display:flex;gap:8px}
.ai-key input{flex:1;min-width:0}
`;
  document.head.appendChild(css);

  const mk=(tag,props={},kids=[])=>{ const e=document.createElement(tag); Object.assign(e,props); kids.forEach(k=>e.appendChild(k)); return e; };

  // Arıza sekmesindeki kart
  const E=AI.el;
  const card=mk("section",{className:"card ai-card"});
  card.setAttribute("aria-labelledby","aiTitle");
  const title=mk("h2",{id:"aiTitle",textContent:"Yapay zekâ yorumu"});
  const intro=mk("p",{className:"sub",textContent:"Aracın şu anki verilerinden hazır bir soru metni oluşturur. Bir yapay zekâya sorduğunda arızanın ne olabileceğini, neyin acil olduğunu ve yaklaşık maliyeti sade dille anlatır. Yapay zekâ yanılabilir; kesin teşhis için ustaya danış."});
  E.claude=mk("a",{className:"primary",textContent:"Claude'da aç",target:"_blank",rel:"noopener"});
  E.gpt=mk("a",{textContent:"ChatGPT'de aç",target:"_blank",rel:"noopener"});
  E.copy=mk("button",{type:"button",className:"wide",textContent:"Metni kopyala"});
  const links=mk("div",{className:"ai-links"},[E.claude,E.gpt,E.copy]);
  E.ask=mk("button",{type:"button",className:"primary",textContent:"Uygulamada yorumlat"});
  E.askRow=mk("div",{className:"actions"},[E.ask]);
  E.noKey=mk("p",{className:"sub",textContent:"İstersen Ayarlar'a Claude API anahtarı ekleyip yorumu bu ekranda da alabilirsin."});
  E.status=mk("p",{className:"sub"}); E.status.setAttribute("role","status"); E.status.setAttribute("aria-live","polite");
  E.out=mk("div",{className:"ai-out"}); E.out.hidden=true;
  E.vin=mk("input",{type:"checkbox"});
  E.vin.addEventListener("change",()=>{ AI.vin=E.vin.checked; aiPaint(); });
  const vinLbl=mk("label",{className:"check"},[E.vin, mk("span",{textContent:"Şase numarasını ekle"})]);
  E.privacy=mk("p",{className:"sub"});
  E.pre=mk("pre"); E.len=mk("p",{className:"sub"});
  const det=mk("details",{},[mk("summary",{textContent:"Metni gör (gönderilecek metnin tamamı)"}),E.pre,E.len]);
  [title,intro,links,E.askRow,E.noKey,E.status,E.out,vinLbl,E.privacy,det].forEach(k=>card.appendChild(k));
  $("ext-ariza").appendChild(card);

  // Claude/ChatGPT: bağlantı güncel metinle açılır; ayrıca metin panoya kopyalanır (alan boş gelirse yapıştırmak için)
  const openWith=(a,urlOf,name)=>a.addEventListener("click",()=>{
    const p=aiPrompt(); a.href=urlOf(p);
    aiCopy(p).then(ok=>{ E.status.textContent = ok ? `${name} yeni sekmede açılıyor. Metin panoya da kopyalandı; yazı alanı boş gelirse uzun basıp yapıştır.` : `${name} yeni sekmede açılıyor.`; });
  });
  openWith(E.claude,aiClaudeUrl,"Claude"); openWith(E.gpt,aiGptUrl,"ChatGPT");
  E.copy.addEventListener("click",async()=>{
    const ok=await aiCopy(aiPrompt());
    E.status.textContent = ok ? "Metin panoya kopyalandı. İstediğin yapay zekâ uygulamasına yapıştırabilirsin." : "Kopyalanamadı. \"Metni gör\"ü açıp metni elle seçerek kopyala.";
  });
  E.ask.addEventListener("click",async()=>{
    if(AI.busy) return;
    AI.busy=true; E.ask.disabled=true; E.out.hidden=true; E.out.classList.remove("ai-err");
    E.status.textContent="Claude yorumluyor… Bu 20-60 saniye sürebilir.";
    const r=await aiAsk(aiPrompt());
    AI.busy=false; E.ask.disabled=false; E.out.hidden=false;
    if(r.ok){ aiRender(E.out,r.text); if(r.cut){ const p=document.createElement("p"); p.className="sub"; p.textContent="Yanıt uzun olduğu için sonu kesildi."; E.out.appendChild(p); }
      E.status.textContent="Yorum hazır. Yapay zekâ yanılabilir; önemli kararlarda ustaya danış."; }
    else { E.out.classList.add("ai-err"); E.out.innerHTML=""; const p=document.createElement("p"); p.textContent=r.error; E.out.appendChild(p); E.status.textContent=""; }
  });

  // Ayarlar sekmesindeki kart
  const sc=mk("section",{className:"card"}); sc.setAttribute("aria-labelledby","aiSetTitle");
  E.car=mk("input",{type:"text",id:"aiCar",autocomplete:"off",placeholder:"Örn. Renault Clio 1.2 16V, 2012",value:settings.carModel});
  E.car.addEventListener("change",()=>{ settings.carModel=E.car.value.trim(); save(); aiPaint(); });
  const carF=mk("div",{className:"field"},[mk("label",{htmlFor:"aiCar",textContent:"Araç (marka, model, motor, yıl)"}),E.car]);
  E.key=mk("input",{type:"password",id:"aiKey",autocomplete:"off",placeholder:"sk-ant-…",value:settings.aiKey});
  E.key.setAttribute("spellcheck","false");
  const saveKey=()=>{ settings.aiKey=E.key.value.trim(); save(); aiPaint(); };
  E.key.addEventListener("change",saveKey);
  E.keyDel=mk("button",{type:"button",textContent:"Sil"});
  E.keyDel.addEventListener("click",()=>{ E.key.value=""; saveKey(); });
  const keyF=mk("div",{className:"field"},[mk("label",{htmlFor:"aiKey",textContent:"Claude API anahtarı (isteğe bağlı)"}),mk("div",{className:"ai-key"},[E.key,E.keyDel])]);
  const keyNote=mk("p",{className:"sub",textContent:"API anahtarı (Anthropic'in ücretli servisine giriş şifresi, console.anthropic.com'dan alınır) yalnızca bu telefonda saklanır. Her yorum birkaç sent tutar (genelde 5-15 sent) ve hesabından düşer. Veriler yalnızca \"Uygulamada yorumlat\"a bastığında Anthropic'e gönderilir."});
  [mk("h2",{id:"aiSetTitle",textContent:"Yapay zekâ yorumu"}),mk("p",{className:"sub",textContent:"Aracını yazarsan yorum daha isabetli olur."}),carF,keyF,keyNote].forEach(k=>sc.appendChild(k));
  $("ext-ayar").appendChild(sc);
}

function aiPaint(){
  const E=AI.el, p=aiPrompt();
  E.claude.href=aiClaudeUrl(p); E.gpt.href=aiGptUrl(p);
  E.pre.textContent=p; E.len.textContent=`${p.length.toLocaleString("tr-TR")} karakter`;
  const hasKey=!!(settings.aiKey||"").trim();
  E.askRow.hidden=!hasKey; E.noKey.hidden=hasKey;
  E.privacy.textContent="Metne eklenenler: araç bilgisi, arıza lambası ve kodlar, donmuş kare, muayene hazırlığı, sayaçlar, akü testi, şu anki değerler, son uyarılar ve son sürüşün özeti. Konum (GPS) eklenmez. Şase numarası "+(AI.vin?"ekleniyor.":"eklenmez (istersen yukarıdaki kutuyu işaretle).");
  AI.lastPaint=Date.now();
}
async function aiLoadTrip(){ try{ AI.trip=(await getTrips())[0]||null; }catch(e){ AI.trip=null; } aiPaint(); }

on("dtc",(d,mil)=>{ AI.mil=!!mil; aiPaint(); });
on("diag",aiPaint); on("connect",()=>{ AI.mil=null; aiLoadTrip(); }); on("disconnect",()=>setTimeout(aiLoadTrip,500));
on("alarm",aiPaint); on("tripEnd",()=>setTimeout(aiLoadTrip,500));
on("tick",()=>{ if(Date.now()-AI.lastPaint>5000) aiPaint(); });
aiLoadTrip();
