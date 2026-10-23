"""Verify public GitHub release assets without authentication or Foundry."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--repo',required=True)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
local=json.loads((root/'module.json').read_text())
base=f'https://github.com/{a.repo}'
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Brazier-release-verifier'}),timeout=60) as r:
        assert r.status==200,(url,r.status)
        data=r.read()
        print(f'HTTP 200: {url} ({len(data)} bytes)')
        return data
permanent=f'{base}/releases/latest/download/module.json'
raw=get(permanent)
m=json.loads(raw)
assert m['id']=='brazier' and m['version']==local['version']
assert m['manifest']==permanent
assert m['download']==f'{base}/releases/download/v{m["version"]}/brazier-v{m["version"]}.zip'
assert m['compatibility']==local['compatibility']
assert m['description']==local['description']
pinned=get(f'{base}/releases/download/v{m["version"]}/module.json')
assert pinned==raw
blob=get(m['download'])
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    assert z.testzip() is None
    assert z.read('module.json')==raw
    assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in z.namelist())
    for name in m['esmodules']+m['styles']:
        assert name in z.namelist(),name
    for directory in ('scripts','styles','templates','assets'):
        for f in (root/directory).rglob('*'):
            if f.is_file() and f.suffix!='.py':
                assert z.read(f.relative_to(root).as_posix())==f.read_bytes(),f
sums=get(f'{base}/releases/download/v{m["version"]}/SHA256SUMS').decode()
for name,data in [('module.json',raw),(f'brazier-v{m["version"]}.zip',blob)]:
    assert f'{hashlib.sha256(data).hexdigest()}  {name}' in sums
print('PASS: public links, manifest, checksums, ZIP CRC, safe paths and source consistency. No live Foundry test performed.')
