// Sahte tarayıcı ortamı: index.html'deki uygulama betiğini ve features/*.js eklentilerini
// Node içinde çalıştırır. Test kodu uygulamanın global değişkenlerine (S, GAUGES, start…) erişir.
require("fake-indexeddb/auto");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
module.exports = function run(testCode){
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  let js = html.split("<script>")[1].split("</script>")[0];
  // eklentiler: <script src="features/…"> sırasıyla
  for (const m of html.matchAll(/<script src="(features\/[^"]+)"><\/script>/g))
    js += "\n;" + fs.readFileSync(path.join(ROOT, m[1]), "utf8");
  const ctx = new Proxy({}, {get:(o,k)=>k in o?o[k]:(()=>{}), set:(o,k,v)=>(o[k]=v,true)});
  const els = {}, sub = {};
  const mk = (id)=>{ const o={id,hidden:false,disabled:false,textContent:"",innerHTML:"",className:"",style:{},value:"",checked:false,
    clientWidth:300,clientHeight:34,width:0,height:0,dataset:{},children:[],
    classList:{toggle(){},add(){},remove(){},contains(){return false}},attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},removeAttribute(k){delete this.attrs[k]},
    addEventListener(t,f){(this.ev=this.ev||{})[t]=f},
    appendChild(c){ if(c&&c.id) els[c.id]=c; (this._kids=this._kids||[]).push(c); return c; },
    append(...k){ (this._kids=this._kids||[]).push(...k); }, prepend(...k){ (this._kids=this._kids||[]).unshift(...k); },
    insertAdjacentHTML(){}, insertBefore(c){ (this._kids=this._kids||[]).push(c); return c; },
    querySelector(s){ const k=(this.id||"")+s; return sub[k]||(sub[k]=mk()); }, querySelectorAll:()=>[], closest:()=>null,
    remove(){}, click(){}, focus(){}, scrollIntoView(){}, scrollTo(){},
    getContext:()=>ctx, getBoundingClientRect:()=>({left:0,width:600,top:0,height:34}), firstChild:{}, lastChild:{style:{}}}; return o; };
  global.document={getElementById:id=>els[id]||(els[id]=mk(id)),createElement:()=>mk(),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>mk(),
    visibilityState:"visible",documentElement:mk(),body:mk(),head:mk()};
  global.getComputedStyle=()=>({getPropertyValue:()=>"#888"});
  global.location={hash:"",protocol:"file:",hostname:""};
  global.localStorage=global.__ls||{getItem:()=>null,setItem(){},removeItem(){}};
  global.window=Object.assign({scrollTo(){},addEventListener(){},devicePixelRatio:2,matchMedia:()=>({matches:false,addEventListener(){}})},global.__winExtra||{});
  if(!global.navigator || !global.navigator.storage)
    Object.defineProperty(global,"navigator",{value:Object.assign({storage:{estimate:async()=>({usage:1}),persist:async()=>true}},global.__navExtra||{}),configurable:true});
  global.__els = els;
  // Testler deneme cihazıyla sürüş kaydını da sınar; uygulamada deneme kaydı varsayılan olarak kapalı
  eval(js + "\n;settings.recordDemo=true;(async()=>{" + testCode + "\n})().then(()=>process.exit(0)).catch(e=>{console.error('FAIL',e);process.exit(1);});");
};
