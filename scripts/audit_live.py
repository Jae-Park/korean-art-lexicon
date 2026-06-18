#!/usr/bin/env python3
"""One-off live-data audit on dist/lexicon.json.
Reference integrity + required fields + source quality + sufficiency signals.
No network. Prints a structured report."""
import json, re, sys
from collections import Counter, defaultdict

d = json.load(open('dist/lexicon.json'))
persons, exhibitions = d['persons'], d['exhibitions']
orgs, terms, pubs = d['organizations'], d['terms'], d['publications']

all_ids = set()
for t in d:
    for e in d[t]:
        all_ids.add(e.get('id'))

AGG = ('artnet', 'mutualart', 'invaluable', 'artsy')
PUBLISHABLE = {'reviewed', 'stable', 'firsthand'}

def src_list(e): return e.get('sources') or []
def host(u):
    m = re.match(r'https?://([^/]+)(/[^?#]*)?', u or '')
    return (m.group(1) if m else '', m.group(2) if m and m.group(2) else '')

issues = defaultdict(list)

# ---- 1. duplicate ids ----
idc = Counter(e.get('id') for t in d for e in d[t])
for i, n in idc.items():
    if n > 1: issues['DUP_ID'].append(f'{i} ×{n}')

# ---- 2. status leakage ----
for t in d:
    for e in d[t]:
        st = e.get('status')
        if st not in PUBLISHABLE:
            issues['STATUS_LEAK'].append(f"{e.get('id')} status={st}")

# ---- 3. broken cross-refs ----
for ex in exhibitions:
    for p in ex.get('participants') or []:
        if p not in all_ids: issues['BROKEN_PARTICIPANT'].append(f"{ex['id']} → {p}")
for coll in (orgs, terms):
    for e in coll:
        for r in e.get('related') or []:
            rid = r if isinstance(r, str) else r.get('id')
            if rid not in all_ids: issues['BROKEN_RELATED'].append(f"{e['id']} → {rid}")

# ---- 4. required fields ----
def need(cond, e, label):
    if not cond: issues['MISSING_FIELD'].append(f"{e.get('id')}: {label}")
for e in persons:
    nm = e.get('name', {})
    need(nm.get('ko', {}).get('full'), e, 'name.ko.full')
    need(nm.get('latn', {}).get('preferred'), e, 'name.latn.preferred')
    need(src_list(e), e, 'sources')
    need(e.get('role'), e, 'role')
for e in exhibitions:
    ti = e.get('title', {})
    need(ti.get('ko'), e, 'title.ko')
    need(ti.get('en'), e, 'title.en')
    need(e.get('type', {}).get('aat'), e, 'type.aat')
    need(e.get('dates'), e, 'dates')
    need(src_list(e), e, 'sources')
for e in orgs:
    nm = e.get('name', {})
    need(nm.get('ko'), e, 'name.ko'); need(nm.get('en'), e, 'name.en')
    need(e.get('type', {}).get('aat'), e, 'type.aat'); need(src_list(e), e, 'sources')
for e in terms:
    tm = e.get('term', {})
    need(tm.get('ko'), e, 'term.ko'); need(tm.get('en'), e, 'term.en')
    need(e.get('definition'), e, 'definition'); need(src_list(e), e, 'sources')

# ---- 5. source quality ----
for t in d:
    for e in d[t]:
        ss = src_list(e)
        if not ss: continue
        hosts = []
        agg_only = True
        for s in ss:
            u = s.get('url', '')
            h, path = host(u)
            hosts.append((h, path, (s.get('note') or '').lower()))
            if not any(a in u.lower() for a in AGG): agg_only = False
        if agg_only:
            issues['AGGREGATOR_ONLY'].append(f"{e.get('id')} ({len(ss)} src)")
        for h, path, note in hosts:
            if path in ('', '/') and not any(k in note for k in ('official', 'studio', 'foundation', 'estate', 'website')):
                issues['ROOT_URL'].append(f"{e.get('id')}: {h}{path}")

# ---- 6. sufficiency signals ----
referenced_persons = set()
for ex in exhibitions:
    referenced_persons |= set(ex.get('participants') or [])
for e in persons:
    if not e.get('name', {}).get('latn', {}).get('variants') and \
       not any('variant' in str(k).lower() for k in e.get('name', {}).keys()):
        # variants live under name.* ; flag persons with single source AND no variant capture
        pass
single_src = [e['id'] for e in persons if len(src_list(e)) <= 1]
orphan_persons = [e['id'] for e in persons if e['id'] not in referenced_persons]
no_birth = [e['id'] for e in persons if not e.get('birth_year') and not e.get('death_year')]
empty_part = [ex['id'] for ex in exhibitions if not (ex.get('participants'))]

# ---- report ----
print('='*70)
print('LIVE DATA AUDIT — dist/lexicon.json')
print(f"persons={len(persons)} exhibitions={len(exhibitions)} orgs={len(orgs)} terms={len(terms)} pubs={len(pubs)}")
print('='*70)
SEV = ['DUP_ID','STATUS_LEAK','BROKEN_PARTICIPANT','BROKEN_RELATED','MISSING_FIELD',
       'AGGREGATOR_ONLY','ROOT_URL']
print('\n--- INTEGRITY (must-fix) ---')
any_hard = False
for k in SEV:
    v = issues.get(k, [])
    if v:
        any_hard = True
        print(f'\n[{k}] {len(v)}')
        for x in v[:40]: print('   -', x)
        if len(v) > 40: print(f'   ... +{len(v)-40} more')
if not any_hard: print('  ✅ none')

print('\n--- SUFFICIENCY (editorial signals, not bugs) ---')
print(f'persons with ≤1 source: {len(single_src)}/{len(persons)}')
print(f'   {", ".join(single_src[:30])}{" ..." if len(single_src)>30 else ""}')
print(f'persons never referenced by any exhibition (orphans): {len(orphan_persons)}/{len(persons)}')
print(f'   {", ".join(orphan_persons[:30])}{" ..." if len(orphan_persons)>30 else ""}')
print(f'persons w/o birth_year & death_year: {len(no_birth)}/{len(persons)}')
print(f'exhibitions w/ empty participants: {len(empty_part)}/{len(exhibitions)}')
print(f'   {", ".join(empty_part[:30])}{" ..." if len(empty_part)>30 else ""}')
print(f'terms total: {len(terms)} | publications total: {len(pubs)}')

# status distribution
print('\n--- STATUS DISTRIBUTION ---')
for t in d:
    c = Counter(e.get('status') for e in d[t])
    if d[t]: print(f'  {t}: {dict(c)}')
