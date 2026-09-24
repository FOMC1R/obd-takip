// Şase numarası: denetim hanesi (9. hane) ve model yılı. node test/vin.test.js
// Geçerli örnekler NHTSA vPIC'te "Check Digit (9th position) is correct" diye doğrulandı (Eylül 2026).
require("./harness")(String.raw`
  const must=(c,m)=>{ if(!c) throw new Error(m); };
  // Geçerli (denetim hanesi tutan) şase numaraları ve beklenen model yılı
  const ok=[["1HGCM82633A004352",2003],   // Honda Accord (ABD)
            ["JH4KA7561PC008269",1993],   // Acura Legend (Japonya) — 7. hane rakam → 1980-2009 döngüsü
            ["1M8GDM9AXKP042788",1989],   // denetim hanesi "X" (kalan 10)
            ["11111111111111111",2001]];
  for(const [v,y] of ok){ must(vinCheckOk(v), v+" geçerli olmalı"); must(vinYear(v)===y, v+" yılı "+vinYear(v)+" beklenen "+y); }
  // Tek hane değişince denetim tutmamalı
  must(!vinCheckOk("1HGCM82634A004352"), "bozuk şase no geçmemeli");
  must(vinYear("1HGCM82634A004352")===null, "bozuk şase noda yıl olmamalı");
  // Tesla: NHTSA da bu örnekte denetimin tutmadığını söylüyor
  must(!vinCheckOk("5YJ3E1EA7JF000316"), "Tesla örneği tutmamalı");
  // 7. hane harf → 2010-2039 döngüsü (denetim hanesi hesaplanmış örnek)
  const mk=(s)=>{ for(const c of "0123456789X"){ const v=s.slice(0,8)+c+s.slice(9); if(vinCheckOk(v)) return v; } };
  const t=mk("5YJ3E1EA0JF000316"); must(t && vinYear(t)===2018, "harfli 7. hanede 2018 olmalı: "+t+" "+(t&&vinYear(t)));
  // Renault Fluence (Avrupa): 9. hane harf → yıl gösterilmez (eski hesap 2003 diyordu)
  const fl="VF1LZB10A44000000";
  must(!vinCheckOk(fl) && vinYear(fl)===null, "Fluence şase nosunda yıl çıkmamalı");
  for(const s of ["ABC","",null,"VF1LZB10A44"]) must(vinYear(s)===null && !vinCheckOk(s), "kısa/boş kabul edilmemeli: "+s);
  must(!vinCheckOk("1HGCM82633A00435O"), "O harfi şase noda olmaz");
  console.log("şase no denetim hanesi ve model yılı: tamam");
`);
