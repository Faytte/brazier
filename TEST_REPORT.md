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
