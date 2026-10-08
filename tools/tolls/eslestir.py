import json,re,sys,math,os
sys.stdout.reconfigure(encoding="utf-8")
SP=os.path.join(os.path.dirname(os.path.abspath(__file__)),"kaynak")
def norm(s):
  s=s.replace("İ","i").replace("I","ı").lower()
  for a,b in [("k.burgaz","kumburgaz"),("ş.pınar","şekerpınar"),("org.san.","osb"),("org. san.","osb"),("organize san.","osb"),("organize sanayi","osb"),
              ("serbest b.","serbest bölge"),("bölgeleri","bölgesi"),("adapazari","adapazarı"),("akmeșe","akmeşe"),("alyhan","alayhan"),("demirciler","demirciler")]:
    s=s.replace(a,b)
  s=re.sub(r"\bg\s*-\s*\d+\b"," ",s)
  s=re.sub(r"\b(gişe(leri|si|ler)?|gate|alın|kavşağı|kavşak|yönü|ve|kmo|exit|çıkışı?)\b"," ",s)
  return [t for t in re.sub(r"[^a-zçğıöşü0-9 ]"," ",s).split() if t]
def dist(a,b): kx=111320*math.cos(math.radians(a[0])); return math.hypot((b[1]-a[1])*kx,(b[0]-a[0])*110540)
# ---- harita noktaları ----
pts={}
for x in json.load(open(f"{SP}/gise.json",encoding="utf-8")):
  la=x.get("lat") or x.get("center",{}).get("lat"); lo=x.get("lon") or x.get("center",{}).get("lon")
  if la: pts[str(x["id"])]={"t":"gise","n":x["tags"].get("name"),"k":(la,lo)}
K=json.load(open(f"{SP}/kavsak2.json",encoding="utf-8"))["el"] if os.path.exists(f"{SP}/kavsak2.json") else {}
for i,x in K.items():
  if "lat" not in x: continue
  t="gise" if x["tags"].get("barrier")=="toll_booth" else "kavsak"
  if t=="gise" and i in pts: continue
  pts[i]={"t":t,"n":x["tags"].get("name"),"k":(x["lat"],x["lon"])}
BOX={"O-3":(40.95,26.5,41.75,29.0),"O-4":(39.9,29.0,41.05,33.0),"O-31":(37.85,26.9,38.55,27.95),"O-32":(38.2,26.2,38.5,27.0),
 "O-21/O-51":(36.7,33.9,38.0,35.6),"O-52/O-53":(36.5,35.2,37.4,37.6),"O-54":(36.9,37.3,37.4,39.1),
 "O-7-AVRUPA":(40.95,28.0,41.4,29.0),"O-7-YSS":(41.0,28.6,41.35,29.4),"O-7-ANADOLU":(40.7,29.1,41.3,30.7),
 "O-5":(38.4,26.9,40.85,29.7),"O-21":(37.9,32.6,39.95,35.0),"MENEMEN-CANDARLI":(38.5,26.8,39.0,27.2),"O-6":(40.1,26.3,41.0,27.5),"AYDIN-DENIZLI":(37.6,27.8,38.0,29.2)}
inbox=lambda k,b:b[0]<=k[0]<=b[2] and b[1]<=k[1]<=b[3]
def alts(name):
  a=[norm(name)]+[norm(m) for m in re.findall(r"\(([^)]*)\)",name)]+[norm(re.sub(r"\(.*?\)","",name))]
  a+= [norm(re.sub(r"\s*-\s*\d+$","",name))]   # "Karacabey - Mustafakemalpaşa - 1"
  # genel kelimeler tek başına eşleşme sayılmaz ("ANADOLU (ÇAMLICA)" → "anadolu" Avrasya'nın Anadolu gişesine düşüyordu)
  GENERIC={"anadolu","avrupa","batı","doğu","kuzey","güney","merkez","havalimanı","osb","serbest","bölge","köprüsü","istanbul","izmir"}
  return [set(x) for x in a if x and not set(x)<=GENERIC]
