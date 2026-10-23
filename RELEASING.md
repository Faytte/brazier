# Maintaining Brazier

The root contains the Foundry module. Runtime code lives in `scripts/`, `styles/`,
`templates/`, and `assets/`; offline tests live in `tests/` and packaging tools in
`tools/`. Build outputs in `dist/` are excluded from Git.

## Development

Use Node 22+ and Python 3.10+:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/run_qa.py
```

To use an installed Chromium browser, set `BRAZIER_CHROMIUM_PATH` to its executable.
The browser suite supplies a mocked Foundry host; passing it does not certify
live Foundry behavior. Keep `compatibility.verified` absent until live validation.

## Release

1. Update `module.json` version, relevant test expectations, changelog and QA report.
2. Run `python tools/build_release.py --repo OWNER/brazier --configure` with the actual owner.
3. Run the complete offline QA suite. Review the generated ZIP and manifest.
4. Commit source changes, push `main`, and check the GitHub Actions QA result.
5. Tag that commit `vMAJOR.MINOR.PATCH`, push the tag, then create a published
   GitHub release with that tag. Attach all three files from `dist/`:
   `module.json`, `brazier-vMAJOR.MINOR.PATCH.zip`, and `SHA256SUMS`.
6. Run `python tools/verify_release.py --repo OWNER/brazier` to fetch the public
   assets without credentials and compare runtime content against the source.

The permanent install URL is
`https://github.com/OWNER/brazier/releases/latest/download/module.json`.
Each manifest pins its ZIP to the matching version tag. Publish stable releases
as the latest release so installed worlds can discover future updates. Do not
replace assets on an existing version; publish a new version instead.

In Molten Hosting, open the hosted Foundry Setup screen, select Add-on Modules,
choose Install Module, and paste the permanent manifest URL into Manifest URL.
Enable Brazier in the world's Manage Modules settings afterward.
