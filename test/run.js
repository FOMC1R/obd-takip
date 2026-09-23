// Tüm testleri sırayla çalıştırır: node test/run.js
const {spawnSync}=require("child_process"), fs=require("fs"), path=require("path");
let bad=0;
for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith(".test.js")).sort()){
  const r=spawnSync(process.execPath,[path.join(__dirname,f)],{encoding:"utf8",timeout:120000});
  const ok=r.status===0; if(!ok) bad++;
  console.log((ok?"GEÇTİ ":"KALDI ")+f+"  | "+(r.stdout||"").trim().split("\n").pop().slice(0,110));
  if(!ok) console.log(r.stderr||r.stdout);
}
process.exit(bad?1:0);
