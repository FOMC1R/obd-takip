// ---------- Silindir bazında tekleme sayacı (OBD mod 06: araç içi test sonuçları) ----------
// Kaynaklar: SAE J1979 / ISO 15031-5 (CAN), python-OBD decoders.monitor + UnitsAndScaling.
// CAN yanıtı: 46 + kayıtlar; her kayıt 9 bayt: MID, TID, UASID, değer(2), alt sınır(2), üst sınır(2).
//   MID A1 = tekleme genel, A2..AD = 1..12. silindir.
//   TID 0B = son 10 sürüşün ağırlıklı ortalaması (EWMA), TID 0C = son/şu anki sürüşteki tekleme sayısı.
//   UASID 0x24 = adet (1 birim = 1 tekleme). Başka UASID gelirse ham değer kullanılır (belirsiz).
// Desteklenen MID'ler mod 01 gibi 32 bitlik maske ile sorulur: 0600, 0620 … 06A0;
// her aralığın son biti bir sonraki aralığın varlığını söyler.
// Eski protokollerde (K-hattı, J1850) mod 06 biçimi tamamen farklı (MID/UASID yok); onları okumuyoruz.
const MISFIRE = {
  cyls: null,          // [{cyl, cur, avg}] son okuma
  status: "idle",      // idle | busy | ok | none | nocan
  at: 0, busy: false, timer: null,
  prev: null,          // bu bağlantıdaki önceki okuma: {cyl: cur}
  EVERY: 120000,       // bağlıyken yeniden okuma aralığı (ms)
  JUMP: 5,             // bir okumadan diğerine bu kadar artış olursa uyarı
};
const m6hex = n=>n.toString(16).toUpperCase().padStart(2,"0");

// Yanıttaki mesajları (46 ile başlayan bayt dizileri) çıkar. Çok parçalı (ISO-TP) yanıtta
// ELM327 önce toplam bayt sayısını ("013"), sonra "0:", "1:" … satırlarını verir.
function m6Messages(resp){
  const ls=lines(resp||"").filter(l=>!/SEARCHING/.test(l)), msgs=[];
  let cur=null, len=0;
  const flush=()=>{ if(cur){ let b=(cur.match(/.{2}/g)||[]).map(h=>parseInt(h,16)); if(len) b=b.slice(0,len); msgs.push(b); } cur=null; len=0; };
  for(const l of ls){
    if(/^[0-9A-F]{3}$/.test(l)){ flush(); len=parseInt(l,16); continue; }
    const m=l.match(/^([0-9A-F]):(.*)$/);
    if(m){ if(m[1]==="0"){ const keep=len; flush(); len=keep; cur=""; } cur=(cur||"")+m[2]; continue; }
    flush(); if(l.startsWith("46")) msgs.push((l.match(/.{2}/g)||[]).map(h=>parseInt(h,16)));
  }
  flush();
  return msgs.filter(b=>b[0]===0x46);
}
// Test kayıtları: [{mid, tid, uas, val, min, max}]
function m6Records(resp){
  const out=[];
  for(const b of m6Messages(resp)){
    for(let i=1;i+9<=b.length;i+=9){
      const r=b.slice(i,i+9);
      out.push({mid:r[0], tid:r[1], uas:r[2], val:r[3]*256+r[4], min:r[5]*256+r[6], max:r[7]*256+r[8]});
    }
  }
  return out;
}
// Desteklenen MID maskesi (birden çok beyin cevap verirse birleşim)
function m6Support(resp, base){
  const set=new Set();
  for(const b of m6Messages(resp)){
    if(b[1]!==base || b.length<6) continue;
    for(let k=0;k<32;k++) if(b[2+(k>>3)] & (0x80>>(k&7))) set.add(base+k+1);
  }
  return set;
}

