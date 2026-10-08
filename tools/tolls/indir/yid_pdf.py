import json, re, sys, os, datetime
import pymupdf
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location('pk', os.path.join(os.path.dirname(__file__), 'parse_kgm.py'))
pk = importlib.util.module_from_spec(spec); spec.loader.exec_module(pk)

K = sys.argv[1]  # dir with current pdfs (and jan/ subdir)
OUT = sys.argv[2]
KGMB = 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/'
WB = 'https://web.archive.org/web/{ts}/' + KGMB

def n(v):
    return int(v) if float(v).is_integer() else v

def parse(path, rename=None, mode='entries'):
    """returns (gise_order, ucret{k:[[g,c,v]]}, sides, validity)"""
    mats, sides = pk.matrix_tables(path)
    gise, ucret = [], {}
    for t in mats:
        en, ex, rows = pk.parse_matrix(t)
        emap, xmap = {}, {}
        if len(en) == len(ex):
            if mode == 'exits':
                emap = dict(zip(en, ex))
            else:
                xmap = dict(zip(ex, en))
        for g2 in [xmap.get(g, g) for g in ex] + [emap.get(g, g) for g in en]:
            if g2 not in gise: gise.append(g2)
        for e, x, k, v in rows:
            e = emap.get(e, e); x = xmap.get(x, x)
            ucret.setdefault(k, []).append([e, x, n(v)])
    sgs = []
    for t in sides:
        for d in pk.parse_side(t):
            d = {kk: (n(vv) if isinstance(vv, float) else vv) for kk, vv in d.items()}
            sgs.append(d)
    return gise, ucret, sgs, pk.validity(path)

