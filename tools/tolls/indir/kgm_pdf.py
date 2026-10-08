import pymupdf, re, json, sys

def num(s):
    if s is None: return None
    s = re.sub(r'[^\d,]', '', s)
    if not s: return None
    return float(s.replace(',', '.')) if ',' in s else float(s)

def clean(s):
    return re.sub(r'\s+', ' ', (s or '').replace('\n', ' ')).strip()

def validity(path):
    t = pymupdf.open(path)[0].get_text()
    m = re.findall(r'(\d\d)[/\.](\d\d)[/\.](\d{4}) saat 00:00', t)
    return sorted(set(f'{y}-{mo}-{d}' for d, mo, y in m))

def matrix_tables(path):
    p = pymupdf.open(path)[0]
    tabs = [t.extract() for t in p.find_tables().tables]
    mats, sides = [], []
    for t in tabs:
        flat = [c for r in t for c in r if c]
        # side table (SGS/serbest gecis): header row like ['SGS Yön','1',...] or ['İstasyon','Yön','1'..]
        hdr = [clean(c) for c in t[0]]
        if 'Yön' in ' '.join(hdr) or 'YÖN' in ' '.join(hdr):
            sides.append(t); continue
        if len(t) < 10: continue
        mats.append(t)
    return mats, sides

def parse_matrix(t):
    # locate exit header row and column offsets
    hi = None
    for i, r in enumerate(t[:3]):
        cells = [clean(c) for c in r]
        if any(c in ('Sınıf', 'SINIF') for c in cells) and sum(1 for c in cells if c and not c.isdigit()) > 4:
            hi = i
    if hi is None:
        hi = 1
    hdr = [clean(c) for c in t[hi]]
    # class column = index of 'Sınıf'/'SINIF' in header, or in first row
    ci = None
    for row in t[:3]:
        for j, c in enumerate(row):
            if clean(c) in ('Sınıf', 'SINIF'): ci = j
    exits_idx = [j for j in range(ci + 1, len(hdr)) if hdr[j]]
    exits = [hdr[j] for j in exits_idx]
    namecol = ci - 1
    raw = []
    names = []
    blk = -1
    for r in t[hi + 1:]:
        nm = clean(r[namecol]) if namecol < len(r) else ''
        if nm and nm not in ('GİRİŞ GİŞELERİ',) and nm not in names:
            names.append(nm)
        k = clean(r[ci])
        if not k.isdigit():
            continue
        if k == '1': blk += 1
        for j, ex in zip(exits_idx, exits):
            v = num(r[j])
            if v is None: continue
            raw.append((blk, ex, k, v))
    entries = names
    rows = [(names[b], ex, k, v) for b, ex, k, v in raw]
    return entries, exits, rows

def parse_side(t):
    out = []
    hdr = [clean(c) for c in t[0]]
    kcols = [j for j, c in enumerate(hdr) if c.isdigit()]
    for r in t[1:]:
        cells = [clean(c) for c in r]
        if 'Yön' in hdr[1] or 'Yön' == hdr[1]:
            gise, yon = cells[0], cells[1]
        else:
            gise, yon = cells[0], None
        d = {'gise': gise}
        if yon: d['yon'] = yon
        for j in kcols:
            d[hdr[j]] = num(cells[j])
        out.append(d)
    return out

if __name__ == '__main__':
    path = sys.argv[1]
    mats, sides = matrix_tables(path)
    res = {'gecerlilik': validity(path), 'matrisler': [], 'yan': []}
    for t in mats:
        en, ex, rows = parse_matrix(t)
        res['matrisler'].append({'giris': en, 'cikis': ex, 'satir': rows})
    for t in sides:
        res['yan'].append(parse_side(t))
    json.dump(res, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False)
