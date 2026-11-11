# Native Foundry development

This uses the licensed Foundry runtime, PF2E and PF2e Dailies in a disposable local world. It does not recreate Foundry from API documentation or use generated images. Screenshots come from the running browser.

## One-time setup

Use Python 3.10+, Node 24+ for Foundry V14, and a Foundry V14 **Node.js ZIP** downloaded from your Foundry account.

```sh
python tools/foundry_dev.py install --zip /absolute/path/FoundryVTT-Node-14.370.zip
python tools/foundry_dev.py start
```

The default private directory is `../.brazier-native`, a sibling of the module checkout. Override it with `--home /absolute/private/path` before the subcommand or `BRAZIER_DEV_HOME`. Runtime files, license activation, worlds and browser state stay outside the module directory and release ZIP. Existing folders without the development marker are refused. No source code is copied over your campaign data.

Open http://127.0.0.1:30001. The license holder must enter the license and accept the EULA personally. The launcher disables UPnP and updates; the localhost URL does not assert that Foundry binds only to loopback. Use the test instance locally.

Install PF2E, PF2e Dailies and its libWrapper dependency through Foundry Setup. Official package ZIPs can alternatively be installed before starting the server with `python tools/foundry_dev.py package --kind system --id pf2e --zip /path/system.zip` (use `--kind module` for modules). Existing package directories are never overwritten. Match campaign versions when checking compatibility; record the actual versions in test reports. Create a new PF2E world named **Brazier Dev** with ID **brazier-dev**, then enable Brazier, PF2e Dailies and libWrapper. The installer links `Data/modules/brazier` directly to this source checkout. Restart once after the initial link so Foundry discovers the module.

## Edit / render / test loop

1. Edit the production `.mjs`, `.hbs`, CSS or assets in this checkout.
2. Reload the test world's browser page to refresh modules and template caches. No release ZIP, GitHub upload or reinstall is required. Manifest changes may require restarting Foundry.
3. Open Brazier through Token Controls or Alt+B; inspect it in the browser and capture actual screenshots.
4. Run native checks using the following **Script** macro in the isolated test world:

```js
await (await import('/modules/brazier/tools/dev/native-suite.mjs?run=' + Date.now())).runNativeSuite();
```

The runner refuses other world IDs, non-GMs, non-PF2E systems or missing dependencies. It uses real Actor/User/JournalEntry/Item documents and the actual ApplicationV2, compendium and Dailies APIs. It tests section clicks, talent persistence, player selection caps and amounts, saved choices, native Dailies rows, actual Accept grants, retry protection and the PF2E rest/Dailies cleanup chain. Fixtures are removed and the previous boon catalog is restored in `finally`. A GM-only Journal Entry records PASS/FAIL, versions, assertions, errors and cleanup failures. Test chat messages and report journals intentionally remain in this disposable world.

The macro starts the test in the real browser, so the agent can run it through the native Macro UI even when the shell sandbox blocks launching a separate Chromium process. Agent-driven physical clicks and screenshots supplement the scripted API/UI checks. Keep the existing unit/model and mock browser QA for fast regression checks; they are different evidence from native runtime results.

## Limits

A test driver is not proof of a passing run. A native report may only say PASS after running successfully on the stated versions. The current scripted player view is GM View As; actual separate-player sessions and server-enforced confidentiality still need their own browser sessions. The suite deliberately uses native rest on its own temporary actor, never a campaign character. A full browser reload is used for JS/template changes rather than pretending arbitrary JS state supports hot replacement.

## Sources

- [Official installation guide](https://foundryvtt.com/article/installation/): licensed Node.js distribution, Node 24 for V14, separate application/data paths.
- [Official application configuration](https://foundryvtt.com/article/configuration/): dataPath, port, world, noupnp and noupdate.
- [ApplicationV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html): real DOM application rendering.
- [DCC's testing guide](https://github.com/foundryvtt-dcc/dcc/blob/main/docs/dev/TESTING.md): separate unit coverage and browser tests against a real Foundry server.
