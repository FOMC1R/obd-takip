// ---------- Hız sınırı (Ayarlar → Hız sınırı) ----------
// Yasal sınırlar data/speedlimits.json'da durur. Yakıt fiyatlarındaki gibi uygulama her açılışta önce GitHub'daki
// güncel kopyayı, olmazsa sitenin kendi kopyasını okur ve son hâlini saklar. Yasalar seyrek değiştiği için
// dosya elle güncellenir (fiyatlardaki gibi günlük bir çekme işi yok); değişince tüm telefonlara kendiliğinden gelir.
const SPEEDLIM = (()=>{
  const SRC=["https://raw.githubusercontent.com/FOMC1R/obd-takip/main/data/speedlimits.json","data/speedlimits.json"];
  const CACHE_KEY="obdTakip.speedlimits";
  // İnternet hiç yokken ilk açılış için gömülü kopya (data/speedlimits.json ile aynı)
  const BUILTIN={surum:1, guncelleme:"2026-09-24",
    otomobil:{yerlesim:50, sehirlerarasi:90, bolunmus:110, otoyol:120},
    yolAdi:{yerlesim:"Yerleşim yeri içi", sehirlerarasi:"Şehirlerarası çift yönlü yol", bolunmus:"Bölünmüş yol", otoyol:"Otoyol"},
    otoyolNot:"Bazı otoyollarda sınır 130 ya da 140 km/sa'e çıkarıldı (İçişleri Bakanlığı, 1 Temmuz 2022). Haritada bu yollar genellikle kendi sınırıyla işaretlidir.",
    bolgeKodlari:{"TR:urban":"yerlesim","TR:rural":"sehirlerarasi","TR:trunk":"bolunmus","TR:dual_carriageway":"bolunmus","TR:motorway":"otoyol"},
    yolTuru:{motorway:"otoyol", motorway_link:"otoyol", residential:"yerlesim", living_street:"yerlesim"},
    ceza:{yerlesimIciBaslangic:6, yerlesimDisiBaslangic:11}};
  const valid=d=>d && d.otomobil && typeof d.otomobil.yerlesim==="number";
  let table=BUILTIN;
  try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); if(valid(c)) table=c; }catch(e){}

  async function load(){
    for(const u of SRC){
      try{
        const r=await fetch(u,{cache:"no-cache"}); if(!r.ok) continue;
        const d=await r.json(); if(!valid(d)) continue;
        table=d; try{ localStorage.setItem(CACHE_KEY,JSON.stringify(d)); }catch(e){}
        paint(); return d;
      }catch(e){}
    }
    return table;
  }
  // Harita kodundan ("TR:urban") ya da yol türünden yasal sınır
  function legalFor(key){ const v=key && table.otomobil[key]; return v ? {v, tur:key, ad:(table.yolAdi||{})[key]||key} : null; }

  // ---- arayüz ----
  const card=document.createElement("section"); card.className="card"; card.id="speedLimCard";
  card.innerHTML=`<h2>Hız sınırı</h2>
    <p class="sub">Hız uyarısı Sınırlar tablosundaki <b>Hız</b> satırına göre verilir.</p>
    <details><summary>Yasal sınırlar (otomobil)</summary><dl class="kv" id="slTable"></dl><p class="sub" id="slNote"></p></details>`;
  $("ext-ayar").appendChild(card);
  function paint(){
    const T=table, rows=["yerlesim","sehirlerarasi","bolunmus","otoyol"].filter(k=>T.otomobil[k]).map(k=>[(T.yolAdi||{})[k]||k, T.otomobil[k]+" km/sa"]);
    kv($("slTable"), rows);
    $("slNote").textContent=[T.otoyolNot, T.guncelleme ? "Tablo tarihi: "+new Date(T.guncelleme).toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"}) : ""].filter(Boolean).join(" ");
  }
  paint();
  load();
  return {load, legalFor, get table(){ return table; }, set table(d){ table=d; }};
})();
