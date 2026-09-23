
require("./harness")(String.raw`
  const CR=String.fromCharCode(13);
  const demo=new DemoLink(); demo.t0=Date.now()-44000;
  let push, closeStream;
  const port={
    readable:new ReadableStream({start(c){ let shut=false; push=s=>{ if(!shut) c.enqueue(new TextEncoder().encode(s)); }; closeStream=()=>{ shut=true; c.close(); }; }}),
    writable:new WritableStream({write(chunk){ const cmd=new TextDecoder().decode(chunk).trim().toUpperCase(); setTimeout(()=>push(demo.reply(cmd)+CR+CR+">"),5); }}),
    async open(o){ this.opened=o; }, async close(){ this.closed=true; }
  };
  settings.record=false;
  await start(new SerialLink(port));
  await wait(4000);
  console.log("status:", __els.statusText.textContent);
  console.log("rpm/speed/coolant:", S.g["0C"].v, S.g["0D"].v, S.g["05"].v);
  console.log("dtc:", JSON.stringify(S.dtc.stored));
  closeStream(); await wait(300);
  console.log("after drop -> active:", S.active, "status:", __els.statusText.textContent, "port closed:", port.closed);
`);
