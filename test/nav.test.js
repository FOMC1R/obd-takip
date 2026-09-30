// Navigasyona geç: varsayılan Google Haritalar, seçilebilir uygulama, Android "intent:" adresi (paket + Play Store
// yedeği), "sor" seçeneği, üst çubuk düğmesinin her zaman görünmesi, ana sayfada ayrı düğme olmaması (bağlı değilken yalnız harita), iz kaydı
require("./harness")(String.raw`
  if(settings.navApp!=="gmaps") throw new Error("varsayılan: "+settings.navApp);
  for(const [k,pkg] of [["gmaps","com.google.android.apps.maps"],["yandex","ru.yandex.yandexnavi"],["waze","com.waze"]]){
    const u=BG.navUrl(k);
    if(!u.startsWith("intent:#Intent;") || !u.includes("package="+pkg+";") || !u.includes("S.browser_fallback_url="+encodeURIComponent("https://play.google.com/store/apps/details?id="+pkg)) || !u.endsWith(";end"))
      throw new Error(k+" adresi: "+u);
  }
  if(BG.navUrl("sor")!=="geo:0,0") throw new Error("seçim ekranı adresi");
  // bağlı değilken de görünür: yalnız haritayı açar, küçük pencere istemez
  HOME.render();
  if(BG.buttons.nav.hidden) throw new Error("bağlı değilken düğme gizli");
  const n0=BG.T.list.length; BG.goNav("test");
  if(!location.href.includes("package=com.google.android.apps.maps;")) throw new Error("bağlı değilken harita açılmadı: "+location.href);
  if(BG.T.list.slice(n0).some(e=>/^pip-/.test(e.k))) throw new Error("bağlı değilken küçük pencere istendi");
  if(BG.buttons.nav.getAttribute("aria-label")!=="Navigasyonu aç") throw new Error("etiket: "+BG.buttons.nav.getAttribute("aria-label"));
  await start(new DemoLink()); await wait(1200); HOME.render();
  if(BG.buttons.nav.hidden) throw new Error("bağlıyken düğme görünmüyor");
  settings.navApp="waze"; BG.goNav("test");
  if(!location.href || !location.href.includes("package=com.waze;")) throw new Error("harita açılmadı: "+location.href);
  if(!BG.T.list.some(e=>e.k==="navigasyon" && e.uygulama==="waze")) throw new Error("iz kaydı yok");
  stop(); await wait(400); HOME.render();
  if(BG.buttons.nav.hidden) throw new Error("kopunca düğme kayboldu");
  if(/homeNav/.test(require("fs").readFileSync(require("path").join(process.cwd(),"features","home.js"),"utf8"))) throw new Error("ana sayfada ikinci navigasyon düğmesi kaldı");
  console.log("navigasyon: varsayılan, adresler, sor, düğmeler, iz tamam");
`);
