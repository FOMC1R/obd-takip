// Araç sınıfına göre hız sınırı (KGM tablosu, Karayolları Trafik Yönetmeliği md. 100): tablo sunucu dosyası ile
// gömülü kopyada aynı; yasal sınır sınıfa göre; haritadaki tabela sınıfın sınırını aşarsa sınıf sınırı; ağır araçta
// maxspeed:hgv; eski tablo (sınıfsız) → otomobil; ticari model ipucu; ayar araç başına
const data=require("../data/speedlimits.json");
require("./harness")(String.raw`
  const L=SPEEDLIM, D=${JSON.stringify(data)};
  if(JSON.stringify(L.table.siniflar)!==JSON.stringify(D.siniflar)) throw new Error("gömülü tablo ile data/speedlimits.json farklı");
  const exp={otomobil:[50,90,110,120], panelvan:[50,85,100,110], kamyonet:[50,80,85,95], minibus:[50,80,90,100], otobus:[50,80,90,100],
    kamyon:[50,80,85,90], motosiklet:[50,80,90,100], motosiklet2:[50,70,80,80], tehlikeli:[30,50,60,70]};
  for(const [k,v] of Object.entries(exp)){ const r=D.siniflar[k]; if([r.yerlesim,r.sehirlerarasi,r.bolunmus,r.otoyol].join()!==v.join()) throw new Error("KGM tablosu: "+k); }
  if(settings.aracSinifi!=="otomobil" || L.sinif!=="otomobil") throw new Error("varsayılan sınıf");
  const way=t=>L.limitOfWay(t);
  // otomobil: tabela olduğu gibi
  if(way({highway:"motorway", maxspeed:"120"}).v!==120 || way({highway:"motorway", maxspeed:"140"}).v!==140) throw new Error("otomobil tabelası");
  // kamyonet
  settings.aracSinifi="kamyonet";
  const m=way({highway:"motorway", maxspeed:"120"});
  if(m.v!==95 || m.tabela!==120 || m.tur!=="otoyol") throw new Error("kamyonet otoyol: "+JSON.stringify(m));
  if(way({highway:"trunk", maxspeed:"110"}).v!==85) throw new Error("kamyonet bölünmüş (trunk)");
  if(way({highway:"primary", oneway:"yes", maxspeed:"90"}).v!==85) throw new Error("kamyonet tek yönlü ana yol");
  if(way({highway:"primary", maxspeed:"90"}).v!==80) throw new Error("kamyonet çift yönlü");
  if(way({highway:"residential", maxspeed:"50"}).v!==50 || way({highway:"primary", maxspeed:"70"}).v!==70) throw new Error("tabela sınıftan düşükse tabela");
  if(L.legalFor("otoyol").v!==95 || way({highway:"motorway"}).v!==95) throw new Error("yasal sınır sınıfa göre");
  // ağır araç: hgv etiketi
  settings.aracSinifi="kamyon";
  if(way({highway:"primary", maxspeed:"90", "maxspeed:hgv":"60"}).v!==60) throw new Error("hgv etiketi");
  if(way({highway:"motorway", maxspeed:"120"}).v!==90) throw new Error("kamyon otoyol");
  // eski tablo (sınıfsız): otomobil gibi davranır, hata yok
  const keep=L.table; L.table={...keep, siniflar:undefined};
  if(way({highway:"motorway", maxspeed:"120"}).v!==120 || L.sinif!=="otomobil") throw new Error("eski tablo");
  // sunucudan / telefondan sınıfsız eski tablo gelirse sınıflar gömülü kopyadan tamamlanır
  const f=L.fill({surum:1, otomobil:{yerlesim:50, sehirlerarasi:90, bolunmus:110, otoyol:120}});
  if(!f.siniflar || f.siniflar.kamyonet.otoyol!==95) throw new Error("eski tablo tamamlanmadı");
  // sunucu otomobil satırını güncellerse (ör. otoyol 130) otomobil için o geçerli
  L.table=L.fill({...keep, siniflar:undefined, otomobil:{...keep.otomobil, otoyol:130}}); settings.aracSinifi="otomobil";
  if(L.legalFor("otoyol").v!==130) throw new Error("sunucudaki otomobil satırı esas alınmadı");
  L.table=keep;
  // ticari model ipucu
  if(!L.COMMERCIAL.test("Doblo") || !L.COMMERCIAL.test("Kangoo") || !L.COMMERCIAL.test("Transit Connect") || L.COMMERCIAL.test("Fluence") || L.COMMERCIAL.test("Egea")) throw new Error("ticari model listesi");
  // araç başına saklanır
  if(!/"aracSinifi"/.test(require("fs").readFileSync(require("path").join(process.cwd(),"features","vehicles.js"),"utf8"))) throw new Error("araç başına ayar listesinde yok");
  settings.aracSinifi="otomobil";
  console.log("araç sınıfı hız sınırı: KGM tablosu, tabela sınırlama, bölünmüş/otoyol, hgv, eski tablo, ticari ipucu tamam");
`);
