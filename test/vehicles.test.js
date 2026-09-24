// Araçlarım: şase numarasından model, araç profilleri, ayarların ayrı tutulması, eski veriyi taşıma,
// sürüş damgası ve liste süzme, vPIC yedeği. node test/vehicles.test.js
const store=global.__store=new Map();
global.__ls={getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k)};
const calls=global.__calls=[];
global.__fetchMock=true;
global.fetch=async(u)=>{ calls.push(String(u));
  if(/vpic\.nhtsa/.test(u)) return {ok:true, json:async()=>({Results:[{Make:"HONDA", Model:"Accord", FuelTypePrimary:"Gasoline", DisplacementL:"2.998832712", ModelYear:"2003"}]})};
  throw new Error("ağ yok"); };
require("./harness")(String.raw`
  const must=(c,m)=>{ if(!c) throw new Error(m); };
  const FL="VF1LZB10A44000000", CE="VXKUHZKXZL4000000", HO="1HGCM82633A004352";

  // 1) Tablo
  const d=VEH.decode(FL);
  must(d && d.marka==="Renault" && d.model==="Fluence" && d.kaynak==="tablo", "VF1LZ Fluence olmalı: "+JSON.stringify(d));
  must(d.preset==="fluence_k4m" && d.yakit==="benzin", "Fluence K4M hazır seçimi: "+JSON.stringify(d));
  const c=VEH.decode(CE); must(c && c.marka==="Opel" && /Corsa/.test(c.model), "VXK… Corsa olmalı: "+JSON.stringify(c));
  const u=VEH.decode("WVWZZZ1KZ9W000000"); must(u && u.kaynak==="marka" && u.marka==="Volkswagen" && !u.model, "bilinmeyen modelde yalnızca marka: "+JSON.stringify(u));
  must(VEH.decode("ZZZ00000000000000")===null, "bilinmeyen üretici null");
  const m=v=>{ const x=VEH.decode(v); return x && x.model; };
  must(m("VF1RJA00665397508")==="Clio V" && m("VF1LZBD0600000000")==="Fluence" && VEH.decode("VF1LZBD0600000000").preset==="fluence_k9k", "Renault kodları");
  must(m("VR3UPHNKSN5852701")==="208" && m("VR3UHZKXZLT097501")==="e-208" && VEH.decode("VXKUKZKXZNW123456").preset==="mokka_e", "Stellantis kodları");
  must(VEH.decode("VF1ZZZ00000000000").kaynak==="marka", "Renault bilinmeyen model: yalnızca marka");
  must(m(VEHICLE_DATA.demoVin)==="C-HR" && vinCheckOk(VEHICLE_DATA.demoVin), "deneme şase nosu tabloda olmalı");
  must(vinYear(FL)===null, "Fluence'ta yıl yok");

  // 2) Eski tek araçlı kullanıcı: ayarları ilk araca geçer, hiçbir şey kaybolmaz
  settings.lim["05"].max=105; settings.carModel=""; Maint.setOdo(12345,"el");
  must(Expenses.add({type:"Yakıt", amount:1000, litre:25, date:"2026-09-01"}), "masraf eklenmeli");
  const nEx=settings.expenses.length; must(nEx===1, "bir masraf");
  must(!Object.keys(settings.vehicles).length, "başta araç yok");
  VEH.identify(FL);
  const kF="VF1LZB10A44";
  must(settings.activeVehicle===kF && settings.legacyVehicle===kF, "ilk araç etkin ve eski sürüşlerin sahibi olmalı");
  must(!Object.keys(settings.vehicles).some(k=>k.length>11 && !k.startsWith("sig:")), "anahtar ilk 11 hane olmalı");
  must(settings.lim["05"].max===105 && settings.maint.odo===12345 && settings.expenses.length===nEx, "eski ayarlar korunmalı");
  must(settings.carModel==="Renault Fluence 1.6 16V (K4M), benzin", "araç adı: "+settings.carModel);
  must(settings.vehicles[kF].pending, "onay bekleniyor olmalı");

  // 3) İkinci araç: kendi ayarları, geçiş
  VEH.identify(CE);
  const kC="VXKUHZKXZL4";
  must(settings.activeVehicle===kC, "Corsa etkin olmalı");
  must(settings.fuel==="elektrik" && settings.evProfile==="corsae", "Corsa-e: elektrik + e-CMP: "+settings.fuel+" "+settings.evProfile);
  must(settings.maint.odo==null && settings.expenses.length===0 && settings.lim["05"].max!==105, "yeni aracın ayarları boş başlamalı");
  must(/Corsa/.test(settings.carModel), "Corsa araç adı: "+settings.carModel);
  Maint.setOdo(500,"el");   // bakım eklentisi nesneyi açılışta yakaladı: yerinde değişim sayesinde yeni araca yazmalı
  must(settings.maint.odo===500, "bakım yeni araca yazılmalı");
  must(settings.vehicles[kF].maint.odo===12345 && settings.vehicles[kF].lim["05"].max===105, "Fluence ayarları saklanmalı");
  VEH.switchTo(kF);
  must(settings.fuel==="benzin" && settings.maint.odo===12345 && settings.lim["05"].max===105 && settings.expenses.length===nEx, "Fluence'a dönünce ayarları gelmeli");
  must(settings.vehicles[kC].maint.odo===500 && settings.vehicles[kC].fuel==="elektrik", "Corsa ayarları saklanmalı");
  must(!("maint" in settings.vehicles[kF]), "etkin aracın ayarı profilde kopya tutulmamalı");
  // kalıcı: kaydedilen ayarlarda ikisi de var
  const saved=JSON.parse(__store.get("obdTakip.v1")); must(saved.vehicles[kC] && saved.activeVehicle===kF, "ayarlar kaydedilmeli");

  // 4) Düzelt: ad ve hazır seçim
  VEH.applyEdit(kC, {ad:"Kırmızı Corsa", marka:"Opel", model:"Corsa-e", yil:"2021", motor:"", yakit:"elektrik", preset:null});
  must(settings.vehicles[kC].ad==="Kırmızı Corsa" && !settings.vehicles[kC].pending, "düzeltme kaydedilmeli");
  must(settings.fuel==="benzin", "etkin olmayan aracı düzeltmek etkin ayarı değiştirmemeli");

  // 5) Şase numarası vermeyen araç (ör. Torres EVX): imzayla tanınır, kullanıcı adlandırır
  const pT=VEH.identify(null, {sig:"6-f-yok"});
  const kT="sig:6-f-yok"; must(settings.activeVehicle===kT && pT.how==="sig", "imzalı araç");
  VEH.applyEdit(kT, {ad:"", marka:"KGM", model:"Torres EVX", yil:"", motor:"", yakit:"elektrik", preset:"torres_evx"});
  must(settings.fuel==="elektrik" && settings.evProfile==="torres", "Torres hazır seçimi: "+settings.evProfile);
  VEH.identify(null, {sig:"6-f-yok"}); must(Object.keys(settings.vehicles).length===3, "aynı imza yeni araç açmamalı");
  VEH.switchTo(kF);

  // 6) Sürüş damgası ve liste süzme
  const tA={id:1,vehicle:kF}, tB={id:2,vehicle:kC}, tOld={id:3}, tDemo={id:4,demo:true,vehicle:"x"};
  let view={trips:[tA,tB,tOld,tDemo]}; settings.tripsAll=false; VEH.filterTrips(view);
  must(view.trips.map(t=>t.id).join()==="1,3,4", "yalnızca bu araç (+ eski + deneme): "+view.trips.map(t=>t.id));
  VEH.switchTo(kC); view={trips:[tA,tB,tOld,tDemo]}; VEH.filterTrips(view);
  must(view.trips.map(t=>t.id).join()==="2,4", "Corsa süzmesi: "+view.trips.map(t=>t.id));
  settings.tripsAll=true; view={trips:[tA,tB,tOld,tDemo]}; VEH.filterTrips(view); must(view.trips.length===4, "tüm araçlar");
  settings.tripsAll=false;
  // gerçek bağlantı gibi: deneme cihazı ama tanıma açık → sürüş damgalanır
  VEH.st.real=true; settings.record=true;
  const dl=new DemoLink(); dl.t0=Date.now()-44000; await start(dl); await wait(7000);
  const key=VEHICLE_DATA.demoVin.slice(0,11);
  must(settings.activeVehicle===key, "deneme şase nosu tanınmalı: "+settings.activeVehicle);
  must(REC.trip && REC.trip.vehicle===key, "sürüş araçla damgalanmalı");
  must(S.diag.vehicle.some(r=>r[0]==="Model" && r[1]), "Araç bölümünde Model satırı");
  stop(); await wait(500);
  const trips=await getTrips(); must(trips.some(t=>t.vehicle===key), "kaydedilen sürüşte araç olmalı");
  VEH.st.real=false;

  // 7) Deneme modu: kalıcı araç açmaz
  const n0=Object.keys(settings.vehicles).length, act0=settings.activeVehicle;
  const dl2=new DemoLink(); dl2.t0=Date.now()-44000; await start(dl2); await wait(7000);
  must(VEH.st.demo && Object.keys(settings.vehicles).length===n0 && settings.activeVehicle===act0, "deneme aracı kaydedilmemeli");
  stop(); await wait(300); must(!VEH.st.demo, "bağlantı kesilince deneme aracı gider");

  // 8) Silme: sürüşler kutu işaretlenmezse kalır
  await VEH.remove(kT, false); must(!settings.vehicles[kT], "araç silinmeli");
  const before=(await getTrips()).length; await VEH.remove(key, true);
  must((await getTrips()).length<before && !settings.vehicles[key], "kutu işaretliyse sürüşleri de silinmeli");

  // 9) vPIC yedeği: yalnızca ilk 11 hane gider, sonuç saklanır
  const r1=await VEH.vpicLookup(HO.slice(0,11)); const r2=await VEH.vpicLookup(HO.slice(0,11));
  const vc=__calls.filter(u=>/vpic/.test(u));
  must(r1.marka==="Honda" && r1.model==="Accord" && r1.yakit==="benzin", "vPIC sonucu: "+JSON.stringify(r1));
  must(vc.length===1 && vc[0].includes("/1HGCM82633A?") && !vc[0].includes("004352"), "yalnızca 11 hane ve önbellek: "+vc);
  console.log("araçlarım: tablo, profiller, taşıma, damga, süzme, vPIC tamam");
`);
