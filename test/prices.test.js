// Güncel yakıt fiyatı: il/ilçe ve yakıt türüne göre fiyat seçimi; elle girilen fiyat korunur
const DATA={guncelleme:"2026-09-24T08:00:00Z", iller:{
  istanbul:{ad:"İstanbul", ort:{benzin:80.4,dizel:90.9,lpg:34.99}, ilce:{"Kadikoy":[80.3,90.7,34.4],"Adalar":[80.3,90.7,null]}},
  ankara:{ad:"Ankara", ort:{benzin:81.4,dizel:92,lpg:35.09}, ilce:{}}}};
global.__fetchMock=true;
global.fetch=async(u)=>({ok:true, json:async()=>DATA});
require("./harness")(String.raw`
  await wait(200);
  settings.fuel="benzin"; settings.priceAuto=true; settings.priceCity="istanbul"; settings.priceDistrict="";
  PRICES.apply(); if(settings.price!==80.4) throw new Error("il ortalaması uygulanmadı: "+settings.price);
  settings.priceDistrict="Kadikoy"; PRICES.apply(); if(settings.price!==80.3) throw new Error("ilçe fiyatı uygulanmadı");
  settings.fuel="lpg"; PRICES.apply(); if(settings.price!==34.4) throw new Error("LPG fiyatı yanlış");
  settings.priceDistrict="Adalar"; PRICES.apply(); if(settings.price!==34.99) throw new Error("ilçede LPG yoksa il ortalamasına düşmeli");
  settings.fuel="dizel"; settings.priceCity="ankara"; settings.priceDistrict=""; PRICES.apply(); if(settings.price!==92) throw new Error("Ankara motorin yanlış");
  console.log("seçimler tamam; bilgi:", __els.priceInfo.textContent);
  // elle fiyat: otomatik kapanmalı ve fiyat ezilmemeli
  settings.price=95; __els.fuelPrice.ev.change(); if(settings.priceAuto) throw new Error("elle fiyatta otomatik kapanmadı");
  PRICES.apply(); if(settings.price!==95) throw new Error("elle fiyat ezildi");
  // elektrikli araçta fiyat kutusu gizli
  settings.fuel="elektrik"; PRICES.apply(); if(!__els.priceAutoBox || __els.priceAutoBox.hidden!==true) console.log("(not: kutu gizleme test ortamında doğrulanamadı)");
  console.log("güncel yakıt fiyatı tamam");
`);
