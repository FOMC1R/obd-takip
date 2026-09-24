// ---------- Araç tanıma tablosu (features/vehicles.js kullanır) ----------
// Şase numarası (VIN): 1-3. hane üretici (WMI), 4-8. hane araç tanımı (VDS). Burada yalnızca 4-8. hanelere bakılır.
// Her satırda en az bir kaynak var; "guven": yüksek = resmî belge ya da birbirinden bağımsız birkaç kaynak,
// orta = tek iyi kaynak ya da birkaç ilan örneği, düşük = çıkarım / tek araç. Eylül 2026'da bakıldı.
//
// Renault / Dacia (VF1, UU1) — iki ayrı düzen:
//  - Eski düzen (Fluence, Clio II-IV, Captur I, Megane III, Symbol, Logan/Sandero II, Duster I): 4-9. haneler Renault'nun
//    6 harflik "tip-varyant" kodudur. 9. hane denetim hanesi DEĞİL, 10-17 seri numarası; model yılı yazılmaz.
//  - CMF (yeni ortak altyapı, ~2016 sonrası: Megane IV, Kadjar, Talisman, Clio V, Captur II, Austral, Taliant, Sandero III):
//    4-6 model, 7-8 "00", 9. hane geçerli denetim hanesi. Motor iki düzende de açık bir kaynakta çözülmüş değil.
//  Kaynaklar: Polonya tüketici kurumu geri çağırma listesi https://uokik.gov.pl/download/19077 (VF1LZ… = FLUENCE, VF15R… = CLIO IV)
//             ve https://uokik.gov.pl/download/18614 (VF1RFB00… = Megane IV); Fransız tip listesi
//             https://www.type-mine.com/marque-renault/fluence (LZBD06 dCi 110, LZBS05 dCi 90, LZBL0E dCi 110 EDC, LZBZ0L Z.E.).
//  Wikibooks'un Renault sayfası yalnızca 1981-88 ABD Renault'larını anlatır; Avrupa araçlarına uymaz.
// Stellantis (VXK Opel, VR3 Peugeot, VR7 Citroën): 6-8. haneler motor kodu. "ZK…" = elektrikli (e-CMP; ZKX 50 kWh, ZKW 54 kWh),
//  "HN…" = 1.2 PureTech benzinli. 9. hane denetim hanesi değil, 10. hane model yılı, 11. fabrika.
//  Kaynak: açık kaynak psa_car_controller araç listesi (VXKUHZKX = corsa-e, VXKUKZKX = Mokka-e, VR3UHZK = e-208, VR3UPHN = 208)
//  https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml
// Türkiye üretimi: WMI'lar https://en.wikibooks.org/wiki/Vehicle_Identification_Numbers_(VIN_codes)/World_Manufacturer_Identifier_(WMI)
//  Bursa'da yapılan Renault'lar da VF1 taşır (Wikibooks NM1 = Oyak-Renault der; gerçek örneklerin hepsi VF1).
// Bulunamayanlar (yalnızca marka gösterilir): KGM Torres / Torres EVX, Corolla E210, Megane IV sedan, Symbol II, Jogger,
//  Ford Otosan (Transit/Courier) modelleri, i20 ile Bayon ayrımı. Torres EVX zaten şase numarası vermiyor (ev.js).
const VEHICLE_DATA = {
  // Kısa marka adı (model satırında)
  wmi:{VF1:"Renault", UU1:"Dacia", VXK:"Opel", W0L:"Opel", W0V:"Opel", VR3:"Peugeot", VF3:"Peugeot", VR7:"Citroën", VF7:"Citroën",
    KPT:"KGM (SsangYong)", NM4:"Fiat", NMT:"Toyota", NLH:"Hyundai", NLA:"Honda", NM0:"Ford", ZFA:"Fiat"},
  // Çekirdeğin "Üretici" listesinde olmayanlar
  wmiLabel:{VXK:"Opel (Stellantis)", W0V:"Opel", KPT:"KGM / SsangYong (Kore)"},
  // Hazır seçimler: yeni araç profiline önerilen ayarlar (Düzelt formunda da listelenir)
  presets:{
    fluence_k4m:{ad:"Renault Fluence 1.6 16V (K4M), benzin", marka:"Renault", model:"Fluence", motor:"1.6 16V (K4M)", yakit:"benzin", disp:1.6,
      lim:{"05":{max:110}, "0C":{max:6200}}},
    fluence_k9k:{ad:"Renault Fluence 1.5 dCi (K9K), dizel", marka:"Renault", model:"Fluence", motor:"1.5 dCi (K9K)", yakit:"dizel", disp:1.5,
      lim:{"05":{max:110}, "0C":{max:4800}}},
    fluence_ze:{ad:"Renault Fluence Z.E. (elektrik)", marka:"Renault", model:"Fluence Z.E.", yakit:"elektrik"},
    corsa_f_12:{ad:"Opel Corsa F 1.2 (benzin)", marka:"Opel", model:"Corsa", motor:"1.2 PureTech", yakit:"benzin", disp:1.2},
    corsa_e:{ad:"Opel Corsa-e (elektrik)", marka:"Opel", model:"Corsa-e", yakit:"elektrik", evProfile:"corsae"},
    mokka_e:{ad:"Opel Mokka-e (elektrik)", marka:"Opel", model:"Mokka-e", yakit:"elektrik", evProfile:"corsae"},
    e208:{ad:"Peugeot e-208 (elektrik)", marka:"Peugeot", model:"e-208", yakit:"elektrik", evProfile:"corsae"},
    e2008:{ad:"Peugeot e-2008 (elektrik)", marka:"Peugeot", model:"e-2008", yakit:"elektrik", evProfile:"corsae"},
    torres_evx:{ad:"KGM Torres EVX (elektrik)", marka:"KGM", model:"Torres EVX", yakit:"elektrik", evProfile:"torres"},
  },
  // vds: 4-8. haneler, baştan eşleşir, "?" her harf. En çok harfi tutan satır kazanır.
  models:[
    // --- Renault, eski düzen ---
    {wmi:"VF1", vds:"LZ", model:"Fluence", yil:"2009-2016", guven:"yüksek", kaynak:["https://uokik.gov.pl/download/19077","https://www.type-mine.com/marque-renault/fluence"]},
    // 7. hane motor gibi görünüyor (yalnızca 4-5 varyant satırından çıkarım): D/S/R/L dizel, Z elektrik
    {wmi:"VF1", vds:"LZ?D", model:"Fluence", yil:"2009-2016", preset:"fluence_k9k", guven:"düşük", kaynak:["https://www.type-mine.com/marque-renault/fluence"]},
    {wmi:"VF1", vds:"LZ?S", model:"Fluence", yil:"2009-2016", preset:"fluence_k9k", guven:"düşük", kaynak:["https://www.type-mine.com/marque-renault/fluence"]},
    {wmi:"VF1", vds:"LZ?L", model:"Fluence", yil:"2009-2016", preset:"fluence_k9k", guven:"düşük", kaynak:["https://www.type-mine.com/marque-renault/fluence"]},
    {wmi:"VF1", vds:"LZ?R", model:"Fluence", yil:"2009-2016", preset:"fluence_k9k", guven:"düşük", kaynak:["https://baids.ru/catalog/lot/1237866"]},
    {wmi:"VF1", vds:"LZ?Z", model:"Fluence Z.E.", yil:"2011-2014", preset:"fluence_ze", guven:"düşük", kaynak:["https://www.type-mine.com/marque-renault/fluence"]},
    // "LZB1…": tek araç — kullanıcının kendi 1.6 16V K4M benzinli Fluence'ı (VF1LZB10A44…). Başka örnek bulunamadı.
    {wmi:"VF1", vds:"LZB1", model:"Fluence", yil:"2009-2016", preset:"fluence_k4m", guven:"düşük", kaynak:["kullanıcının aracı (VF1LZB10A44…, K4M)"]},
    {wmi:"VF1", vds:"BB", model:"Clio II (5 kapı)", yil:"1998-2012", guven:"orta", kaynak:["https://vinnumber.info/database/1293-clio_14.html"]},
    {wmi:"VF1", vds:"CB", model:"Clio II (3 kapı)", yil:"1998-2012", guven:"orta", kaynak:["https://vinnumber.info/database/1293-clio_14.html"]},
    {wmi:"VF1", vds:"BR", model:"Clio III (5 kapı)", yil:"2005-2014", guven:"orta", kaynak:["https://stat.vin/cars/VF1BR1J0H38593099"]},
    {wmi:"VF1", vds:"CR", model:"Clio III (3 kapı)", yil:"2005-2014", guven:"orta", kaynak:["https://stat.vin/cars/VF1BR1J0H38593099"]},
    {wmi:"VF1", vds:"KR", model:"Clio III Grandtour", yil:"2008-2014", guven:"orta", kaynak:["https://vindecodervehicle.com/en/brand/renault/model/clio-iii-grandtour"]},
    {wmi:"VF1", vds:"5R", model:"Clio IV", yil:"2012-2019", guven:"yüksek", kaynak:["https://uokik.gov.pl/download/19077"]},
    {wmi:"VF1", vds:"7R", model:"Clio IV Grandtour", yil:"2013-2019", guven:"orta", kaynak:["https://vf.vin/"]},
    {wmi:"VF1", vds:"2R", model:"Captur", yil:"2013-2019", guven:"orta", kaynak:["https://vf.vin/"]},
    {wmi:"VF1", vds:"BZ", model:"Megane III (hatchback)", yil:"2008-2016", guven:"orta", kaynak:["https://decodethatvin.com/vin/VF1BZ5G0646556534"]},
    {wmi:"VF1", vds:"DZ", model:"Megane III Coupé", yil:"2008-2016", guven:"orta", kaynak:["https://www.classic.com/"]},
    {wmi:"VF1", vds:"LB", model:"Clio Symbol / Thalia", yil:"1999-2008", guven:"düşük", kaynak:["https://vinnumber.info/database/1293-clio_14.html"]},
    // --- Renault, CMF düzeni ---
    {wmi:"VF1", vds:"RFB00", model:"Megane IV", yil:"2016-", guven:"yüksek", kaynak:["https://uokik.gov.pl/download/18614"]},
    {wmi:"VF1", vds:"RFE00", model:"Kadjar", yil:"2015-2022", guven:"orta", kaynak:["https://stat.vin/cars/VF1RFE00662901453"]},
    {wmi:"VF1", vds:"RFD00", model:"Talisman", yil:"2015-2022", guven:"orta", kaynak:["https://stat.vin/cars/VF1RFD00761491360"]},
    {wmi:"VF1", vds:"RJA00", model:"Clio V", yil:"2019-", guven:"yüksek", kaynak:["https://stat.vin/cars/VF1RJA00665397508"]},
    {wmi:"VF1", vds:"RJB00", model:"Captur II", yil:"2019-", guven:"orta", kaynak:["https://vf.vin/"]},
    {wmi:"VF1", vds:"RJF00", model:"Taliant", yil:"2021-", guven:"orta", kaynak:["https://www.neziroglu.com.tr/site/arac_bilgi/20615"]},
    {wmi:"VF1", vds:"RHN00", model:"Austral", yil:"2022-", guven:"orta", kaynak:["https://www.cem.es/sites/default/files/2024-03/05_protocolo_austral.pdf"]},
    // --- Dacia ---
    {wmi:"UU1", vds:"LS", model:"Logan", yil:"2004-2012", guven:"orta", kaynak:["https://stat.vin/cars/UU1LSDAEH35495202"]},
    {wmi:"UU1", vds:"4S", model:"Logan II", yil:"2012-2020", guven:"orta", kaynak:["https://carsbat.com/"]},
    {wmi:"UU1", vds:"HS", model:"Duster", yil:"2010-2017", guven:"orta", kaynak:["https://www.vindecoderz.com/"]},
    {wmi:"UU1", vds:"DJF00", model:"Sandero III", yil:"2020-", guven:"orta", kaynak:["https://stat.vin/cars/UU1DJF00267984266"]},
    // --- Opel / Peugeot / Citroën (Stellantis) ---
    {wmi:"VXK", vds:"UHZK", model:"Corsa-e", yil:"2020-", preset:"corsa_e", guven:"yüksek", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VXK", vds:"UKZK", model:"Mokka-e", yil:"2021-", preset:"mokka_e", guven:"yüksek", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VXK", vds:"UPHN", model:"Corsa", yil:"2019-", preset:"corsa_f_12", guven:"orta", kaynak:["https://autoplius.lt/"]},
    {wmi:"VR3", vds:"UHZK", model:"e-208", yil:"2019-", preset:"e208", guven:"yüksek", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VR3", vds:"UKZK", model:"e-2008", yil:"2020-", preset:"e2008", guven:"yüksek", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VR3", vds:"UPHN", model:"208", motor:"1.2 PureTech", yakit:"benzin", yil:"2019-", guven:"orta", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VR3", vds:"USHN", model:"2008", motor:"1.2 PureTech", yakit:"benzin", yil:"2019-", guven:"orta", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    {wmi:"VR7", vds:"BCZK", model:"ë-C4", yakit:"elektrik", yil:"2021-", guven:"yüksek", kaynak:["https://raw.githubusercontent.com/flobz/psa_car_controller/master/psa_car_controller/psacc/resources/car_models.yml"]},
    // --- Türkiye üretimi ---
    {wmi:"NM4", vds:"35600", model:"Egea / Tipo (sedan)", yil:"2015-", guven:"orta", kaynak:["https://www.sikayetvar.com/"]},
    {wmi:"NMT", vds:"KZ3", model:"C-HR", yil:"2016-", guven:"orta", kaynak:["https://auditvin.report/"]},
    {wmi:"NLH", vds:"A", model:"i10", guven:"orta", kaynak:["https://en.wikibooks.org/wiki/Vehicle_Identification_Numbers_(VIN_codes)/Hyundai/VIN_Codes"]},
    {wmi:"NLH", vds:"B", model:"i20 / Bayon", guven:"orta", kaynak:["https://en.wikibooks.org/wiki/Vehicle_Identification_Numbers_(VIN_codes)/Hyundai/VIN_Codes"]},
    {wmi:"NLA", vds:"FC5", model:"Civic (sedan)", yil:"2016-2021", guven:"orta", kaynak:["https://www.vindecoderz.com/EN/check-lookup/NLAFC5671KW000307"]},
  ],
  // Deneme cihazının şase numarası: Toyota C-HR (Türkiye). Uydurma seri no; denetim hanesi tutuyor (10. hane "0": yıl yazılmamış)
  demoVin:"NMTKZ3BE30R045678",
};
