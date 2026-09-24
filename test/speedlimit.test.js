// Hız sınırı: yasal tablo yükleme ve saklama
const TABLE={surum:2, guncelleme:"2027-01-01", otomobil:{yerlesim:50, sehirlerarasi:90, bolunmus:120, otoyol:130},
  yolAdi:{yerlesim:"Yerleşim yeri içi", sehirlerarasi:"Şehirlerarası", bolunmus:"Bölünmüş yol", otoyol:"Otoyol"},
  bolgeKodlari:{"TR:urban":"yerlesim","TR:rural":"sehirlerarasi","TR:motorway":"otoyol"}, yolTuru:{motorway:"otoyol", residential:"yerlesim"}};
const store={};
global.__ls={getItem:k=>store[k]??null, setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; }};
global.__fetchMock=true;
global.__fetchLog=[];
global.fetch=async(u,o)=>{ global.__fetchLog.push({u,o});
  if(/speedlimits\.json/.test(u)) return {ok:true, json:async()=>TABLE};
  if(global.__overpass) return global.__overpass(u,o);
  throw new Error("ağ yok"); };
require("./harness")(String.raw`
  await wait(100);
  // yükleme: GitHub'daki güncel tablo okunur ve saklanır
  if(!/raw\.githubusercontent\.com/.test(__fetchLog[0].u)) throw new Error("önce GitHub kopyası denenmeli");
  if(SPEEDLIM.table.otomobil.otoyol!==130) throw new Error("güncel tablo alınmadı");
  if(!JSON.parse(localStorage.getItem("obdTakip.speedlimits")).surum) throw new Error("tablo saklanmadı");
  if(SPEEDLIM.legalFor("bolunmus").v!==120 || SPEEDLIM.legalFor("yok")) throw new Error("legalFor yanlış");
  console.log("yasal tablo:", __els.slNote.textContent);
  console.log("hız sınırı tamam");
`);
