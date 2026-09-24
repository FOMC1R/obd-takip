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

  // etiket çözümleme
  const T=(s,v)=>{ const r=SPEEDLIM.speedFromTag(s); if((r?r.v:undefined)!==v) throw new Error("etiket "+s+" → "+JSON.stringify(r)+" (beklenen "+v+")"); };
  T("50",50); T("90",90); T("110 km/h",110); T("30 mph",48); T("TR:urban",50); T("TR:motorway",130); T("70;50",70);
  T("none",undefined); T("walk",undefined); T("signals",undefined); T(null,undefined);
  const W=(tags,v,k)=>{ const r=SPEEDLIM.limitOfWay(tags); if((r?r.v:undefined)!==v || (r?r.kaynak:undefined)!==k) throw new Error("yol "+JSON.stringify(tags)+" → "+JSON.stringify(r)); };
  W({highway:"primary", maxspeed:"82"},82,"yol");
  W({highway:"primary", maxspeed:"TR:rural"},90,"yasal");
  W({highway:"secondary", "maxspeed:forward":"70","maxspeed:backward":"50"},50,"yol");
  W({highway:"primary", "source:maxspeed":"TR:urban"},50,"yasal");
  W({highway:"motorway"},130,"yasal");          // yol türünden yedek
  W({highway:"residential"},50,"yasal");
  W({highway:"primary"},undefined,undefined);   // bilinmiyor: elle sınıra düşülecek

  // en yakın yol seçimi: servis yolu elenir, sınırı bilinen yakın yol tercih edilir
  const P={lat:41.0, lon:29.0}, dLat=m=>m/110540;
  const line=(off)=>[{lat:P.lat+dLat(off), lon:28.999},{lat:P.lat+dLat(off), lon:29.001}];
  const els=[{type:"way", tags:{highway:"service", maxspeed:"20"}, geometry:line(1)},
    {type:"way", tags:{highway:"primary", name:"Ana Cadde"}, geometry:line(4)},
    {type:"way", tags:{highway:"primary", name:"Yan Cadde", maxspeed:"70"}, geometry:line(9)},
    {type:"way", tags:{highway:"motorway", maxspeed:"140"}, geometry:line(25)}];
  const pk=SPEEDLIM.pickWay(els,P);
  console.log("seçilen yol:", JSON.stringify(pk));
  if(!pk || pk.v!==70 || pk.ad!=="Yan Cadde") throw new Error("yakın ve sınırı bilinen yol seçilmedi");
  if(Math.abs(SPEEDLIM.distToWay(P,line(9))-9)>0.5) throw new Error("uzaklık yanlış");

  // özellik kapalıyken eski davranış: uyarı elle girilen sınırla, istek yok
  const G=GBY["0D"], man=settings.lim["0D"].max;
  if(settings.speedLim.mode!=="ayar") throw new Error("varsayılan açık olmamalı");
  const nOv=()=>__fetchLog.filter(x=>/overpass/.test(x.u)).length;
  REC.fix={lat:41, lon:29, acc:5, t:Date.now()}; SPEEDLIM.poll(Date.now());
  if(nOv()) throw new Error("kapalıyken Overpass'a gidildi");
  if(limOf("0D").max!==man || SPEEDLIM.now().kaynak!=="ayar") throw new Error("kapalıyken sınır değişti");

  // açık: Overpass yanıtı taklidi
  let reply={elements:[{type:"way", tags:{highway:"residential", name:"Moda Caddesi", maxspeed:"50"}, geometry:line(0)}]};
  global.__overpass=async(u,o)=>{ if(o.method!=="POST" || /41\.0/.test(u)) throw new Error("konum adres satırında"); return {ok:true, json:async()=>reply}; };
  const seen=[]; on("speedLimit",n=>seen.push(n));
  settings.speedLim.mode="yol"; settings.speedLim.tol="0"; S.active=true;
  let t0=Date.now(); REC.fix={lat:P.lat, lon:P.lon, acc:5, t:t0};
  await SPEEDLIM.poll(t0);
  if(nOv()!==1) throw new Error("istek gitmedi");
  const body=decodeURIComponent(__fetchLog.find(x=>/overpass/.test(x.u)).o.body);
  if(!/around:30,41\.00000,29\.00000/.test(body)) throw new Error("sorgu yanlış: "+body);
  const n1=SPEEDLIM.now(); console.log("yol sınırı:", JSON.stringify(n1), "| ayar:", __els.slNow.textContent);
  if(n1.v!==50 || n1.kaynak!=="yol" || n1.yer!=="Moda Caddesi") throw new Error("yol sınırı alınmadı");
  if(!seen.length || seen[seen.length-1].v!==50) throw new Error("speedLimit kancası gelmedi");
  if(limOf("0D").max!==50) throw new Error("uyarı yol sınırını kullanmıyor");
  settings.speedLim.tol="ceza"; if(limOf("0D").max!==55) throw new Error("ceza payı şehir içi +5 değil");
  settings.speedLim.tol="0";

  // istek sıklığı: 20 sn dolmadan ya da 200 m gidilmeden yeni istek yok
  REC.fix={lat:P.lat+dLat(500), lon:P.lon, acc:5, t:t0+5000}; await SPEEDLIM.poll(t0+5000);
  REC.fix={lat:P.lat+dLat(50), lon:P.lon, acc:5, t:t0+30000}; await SPEEDLIM.poll(t0+30000);
  if(nOv()!==1) throw new Error("sıklık sınırı çalışmadı: "+nOv());
  REC.fix={lat:P.lat+dLat(300), lon:P.lon, acc:5, t:t0+31000}; reply={elements:[{type:"way", tags:{highway:"motorway"}, geometry:line(300)}]};
  await SPEEDLIM.poll(t0+31000);
  if(nOv()!==2 || SPEEDLIM.now().v!==130 || SPEEDLIM.now().kaynak!=="yasal") throw new Error("ikinci istek/yol türü yedeği yanlış");
  // kötü konum (doğruluk düşük) → istek yok
  REC.fix={lat:P.lat+dLat(900), lon:P.lon, acc:200, t:t0+60000}; await SPEEDLIM.poll(t0+60000);
  if(nOv()!==2) throw new Error("belirsiz konumda istek gitti");

  // uyarı yol sınırıyla: 130 sınırında 140 → uyarı
  const st=S.g["0D"]; S.alarms.delete("g0D"); st.alarm=false; st.out=0;
  for(let i=0;i<3;i++){ st.v=140; checkLimits(G); }
  if(!S.alarms.has("g0D") || !/üst sınır 130/.test(S.alarms.get("g0D").text)) throw new Error("yol sınırıyla uyarı yok");
  drop("g0D"); st.alarm=false;

  // hata: sessizce elle sınıra dön, bekleme süresi artar
  global.__overpass=async()=>{ throw new Error("zaman aşımı"); };
  REC.fix={lat:P.lat+dLat(1300), lon:P.lon, acc:5, t:t0+62000}; await SPEEDLIM.poll(t0+62000);
  if(SPEEDLIM.now().kaynak!=="ayar") throw new Error("600 m uzaklaşınca eski yol sınırı kaldı");
  if(!(SPEEDLIM.state.backoff>Date.now()+20000)) throw new Error("hatada bekleme yok");
  const n3=nOv(); REC.fix={lat:P.lat+dLat(1700), lon:P.lon, acc:5, t:t0+90000}; await SPEEDLIM.poll(t0+90000);
  if(nOv()!==n3) throw new Error("bekleme süresinde yeniden denendi");
  if(limOf("0D").max!==man) throw new Error("hatada elle sınıra dönmedi");

  // panel rozeti yol sınırını gösterir
  global.__overpass=async()=>({ok:true, json:async()=>({elements:[{type:"way", tags:{highway:"primary", maxspeed:"82"}, geometry:line(0)}]})});
  SPEEDLIM.reset(); REC.fix={lat:P.lat, lon:P.lon, acc:5, t:Date.now()}; await SPEEDLIM.poll(Date.now());
  const CL=window.CLUSTER; CL.open(); CL.update();
  if(CL.limEl.textContent!=="82") throw new Error("panel rozeti yol sınırını göstermiyor: "+CL.limEl.textContent);
  CL.close();
  // kapatınca her şey eski hâline
  settings.speedLim.mode="ayar"; __els.slMode.value="ayar"; __els.slMode.ev.change({target:__els.slMode});
  if(SPEEDLIM.now().v!==man || limOf("0D").max!==man) throw new Error("kapatınca elle sınıra dönmedi");
  // tanılama paketine konum girmez
  if(JSON.stringify(settings).includes("41.0")) throw new Error("konum ayarlara yazıldı");
  console.log("hız sınırı tamam: tablo, etiketler, yol seçimi, sıklık, uyarı, hata, panel");
`);
