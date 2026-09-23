
// Eski sürümden kalan kayıt: devir ve hız eski varsayılanda, su sıcaklığını kullanıcı 100 yapmış, fiyat eski 45
const old={lim:{"0C":{show:true,min:null,max:6000},"0D":{show:true,min:null,max:140},"05":{show:true,min:null,max:100}},price:45,fuel:"benzin"};
let stored=JSON.stringify(old);
global.__ls={getItem:()=>stored,setItem:(k,v)=>{stored=v;}};
require("./harness")(String.raw`
  console.log("devir:",settings.lim["0C"].max,"hız:",settings.lim["0D"].max,"su (kullanıcının 100'ü korunmalı):",settings.lim["05"].max,"fiyat:",settings.price,"v:",settings.v);
  const ev=__els.fuelType.ev.change; settings.fuel="benzin"; __els.fuelType.value="lpg";
  // iki dinleyici var; test ortamı sonuncuyu saklıyor, bu yüzden fiyat mantığını doğrudan dene
  if(settings.price===FUEL_PRICE[settings.fuel]) settings.price=FUEL_PRICE["lpg"]; settings.fuel="lpg";
  console.log("LPG'ye geçince fiyat:", settings.price);
`);
