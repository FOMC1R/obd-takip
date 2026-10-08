import json,sys,os,math
sys.stdout.reconfigure(encoding="utf-8")
HERE=os.path.dirname(os.path.abspath(__file__)); exec(open(os.path.join(HERE,"eslestir.py"),encoding="utf-8").read().split("if __name__")[0])
KGM=json.load(open(os.path.join(SP,"ucret_kgm.json"),encoding="utf-8")); YID=json.load(open(os.path.join(SP,"ucret_yid.json"),encoding="utf-8"))
BR=json.load(open(os.path.join(SP,"kopru.json"),encoding="utf-8"))
def dedup(pts):
  out=[]
  for p in pts:
    p=[round(p[0],5),round(p[1],5)]
    if all(dist(p,q)>25 for q in out): out.append(p)
  return out
def matrix(names, pairs):
  n=len(names); idx={g:i for i,g in enumerate(names)}; m=[None]*(n*n); miss=0
  for a,b,v in pairs:
    if a in idx and b in idx: m[idx[a]*n+idx[b]]=v
    else: miss+=1
  return m,miss
roads=[]; report=[]; WEAKS={}
def closed(y, src):
  names=y["gise"]; loc=locate(y["id"],names) if y["id"] in BOX else {}
  weak=dict(WEAK)
  gise=[]
  for g in names:
    if loc.get(g): gise.append({"ad":g,"k":dedup(loc[g])})
    elif weak.get(g): gise.append({"ad":g,"k":dedup(weak[g]),"r":250})   # yaklaşık: kavşak noktası
    else: gise.append({"ad":g,"k":[]})
  m={}; miss=0
  for c,pairs in (y.get("ucret") or {}).items():
    m[c],mm=matrix(names,pairs); miss+=mm
  WEAKS[y["id"]]=weak
  r={"id":y["id"],"ad":y["ad"],"tip":"kapali","tarih":y.get("tarifeTarihi"),"gise":gise,"m":m}
  if y.get("onceki") and y["onceki"].get("ucret"):
    r["onceki"]={"m":{c:matrix(names,p)[0] for c,p in y["onceki"]["ucret"].items()}}
  if y.get("dogrulanmadi"): r["dogrulanmadi"]=True
  located=sum(1 for g in gise if g["k"])
  report.append((y["id"],located,len(gise),[g["ad"] for g in gise if not g["k"]],miss))
  return r
for y in KGM["yollar"]+YID["yollar"]:
  if y["tip"]=="kapali": roads.append(closed(y,None))
# ---- Kuzey Marmara (O-7) ile TEM (O-3 / O-4) aynı adlı gişeler: KMO kuzeyden geçer → kuzeydeki nokta O-7'ye ----
byid={r["id"]:r for r in roads}
for tem,kmo in [("O-3","O-7-AVRUPA"),("O-4","O-7-ANADOLU")]:
  for gt in byid[tem]["gise"]:
    for gk in byid[kmo]["gise"]:
      if set(norm(gt["ad"]))!=set(norm(gk["ad"])) or not (gt["k"] or gk["k"]): continue
      allp=sorted({tuple(p) for p in gt["k"]+gk["k"]}, key=lambda p:-p[0])
      if len(allp)<2 or dist(allp[0],allp[-1])<1000: continue
      north=[list(p) for p in allp if dist(p,allp[0])<1000]; south=[list(p) for p in allp if dist(p,allp[0])>=1000]
      gk["k"]=north; gt["k"]=south; gk.pop("r",None); gt.pop("r",None)
      print("ayrıldı:",tem,gt["ad"],"↔",kmo,gk["ad"])
# ---- bir harita noktası tek yola ait olsun ----
# Aynı adlı farklı gişeler (ör. TEM Silivri ile Kuzey Marmara Silivri, 4 km ara) ad eşleşmesiyle iki yola birden düşebiliyor.
# Paylaşılan nokta, kendisine en yakın paylaşılmamış gişesi hangi yoldaysa o yola verilir.
closed_r=[r for r in roads if r["tip"]=="kapali"]
owners={}
for r in closed_r:
  for g in r["gise"]:
    for p in g["k"]: owners.setdefault((p[0],p[1]),[]).append((r,g))
def near_key(p):   # 70 m içindeki noktaları aynı fiziksel nokta say
  return [q for q in owners if dist(p,q)<70]
groups=[]; seen=set()
for q in list(owners):
  if q in seen: continue
  grp=near_key(q); seen.update(grp)
  rs={id(r) for k in grp for r,g in owners[k]}
  if len(rs)>1: groups.append(grp)
def unshared_centers(r, shared_pts):
  out=[]
  for g in r["gise"]:
    pts=[p for p in g["k"] if (p[0],p[1]) not in shared_pts]
    if pts and len(pts)==len(g["k"]): out.append(pts[0])
  return out
