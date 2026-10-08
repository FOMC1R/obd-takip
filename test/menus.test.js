// Alt menüler: her kart başlığı doğru bölüme düşüyor (bilinmeyen başlık "Diğer"e, kaybolmaz), Arıza kodları sabit,
// sınır süzgecinin kategorileri. Gerçek sayfa düzeni headless Chrome ile ayrıca ölçülür (bkz. CONTRIBUTING).
require("./harness")(String.raw`
  const M=MENUS;
  const want={ayar:{"Araçlarım":"arac","Uyarı sınırları":"sinir","Yakıt":"yakit","Elektrikli araç":"ev","Uygulama":"genel","Navigasyon ve küçük pencere":"surus","Köprü ve otoyol ücretleri":"surus",
    "Açılış animasyonu":"genel","Uygulama olarak yükle":"genel","Sürüşte otomatik aç":"surus","Hız sınırı":"surus","Yapay zekâ yorumu":"ai",
    "Yedekle ve geri yükle":"yedek","Tanılama paketi":"yedek","Kullanım istatistiği":"gizli","Nasıl kullanılır":"yardim","Yenilikler":"yardim","Bilinmeyen yeni kart":"diger"},
    ariza:{"Arıza kodları":"","Araç durumu":"durum","Diğer beyinler":"beyin","Akü testi":"test","Tekleme sayacı":"test","Aracın kendi test sonuçları":"test",
    "Yapay zekâ yorumu":"rapor","Arıza raporu":"rapor"}};
  for(const t in want) for(const [title,k] of Object.entries(want[t])) if(M.groupOf(t,title)!==k) throw new Error(t+" / "+title+" → "+M.groupOf(t,title)+" (beklenen "+k+")");
  const c=g=>M.catOf(g);
  if(c({name:"Motor devri"})!=="motor" || c({name:"Uzun süreli yakıt ayarı"})!=="yakit" || c({name:"Hava akışı (MAF)"})!=="yakit" || c({name:"x",ev:true})!=="ev" || c({name:"x",custom:true})!=="ozel") throw new Error("sınır kategorileri");
  // bakım ve masraf kendi sekmesinde, ana sayfadan açılıyor
  const tiles=HOME.tiles().map(t=>t.k); if(!tiles.includes("bakim") || !tiles.includes("masraf")) throw new Error("kutucuk: "+tiles);
  showTab("masraf"); if(settings.tab!=="masraf") throw new Error("masraf sekmesi açılmadı");
  // buildSettings sarıldı: yeniden kurulunca hata yok
  buildSettings();
  console.log("alt menüler: başlık → bölüm eşlemesi, Diğer, sabit kart, sınır süzgeci, bakım/masraf sekmesi tamam");
`);
