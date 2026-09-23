// Yapay zekâ yorumu: metin deneme verisinden doğru kuruluyor mu, sınır, adres, şase no, API yolu
require("./harness")(String.raw`
  const must=(c,m)=>{ if(!c) throw new Error(m); };
  const demo=new DemoLink(); demo.t0=Date.now()-44000;
  settings.record=false; settings.carModel="Renault Clio 1.2 16V, 2012"; settings.aiKey="";
  await start(demo); await wait(6000);
  const p=aiPrompt();
  console.log(p.split("\n").slice(9,40).join("\n"));
  must(p.includes("P0301"), "P0301 yok");
  must(p.includes(dtcInfo("P0301").desc), "P0301 Türkçe açıklaması yok");
  must(p.includes("## Muayene hazırlığı"), "muayene hazırlığı yok");
  must(p.includes("## Donmuş kare"), "donmuş kare yok");
  must(p.includes("Renault Clio"), "araç modeli yok");
  must(p.includes("## Şu anki değerler") && p.includes("Motor devri:"), "anlık değer yok");
  must(/Arıza lambası\n- YANIYOR/.test(p), "arıza lambası durumu yok");
  must(p.length<=AI.MAX, "metin sınırı aşıldı: "+p.length);
  // şase no: varsayılan kapalı
  must(S.vin && S.vin.length===17, "demo VIN okunmadı");
  must(!p.includes(S.vin), "şase no varsayılanda eklenmemeli");
  AI.vin=true; must(aiPrompt().includes(S.vin), "kutu işaretliyken şase no eklenmeli"); AI.vin=false;
  // adres: kodlanmış ve geri çözülünce aynı
  const u=aiClaudeUrl(p), g=aiGptUrl(p);
  must(u.startsWith("https://claude.ai/new?q=") && g.startsWith("https://chatgpt.com/?q="), "adres biçimi");
  must(!/[\s#&]/.test(u.slice(24)), "adres kodlanmamış");
  must(decodeURIComponent(u.slice(24))===p, "adres geri çözülemedi");
  // uzun veri: sınır korunuyor, kodlar kalıyor
  for(let i=0;i<300;i++) S.log.push({level:"warn",text:"Uzun deneme uyarısı "+i+" ".repeat(40)+"x",t:new Date()});
  S.diag.counters=Array.from({length:200},(_,i)=>["Sayaç "+i,"değer "+i]);
  const big=aiPrompt(); must(big.length<=AI.MAX && big.includes("P0301"), "uzun veride sınır/kod: "+big.length);
  console.log("metin:", p.length, "karakter | uzun veride:", big.length, "| adres:", u.length);

  // API yolu: sahte fetch
  let seen=null;
  globalThis.fetch=async(url,opt)=>{ seen={url,opt}; return {ok:true,status:200,json:async()=>({model:"claude-opus-5",stop_reason:"end_turn",
    content:[{type:"thinking",thinking:""},{type:"text",text:"## Özet\n- **Ateşleme** bobinine bak\nAcil değil."}]})}; };
  let r=await aiAsk("deneme"); must(r.ok===false && /anahtar/i.test(r.error), "anahtarsız istek engellenmeli");
  settings.aiKey="sk-ant-test";
  r=await aiAsk("deneme");
  must(r.ok && r.text.includes("Ateşleme"), "başarılı yanıt okunmadı");
  const h=seen.opt.headers, b=JSON.parse(seen.opt.body);
  must(seen.url==="https://api.anthropic.com/v1/messages", "adres");
  must(h["x-api-key"]==="sk-ant-test" && h["anthropic-version"]==="2023-06-01" && h["anthropic-dangerous-direct-browser-access"]==="true", "başlıklar");
  must(b.model==="claude-opus-5" && b.messages[0].content==="deneme" && b.max_tokens>0, "gövde");
  // güvenli çizim: yalnızca textContent
  const box=document.createElement("div"); const kids=[]; box.appendChild=c=>{ kids.push(c); return c; };
  aiRender(box,r.text+"\n<img src=x onerror=alert(1)>");
  must(kids.map(k=>k.textContent).join("|")==="Özet|• Ateşleme bobinine bak|Acil değil.|<img src=x onerror=alert(1)>", "çizim: "+kids.map(k=>k.textContent).join("|"));
  must(kids.every(k=>!k.innerHTML), "model çıktısı innerHTML ile yazılmamalı");
  // 401, 429, ağ hatası
  globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({type:"error",error:{type:"authentication_error",message:"invalid x-api-key"}})});
  r=await aiAsk("deneme"); must(!r.ok && r.status===401 && /Anahtar geçersiz/.test(r.error), "401 mesajı");
  console.log("401:", r.error);
  globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({})});
  r=await aiAsk("deneme"); must(!r.ok && /Birkaç dakika/.test(r.error), "429 mesajı");
  globalThis.fetch=async()=>{ throw new TypeError("Failed to fetch"); };
  r=await aiAsk("deneme"); must(!r.ok && /İnternete bağlanılamadı/.test(r.error), "ağ hatası mesajı");
  console.log("ağ:", r.error);
  stop(); await wait(200);
  console.log("yapay zekâ yorumu: tamam");
`);