shared=set(k for grp in groups for k in grp)
moved=0
for grp in groups:
  cand={id(r):r for k in grp for r,g in owners[k]}
  p=grp[0]
  best=min(cand.values(), key=lambda r: min((dist(p,c) for c in unshared_centers(r,shared)), default=9e9))
  for k in grp:
    for r,g in owners[k]:
      if r is not best and [k[0],k[1]] in g["k"]: g["k"].remove([k[0],k[1]]); moved+=1
print("paylaşılan nokta grubu:",len(groups),"· başka yoldan çıkarılan nokta:",moved)
# İstanbul: elle doğrulanmış konumlar (harita noktalarının isimsiz kümesi; kavşağa 2,5 km'den uzak kalıyordu)
OVERRIDE={("O-4","ANADOLU (ÇAMLICA)"):[[41.02391,29.09193],[41.02507,29.09124],[41.02459,29.08886]]}
for (rid,gad),k in OVERRIDE.items():
  for g in byid[rid]["gise"]:
    if g["ad"]==gad: g["k"]=k; g.pop("r",None)
# boşalan gişelere kavşaktan yaklaşık konum
for r in closed_r:
  for g in r["gise"]:
    w=WEAKS.get(r["id"],{}).get(g["ad"])
    if not g["k"] and w: g["k"]=dedup(w); g["r"]=250
# Osmangazi: Hersek gişesi giriş olarak İzmir yönü, çıkış olarak İstanbul yönü sütunu
o5=[r for r in roads if r["id"]=="O-5"][0]
for g in o5["gise"]:
  if g["ad"]=="Osmangazi Köprüsü (İzmir Yönü)": g["adCikis"]="Osmangazi Köprüsü (İstanbul Yönü)"
  if g["ad"]=="Osmangazi Köprüsü (İstanbul Yönü)": g["k"]=[]; g.pop("r",None)   # aynı Hersek gişesi; adCikis ile kullanılır
def fixed(id_, src, k, extra=None):
  y=[x for x in src["yollar"] if x["id"]==id_][0]
  r={"id":id_,"ad":y["ad"],"tip":y["tip"],"tarih":y.get("tarifeTarihi"),"gise":[{"ad":y["ad"],"k":k}]}
  if y.get("sabit"): r["sabit"]=y["sabit"]
  if y.get("saatli"): r["saatli"]=y["saatli"]
  if y.get("onceki"):
    o={kk:y["onceki"][kk] for kk in ("sabit","saatli") if y["onceki"].get(kk)}
    if o: r["onceki"]=o
  if extra: r.update(extra)
  return r
roads.append(fixed("15TEMMUZ",KGM,BR["15TEMMUZ"]["orta"]))
roads.append(fixed("FSM",KGM,BR["FSM"]["orta"]))
roads.append(fixed("YSS-KOPRU",YID,BR["YSS"]["orta"],{"dahil":[{"yol":"O-7-YSS"}]}))
roads.append(fixed("OSMANGAZI-KOPRU",YID,BR["OSMANGAZI"]["orta"],{"dahil":[{"yol":"O-5","cikis":"Osmangazi Köprüsü (İstanbul Yönü)"}]}))
roads.append(fixed("1915-KOPRU",YID,BR["1915"]["orta"],{"dahil":[{"yol":"O-6"}]}))
roads.append(fixed("AVRASYA",YID,[[41.00497,29.02833],[41.00233,28.96965]],{"ikiNokta":True}))
D={"surum":1,"tarifeTarihi":"2026-07-01","olusturma":"2026-10-08",
   "aciklama":"Köprü, tünel ve otoyol geçiş ücretleri (KDV dahil, TL). KGM yolları 01.01.2026, YİD yolları 01.07.2026 tarifesi (onceki: 01.01.2026). m: n×n ızgara, satır giriş, sütun çıkış (gise sırası).",
   "kaynaklar":["https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Otoyollar/UcretlerYeni.aspx","https://www.avrasyatuneli.com"],
   "lisans":"Gişe ve köprü konumları © OpenStreetMap katkıcıları, ODbL 1.0 (openstreetmap.org/copyright)","yollar":roads}
OUT=os.path.join(HERE,"..","..","data","tolls.json")
txt=json.dumps(D,ensure_ascii=False,separators=(",",":"))
open(r"D:\FO-YEDEK\OBD-Takip\data\tolls.json","w",encoding="utf-8",newline="\n").write(txt)
print("boyut KB:",round(len(txt.encode())/1024))
report=[(r["id"],sum(1 for g in r["gise"] if g["k"]),len(r["gise"]),[g["ad"] for g in r["gise"] if not g["k"]],0) for r in closed_r]
for r in report: print(f"{r[0]}: konum {r[1]}/{r[2]} · eşleşmeyen ücret satırı {r[4]} · konumsuz {r[3]}")
