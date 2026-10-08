import json,urllib.request,urllib.parse,time,sys
sys.stdout.reconfigure(encoding="utf-8")
UA={"User-Agent":"obd-takip-dev/1.0 (github.com/FOMC1R/obd-takip)"}
SRV=["https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
out={}
lat=35.8
while lat<42.2:
  lon=25.6
  while lon<44.9:
    q=f'[out:json][timeout:60];(node["barrier"="toll_booth"]({lat},{lon},{min(lat+2,42.2)},{min(lon+2,44.9)});way["barrier"="toll_booth"]({lat},{lon},{min(lat+2,42.2)},{min(lon+2,44.9)}););out center tags;'
    for attempt in range(4):
      try:
        req=urllib.request.Request(SRV[attempt%2],data=urllib.parse.urlencode({"data":q}).encode(),headers=UA)
        d=json.load(urllib.request.urlopen(req,timeout=90))
        for e in d["elements"]: out[f'{e["type"]}{e["id"]}']=e
        print(f"{lat},{lon}: {len(d['elements'])}"); break
      except Exception as x:
        time.sleep(5)
    else: print(f"{lat},{lon}: BAŞARISIZ")
    time.sleep(1.5); lon+=2
  lat+=2
json.dump(list(out.values()),open("gise.json","w",encoding="utf-8"),ensure_ascii=False)
print("toplam",len(out))
