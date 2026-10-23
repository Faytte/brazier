"""Build a version-pinned Foundry release with a permanent manifest URL."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--repo', required=True, help='GitHub OWNER/brazier')
p.add_argument('--configure', action='store_true', help='Also update source module.json')
args = p.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/brazier', args.repo):
    p.error('--repo must be OWNER/brazier')
m = json.loads((ROOT/'module.json').read_text())
v = m['version']
if not re.fullmatch(r'\d+\.\d+\.\d+', v):
    p.error('module version must be major.minor.patch')
base = f'https://github.com/{args.repo}'
m.update(url=base, manifest=f'{base}/releases/latest/download/module.json',
         download=f'{base}/releases/download/v{v}/brazier-v{v}.zip')
manifest = (json.dumps(m, indent=2, ensure_ascii=False)+'\n').encode()
if args.configure:
    (ROOT/'module.json').write_bytes(manifest)
out = ROOT/'dist'
out.mkdir(exist_ok=True)
(out/'module.json').write_bytes(manifest)
files = [ROOT/'README.md', ROOT/'TEST_REPORT.md']
for folder in ('scripts', 'styles', 'templates', 'assets'):
    files.extend(f for f in (ROOT/folder).rglob('*') if f.is_file() and f.suffix != '.py')
archive = out/f'brazier-v{v}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('module.json', manifest)
    for f in sorted(files):
        z.write(f, f.relative_to(ROOT).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert z.read('module.json') == manifest
    assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in z.namelist())
    for name in m['esmodules']+m['styles']:
        assert name in z.namelist(), name
(out/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n' for f in (out/'module.json', archive)))
print(f'Built {archive.name}; manifest: {m["manifest"]}')