async function misfireRead(auto){
  if(!S.elm || !S.active || MISFIRE.busy) return;
  MISFIRE.busy=true; MISFIRE.status="busy"; misfirePaint();
  try{
    if(!S.isCan){ MISFIRE.status="nocan"; MISFIRE.cyls=null; return; }
    // Desteklenen MID'ler: 00 → 20 → … → A0 zinciri
    const sup=new Set();
    for(let base=0; base<=0xA0; base+=0x20){
      const r=await q("06"+m6hex(base),4000); if(!r) break;
      const s=m6Support(r,base); s.forEach(x=>sup.add(x));
      if(base===0xA0 || !s.has(base+0x20)) break;
    }
    const mids=[]; for(let m=0xA2;m<=0xAD;m++) if(sup.has(m)) mids.push(m);
    const cyls=[];
    for(const mid of mids){
      const r=await q("06"+m6hex(mid),4000); if(!r) continue;
      const rec=m6Records(r).filter(x=>x.mid===mid);
      const cur=rec.find(x=>x.tid===0x0C), avg=rec.find(x=>x.tid===0x0B);
      if(!cur && !avg) continue;
      cyls.push({cyl:mid-0xA1, cur:cur?cur.val:0, avg:avg?avg.val:0});
    }
    MISFIRE.at=Date.now();
    if(!cyls.length){ MISFIRE.status="none"; MISFIRE.cyls=null; return; }
    MISFIRE.status="ok"; MISFIRE.cyls=cyls;
    // Bağlıyken bir silindirin bu sürüşteki sayısı belirgin artarsa bir kez uyar
    if(auto && MISFIRE.prev){
      for(const c of cyls){
        const p=MISFIRE.prev[c.cyl];
        if(p!=null && c.cur-p>=MISFIRE.JUMP)
          raise("misfire"+c.cyl,"warn",`${c.cyl}. silindirde tekleme artıyor (+${c.cur-p}, bu sürüşte ${c.cur})`,
            `Dikkat. ${c.cyl}. silindirde tekleme artıyor`);
      }
    }
    MISFIRE.prev={}; cyls.forEach(c=>{ MISFIRE.prev[c.cyl]=c.cur; });
  }catch(e){ console.error("tekleme okuma:", e); }
  finally{ MISFIRE.busy=false; misfirePaint(); }
}

// Karar: eşikler deneyime dayalı tahmindir, standartta tanımlı değildir.
function misfireVerdict(cyls){
  const sc=cyls.map(c=>({cyl:c.cyl, s:Math.max(c.cur,c.avg)})).sort((a,b)=>b.s-a.s);
  const w=sc[0], second=sc[1]?sc[1].s:0;
  if(!w || w.s===0) return {ok:true, worst:null, text:"Tekleme yok. Tüm silindirler düzgün çalışıyor."};
  if(w.s<5) return {ok:true, worst:null, text:"Çok az tekleme sayıldı. Bu kadarı genelde normaldir."};
  if(w.s>=2*second+3) return {ok:false, worst:w.cyl, text:`${w.cyl}. silindirde tekleme var: buji, bobin veya enjektör kontrol ettirilmeli.`};
  return {ok:false, worst:null, text:"Birden fazla silindirde tekleme var: ateşleme, yakıt veya hava kaçağı kontrol ettirilmeli."};
}

// ---------- Arayüz ----------
(function(){
  const st=document.createElement("style");
  st.textContent=`
.mf-legend{display:flex;gap:14px;font-size:13px;color:var(--muted);flex-wrap:wrap}
.mf-legend i{display:inline-block;width:12px;height:8px;border-radius:2px;margin-right:6px;vertical-align:middle}
.mf-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.mf-row{display:grid;grid-template-columns:78px 1fr;gap:4px 10px;align-items:center;padding:6px 8px;border-radius:10px}
.mf-row.worst{background:var(--warn-bg);outline:1px solid var(--warn)}
.mf-row b{font-size:15px;grid-row:span 2}
.mf-bar{display:grid;grid-template-columns:1fr 42px;gap:8px;align-items:center}
.mf-bar span{height:8px;border-radius:4px;background:var(--panel-2);border:1px solid var(--line);overflow:hidden;position:relative}
.mf-bar span i{position:absolute;inset:0 auto 0 0;border-radius:4px}
.mf-bar em{font-style:normal;font:600 15px var(--f-num);text-align:right;font-variant-numeric:tabular-nums}
.mf-cur{background:var(--accent)} .mf-avg{background:var(--series-b)}`;
  document.head.appendChild(st);
  const card=document.createElement("section"); card.className="card"; card.id="mfCard";
  card.innerHTML=`<div class="row"><h2 style="margin-right:auto">Tekleme sayacı</h2><button id="mfBtn" disabled>Yenile</button></div>
  <p class="sub">Tekleme: bir silindirde yakıtın düzgün yanmaması. Motor sarsılır, çekiş düşer. Motor beyni her silindir için ayrı sayar.</p>
  <div id="mfBox"><p class="empty">Bağlanınca okunur.</p></div>`;
  $("ext-ariza").appendChild(card);
  $("mfBtn").addEventListener("click",()=>misfireRead(false));
})();

