import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
tax = json.load(open('data/taxonomy.json', encoding='utf-8'))
print('taxonomy keys:', list(tax.keys()))
print('industries', len(tax['industries']), 'needs', len(tax['human_needs']), 'neuro', len(tax['neuro_drivers']), 'emotions', len(tax['emotions']), 'gaps', len(tax['gap_types']), 'drivers', len(tax['drivers']), 'models', len(tax['business_models']), 'regions', len(tax['regions']), 'dims', len(tax['score_dimensions']), 'tags', len(tax['tags']), 'grades', len(tax['grades']))
w = sum(d['weight'] for d in tax['score_dimensions'])
print('weight sum =', round(w, 6))
print('industry ids:', [i['id'] for i in tax['industries']])
print('gap ids:', [i['id'] for i in tax['gap_types']])
print('region ids:', [i['id'] for i in tax['regions']])
opps = json.load(open('data/opportunities.json', encoding='utf-8'))
req = ['id','slug','title','one_liner','industry_id','gap_type_ids','region_ids','origin_country','target_countries','human_need_ids','neuro_drivers','emotion_tags','source_langs','signal','seven_questions','roi','scores','window','risks','first_steps_7d','kill_criteria','compliance_notes','evidence_count','activity_dates','first_seen','last_activity','momentum','rank_score','tags','verified','disclaimer']
missing = []
for o in opps:
    for k in req:
        if k not in o: missing.append((o.get('id'), k))
print('missing fields:', missing[:10], 'count', len(missing))
q7 = ['traffic','money','model','roi','audience','drivers','moat']
print('seven questions incomplete:', [(o['id'], [k for k in q7 if not o['seven_questions'].get(k)]) for o in opps if any(not o['seven_questions'].get(k) for k in q7)])
print('industries covered:', sorted({o['industry_id'] for o in opps}))
print('regions covered:', sorted({r for o in opps for r in o['region_ids']}))
print('gap types covered:', sorted({g for o in opps for g in o['gap_type_ids']}))
print('verified:', sum(1 for o in opps if o['verified']), '/', len(opps))
print('evidence tiers:', sorted({e['tier'] for o in opps for e in o['signal']['evidence']}))
