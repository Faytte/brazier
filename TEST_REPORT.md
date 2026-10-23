# v0.3.0 Benison consumable preparation — October 23, 2026

Adds player checkboxes, cap/re-enable behavior, assigned-character Amount calculation, configurable level offsets and quantities, the deferred Additive family filter, and PF2e Dailies preparation grants with scoped cleanup. Consumable eligibility follows the consumable trait on consumables, bombs and ammunition.

Node tests cover default/custom boundaries, invalid configuration, source preservation, native temporary flags, separate purchased stock, cleanup scope, permission/assignment checks, duplicate preparation, consumed items, partial creation and receipt-write retries, and Dailies registration. New floors: quantity model 100% lines / 90% branches, Dailies adapter 90% / 80%. Existing coverage floors remain. Browser tests add physical checkbox cap/re-enable interactions, tier configuration and Amount checks to the existing template, tree, catalog and perspective suite.

Local syntax, Node coverage and static audit pass. Full headless Chromium gate runs in GitHub Actions before release; the local environment cannot launch its browser. The host, Item/Actor documents, ownership and Dailies APIs in these tests are simulated. Source review is pinned to PF2E 8.6.1 and PF2e Dailies 4.23.1; see docs/research/benison-preparation.md. No live Foundry installation or actual PF2E/Dailies preparation was tested. Automatic rune etching and Curio rule-element effects remain outside this build.

---

# v0.2.1 catalog modes, multi-traits, property runes and perspective — October 23, 2026

Adds overview/management modes, independently filtered consumable/property-rune pools, searchable multi-trait controls, Storyteller-only player perspective and saved player selections. Property rune identity metadata is derived from pinned PF2E 8.6.1 equipment data; unrelated applied equipment and fundamental runes are excluded.

Tests cover all/any trait intersections, consumable-only trait vocabulary, weapon/armor/accessory rune classification, duplicate prevention, player perspective permissions, returning to Storyteller, selection authorization/count limits and durable replay receipts. Browser tests exercise the actual template, trait chips, rune picker, mode toggle, player view and saved selections in a mocked host. Existing tree and Curio confidentiality/item-sync regressions remain in the gate.

Local Node/model/permission tests, coverage floors and static checks pass. The complete Chromium gate runs in GitHub Actions because the macOS sandbox blocks local browser launch. In-app browser checks use a mock host. No live Foundry installation or actual PF2E/Dailies integration was tested. Choices are recorded; item distribution and automatic rune application are not implemented.

---

# v0.2.0 Curio and Benison catalogs — October 23, 2026

New catalog model and UI are separate from the skill-tree implementation. Tests cover public-summary allowlisting, private details, permission revocation, stable item IDs, marked actor-copy updates, preservation of existing item rules and quantity, stale writes, partial synchronization failure recovery, gift/image validation, more than 100 gifts, catalog deduplication, global choice counts and combined item filters.

Local syntax checks, all Node suites, existing coverage floors, the new catalog model floor (95% lines / 80% branches), and static package audit pass. The macOS sandbox blocks local Chromium launch (MachPortRendezvous permission denied). An in-app browser preview with a mocked Foundry host was used to exercise Curio saving, gift selection, consumable indexing and the global count controls. The automated Chromium suite is extended to cover those interactions and runs in GitHub Actions before release.

The browser fixture compiles the real template and imports production scripts. Its Item, JournalEntry, ownership and compendium APIs are simulated. No live Foundry installation or real PF2E/Dailies integration was tested. Relic gifts are descriptive text and source links; automated bearer mechanics are not implemented. Existing skill-tree tests remain part of the QA gate.

---

# v0.1.5 native controls and opaque talents — October 23, 2026

Uses Foundry’s documented V14 getSceneControlButtons hook to register a button
under controls.tokens.tools. Foundry owns its rendering and placement. The
standalone launcher, DOM insertion and custom positioning CSS are removed.
The native tool is visible to players and GMs, opens the existing application
and preserves Alt+B. No other scene controls or world data are modified.

Locked talent symbols previously used opacity .65, making their backgrounds
translucent. They now use opacity 1, preserving their gray styling and opaque
backgrounds so connecting lines remain behind the discs.

The offline browser suite checks native tool configuration, idempotent registration,
preservation of other tools, GM/player visibility and opening the actual Brazier
application. It checks computed opacity of locked and available talent symbols,
alongside the existing real-template interaction and security tests. The host and
scene-control renderer remain simulated; no live Foundry installation was tested
by the publishing agent. The previous release’s final-commit CI run also passed:
https://github.com/Faytte/brazier/actions/runs/40002888855

API reference: https://foundryvtt.com/api/functions/hookEvents.getSceneControlButtons.html

---

# v0.1.4 interaction fixes — October 23, 2026

User-observed defects on Foundry 14.369: Alt+B opens Brazier, but the flame
launcher is absent and application buttons do not respond.

