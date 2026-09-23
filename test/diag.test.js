
require("./harness")(String.raw`
  const demo=new DemoLink(); demo.t0=Date.now()-44000;
  settings.record=false;
  // kv() öğelere append ile yazıyor; sahte append'i metne çevir
  const txt=el=>{ const out=[]; (el._kids||[]).forEach(k=>out.push(k.textContent)); return out.join(" | "); };
  for(const id of ["vehInfo","counters","ready","ffBox"]){ const el=document.getElementById(id); el.append=(...k)=>{ el._kids=(el._kids||[]).concat(k); }; Object.defineProperty(el,"innerHTML",{set(v){ el._kids=[]; el._html=v; },get(){ return el._html; }}); el.appendChild=c=>{ el.append(c); }; }
  await start(demo);
  await wait(6000);
  console.log("ARAÇ:", txt(__els.vehInfo));
  console.log("SAYAÇ:", txt(__els.counters));
  const rk=__els.ready._kids||[]; console.log("MUAYENE:", rk[0]&&rk[0].textContent, "/ madde:", rk[1]&&rk[1].children);
  const fk=__els.ffBox._kids||[]; console.log("DONMUŞ KARE:", fk[0] ? txt(fk[0]) : __els.ffBox._html);
  stop(); await wait(200);
`);
