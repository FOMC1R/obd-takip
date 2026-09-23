
const said=[];
global.speechSynthesis={getVoices:()=>[{lang:"en-US",name:"en"},{lang:"tr-TR",name:"Türkçe Google"}],speak:u=>said.push(u.text+" ["+(u.voice&&u.voice.name)+"]"),addEventListener(){}};
global.SpeechSynthesisUtterance=function(t){this.text=t;};
global.__winExtra={speechSynthesis:global.speechSynthesis};
global.__said=said;
require("./harness")(String.raw`
  const demo=new DemoLink(); demo.t0=Date.now()-60000;
  settings.record=false; settings.lim["05"].max=95;
  await start(demo); await wait(5000);
  console.log(__said.filter(x=>x.trim()!=="[Türkçe Google]").join("\n"));
  settings.mute=true; __said.length=0; raise("x","crit","deneme"); console.log("sessizde konuşma:", __said.length);
  stop(); await wait(200);
`);