The app requested a root template part while event binding required its outer
`.brazier-root` wrapper. Root-part child replacement can omit that wrapper. The
previous browser fixture always provided the wrapper and did not compile the
actual template, so it could not detect this integration mismatch. The app now
uses a regular template part. The launcher stays directly under document.body
rather than a sidebar container that core layouts or themes can hide; its icon
is inline SVG and does not rely on a font glyph.

The browser suite now compiles the actual shipped Handlebars template using a
vendored MIT-licensed Handlebars browser bundle (test-only). It models root-part
child replacement and exercises real section-tab, New Tree, Add Talent and Tree
Settings clicks, along with hidden/replaced sidebar launcher visibility and the
existing pan/zoom, drag, permissions and XSS tests.

Local syntax, model/store tests, coverage floors and static package audit pass.
The full offline gate runs in GitHub Actions before publication because this
local environment cannot launch Chromium. These tests
still simulate Foundry document APIs and the application host; no live Foundry
installation was tested by the publishing agent. The user’s findings demonstrate
why the earlier offline results did not establish live-runtime correctness.

---

# v0.1.3 metadata update — October 23, 2026

Target: Foundry VTT **14.369**, the user’s installed version.
Changes: synopsis is exactly **Brazier Flame Management**; `compatibility.minimum`
remains 14 and `compatibility.verified` now declares 14.369. This compatibility
declaration is based on public API review and offline regression QA. It must not
be interpreted as a completed live Foundry test. The prior release omitted
`verified`; the user reported a red compatibility badge despite running V14.
The exact badge tooltip was not captured, so its cause has not been reproduced
in a live installation.

No production scripts, CSS, templates or SVG assets were changed. The existing
package audit and download verifier now validate the declared metadata.
The full offline QA gate runs in GitHub Actions for this release. Local browser
execution remains unavailable because of the macOS sandbox; runtime behavior
in an actual Foundry server/client remains untested.

The v0.1.2 reports below are historical records and describe that version’s
metadata, including its then-omitted verified field.

---

# Publication validation — October 23, 2026

The supplied offline QA suite was rerun for GitHub publication. Production JavaScript,
CSS, templates and SVG files match the supplied v0.1.2 source archive byte for byte.
Only packaging metadata, developer tooling and documentation were changed.

Local results: all four syntax checks, model tests, 3,478 deterministic assertions,
mock store/permission tests, coverage floors and package audit pass. Coverage is
55.29% / 49.64% for app, 96.64% / 92.81% for model and 100% / 72.28% for store
(line / branch). The local browser test is blocked by the macOS execution sandbox:
Chromium exits at MachPortRendezvous `bootstrap_check_in` with permission denied.
The complete suite subsequently **PASSED in GitHub Actions**, including the Chromium
DOM/CSS/pan/zoom/editor simulation and release packaging:
https://github.com/Faytte/brazier/actions/runs/39998140934 .
GitHub runner/action deprecation notices in that run were addressed by pinning
current official action revisions and the Ubuntu 24.04 runner for future runs. No live Foundry installation was tested.

Tooling fixes: coverage parsing accepts both Node reporter prefixes; browser tests
use Playwright Chromium by default with optional `BRAZIER_CHROMIUM_PATH` override.
Release tools generate the permanent manifest, version-pinned ZIP and SHA-256 checksums,
and verify public downloads against the source. `compatibility.verified` remains unset.

The report below accompanied the original archive. Its earlier execution claims
are retained as historical supplied documentation, not as independently verified
results of this publication run.

---

# Brazier v0.1.2 — DCC-guided offline QA report

Date: October 23, 2026
Target: Foundry VTT V14 (minimum 14; **verified intentionally unset**)
Scope: **All feasible tests without installing or running Foundry VTT**
Result: **PASS for the repeatable offline QA gate; NOT a Foundry-runtime certification**

## Testing methodology and sources

