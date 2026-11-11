# Development guide — v0.4.0

This source is versioned v0.4.0, building on Base 1 / v0.3.1. See TEST_REPORT.md for the release validation and CHANGELOG.md for user-facing changes. Base 1 remains untouched. Do not overwrite an existing release asset; future builds need a new version.

## Local interactive rendering

Run `python tools/preview_server.py`, then open http://127.0.0.1:8765/.

The preview imports production JavaScript, compiles the real Handlebars template and loads production CSS/assets. Storyteller, player, unassigned-player, empty-world and large-catalog scenarios are disposable. Editing source auto-reloads the page and resets fixtures. No Foundry license, campaign world or public deployment is used.

**Run UI Checks** exercises twelve flows against the simulated documents, including preparation, retry and cleanup. Reset Fixture before a fresh run. The separate headless suite also runs these scenarios after its existing tree/catalog checks. The evidence exporter accepts screenshot image data through a same-origin loopback form and writes only named PNG/JPEG files in the sibling `brazier-roadmap` folder. Never package that preview host as a Foundry substitute.

### Simulated APIs

ApplicationV2/Handlebars rendering lifecycle; users/assigned characters; JournalEntry ownership and flags; Item/Actor embedded documents; compendium indexes; ChatMessage requests; notifications; FilePicker; and Dailies preparation/rest entry points. PF2E rules are source data here: modifiers, actions and runes are **not evaluated by the PF2E engine**. No real multiplayer permission claim follows from these fixtures.

## Added in this snapshot

- Campaign schema, private Storyteller journal and per-player allowlisted projections. Base 1 Memory options and choices migrate lazily; original documents stay intact.
- Earned Memories, source links, prerequisites, visibility, award/revoke controls; daily Shrouds with capacity, level requirements and exclusive groups.
- Rune equipment targets and compatibility messages. A bounded weapon adapter uses source-reviewed AdjustStrike property-runes effects; armor/accessory automation remains manual.
- Source-linked feat/action/effect grants have stable actor/scope/source IDs. Repeated synchronization repairs missing grants without multiplying them. Permanent Memories/Curios/talents and daily boons use separate scopes. Unresolved ChoiceSet sources are rejected.
- Curio bearer, campaign tags, revealed gifts, level/milestone gates, source previews and explicit mechanical synchronization. Existing public-name/private-detail behavior and stable world Item syncing remain.
- Caravan lands on Carriage Outfit. Cargo & Treasury opens the actual registered PF2E Party/loot inventory sheet directly. The reduced inventory table is removed. An optional stash override remains. Other navigation is Projects, plus Storyteller Requests and Settings. Overview, People, player My Requests and Caravan Activity tabs remain removed; their saved records stay intact. Inventory receipts and stable destination IDs support retry after partial writes; ordinary stock is not silently merged.
- Talent duplication with clean progression, editor undo/redo with revision checks, grid alignment, visible-talent search, minimum levels, rank costs/sources, source synchronization and dependency-aware refund requests.
- Consumable preparation roster, saved/draft status and explicit removed-option reconciliation. Existing quantity bands, caps, Additive family filtering, preparation and scoped cleanup remain.
- Campaign JSON export/import. Import replaces configuration/entitlements but preserves current requests, transaction receipts and activity; it does not restore actor inventory.

## Mechanical safety and remaining work

Mechanical grants are opt-in and disabled by default. Their **simulated** lifecycle is tested; native Foundry/PF2E/Dailies schemas and hook ordering still need validation. Supported grants use only declared source Items, not arbitrary JavaScript.

A shared talent purchase reconciles assigned players with tree access; a personal purchase reconciles its recipient. If synchronization fails after a purchase, the point purchase remains recorded and a warning requests synchronization; retry via the sync control. Refund cleanup runs before points are returned. Multi-actor cleanup is recoverable, not a distributed transaction.

A grant marker identifies ownership, not whether the user has subsequently customized that marked Item. Review marked grants before syncing after manual edits. Existing grant sources are retained rather than overwritten on every sync; changing a source UUID reconciles its marked replacement. Curio source benefits sync explicitly after save/reveal/bearer changes. Actor-owned Curio copies already delivered to a player cannot become secret again merely by hiding a catalog entry.

Supply transfer creates a destination stack before spending linked stock. A partial failure can leave that pending stack visible until the GM retries the request. Receipts prevent the successful retry from duplicating/debiting twice. Cross-client simultaneous GM actions and real PF2E container/currency behavior remain native-validation work. Currency is displayed and edited through the actor's own sheet; no custom currency-spending engine is claimed.

The broader roadmap still includes persistent favorites, richer template organization, project contributors/linked checks/resource budgets, full purchase/grant recovery audit UX, Item Piles integration, and broader narrow-window/keyboard/native validation. These are not claimed complete in this snapshot.

## Validation and release boundary

Run `python tests/run_qa.py` with Node >=22 and the development Python requirements. It checks syntax, coverage floors, package structure, launcher regression tests and headless browser flows. No coverage floors from Base 1 were lowered.

`python tests/run_qa.py --core-only` runs the non-browser portion explicitly and never reports the complete QA gate passed. The complete offline gate now passes locally using BRAZIER_CHROMIUM_SINGLE_PROCESS=1. This fallback avoids macOS multiprocess MachPortRendezvous startup denial; ordinary CI remains multiprocess. Both the legacy browser suite and all twelve campaign scenarios pass with production UI in a simulated host. This is not a live Foundry test. Native integration review remains outstanding.

Base 1 remains the rollback source/install archive. New campaign journals are additive. Reverting to Base 1 does not automatically undo actor inventory changes made by the new experimental grant/transfer features; export and inspect those marked Items before rollback.

## Native stash revision — November 11

Cargo & Treasury is now an action opening the actual PF2E stash window, not a restricted inventory page. PF2E owns drag/drop in either direction, quantity/stack/container handling, currency tools, permissions and updates. The preview only simulates that handoff and clearly labels it. No native PF2E inventory UI or drag/drop is simulated as proof of live behavior.

The action honors the native sheet’s view permission, including LIMITED access. An explicit stash override does not silently fall back if missing. It cannot operate with GM privileges while pretending to be a player in View As. Legacy supply requests remain reviewable for recovery; new native stash transfers do not pass through Brazier’s approval flow. See [source review and capability matrix](research/native-party-stash.md).

Seven Node test files, the full legacy browser suite and twelve campaign browser scenarios pass for v0.4.0 using the local single-process fallback. Native live handoff/transfer verification remains pending.
