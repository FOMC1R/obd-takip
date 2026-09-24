// Ön cam (HUD): hız sınırı yolun sınırından (SPEEDLIM) gelir; yoksa ayardaki sınır
require("./harness")(String.raw`
  const HUD=window.HUD;
  const d=new DemoLink(); d.t0=Date.now()-44000;
  await start(d); await wait(2500); S.paused=true; await wait(800);
  HUD.open();
  const st=S.g["0D"]; st.v=62; st.ts=Date.now();
  const orig=window.SPEEDLIM;
  window.SPEEDLIM={now:()=>({v:50, kaynak:"yol"})}; emit("speedLimit",window.SPEEDLIM.now());
  if(HUD.limEl.textContent!=="50") throw new Error("HUD yol sınırını göstermedi: "+HUD.limEl.textContent);
  if(!HUD.vals.spd.className.includes("over")) throw new Error("yol sınırı aşımında kırmızı değil");
  window.SPEEDLIM={now:()=>({v:settings.lim["0D"].max, kaynak:"ayar"})}; HUD.update();
  if(HUD.limEl.textContent!==String(settings.lim["0D"].max) || HUD.vals.spd.className.includes("over")) throw new Error("ayardaki sınıra dönmedi");
  window.SPEEDLIM=orig;
  HUD.close(); stop(); await wait(600);
  console.log("HUD hız sınırı: yol sınırı ve ayara dönüş tamam");
`);
