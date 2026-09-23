// ---------- Masraf defteri (Sürüşler sekmesi) ----------
// Yakıt, bakım, onarım, sigorta… harcamaları. Kayıtlar küçük olduğu için ayarlarla birlikte (localStorage) saklanır.
// Depo tam doldurulan iki yakıt alımı arasında alınan litre / gidilen km = gerçek tüketim. Uygulamanın tahmini
// (sürüşlerin yakıt / yol ortalaması) bununla karşılaştırılır ve düzeltme oranı (settings.calib) önerilir.
const EXP_TYPES = ["Yakıt","Bakım","Onarım","Sigorta","Vergi","Otopark-Köprü","Diğer"];
const Expenses = (()=>{
  if(settings.expenses===undefined) settings.expenses=[];
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const p2=n=>String(n).padStart(2,"0");
  const today=()=>{ const d=new Date(); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; };
  const numIn=v=>{ if(v===""||v==null) return null; const n=Number(String(v).replace(",",".")); return isFinite(n)?n:null; };
  const list=()=>settings.expenses;
  const sorted=()=>[...list()].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);

  function add(e){
    const x={id:Date.now()*100+Math.floor(Math.random()*100), date:e.date||today(), type:EXP_TYPES.includes(e.type)?e.type:"Diğer",
      amount:numIn(e.amount), km:numIn(e.km), litre:e.type==="Yakıt"?numIn(e.litre):null, full:e.type==="Yakıt"?e.full!==false:false, note:String(e.note||"").slice(0,200)};
    if(!(x.amount>0)) return null;
    list().push(x); save(); return x;
  }
  function remove(id){ settings.expenses=list().filter(x=>x.id!==id); save(); }

  // Toplamlar: bu ay, bu yıl, km başına
  function totals(now=new Date()){
    const ym=`${now.getFullYear()}-${p2(now.getMonth()+1)}`, y=String(now.getFullYear());
    const sum=a=>a.reduce((s,x)=>s+(x.amount||0),0);
    const month=sum(list().filter(x=>x.date.startsWith(ym))), year=sum(list().filter(x=>x.date.startsWith(y)));
    // km başına: km girilmiş ilk ve son kayıt arası. İlk kaydın kendisi o aralıktan önceki yola aittir, sayılmaz.
    const withKm=list().filter(x=>x.km>0).sort((a,b)=>a.km-b.km);
    let perKm=null, span=0;
    if(withKm.length>=2){ const first=withKm[0], last=withKm[withKm.length-1]; span=last.km-first.km;
      if(span>=100){ const inRange=list().filter(x=>x!==first && x.date>=first.date && x.date<=last.date); perKm=sum(inRange)/span; } }
    return {month, year, perKm, span};
  }
  // Gerçek tüketim: iki "depo dolu" alım arası. Aradaki kısmi alımların litresi de eklenir.
  function realEconomy(){
    const f=list().filter(x=>x.type==="Yakıt" && x.km>0 && x.litre>0).sort((a,b)=>a.km-b.km);
    let litres=0, dist=0, start=null, acc=0, segs=0;
    for(const x of f){
      if(start==null){ if(x.full) start=x; continue; }
      acc+=x.litre;
      if(x.full){ if(x.km>start.km){ litres+=acc; dist+=x.km-start.km; segs++; } start=x; acc=0; }
    }
    return dist>0 ? {l100:litres/dist*100, litres, dist, segs} : null;
  }
  // Uygulamanın tahmini: gerçek sürüşlerin (deneme hariç) toplam yakıt / toplam yol
  function estEconomy(trips){
    let fuel=0, odo=0;
    for(const t of trips||[]) if(!t.demo && t.fuel>0 && t.odo>1){ fuel+=t.fuel; odo+=t.odo; }
    return odo>=20 ? {l100:fuel/odo*100, km:odo} : null;
  }
  // Önerilen düzeltme oranı; fark %3'ten azsa ya da veri azsa null
  function suggestCalib(real, est, calib=settings.calib){
    if(!real || !est || real.dist<100 || !(est.l100>0)) return null;
    const k=Math.round(calib*real.l100/est.l100);
    if(Math.abs(k-calib)<3 || k<50 || k>200) return null;
    return k;
  }

  function csv(){
    const num=v=>v==null?"":String(v).replace(".",",");
    const head=["Tarih","Tür","Tutar (TL)","Km","Litre","Depo dolu","Not"];
    const rows=sorted().map(x=>[x.date,x.type,num(x.amount),num(x.km),num(x.litre),x.type==="Yakıt"?(x.full?"evet":"hayır"):"",`"${(x.note||"").replace(/"/g,"'")}"`].join(";"));
    return "﻿"+head.join(";")+"\r\n"+rows.join("\r\n");
  }
  function exportCsv(){
    const blob=new Blob([csv()],{type:"text/csv;charset=utf-8"}), name=`masraflar_${today()}.csv`;
    try{ const file=new File([blob],name,{type:"text/csv"});
      if(navigator.canShare && navigator.canShare({files:[file]})){ navigator.share({files:[file],title:"Masraf defteri"}).catch(()=>{}); return; } }catch(e){}
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }

  // ----- Arayüz -----
  const css=document.createElement("style");
  css.textContent=`
  .ex-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ex-form .wide{grid-column:1/-1}
  .ex-form .field input,.ex-form .field select{min-width:0}
  .ex-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
  .ex{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line);align-items:center}
  .ex .amt{font-family:var(--f-num);font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
  .ex .meta{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
  .ex button{grid-row:span 2;min-width:44px}
  .ex .confirm{grid-column:1/-1}`;
  document.head.appendChild(css);
  const card=document.createElement("section"); card.className="card"; card.id="expCard"; card.setAttribute("aria-labelledby","expTitle");
  $("ext-surus").appendChild(card);
  let formType="Yakıt", showAll=false, delId=null, trips=[];
  const TL=v=>`${fmt(v,0)} TL`;
  function odoGuess(){ return typeof Maint!=="undefined" && settings.maint && settings.maint.odo!=null ? Math.round(settings.maint.odo) : ""; }
  async function render(){
    try{ trips=await getTrips(); }catch(e){ trips=[]; }
    const tt=totals(), real=realEconomy(), est=estEconomy(trips), k=suggestCalib(real,est);
    const items=sorted(), shown=showAll?items:items.slice(0,8);
    let h=`<div class="row"><h2 id="expTitle" style="margin-right:auto">Masraf defteri</h2><button id="exCsv">CSV paylaş</button></div>
      <div class="stats">
        <div class="stat"><b>${TL(tt.month)}</b><span>Bu ay</span></div>
        <div class="stat"><b>${TL(tt.year)}</b><span>Bu yıl</span></div>
        <div class="stat"><b>${tt.perKm!=null?fmt(tt.perKm,2):"—"}</b><span>Km başına, TL${tt.perKm!=null?` (${fmt(tt.span,0)} km)`:""}</span></div>
        <div class="stat"><b>${real?fmt(real.l100,1):"—"}</b><span>Gerçek tüketim, L/100 km</span></div>
      </div>`;
    if(real){
      h+=`<p class="sub">Gerçek tüketim, depo tam doldurulan alımlar arasında ${fmt(real.dist,0)} km ve ${fmt(real.litres,1)} litreden hesaplandı.`;
      if(est) h+=` Uygulamanın tahmini ${fmt(est.l100,1)} L/100 km (${fmt(est.km,0)} km sürüşten).`;
      h+=`</p>`;
      if(k) h+=`<div class="verdict no">Tahmin gerçekten ${est.l100<real.l100?"düşük":"yüksek"} çıkıyor. Düzeltme oranı şu an %${fmt(settings.calib,0)}.
        <div class="actions" style="margin-top:8px"><button class="primary" id="exCalib">Düzeltme oranını ${k} yap</button></div></div>`;
      else if(est) h+=`<p class="sub">Tahmin gerçeğe yakın; düzeltme gerekmiyor.</p>`;
    } else h+=`<p class="sub">Gerçek tüketim için yakıt alırken km ve litreyi gir, "Depo tam dolduruldu"yu işaretle. İki tam dolumdan sonra hesaplanır.</p>`;
    h+=`<h3>Yeni masraf</h3><div class="ex-form">
      <div class="field"><label for="exDate">Tarih</label><input type="date" id="exDate" value="${today()}"></div>
      <div class="field"><label for="exType">Tür</label><select id="exType">${EXP_TYPES.map(t=>`<option${t===formType?" selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="exAmt">Tutar (TL)</label><input type="number" id="exAmt" inputmode="decimal" min="0" step="0.01"></div>
      <div class="field"><label for="exKm">Km (sayaç)</label><input type="number" id="exKm" inputmode="numeric" min="0" step="1" value="${odoGuess()}"></div>
      ${formType==="Yakıt"?`<div class="field"><label for="exL">Litre</label><input type="number" id="exL" inputmode="decimal" min="0" step="0.01"></div>
      <label class="check"><input type="checkbox" id="exFull" checked> Depo tam dolduruldu</label>`:""}
      <div class="field wide"><label for="exNote">Not</label><input type="text" id="exNote" maxlength="200"></div>
      <div class="actions wide"><button class="primary" id="exAdd">Ekle</button></div>
      <p class="sub wide" id="exMsg"></p></div>
      <h3>Son masraflar</h3><ul class="ex-list">`;
    if(!items.length) h+=`<li class="empty">Henüz masraf girilmedi.</li>`;
    for(const x of shown){
      const meta=[new Date(x.date+"T12:00").toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"}), x.km?`${fmt(x.km,0)} km`:"",
        x.litre?`${fmt(x.litre,2)} L${x.litre>0?` · ${fmt(x.amount/x.litre,2)} TL/L`:""}${x.full?"":" (kısmi)"}`:"", x.note].filter(Boolean).join(" · ");
      h+=`<li class="ex" data-id="${x.id}"><b>${esc(x.type)}</b><span class="amt">${esc(TL(x.amount))}</span>
        <span class="meta">${esc(meta)}</span><button class="exDel" aria-label="Sil">Sil</button>
        ${delId===x.id?`<div class="confirm"><div><b>Bu masraf silinsin mi?</b></div><div class="actions"><button class="exNo">Vazgeç</button><button class="danger exYes">Evet, sil</button></div></div>`:""}</li>`;
    }
    h+=`</ul>${items.length>8?`<div class="actions"><button id="exMore">${showAll?"Daha az göster":`Tümünü göster (${items.length})`}</button></div>`:""}`;
    card.innerHTML=h;
    const g=s=>card.querySelector(s);
    g("#exCsv").addEventListener("click",exportCsv);
    g("#exType").addEventListener("change",e=>{ formType=e.target.value; const keep={d:g("#exDate").value,a:g("#exAmt").value,k:g("#exKm").value,n:g("#exNote").value};
      render().then(()=>{ g("#exDate").value=keep.d; g("#exAmt").value=keep.a; g("#exKm").value=keep.k; g("#exNote").value=keep.n; }); });
    g("#exAdd").addEventListener("click",()=>{
      const x=add({date:g("#exDate").value, type:g("#exType").value, amount:g("#exAmt").value, km:g("#exKm").value,
        litre:formType==="Yakıt"?g("#exL").value:null, full:formType==="Yakıt"?g("#exFull").checked:false, note:g("#exNote").value});
      if(!x){ g("#exMsg").textContent="Tutarı gir."; return; }
      render();
    });
    if(k) g("#exCalib").addEventListener("click",()=>{ settings.calib=k; save(); if(typeof buildSettings==="function") buildSettings(); render(); });
    if(items.length>8) g("#exMore").addEventListener("click",()=>{ showAll=!showAll; render(); });
    card.querySelectorAll(".ex").forEach(li=>{
      const id=Number(li.dataset.id), b=s=>li.querySelector(s);
      b(".exDel").addEventListener("click",()=>{ delId=delId===id?null:id; render(); });
      if(delId===id){ b(".exNo").addEventListener("click",()=>{ delId=null; render(); }); b(".exYes").addEventListener("click",()=>{ remove(id); delId=null; render(); }); }
    });
  }
  on("tripEnd",()=>setTimeout(render,500));   // sürüş kaydedildikten sonra tahmini güncelle
  render();
  return {add, remove, totals, realEconomy, estEconomy, suggestCalib, csv, render};
})();
