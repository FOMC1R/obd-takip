// Mod 06 (aracın kendi test sonuçları): desteklenen test grupları zinciri, 9 baytlık kayıt çözümü, birim/ölçek
// (işaretli ve ofsetli dahil), geçti/sınırda/kaldı kararı, tekleme gruplarının bu kartta tekrarlanmaması
require("./harness")(String.raw`
  const M=MONITORS;
  // ölçek: 0x0A mV, 0x16 °C ofset, 0x39 % ofset, 0x8A işaretli
  const near=(a,b)=>Math.abs(a-b)<1e-6;
  if(!near(M.scale(0x0A,3688),449.936) || !near(M.scale(0x16,650),25) || !near(M.scale(0x39,32768),0) || !near(M.scale(0x8A,0xFFFF),-0.122))
    throw new Error("ölçek yanlış");
  const j=(v,lo,hi,uas=0x01)=>M.judge({uas, val:v, min:lo, max:hi}).state;
  if(j(50,0,100)!=="ok" || j(5,0,100)!=="near" || j(101,0,100)!=="fail" || j(100,0,100)!=="near") throw new Error("karar yanlış");
  if(M.judge({uas:0x8A, val:0xFFF6, min:0xFFEC, max:0x000A}).state!=="ok") throw new Error("işaretli sınır yanlış");
  await start(new DemoLink());
  for(let i=0;i<60 && M.st.status!=="ok";i++) await wait(250);
  if(M.st.status!=="ok") throw new Error("okunmadı: "+M.st.status);
  const g=M.st.groups, names=g.map(x=>x.name);
  if(!names.some(n=>/^Katalizör/.test(n)) || !names.some(n=>/^Oksijen sensörü \(1\. sıra, 1\. sensör\)/.test(n))) throw new Error("grup adları: "+names);
  if(g.some(x=>x.mid>=0xA1 && x.mid<=0xAD)) throw new Error("tekleme grupları tekrarlandı");
  const cat=g.find(x=>x.mid===0x21).tests[0];
  if(cat.state!=="near") throw new Error("katalizör sınırda görünmeli: "+cat.state);
  const o2=g.find(x=>x.mid===0x01).tests[0];
  if(o2.state!=="ok" || o2.unit!=="mV" || Math.round(o2.v)!==450 || o2.name!=="Zengin→fakir eşik voltajı") throw new Error("O2 testi: "+JSON.stringify(o2));
  const fuel=g.find(x=>x.mid===0x81).tests[0];
  if(Math.abs(fuel.v-4.1)>0.01 || fuel.unit!=="%") throw new Error("yakıt sistemi yüzde: "+fuel.v);
  if(!S.diag.monitors || S.diag.monitors.near.length!==1 || S.diag.monitors.fails.length) throw new Error("özet: "+JSON.stringify(S.diag.monitors));
  if(S.alarms.has("m06")) throw new Error("kalan test yokken uyarı verildi");
  stop(); await wait(400);
  console.log("mod 06: "+g.length+" grup, ölçek, karar, katalizör sınırda, tekleme ayrı tamam");
`);