function misfirePaint(){
  const box=$("mfBox"), btn=$("mfBtn"); if(!box) return;
  btn.disabled=!S.active || MISFIRE.busy;
  btn.textContent=MISFIRE.busy?"Okunuyor…":"Yenile";
  const st=MISFIRE.status;
  if(st==="busy" && !MISFIRE.cyls){ box.innerHTML='<p class="empty">Okunuyor…</p>'; return; }
  if(st==="idle"){ box.innerHTML='<p class="empty">Bağlanınca okunur.</p>'; return; }
  if(st==="nocan"){ box.innerHTML='<p class="empty">Araç bu bilgiyi vermiyor. Bu okuma yalnızca yeni tip bağlantılı araçlarda (genelde 2008 ve sonrası) çalışır.</p>'; return; }
  if(st==="none"){ box.innerHTML='<p class="empty">Araç bu bilgiyi vermiyor. Birçok Toyota, Hyundai ve Avrupa aracı silindir bazında sayı paylaşmaz; bu bir arıza değildir.</p>'; return; }
  const cyls=MISFIRE.cyls||[]; const v=misfireVerdict(cyls);
  const top=Math.max(10,...cyls.map(c=>Math.max(c.cur,c.avg)));
  const pct=n=>Math.round(Math.min(100,n/top*100));
  box.innerHTML=`<div class="verdict ${v.ok?"ok":"no"}"></div>
  <div class="mf-legend"><span><i class="mf-cur"></i>Bu sürüş</span><span><i class="mf-avg"></i>Son 10 sürüş ortalaması</span></div>
  <ul class="mf-list">${cyls.map(c=>`<li class="mf-row${c.cyl===v.worst?" worst":""}"><b>${c.cyl}. silindir</b>
    <div class="mf-bar"><span><i class="mf-cur" style="width:${pct(c.cur)}%"></i></span><em>${c.cur}</em></div>
    <div class="mf-bar"><span><i class="mf-avg" style="width:${pct(c.avg)}%"></i></span><em>${c.avg}</em></div></li>`).join("")}</ul>
  <p class="sub">${v.ok&&v.text.startsWith("Tekleme yok")?"Not: bazı araçlar bu sayacı hep sıfır gösterir. ":""}Son okuma: ${new Date(MISFIRE.at).toLocaleTimeString("tr-TR")}</p>`;
  box.querySelector(".verdict").textContent=v.text;
}

on("connect",()=>{
  MISFIRE.prev=null; misfirePaint();
  clearInterval(MISFIRE.timer);
  MISFIRE.timer=setInterval(()=>{ if(S.active && !S.paused) misfireRead(true); }, MISFIRE.EVERY);
});
on("diag",()=>misfireRead(false));
on("disconnect",()=>{
  clearInterval(MISFIRE.timer); MISFIRE.timer=null; MISFIRE.prev=null;
  [...S.alarms.keys()].filter(k=>k.startsWith("misfire")).forEach(drop);
  misfirePaint();
});

// ---------- Deneme modu: 4 silindirli araç, 1. silindirde tekleme (demodaki P0301 koduyla uyumlu) ----------
(function(){
  const o=DemoLink.prototype.reply;
  const isoTp=d=>{ const n=d.length/2, out=[n.toString(16).toUpperCase().padStart(3,"0")]; let i=0,k=0;
    while(i<d.length){ const take=(k===0?6:7)*2; out.push(k.toString(16).toUpperCase()+":"+d.slice(i,i+take).padEnd(take,"0")); i+=take; k++; } return out.join("\r"); };
  const mask=(base,list)=>{ let m=0; list.forEach(p=>{ m|=1<<(31-(p-base-1)); }); return (m>>>0).toString(16).toUpperCase().padStart(8,"0"); };
  const SUP={0x00:[0x01,0x02,0x20],0x20:[0x21,0x31,0x40],0x40:[0x41,0x60],0x60:[0x80],0x80:[0x81,0xA0],0xA0:[0xA1,0xA2,0xA3,0xA4,0xA5]};
  const w=n=>m6hex((n>>8)&255)+m6hex(n&255);
  DemoLink.prototype.reply=function(cmd){
    if(!/^06[0-9A-F]{2}$/.test(cmd)) return o.call(this,cmd);
    const mid=parseInt(cmd.slice(2),16);
    if(SUP[mid]) return "46"+m6hex(mid)+mask(mid,SUP[mid]);
    if(mid<0xA2 || mid>0xA5) return "NO DATA";
    const t=(Date.now()-this.t0)/1000, cyl=mid-0xA1, fresh=this.cleared>=0;   // kod silinince sayaçlar sıfırlanır
    const since=fresh ? t-this.cleared : t;
    const cur = cyl===1 ? (fresh?Math.floor(since/40):14+Math.floor(since/20)*3) : (cyl===3 && !fresh ? 1 : 0);
    const avg = fresh ? 0 : ({1:23,2:0,3:2,4:0})[cyl];
    const rec=(tid,v)=>m6hex(mid)+m6hex(tid)+"24"+w(v)+"0000"+"FFFF";
    return isoTp("46"+rec(0x0B,avg)+rec(0x0C,cur));
  };
})();
