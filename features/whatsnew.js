// ---------- Yenilikler: güncellemeden sonraki ilk açılışta kısa özet penceresi ----------
// Yeni sürüm ilk kez açıldığında, açılış animasyonu bittikten sonra bir kez gösterilir. Birkaç sürüm atlandıysa
// atlananların maddeleri tek pencerede birleşir. İlk kurulumda (FIRST_RUN, index.html) gösterilmez.
// Araç hareket ederken çıkmaz; durunca çıkar. Ayarlar → Yardım → Yenilikler'den tekrar okunur.
// Kalıcı: settings.seenVersion. CHANGES'in ilk öğesi her zaman APP_VERSION olmalı (test/whatsnew.test.js denetler).
const WHATSNEW = (()=>{
  const CHANGES=[
    {v:"1.22", items:[
      "Kontağı kapatınca artık kırmızı \"bağlantı koptu\" uyarısı çıkmıyor; sürüş sessizce kaydediliyor.",
      "Motor dururken (kontak açık) yakıt sayılmıyor; tüketim daha doğru.",
      "Hız aşımı ve emme havası uyarıları sarı; kırmızı yalnızca motor tehlikesinde. Emme havası sınırı 70 °C.",
      "Aracın vermediği değerler Canlı ekranında gizleniyor; kısa, hareketsiz kontak açmaları sürüş sayılmıyor.",
      "Tanılama paketi bağlı değilken de son bağlantının kaydını içeriyor.",
    ]},
    {v:"1.21", items:[
      "Ayarlar ve Arıza sayfaları alt menülere bölündü: başlığa dokun, yalnızca o bölüm açılsın. Telefonun geri tuşu listeye döner.",
      "Uyarı sınırlarında Gösterilenler / Motor / Yakıt / Elektrik süzgeci: uzun liste yerine yalnızca ilgili değerler.",
      "Bakım ve Masraf ana sayfada ayrı kutucuklar oldu.",
      "Bu pencere: her güncellemeden sonra neyin değiştiğini burada görürsün.",
    ]},
    {v:"1.20", items:[
      "Elektrikli araçlar için ikinci el batarya raporu (sağlık, hücre farkı, PDF).",
      "Diğer beyinler: ABS, hava yastığı, gösterge ve gövde arıza kodlarını okur (yalnızca okur, silmez).",
      "Markaya özel değerler (deneysel): şanzıman yağı sıcaklığı, partikül filtresi doluluğu.",
      "15 elektrikli araç için açık veritabanından hazır tanım.",
    ]},
    {v:"1.19", items:[
      "Yedekle ve geri yükle: tüm kayıtlar tek dosyada; telefon değiştirince taşınır.",
      "Aracın kendi test sonuçları: motor beyninin emisyon parçaları için yaptığı ölçümler.",
      "OBDLink cihazlarda daha hızlı okuma.",
    ]},
  ];
  const cmp=(a,b)=>{ const x=String(a).split(".").map(Number), y=String(b).split(".").map(Number);
    for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d; } return 0; };
  const cur=typeof APP_VERSION!=="undefined" ? APP_VERSION : "0";
  // Bu alan 1.21'de geldi: önceden kurulu olanlar 1.20'deydi; ilk kurulumda "zaten gördü" sayılır
  if(settings.seenVersion===undefined){ settings.seenVersion = (typeof FIRST_RUN!=="undefined" && FIRST_RUN) ? cur : "1.20"; save(); }
  const unseen=()=>CHANGES.filter(c=>cmp(c.v,settings.seenVersion)>0 && cmp(c.v,cur)<=0);

  const css=document.createElement("style");
  css.textContent=`
.wn-back{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px;animation:wnIn .2s ease-out}
.wn{width:min(440px,100%);max-height:min(80vh,640px);overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:18px;padding:18px 18px 14px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.wn h2{margin:0 0 4px;font-size:20px}
.wn h3{margin:14px 0 6px;font-size:14px;color:var(--muted);font-weight:600}
.wn ul{margin:0;padding-left:20px;display:grid;gap:6px}
.wn li{line-height:1.4}
.wn .actions{justify-content:flex-end;margin-top:14px}
@keyframes wnIn{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.wn-back{animation:none}}
`;
  document.head.appendChild(css);
  const block=list=>list.map(c=>`<h3>Sürüm ${escHtml(c.v)}</h3><ul>${c.items.map(i=>`<li>${escHtml(i)}</li>`).join("")}</ul>`).join("");

  let box=null;
  function show(list){
    list=list||unseen(); if(box || !list.length) return false;
    box=document.createElement("div"); box.className="wn-back"; box.id="wnBack";
    box.innerHTML=`<div class="wn" role="dialog" aria-modal="true" aria-labelledby="wnTitle">
      <h2 id="wnTitle">Yenilikler</h2><p class="sub">Uygulama güncellendi. Bu sürümde değişenler:</p>${block(list)}
      <div class="actions"><button class="primary" id="wnOk">Tamam</button></div></div>`;
    document.body.appendChild(box);
    const ok=box.querySelector("#wnOk");
    ok.addEventListener("click",close);
    box.addEventListener("click",e=>{ if(e.target===box) close(); });
    if(ok.focus) ok.focus();
    return true;
  }
  function close(){
    settings.seenVersion=cur; save();
    if(box){ const b=box; box=null; if(b.remove) b.remove(); }
  }
  document.addEventListener("keydown",e=>{ if(box && e.key==="Escape") close(); });
  const moving=()=>S.active && (cur0D()||0)>3;
  const cur0D=()=>{ const g=S.g && S.g["0D"]; return g && Date.now()-(g.ts||0)<5000 ? g.v : null; };
  // açılış animasyonu sürerken ya da araç giderken bekle
  function maybe(){
    if(!unseen().length || box) return;
    if((typeof SPLASH!=="undefined" && SPLASH.el) || moving()){ setTimeout(maybe, 1000); return; }
    show();
  }
  setTimeout(maybe, 600);

  // ---- Ayarlar → Yardım → Yenilikler ----
  const card=document.createElement("section"); card.className="card"; card.id="wnCard";
  card.innerHTML=`<h2>Yenilikler</h2><div id="wnAll">${block(CHANGES)}</div>`;
  $("ext-ayar").appendChild(card);

  return {CHANGES, cmp, unseen, show, close, maybe, get open(){ return !!box; }};
})();
