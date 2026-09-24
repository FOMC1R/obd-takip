// Birleştirme artığı kalmasın: çakışma işaretleri, bozuk service worker, eksik eklenti dosyası
const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const files=["index.html","sw.js","manifest.webmanifest",...fs.readdirSync(path.join(ROOT,"features")).map(f=>"features/"+f)];
const bad=[];
for(const f of files){
  const s=fs.readFileSync(path.join(ROOT,f),"utf8");
  if(/^(<<<<<<<|=======|>>>>>>>)( |\r?$)/m.test(s)) bad.push(f+": çakışma işareti");
}
const sw=fs.readFileSync(path.join(ROOT,"sw.js"),"utf8");
try{ new Function(sw); }catch(e){ bad.push("sw.js: sözdizimi hatası "+e.message); }
try{ JSON.parse(fs.readFileSync(path.join(ROOT,"manifest.webmanifest"),"utf8")); }catch(e){ bad.push("manifest: "+e.message); }
// index.html'deki her eklenti dosyası var mı ve service worker kurulum listesinde mi
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
for(const m of html.matchAll(/<script src="(features\/[^"]+)"><\/script>/g)){
  if(!fs.existsSync(path.join(ROOT,m[1]))) bad.push(m[1]+": dosya yok");
  if(!sw.includes("./"+m[1])) bad.push(m[1]+": sw.js SHELL listesinde yok");
}
if(bad.length){ console.error(bad.join("\n")); process.exit(1); }
console.log("bütünlük tamam:", files.length, "dosya");