def parse_aydin(path):
    p = pymupdf.open(path)[0]
    ws = p.get_text('words')
    nums = [w for w in ws if re.fullmatch(r'[\d\.]+,\d\d', w[4])]
    cols = {}
    for w in nums: cols.setdefault(round(w[2]), []).append(w)
    st = ['AYDIN ALIN', 'KÖŞK', 'YENİ PAZAR', 'NAZİLLİ', 'KUYUCAK', 'BUHARKENT', 'SARAYKÖY', 'KUMKISIK-A', 'KUMKISIK-B', 'PAMUKKALE', 'KOCABAŞ']
    xs = sorted(cols)
    assert len(xs) == 11, xs
    U = {}
    for ci, x in enumerate(xs):
        c = sorted(cols[x], key=lambda w: w[1]); assert len(c) == 66, len(c)
        for i, w in enumerate(c):
            U.setdefault(str(i % 6 + 1), []).append([st[i // 6], st[ci], n(float(w[4].replace('.', '').replace(',', '.')))])
    for k in U: U[k].sort(key=lambda r: (st.index(r[0]), st.index(r[1])))
    return st, U, [], pk.validity(path)

def sabit(path):
    t = pymupdf.open(path)[0].get_text()
    vals = [float(v.replace('.', '').replace(',', '.')) for v in re.findall(r'([\d\.]+,\d\d) ?₺', t)]
    assert len(vals) == 6, vals
    return {str(i + 1): n(v) for i, v in enumerate(vals)}, pk.validity(path)

J = os.path.join(K, 'jan')
def jf(name, ts): return os.path.join(J, f'{name}_{ts}.pdf')

COMMON_NOT = ('Ücretlere KDV dahil. Aynı istasyondan giriş-çıkış (U dönüşü) satırları da tabloda: bu durumda en uzak mesafe ücreti alınır. '
              'Giriş bilgisi bulunamazsa en uzak mesafe ücreti uygulanır.')
SINIF_NOT = 'Sınıflar KGM tanımı: 1 otomobil, 2 iki akslı ticari/minibüs, 3 üç akslı/otobüs, 4 dört-beş akslı, 5 altı ve üstü akslı, 6 motosiklet.'

roads = []
def closed(id_, ad, isletme, fname, jan_ts, extra_not='', rename_mode='entries', jan_unverified=False, aydin=False):
    cur = os.path.join(K, fname + '.pdf')
    f = parse_aydin if aydin else (lambda p: parse(p, mode=rename_mode))
    gise, ucret, sgs, val = f(cur)
    r = {'id': id_, 'ad': ad, 'isletme': isletme, 'tip': 'kapali',
         'kaynak': [KGMB + fname + '.pdf', 'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Otoyollar/UcretlerYeni.aspx'],
         'tarifeTarihi': val[-1] if val else None, 'dogrulanmadi': False,
         'gise': gise, 'ucret': ucret}
    if sgs:
        r['serbestGecis'] = sgs
    r['not'] = (COMMON_NOT + ' ' + SINIF_NOT + ' ' + extra_not).strip()
    if jan_ts:
        jp = jf(fname, jan_ts)
        g2, u2, s2, v2 = f(jp)
        o = {'tarifeTarihi': '2026-01-01', 'gecerlilikBitis': '2026-06-30',
             'kaynak': [WB.format(ts=jan_ts) + fname + '.pdf'],
             'dogrulanmadi': jan_unverified, 'ucret': u2}
        if s2: o['serbestGecis'] = s2
        if g2 != gise: o['gise'] = g2
        o['not'] = ('KGM sitesindeki aynı PDF\'in Wayback Machine arşiv kopyası (resmî belgenin arşivi). ' +
                    ('Bu dosyanın yalnız 31.12.2025 tarihli ilk kopyası arşivlenmiş; diğer yollarda bu ilk kopyalar sonradan '
                     'daha düşük rakamlarla düzeltildiği için bu dönem rakamları kesin değil.' if jan_unverified else
                     '1 Temmuz 2026 öncesi yürürlükteki son sürüm alındı (31.12.2025 tarihli ilk yayımlanan kopya sonradan düzeltilmiş, o kullanılmadı).'))
        r['onceki'] = o
    roads.append(r)
    return r

def bridge(id_, ad, isletme, fname, jan_ts, extra_not):
    s, val = sabit(os.path.join(K, fname + '.pdf'))
    sj, _ = sabit(jf(fname, jan_ts))
    roads.append({'id': id_, 'ad': ad, 'isletme': isletme, 'tip': 'kopru',
                  'kaynak': [KGMB + fname + '.pdf'], 'tarifeTarihi': val[-1], 'dogrulanmadi': False,
                  'sabit': s, 'not': ('Ücretlere KDV dahil. ' + SINIF_NOT + ' ' + extra_not).strip(),
                  'onceki': {'tarifeTarihi': '2026-01-01', 'gecerlilikBitis': '2026-06-30',
                             'kaynak': [WB.format(ts=jan_ts) + fname + '.pdf'], 'dogrulanmadi': False, 'sabit': sj,
                             'not': 'KGM PDF\'inin Wayback arşiv kopyası; otomobil rakamı KGM duyurusunu aktaran haberlerle aynı.'}})

closed('O-7-AVRUPA', 'Kuzey Marmara Otoyolu – Avrupa Kesimi (Kınalı–Odayeri)', None, '14-KMOAvrupaKinali-Odayeri', '20260415175019',
       'Kaynakta giriş gişeleri kodlu yazılı: KINALI (G11), SİLİVRİ (G12), ÇATALCA (G13), NAKKAŞ (G14), YASSIÖREN (G21), TAYAKADIN (G22), FATİH (G23); burada çıkış başlığındaki kodsuz adlar kullanıldı. '
       '"serbestGecis": havalimanı bağlantısındaki serbest geçiş (bariyersiz) noktalarının yöne göre tek ücretleri (SGS numarası ve yön kaynaktaki gibi). '
       'Nakkaş–Başakşehir kesimi henüz açılmadı (2027 bekleniyor), tarifesi yok.', rename_mode='exits')
closed('O-7-YSS', 'Kuzey Marmara Otoyolu – Yavuz Sultan Selim Köprüsü ve Kuzey Çevre Yolu (Odayeri–Kurnaköy)',
       'ICA İçtaş Astaldi (doğrulanmadı)', '13-YSSKuzeyCevreYolu', '20260410165904',
       'Kaynak notu: "Köprü Geçiş Ücreti İçermektedir" – bu tablodaki ücretlere YSS Köprüsü ücreti dahil; köprü iki yönlü ücretli (01.01.2022\'den beri). '
       '"serbestGecis": bağlantı yollarındaki serbest geçiş noktalarının yöne göre tek ücretleri. Kaynak notu: İkitelli Kavşağı\'nda Kuzey-Güney yönünde çıkış olmadığından bu kısmın ücreti Başakşehir Güney (Kuzey-Güney) istasyonunda alınır (İkitelli K-G = 0).')
closed('O-7-ANADOLU', 'Kuzey Marmara Otoyolu – Anadolu Kesimi (Kurtköy–Akyazı)', None, '15-KMOAnadoluKurtkoy-Akyazi', '20260415175019',
       'Kaynakta giriş satırında "MERMECİLER" yazılı (yazım hatası); çıkış başlığındaki "MERMERCİLER" kullanıldı. '
       '"serbestGecis": serbest geçiş noktalarının yöne göre tek ücretleri (SGS = Serbest Geçiş Sistemi). KURNAKÖY 2 bu tablonun gişesi; O-7-YSS\'deki Kurnaköy ayrı sistem.',
       rename_mode='exits')
bridge('YSS-KOPRU', 'Yavuz Sultan Selim Köprüsü', 'ICA İçtaş Astaldi (doğrulanmadı)', '3-YSSKoprusu', '20251231062022',
       'Köprü iki yönde de ücretli (01.01.2022\'den beri). Kuzey Marmara (O-7-YSS) kapalı sistem tablosundaki ücretlere bu köprü ücreti zaten dahil; ayrıca eklenmemeli.')
closed('O-5', 'Gebze–Orhangazi–İzmir Otoyolu (İzmit Körfez Geçişi ve Bağlantı Yolları Dahil)', 'Otoyol Yatırım ve İşletme A.Ş.',
       '12-Gebze-Orhangazi-Izmir', '20260607181213',
       'İki ayrı kapalı sistem tablosu var: Gebze–Bursa (1. ve 2. kesim: Osmangazi Köprüsü … Bursa Kuzey) ve Bursa–İzmir (3. ve 4. kesim: Bursa Batı … İzmir); iki tablo arası çift yok. '
       'Kaynak notu: İstanbul→İzmir yönünde Osmangazi köprü gişesinde yalnız köprü ücreti, sonra çıkılan gişede kat edilen otoyol ücreti alınır (yani "Osmangazi Köprüsü (İzmir Yönü)" girişli satırlar köprü HARİÇ otoyol ücretidir; köprü+otoyol = köprü ücreti + bu satır). '
       'İzmir→İstanbul yönünde Osmangazi köprü gişesinde köprü + girişe göre otoyol ücreti birlikte alınır ("Osmangazi Köprüsü (İstanbul Yönü)" çıkış sütunu köprü DAHİL). '
       'Karacabey-Mustafakemalpaşa 1/2 ve diğer adlar kaynaktaki giriş satırı yazımıyla (başlıktaki satır kırılma tireleri atıldı). PDF başlığında "01 Ocak" yazsa da not kısmı 01/07/2026 diyor.')
bridge('OSMANGAZI-KOPRU', 'Osmangazi Köprüsü', 'Otoyol Yatırım ve İşletme A.Ş.', '2-Osmangazi', '20251231061929',
       'O-5 kapalı sistem tablosundaki "Osmangazi Köprüsü (İzmir Yönü)" giriş–çıkış (aynı istasyon) satırı da bu köprü ücretine eşit.')
closed('O-21', 'Ankara–Niğde Otoyolu', None, '17-Ankara-Nigde', '20260415175019')
closed('MENEMEN-CANDARLI', 'Menemen–Aliağa–Çandarlı Otoyolu', None, '16-Menemen-Aliaga-Candarli', '20251231062019', jan_unverified=True)
closed('O-6', 'Malkara–Çanakkale Otoyolu (1915 Çanakkale Köprüsü Dahil)', None, '18-Malkara-Canakkale', '20260514195915',
       'Tablodaki ücretlere 1915 Çanakkale Köprüsü dahil (köprüyü geçen çiftlerde). GELİBOLU GÜNEY G-4 ↔ 1915 ÇANAKKALE KÖPRÜSÜ G-5 = yalnız köprü ücreti. '
       'U dönüşünde en uzak mesafe ücreti alınır. Kınalı–Tekirdağ–Malkara ve Çanakkale–Savaştepe kesimleri için KGM\'de tarife yok (açılmamış).')
bridge('1915-KOPRU', '1915 Çanakkale Köprüsü', None, '4-1915Canakkale', '20251231061825',
       'O-6 Malkara–Çanakkale tablosu köprüyü içerir; bu tek ücret GELİBOLU GÜNEY G-4 ↔ G-5 çiftine eşit. Giriş bilgisi yoksa çıkışa göre en uzak mesafe ücreti; U dönüşünde en uzak mesafe ücreti.')
closed('AYDIN-DENIZLI', 'Aydın–Denizli Otoyolu', None, '19-Aydin-Denizli', '20251231061822', aydin=True, jan_unverified=True,
       extra_not='KUMKISIK-A / KUMKISIK-B kaynakta ayrı gişe (yöne bağlı yarım bağlantı gibi; bazı çiftlerde en yüksek ücret yazılı) – kaynaktaki gibi aktarıldı.')

roads.append({
    'id': 'AVRASYA', 'ad': 'Avrasya Tüneli', 'isletme': 'ATAŞ (Avrasya Tüneli İşletme İnşaat ve Yatırım A.Ş.)', 'tip': 'tunel',
    'kaynak': ['https://www.avrasyatuneli.com/ucretlendirme/',
               'https://www.avrasyatuneli.com/haberler-ve-duyurular/detay/1-temmuz-2026-itibariyla-gecerli-avrasya-tuneli-gecis-ucretleri-tarifesi'],
    'tarifeTarihi': '2026-07-01', 'dogrulanmadi': False,
    'saatli': {'gunduz': {'saat': '05:00-23:59', '1': 330, '2': 495, '6': 257.4},
               'gece': {'saat': '00:00-04:59', '1': 165, '2': 247.5, '6': 128.7}},
    'not': 'Tek yön ücreti, %10 KDV dahil. İşletmeci sınıf tanımı: 1. sınıf = aks aralığı 3,20 m\'den küçük iki akslı (otomobil); 2. sınıf = aks aralığı 3,20 m ve üstü, UKOME kararınca geçişi uygun iki akslı (minibüs); 6. sınıf = motosiklet. 3-4-5. sınıf araçlar tünele giremez. Gece tarifesi gündüzün %50\'si. Ödeme yalnız HGS/serbest geçiş (gişede nakit yok).',
    'onceki': {'tarifeTarihi': '2026-01-01', 'gecerlilikBitis': '2026-06-30', 'dogrulanmadi': False,
               'kaynak': ['https://www.avrasyatuneli.com/haberler-ve-duyurular/detay/1-ocak-2026-itibariyla-gecerli-avrasya-tuneli-gecis-ucretleri-tarifesi'],
               'saatli': {'gunduz': {'saat': '05:00-23:59', '1': 280, '2': 420, '6': 218.4},
                          'gece': {'saat': '00:00-04:59', '1': 140, '2': 210, '6': 109.2}}}})

doc = {'toplama': datetime.date.today().isoformat(),
       'aciklama': 'Ana alanlar (ucret/sabit/saatli) bugün yürürlükteki 01.07.2026 tarifesi (KGM 2026 Temmuz zammı). İstenen 01.01.2026 tarifesi her yolun "onceki" alanında (01.01–30.06.2026 arası geçerli). Ücretler TL, KDV dahil. Kaynak: KGM "Otoyol ve Köprü Geçiş Ücretleri" sayfasındaki resmî PDF\'ler ve Avrasya Tüneli resmî sitesi.',
       'yollar': roads}
json.dump(doc, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
tot = sum(len(v) for r in roads for v in r.get('ucret', {}).values())
totj = sum(len(v) for r in roads for v in r.get('onceki', {}).get('ucret', {}).values())
print('roads', len(roads), 'rows current', tot, 'rows jan', totj)
for r in roads:
    print(r['id'], r['tarifeTarihi'], len(r.get('gise', [])), {k: len(v) for k, v in r.get('ucret', {}).items()}, r.get('sabit'), len(r.get('serbestGecis', [])))
