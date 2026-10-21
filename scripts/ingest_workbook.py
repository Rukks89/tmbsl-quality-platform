"""Build src/data/master-data.json from data/Shop-Station-Activity.xlsx.

Standard library only. Run with:  python3 -I scripts/ingest_workbook.py

Rules (documented in docs/data-validation.md):
  * Shop (col A) and station (col B) values carry forward to continuation rows.
    Merged-cell ranges are used to confirm each carried value; rows outside a
    merge that rely on carry-forward are reported as warnings.
  * Every non-empty line of an activity cell becomes its own operation, keeping
    its OPxx-yy.z code, the original text and the source row/cell reference.
  * The workbook contains a find-and-replace artefact where "ST" was replaced by
    "STATION" inside words ("FaSTATIONeners"). Display text repairs this; the
    original text is preserved verbatim in `source`.
  * Wrapped lines (start with a lowercase word, no code) are joined to the
    previous line. Lettered sub-items ("a.SLD mounting") keep a parent heading.
  * Only exact duplicates (same station, same code, same normalised text) are
    removed, and each removal is logged.
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'Shop-Station-Activity.xlsx'
OUT = ROOT / 'src' / 'data' / 'master-data.json'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
T = '{%s}t' % NS['m']

# Display aliases for shop names. Source spelling is kept in `sourceName`.
SHOP_ALIASES = {
    'Chassis Preperations': ('Chassis Preparation', 'chassis'),
    'JIGS SHOP': ('Jigs Shop', 'jigs'),
    'COUPLING SHOP': ('Coupling Shop', 'coupling'),
    'PANELING SHOP': ('Paneling Shop', 'paneling'),
    'PAINT SHOP': ('Paint Shop', 'paint'),
    'TRIM SHOP': ('Trim Shop', 'trim'),
}


def repair(text):
    """Undo the ST -> STATION replacement artefact, preserving case."""
    def fix_word(m):
        w = m.group(0)
        if 'STATION' not in w:
            return w
        out = []
        parts = w.split('STATION')
        for i, p in enumerate(parts):
            out.append(p)
            if i < len(parts) - 1:
                nxt = parts[i + 1]
                prev = ''.join(out)
                upper_ctx = (prev[-1:].isupper() or not prev) and (nxt[:1].isupper() or not nxt or not nxt[:1].isalpha())
                if upper_ctx:
                    out.append('ST')
                elif not prev and m.start() == 0:
                    out.append('St')
                else:
                    out.append('st')
        return ''.join(out)
    return re.sub(r'[A-Za-z]*STATION[A-Za-z]*', fix_word, text)


def norm(text):
    return re.sub(r'\s+', ' ', text).strip()


def col_row(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    return m.group(1), int(m.group(2))


def load(path):
    z = zipfile.ZipFile(path)
    shared = [''.join(t.text or '' for t in si.iter(T))
              for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    merges = []
    for mc in sheet.findall('.//m:mergeCell', NS):
        a, b = mc.get('ref').split(':')
        (c1, r1), (_, r2) = col_row(a), col_row(b)
        merges.append((c1, r1, r2))
    rows = {}
    for r in sheet.findall('.//m:row', NS):
        cells = {}
        for c in r.findall('m:c', NS):
            col, _ = col_row(c.get('r'))
            v = c.find('m:v', NS)
            if v is not None:
                cells[col] = shared[int(v.text)] if c.get('t') == 's' else v.text
            elif c.find('m:is', NS) is not None:
                cells[col] = ''.join(t.text or '' for t in c.find('m:is', NS).iter(T))
        rows[int(r.get('r'))] = cells
    return rows, merges


def merge_anchor(merges, col, row):
    for c, r1, r2 in merges:
        if c == col and r1 <= row <= r2:
            return r1
    return None


def station_meta(raw):
    lines = [norm(l) for l in raw.split('\n') if norm(l)]
    first = repair(lines[0])
    name = repair(' '.join(lines[1:])) if len(lines) > 1 else None
    m = re.search(r'(\d{2})', first)
    number = m.group(1) if m else None
    sm = re.fullmatch(r'(S\d{2})(?:[- ]+(.+))?', first)
    if sm:
        name = name or (sm.group(2).title() if sm.group(2) else None)
        name = name[:1].upper() + name[1:] if name else None
        code = sm.group(1)
        label = f'{code} · {name}' if name else code
    elif number and re.search(r'ST', first.upper()):
        code, label = f'ST-{number}', f'Station {number}'
    else:
        code, label = None, first.title() if first.isupper() else first
        label = re.sub(r'\b(Lh|Rh)\b', lambda x: x.group(1).upper(), label)
        if first == 'PDI':
            label = 'PDI'
    return {'label': label, 'number': number, 'code': code, 'subtitle': name}


GENERIC = [
    (re.compile(r'^ensur(e|ing).*check ?list', re.I), 'checklist'),
    (re.compile(r'^move (bus|chassis)', re.I), 'transfer'),
]
CODE_RE = re.compile(r'^(OP\d+)\s*-\s*(\d+\.\d+)\s+(.*)$')
SUB_RE = re.compile(r'^([A-Za-z])\.\s*(.*)$')


def main():
    rows, merges = load(SRC)
    header = rows[1]
    shops, warnings, duplicates = [], [], []
    shop = station = None
    seen = set()
    act_seq = 0
    last_row = max(rows)
    for r in range(2, last_row + 1):
        cells = rows.get(r, {})
        a, b, c = (cells.get(k) for k in 'ABC')
        if a and a.strip():
            src = a.strip()
            display, sid = SHOP_ALIASES.get(src, (src.title(), re.sub(r'\W+', '-', src.lower())))
            shop = {'id': sid, 'name': display, 'sourceName': src, 'sourceRow': r, 'order': len(shops) + 1, 'stations': []}
            shops.append(shop)
            station = None
        if b and b.strip():
            meta = station_meta(b)
            sid = f"{shop['id']}-{(meta['code'] or meta['label']).lower()}"
            sid = re.sub(r'[^a-z0-9]+', '-', sid).strip('-')
            base, n = sid, 2
            while any(s['id'] == sid for s in shop['stations']):
                sid, n = f'{base}-{n}', n + 1
            station = {'id': sid, 'shopId': shop['id'], **meta, 'sourceLabel': norm(b), 'sourceRow': r,
                       'order': len(shop['stations']) + 1, 'activities': []}
            shop['stations'].append(station)
        if not c or not c.strip():
            continue
        if shop is None or station is None:
            warnings.append({'row': r, 'level': 'error', 'message': 'Activity has no determinable shop/station; excluded from hierarchy.', 'text': norm(c)})
            continue
        # Confirm carry-forward with merged ranges.
        if not (a and a.strip()) and merge_anchor(merges, 'A', r) != shop['sourceRow']:
            warnings.append({'row': r, 'level': 'warning', 'message': f"Shop '{shop['name']}' assigned by carry-forward (row outside shop merge range)."})
        if not (b and b.strip()) and merge_anchor(merges, 'B', r) != station['sourceRow']:
            warnings.append({'row': r, 'level': 'warning', 'message': f"Station '{station['label']}' assigned by carry-forward (row outside station merge range)."})
        anchor_c = merge_anchor(merges, 'C', r)
        span = None
        for col, r1, r2 in merges:
            if col == 'C' and r1 == r:
                span = r2
        lines = [norm(l) for l in c.split('\n') if norm(l)]
        merged_lines = []
        for idx, line in enumerate(lines):
            if merged_lines and not CODE_RE.match(line) and not SUB_RE.match(line) and line[:1].islower():
                merged_lines[-1]['text'] += ' ' + line
                merged_lines[-1]['joined'] = True
                warnings.append({'row': r, 'level': 'info', 'message': 'Wrapped line joined to previous operation.', 'text': line})
                continue
            merged_lines.append({'text': line, 'line': idx + 1, 'joined': False})
        parent = None
        for ml in merged_lines:
            raw = ml['text']
            fixed = repair(raw)
            m = CODE_RE.match(fixed)
            op_group = op_code = None
            desc = fixed
            if m:
                op_group, op_code, desc = m.group(1), m.group(2), m.group(3)
            sub = SUB_RE.match(desc)
            parent_heading = None
            if sub and not m:
                parent_heading = parent
                desc = sub.group(2)
            else:
                parent = desc
            kind = 'operation'
            for rx, k in GENERIC:
                if rx.search(desc):
                    kind = k
            key = (station['id'], op_code, desc.lower())
            if key in seen:
                duplicates.append({'row': r, 'stationId': station['id'], 'text': desc, 'reason': 'Exact duplicate of an earlier operation at the same station (same code and text).'})
                continue
            seen.add(key)
            act_seq += 1
            station['activities'].append({
                'id': f'A{act_seq:04d}', 'stationId': station['id'], 'shopId': shop['id'],
                'opGroup': op_group, 'opCode': f'{op_group}-{op_code}' if op_group else None,
                'text': desc, 'parentHeading': parent_heading, 'kind': kind,
                'source': raw, 'sourceRef': f'C{r}' + (f':C{span}' if span else ''), 'sourceRow': r, 'sourceLine': ml['line'],
                'repaired': fixed != raw,
            })
    for s in shops:
        for st in s['stations']:
            if not st['activities']:
                warnings.append({'row': st['sourceRow'], 'level': 'warning', 'message': f"Station '{st['label']}' in {s['name']} has no activities in the workbook."})
    totals = {
        'shops': len(shops),
        'stations': sum(len(s['stations']) for s in shops),
        'activities': sum(len(st['activities']) for s in shops for st in s['stations']),
        'codedOperations': sum(1 for s in shops for st in s['stations'] for a in st['activities'] if a['opCode']),
        'repairedTexts': sum(1 for s in shops for st in s['stations'] for a in st['activities'] if a['repaired']),
        'sourceRows': last_row - 1,
        'mergedRanges': len(merges),
    }
    out = {
        'source': {'file': SRC.name, 'sheet': 'Sheet1', 'columns': [norm(header.get(k, '')) for k in 'ABC'], 'rows': last_row},
        'totals': totals, 'shops': shops, 'warnings': warnings, 'duplicatesRemoved': duplicates,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(totals), len(warnings), 'notes;', len(duplicates), 'duplicates removed')


if __name__ == '__main__':
    sys.exit(main())
