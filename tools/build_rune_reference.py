import json,re,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Rebuild rune identity categories from the reviewed PF2E equipment source checkout.')
parser.add_argument('equipment',type=Path,help='PF2E packs/pf2e/equipment directory')
root=parser.parse_args().equipment;mapping={};fund=[]
for p in root.rglob('*.json'):
 d=json.loads(p.read_text())
 if not isinstance(d,dict) or d.get('type')!='equipment':continue
 u=d.get('system',{}).get('usage',{}).get('value','');name=d['name'].lower()
 if name=='shield augmentation':continue
 if not ('etched-' in u or u.startswith('applied-to-')):continue
 if re.search(r'(?:potency|striking|resilien|reinforcing)',name):fund.append(d['_id']);continue
 kind='armor' if 'armor' in u else 'weapon' if 'weapon' in u or 'clan-dagger' in u else 'item' if u.startswith('applied-to-') else None
 if kind:mapping[d['_id']]=kind
out=Path(__file__).resolve().parents[1]/'scripts/rune-reference.mjs'
out.write_text('// PF2E 8.6.1 equipment identity reference, revision 28d9d156f252d084371d994dc359509b49eadf18.\n// Only document IDs and category classifications; no rules text.\nexport const PROPERTY_RUNE_IDS = '+json.dumps(mapping,sort_keys=True,indent=2)+';\nexport const FUNDAMENTAL_RUNE_IDS = '+json.dumps(sorted(fund))+';\n')
print(len(mapping),'property/accessory runes;',len(fund),'fundamental IDs excluded')
