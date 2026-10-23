"""DCC-style offline QA gate for Brazier. No Foundry install or online packages needed.
Requires Node >=22 and Python >=3.10; browser tests require installed Playwright/Chromium.
"""
from pathlib import Path
import re, subprocess, sys
ROOT = Path(__file__).resolve().parents[1]

def run(args):
    print("\n$", " ".join(args),flush=True)
    result = subprocess.run(args, cwd=ROOT, encoding="utf-8", stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(result.stdout)
    if result.returncode: raise SystemExit(f"QA FAILED ({result.returncode}): {' '.join(args)}")
    return result.stdout

for src in sorted((ROOT/'scripts').glob('*.mjs')):
    run(['node','--check',str(src.relative_to(ROOT))])
coverage=run(['node','--experimental-test-coverage','--test',
              'tests/model.test.mjs','tests/model_robust.test.mjs','tests/store.test.mjs','tests/catalog.test.mjs'])
# Coverage thresholds based on measured baseline, rather than a claimed absolute number
# of passing test cases. Real Foundry E2E is excluded from this metric.
thresholds={
  'app.mjs': (50,45),
  'model.mjs': (95,90),
  'store.mjs': (95,70),
  'catalog.mjs': (95,80),
}
for file,(min_lines,min_branches) in thresholds.items():
    match=re.search(rf'^[#ℹ]?\s*{re.escape(file)}\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)',coverage,re.MULTILINE)
    if not match: raise SystemExit(f'QA FAILED: no code coverage for {file}')
    lines,branches=map(float,match.groups())
    print(f'Coverage {file}: {lines:.2f}% lines / {branches:.2f}% branches (floors {min_lines}% / {min_branches}%)')
    if lines<min_lines or branches<min_branches: raise SystemExit(f'QA FAILED: coverage below threshold for {file}')
run([sys.executable,'tests/package_audit.py'])
run([sys.executable,'tests/browser_smoke.py'])
print('\nBRAZIER OFFLINE QA GATE: PASSED (not a real Foundry integration test)')
