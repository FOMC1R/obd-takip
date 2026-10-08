import json,urllib.request,urllib.parse,time,os,sys
sys.stdout.reconfigure(encoding="utf-8")
UA={"User-Agent":"obd-takip-dev/1.0 (github.com/FOMC1R/obd-takip)"}
SRV=["https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
B={"O3":(40.95,26.5,41.75,29.0),"O4a":(40.75,29.0,41.05,31.2),"O4b":(40.55,31.2,40.95,33.0),"O4c":(39.9,32.4,40.6,32.95),
   "izmir":(37.85,26.2,38.55,27.95),"aydindenizli":(37.6,27.8,38.0,29.2),"menemen":(38.5,26.8,39.0,27.2),
   "cukurova1":(36.7,33.9,38.0,35.6),"cukurova2":(36.5,35.5,37.4,37.6),"urfa":(36.9,37.3,37.4,39.1),
   "o5a":(40.0,28.6,40.85,29.7),"o5b":(39.2,27.3,40.1,28.8),"o5c":(38.4,26.9,39.3,28.0),
   "o21":(37.9,32.6,39.95,35.0),"o6":(40.1,26.3,41.0,27.5),"km1":(40.95,28.0,41.4,29.0),"km2":(40.7,29.0,41.3,30.7)}
fn="kavsak2.json"; out=json.load(open(fn,encoding="utf-8")) if os.path.exists(fn) else {"done":[],"el":{}}
ONLY=sys.argv[1:]
for k,(a,b,c,d) in B.items():
  if ONLY and k not in ONLY: continue
  if k in out["done"]: continue
  q=f'[out:json][timeout:90];node["highway"="motorway_junction"]["name"]({a},{b},{c},{d});out;'
  ok=False
  for i in range(3):
    try:
      d2=json.load(urllib.request.urlopen(urllib.request.Request(SRV[i%2],data=urllib.parse.urlencode({"data":q}).encode(),headers=UA),timeout=120))
      for x in d2["elements"]: out["el"][str(x["id"])]=x
      out["done"].append(k); ok=True; print(k,len(d2["elements"]),flush=True); break
    except Exception as ex: print(k,"hata",ex,flush=True); time.sleep(6)
  json.dump(out,open(fn,"w",encoding="utf-8"),ensure_ascii=False)
  time.sleep(2)
print("bitti", len(out["el"]), "eksik:", [k for k in B if k not in out["done"]])
