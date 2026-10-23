"""Static installable-module sanity checks. stdlib only."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
R=Path(__file__).resolve().parents[1]
manifest=json.loads((R/'module.json').read_text())
assert manifest['id']==R.name=='brazier'
assert re.fullmatch(r'\d+\.\d+\.\d+',manifest['version'])
assert manifest['compatibility']['minimum']=='14'
assert manifest['compatibility']['verified']=='14.369','Declared compatibility target must match release documentation'
for item in manifest['esmodules']+manifest['styles']:
 assert (R/item).is_file(),item
for js in (R/'scripts').glob('*.mjs'):
 for sub in re.findall(r'from\s+["\'](\.[^"\']+)["\']',js.read_text()):
  assert (js.parent/sub).is_file(),(js,sub)
css=(R/'styles/brazier.css').read_text()
for file in re.findall(r'url\(["\']?(\.\./assets/[^)"\']+)',css):
 assert (R/'styles'/file).is_file(),file
for asset in (R/'assets').glob('*.svg'):
 root=ET.parse(asset).getroot();assert root.tag.endswith('svg'),asset
 body=asset.read_text().lower()
 assert not any(term in body for term in ['<script','onload=','javascript:','<foreignobject']),asset
for expected in ['Skill Trees','Benison Boons','Curio','Caravan']:
 assert expected in (R/'templates/window.hbs').read_text(),expected
hbs=(R/'templates/window.hbs').read_text()
assert len(re.findall(r'{{#if\s+',hbs))==len(re.findall(r'{{/if}}',hbs))
assert len(re.findall(r'{{#each\s+',hbs))==len(re.findall(r'{{/each}}',hbs))
assert len(re.findall(r'{{#unless\s+',hbs))==len(re.findall(r'{{/unless}}',hbs))
assert 'https://' not in (R/'templates/window.hbs').read_text(),'No remote script dependencies in template'
assert (R/'scripts/main.mjs').read_text().count('Hooks.once("ready"')==1
assert 'root:true' not in (R/'scripts/app.mjs').read_text(),'Controls require the retained template wrapper'
assert any((R/'assets').glob('*.svg'))
print('Brazier manifest/templates/SVG/assets/import static audit: PASSED')