This pass followed the layered approach in the community-maintained [DCC Testing Guide](https://github.com/foundryvtt-dcc/dcc/blob/main/docs/dev/TESTING.md): independent rule tests with mocks, adversarial data validation, browser interaction tests, coverage with enforced minimums, repeatable test commands, and clear separation from genuine Foundry integration tests. Cross-checked public APIs against [Foundry V14 ApplicationV2](https://foundryvtt.com/api/modules/foundry.applications.html), [V14 JournalEntry](https://foundryvtt.com/api/v14/classes/foundry.documents.JournalEntry.html), [V14 FilePicker](https://foundryvtt.com/api/v14/classes/foundry.applications.apps.FilePicker.html), and [official module guide](https://foundryvtt.com/article/module-development/).

DCC's *real Foundry integration* tier imports proprietary Foundry `common/` modules, while its true Playwright E2E tier launches a licensed Foundry server. Neither is available or permissible under the requested limit of **no Foundry installation**; Brazier's corresponding tests use a mock host and are never described as actual Foundry E2E. An npm switch to Vitest would not increase accuracy without the real Foundry APIs, so this repeatable build instead uses Node's V8 coverage and the locally available Playwright/Chromium.

## Executed checks

Run: `python tests/run_qa.py` from the source folder.

| Gate | Result | Details |
|---|---|---|
| JS syntax | PASS | All 4 production `.mjs` files checked with Node 22.16.0 |
| Model tests | PASS | Private/unassigned trees, progression and unlocks, fog visibility and prerequisite checks |
| Adversarial/fuzz tests | PASS | **3,478 deterministic assertions** across randomized DAGs and malformed state, including 1,000-node graph, cycle detection, reserved IDs, revision metadata |
| Document & permission simulations | PASS | Multi-user mock Journals, observer-only projections, access revocation, create/update/delete |
| Store transactions | PASS | Shared points, one-time ranks, serialized purchases, concurrent purchase contention, timestamp conflicts, purchase retry after ChatMessage acknowledgment failure, purchase/delete race |
| App editor methods | PASS | Imported tree persistence/rollback, actual prerequisite checkbox handler, node edit HTML, points controls, editor actions, connect/disconnect, delete |
| Headless Chromium | PASS | Actual Brazier JS/CSS, actual browser pointer selection and node dragging, pan/zoom, repeated render event deduplication, fallback launcher relocation, narrower window, XSS escaping, authorization projection |
| Layout | PASS | Canvas **86.6%** of default mock window width; narrow layout at 735px retains >=77% and canvas height >=240px |
| Package audit | PASS | Manifest, relative imports, every included referenced asset, SVG XML validity and active-content patterns, tab presence and balanced templates |
| Release archives | PASS | Zip integrity/CRC, safe paths and expected module root, archive install source consistency (verified during packaging) |

### Coverage ratchet (Node built-in V8 reporting)

Measured from Node test runs; browser code exercised in Chromium is **not** counted in this coverage metric. Source-specific floors enforced by `tests/run_qa.py`:

| Production file | Line coverage | Branch coverage | Enforced floors (line / branch) |
|---|---:|---:|---:|
| `app.mjs` | **55.29%** | **49.64%** | 50% / 45% |
| `model.mjs` | **96.64%** | **92.81%** | 95% / 90% |
| `store.mjs` | **100.00%** | **72.28%** | 95% / 70% |

High UI callback line coverage is difficult to achieve without the actual ApplicationV2 renderer; the **separate** real-browser mouse/CSS suite exercises portions not reflected by Node coverage. DCC proposes broad UI-target guidance around 40–50% and business-logic coverage of 80–85%; both are exceeded here on line coverage, but **real application integration remains untested**.

## Defects reproduced by failing tests, then fixed

1. **Import revision conflict**: valid exported trees from other worlds could fail to save because their old `updatedAt` did not match the newly created master. Reset the revision to the new master's timestamp and delete the provisional Journal on failed import.
2. **Prerequisite checkbox broken**: generic `node.*` handler ran before `node.requires`, writing a Boolean instead of an array. Corrected dispatch order; added change-event regression test.
3. **Reserved node IDs**: imports accepted `__proto__` and other unsafe object-property names. Restricted them and validated `updatedAt`.
4. **Non-idempotent request retry**: if an upgrade was persisted but the ChatMessage `processed` flag update failed, a retry could charge points a second time. Request IDs now persist atomically with the purchase on the GM master, and retries are detected.
5. **Unnecessary disclosure**: per-node Storyteller-only `notes` were included in otherwise authorized player projections. Removed them from player payloads.
6. **Purchase-delete race**: tree deletion could overlap a queued save and leave projections. Deletion now uses the tree's existing serialization queue.
7. **Repeated event handlers**: an unchanged rendered root could accumulate duplicate click handlers after rerenders. Made bindings idempotent per root and canvas stage.
8. **Late sidebar insertion**: a button first mounted in the body was not moved into a sidebar that appeared later. The launcher now safely relocates existing buttons.

Other existing v0.1.1 regression checks (click/drag pointer capture, projection-sync failure handling, stale writes, malformed import limits) remain passing.

## Limitations and residual risk

- **No licensed Foundry V14 runtime**, browser app renderer, `DataModel` field validation, actual database or two-client server communication was executed. Real ownership semantics and cross-client synchronization **cannot** be verified using mocks and public docs alone.
- The Chromium suite uses a simplified mock ApplicationV2 host; it does not compile the actual Handlebars template with Foundry's compiler. The template received static syntax and reference checks, not real render certification.
- Cross-client writes by two active GMs are not server-side atomic compare-and-swap; the module prioritizes single-authoritative-GM operation and has locally serialized writes. This caveat persists until live integration work.
- Browser appearance/behavior may differ across operating systems, Foundry themes, browser engines and system modules. Current offline mouse tests used headless Chromium.
- `compatibility.verified` intentionally remains absent. This build should still first be enabled in a disposable world before use in either campaign.

## Reproduction

Source archive contains `tests/run_qa.py`, all test sources, and the production files. Run the script with Node >=22 and Python >=3.10 with Playwright Chromium installed (`/usr/bin/chromium` available here). Zero npm downloads, no real Foundry install, and no game-system installation were required for this suite.
