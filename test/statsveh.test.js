// İstatistik + araç profilleri birlikte: damgasız eski sürüş ilk araca (legacyVehicle) sayılır, ikinci araca sayılmaz
require("./harness")(String.raw`
  settings.vehicles={"VF1LZB10A44":{ad:"Fluence"},"VXKUHZKX00L":{ad:"Corsa-e"}};
  settings.legacyVehicle="VF1LZB10A44"; settings.activeVehicle="VF1LZB10A44";
  const old={vehicle:undefined, demo:false};
  const a=STATS.matchVeh(old,"VF1LZB10A44"), b=STATS.matchVeh(old,"VXKUHZKX00L");
  console.log("eski sürüş → Fluence:", a, "| Corsa-e:", b);
  if(!a || b) throw new Error("damgasız sürüş yanlış araca sayıldı");
  if(!STATS.matchVeh({vehicle:"VXKUHZKX00L"},"VXKUHZKX00L") || STATS.matchVeh({vehicle:"VXKUHZKX00L"},"VF1LZB10A44")) throw new Error("damgalı sürüş eşleşmesi yanlış");
  console.log("istatistik araç süzgeci tamam");
`);
