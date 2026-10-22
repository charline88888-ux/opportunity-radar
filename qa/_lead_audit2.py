import json, io, sys, datetime as dt
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
opps = json.load(open('data/opportunities.json', encoding='utf-8'))
tax = json.load(open('data/taxonomy.json', encoding='utf-8'))
hl = {g['id']: g['half_life_months'] for g in tax['gap_types']}
asof = dt.date(2026,10,22)
print('window samples:')
for o in opps[:8]:
    age = (asof - dt.date.fromisoformat(o['first_seen'])).days/30.44
    print(o['id'], o['gap_type_ids'], 'hl=', [hl[g] for g in o['gap_type_ids']], 'first_seen=', o['first_seen'], 'age_m=', round(age,1), 'window=', o['window'])
r = json.load(open('data/rankings.json', encoding='utf-8'))
print('\nrankings meta:', json.dumps(r['meta'], ensure_ascii=False)[:400])
for w in ['day','week','month','year']:
    items = r['windows'][w]['items']
    print(w, 'n=', len(items), 'first=', {k: items[0][k] for k in items[0]})