def locate(road, names):
  b=BOX[road]; P={i:p for i,p in pts.items() if inbox(p["k"],b)}
  res={}; used=set(); jmatch={}
  for g in names:
    found=None
    for A in alts(g):
      ex=[i for i,p in P.items() if p["t"]=="gise" and p["n"] and set(norm(p["n"]))==A]
      sub=[i for i,p in P.items() if p["t"]=="gise" and p["n"] and A<=set(norm(p["n"]))]
      c=ex or sub
      if c: found=("gise",c); break
    if not found:
      for A in alts(g):
        j=[i for i,p in P.items() if p["t"]=="kavsak" and p["n"] and (set(norm(p["n"]))==A or A<=set(norm(p["n"])))]
        if j: found=("kavsak",j); break
    res[g]=found
  # kavşakla bulunanlar: çevredeki atanmamış gişe noktalarını en yakın eşleşmiş kavşağa ver
  named_ids={i for v in res.values() if v and v[0]=="gise" for i in v[1]}
  jpts=[(g,P[i]["k"]) for g,v in res.items() if v and v[0]=="kavsak" for i in v[1]]
  out={}
  for g,v in res.items():
    if v and v[0]=="gise": out[g]=[P[i]["k"] for i in v[1]]
  # köprü / tünel gişelerinin çevresi (Avrasya Anadolu gişesi, 15 Temmuz, FSM) otoyol gişesine atanmaz
  NOGO=[(40.993,29.038),(41.0055,29.028),(41.039,29.041),(41.0915,29.061),(41.0028,28.9668)]
  free=[i for i,p in P.items() if p["t"]=="gise" and i not in named_ids and all(dist(p["k"],c)>2000 for c in NOGO)]
  for i in free:
    k=P[i]["k"]; best=min(jpts,key=lambda x:dist(k,x[1]),default=None)
    if best and dist(k,best[1])<=2500:
      # eşleşmiş isimli bir gişeye daha yakınsa ona ait say (atlama)
      nn=min((dist(k,kk) for g2,kk_l in out.items() for kk in kk_l),default=9e9)
      if nn<dist(k,best[1]): continue
      out.setdefault(best[0],[]).append(k)
  # aynı noktalar iki gişede olmasın
  seen={}
  for g in names:
    if g not in out: continue
    key=tuple(sorted((round(a,4),round(c,4)) for a,c in out[g]))
    if key in seen: out[g]=None
    else: seen[key]=g
  # Her gişe için kavşaktan yaklaşık konum adayı (gişe noktası bulunsa da; sonradan boşalırsa kullanılır).
  # Kuzey Marmara (O-7) için "K. M. O." adlı kavşaklar, diğer yollarda onlar dışındakiler.
  WEAK.clear()
  kmo=road.startswith("O-7")
  for g in names:
    for A in alts(g):
      j2=[i for i,p in P.items() if p["t"]=="kavsak" and p["n"] and (set(norm(p["n"]))==A or A<=set(norm(p["n"])))]
      if not j2: continue
      isk=lambda i:(P[i]["n"] or "").upper().replace(" ","").startswith(("K.M.O","KMO"))
      pref=[i for i in j2 if isk(i)==kmo] or j2
      WEAK[g]=[P[i]["k"] for i in pref][:2]; break
  return {g:(out.get(g) or None) for g in names}
WEAK={}
if __name__=="__main__":
  tot=hit=0
  for f in ["ucret_kgm.json","ucret_yid.json"]:
    D=json.load(open(f"{SP}/{f}",encoding="utf-8"))
    for y in D["yollar"]:
      if y["id"] not in BOX: continue
      r=locate(y["id"],y["gise"]); ok=[g for g,v in r.items() if v]; miss=[g for g,v in r.items() if not v]
      tot+=len(r); hit+=len(ok); print(f'{y["id"]}: {len(ok)}/{len(r)}  eksik: {miss}')
  print("TOPLAM",hit,"/",tot)
