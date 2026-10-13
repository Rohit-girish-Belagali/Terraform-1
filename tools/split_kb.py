# Splits knowledge_base.json into one self-contained KB per case study (kb/caseN_*.json) plus kb/kb.json (all cases).
import json, copy
d = json.load(open('knowledge_base.json'))
lex = {"F-CRACKED":"crack|plates|fissur","F-LOOSE-DUST":"dust|wind[- ]?(blown|lifting)|dust|lifting loose|loose soil|erosion|eroding","F-GRITTY":"grit|sandy|\\bsand\\b|beach","F-NO-VEG":"no (visible )?(veg|plants|green)|barren|bare (land|plot|ground)|sparse|scrap of green|dead (veg|weeds)|brittle weeds","F-STANDING-WATER":"standing (water|puddle)|puddle|pooling|submerged|flooded","F-SOUR-SMELL":"sour|musty|foul smell","F-YELLOW-WEEDS":"yellow|rotting roots|soft roots|wilting","F-SLOW-DRAIN":"slow(ly)? drain|drains slowly|stays wet|waterlog|poorly drain","F-DARK-STICKY":"sticky|dark clay|heavy clay","F-SALT-CRUST":"white.{0,25}(crust|residue)|salt crust|crusty|crusted","F-SALT-SMELL":"salt(y)? (smell|air|wind|spray)|smell of salt|salty","F-STUNTED-BROWN":"stunted|browning|scorched","F-SEA-NEAR":"\\bsea\\b|shore|coast|ocean","F-HARD-PACKED":"hard[- ]packed|compact|hard ground|pressed[- ]down|rock[- ]hard","F-SURFACE-POOLING":"water (sits|pools)|pools on (the )?surface|doesn.t soak|not soak|poor infiltration","F-BARE-PATCHES":"bare (patch|dirt|spot)|worn (down )?to","F-THIN-GRASS":"thin|patchy|overgraz|grazed|grazing|pasture","F-STUMPS":"stump|debris|tracks|cleared|deforest|felled|logging","F-NO-CANOPY":"no (canopy|shade|trees)|exposed to (the )?sun|full sun|open to the sun|cleared","F-HIGH-HEAT":"\\b4\\d ?°? ?c|scorching|extreme heat|very hot|intense heat","F-RAIN-RARE":"rain(fall)? (is )?(rare|unreliable|unpredictable|scarce)|rare.{0,30}rain|no rain|last rain"}
stress = {"ARC-SANDY":["drought","low fertility"],"ARC-ARID":["drought","heat","low fertility"],"ARC-WATERLOGGED":["waterlogging"],"ARC-SALINE":["salinity"],"ARC-COMPACTED":["low fertility"],"ARC-DISTURBED":["heat","low fertility"]}
for f in d['features']: f['lexicon'] = lex[f['id']]
for a in d['archetypes']: a['stress_tags'] = stress[a['id']]
for r in d['rules']:
    if r['id']=='R-WATER-SAFETY':
        r['condition']={"water_access":["unknown","none"]}; r['effect_data']={"require_water":["low","low-medium"]}
    if r['id']=='R-HEAVY-FEEDER':
        r['condition']={"archetype_stress_any":["low fertility"]}; r['effect_data']={"exclude_feeder_class":["heavy"]}
d['meta']['water_confirm_features']=["F-STANDING-WATER"]
d['meta']['conflicts']=[["F-STANDING-WATER","F-CRACKED"],["F-STANDING-WATER","F-RAIN-RARE"]]
d['meta']['text_limit']=3000
d['toggles'][6]['adds_features']=["F-SALT-SMELL"]
d['toggles'][3]['cancels_features']=["F-NO-CANOPY"]
cases = {
 "case1_arid":(["ARC-ARID","ARC-SANDY"],["PROC-ORG-MATTER","PROC-MULCH","PROC-WINDBREAK","PROC-COVER-CROP","PROC-SHADE","PROC-BIOCHAR"],["CROP-COWPEA","CROP-SORGHUM","CROP-PMILLET","CROP-AMARANTH","CROP-TOMATO"]),
 "case2_wetland":(["ARC-WATERLOGGED"],["PROC-DRAINAGE"],["CROP-RICE","CROP-TARO","CROP-TOMATO"]),
 "case3_saline":(["ARC-SALINE","ARC-SANDY"],["PROC-LEACH","PROC-WINDBREAK","PROC-MULCH","PROC-ORG-MATTER","PROC-BIOCHAR"],["CROP-BARLEY","CROP-PMILLET","CROP-TOMATO"]),
 "case4_pasture":(["ARC-COMPACTED"],["PROC-DECOMPACT","PROC-ORG-MATTER","PROC-COVER-CROP"],["CROP-PIGEONPEA","CROP-SORGHUM","CROP-COWPEA","CROP-TOMATO"]),
 "case5_deforested":(["ARC-DISTURBED"],["PROC-DECOMPACT","PROC-ORG-MATTER","PROC-MULCH","PROC-SHADE","PROC-COVER-CROP"],["CROP-COWPEA","CROP-SORGHUM","CROP-PIGEONPEA","CROP-PMILLET","CROP-AMARANTH","CROP-TOMATO"]),
}
def sub(arcs, procs, crops, name):
    k = copy.deepcopy(d)
    k['meta']['name']=name
    k['archetypes']=[a for a in k['archetypes'] if a['id'] in arcs]
    k['rules']=[r for r in k['rules'] if r['type']!='diagnostic' or r['archetype'] in arcs]
    k['procedures']=[p for p in k['procedures'] if p['id'] in procs]
    k['readiness_criteria']=[c for c in k['readiness_criteria'] if set(c['applies_to'])&set(arcs)]
    k['crops']=[c for c in k['crops'] if c['id'] in crops]
    used=set()
    for r in k['rules']:
        w=r.get('when',{})
        if r['type']=='diagnostic':
            for v in w.values(): used|=set(v)
    k['features']=[f for f in k['features'] if f['id'] in used]
    k.pop('scenarios',None)
    return k
for n,(a,p,c) in cases.items():
    json.dump(sub(a,p,c,'TERRAFORM KB - '+n),open(f'kb/{n}.json','w'),indent=1)
allk=copy.deepcopy(d); allk['meta']['name']='TERRAFORM KB - all cases'
json.dump(allk,open('kb/all_cases.json','w'),indent=1)
print('done')
