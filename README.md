# Brazier — Flame Management (0.4.0)

Brazier Flame Management is a campaign progression and preparation application for Foundry VTT, with PF2E integrations for Curios, Benison Boons and the native party stash. Skill trees also work independently of a game system. Each world's data stays in that world.

## Install or update

In Foundry Setup → Add-on Modules → Install Module, use this permanent Manifest URL (also suitable for Molten Hosting):

```text
https://github.com/Faytte/brazier/releases/latest/download/module.json
```

Existing installations can use Foundry's module update controls. Back up the world before updating. Enable Brazier in the world's Manage Modules settings; enable PF2e Dailies for daily Benison preparation. Open Brazier from the native flame tool under Token Controls, or press **Alt+B**.

For manual installation, extract the versioned release ZIP into `Data/modules/brazier/` so that `module.json` sits directly in that folder. Restart Foundry after installation.

Declared compatibility is Foundry **14**, verified target **14.369**, based on API/source review and offline checks. **No live Foundry installation or actual PF2E/Dailies session has been tested by this development workflow.** Source review targets PF2E 8.6.1 and Dailies 4.23.1, with additional public V14 source review for native stash delegation.

## Skill Trees

Storytellers can create freeform shared or personal progression trees, assign access, choose full/frontier/discovered visibility, arrange opaque talent nodes, and customize art and connectors. Players see only their permitted projection, inspect a talent and spend points through a GM-validated request. An active Storyteller processes player changes.

This version adds duplication with clean progression, local editor undo/redo, grid alignment, visible-talent search, minimum character levels, per-rank costs and source benefits. Refund requests go to Storyteller Requests under Caravan; dependent talents must be refunded first. JSON imports create new template trees and reset progression; exports preserve layout for reuse.

## Curio

Curio names and icons are public. Descriptions and revealed gifts are restricted to selected players. Use built-in icons or custom art, add custom or compendium-linked relic gifts, choose a bearer, and configure minor/major/grand gifts with level and milestone conditions.

Saving creates or updates one stable world Item and marked actor copies. Give the world Item to a character through normal Foundry inventory controls. Source-linked mechanics require the opt-in setting below and explicit synchronization. Giving an Item to an actor shares its contents with that actor's owners; revoking catalog access cannot erase a copy or knowledge already received.

## Benison Boons

### Consumables

Storytellers curate eligible consumables from accessible Item compendiums using name, level, category, rarity, source and multi-trait filters. Overview shows Current Options, a global choice count and the player preparation roster. Manage Options handles search, additions and removal. The Additive filter matches its numbered family while preserving source traits.

Assign each player a PF2E character in **User Configuration**; ownership alone is not assignment. Players check up to the global number of choices, see the resulting Amount, then Save Choices. Unselected boxes disable at the cap and re-enable when a choice is removed. Removed options require explicit reconciliation; a lowered allowance does not silently replace a selection.

Quantity bands use item level relative to character level. Defaults: offset ≥ −1 grants 1, offsets −4 through −2 grant 2, and anything lower grants 3. The Storyteller can change both boundaries and all quantities.

Complete PF2e Dailies preparation to receive separate marked temporary stacks. Repeating preparation does not refill consumed items. Native temporary-item rest cleanup and Brazier's Dailies callback reset the cycle; the next preparation reconciles remaining marked stacks. Purchased inventory is not merged or deleted. Changes after successful preparation apply after the next rest. Assign exactly one player account to each preparing character.

### Runes

Curate property runes separately from fundamental potency/striking/resilient/reinforcing runes. Players save rune choices and equipment targets. Compatibility messages explain unsupported targets, existing runes and capacity.

The optional weapon adapter creates temporary, marked PF2E effect Items for a bounded supported rune set; it does not permanently etch or overwrite the weapon. Armor/accessory automation remains manual. See [development/integration notes](docs/DEVELOPMENT.md).

### Memories and Shrouds

Memories are Storyteller-awarded persistent unlocks with reveal permissions and prerequisites. Shrouds are daily prepared choices with configurable capacity, level requirements and exclusive groups. Saving a loadout does not grant inventory early. Narrative entries need no mechanical source; linked feat/action/effect benefits use the optional grant layer.

These are campaign mechanics configured by the Storyteller, not a claim that every entry is an official PF2E rule.

## Caravan

Caravan opens **Carriage Outfit**, with Storyteller-authored visible equipment/facility entries. Projects provide GM-reviewed progress tracks. Storyteller Requests retains talent refund review and recovery for previously saved supply requests. Overview, People, player My Requests and Caravan Activity tabs are removed; existing underlying records are retained.

**Cargo & Treasury ↗ opens the actual native PF2E Party stash window on its inventory tab.** There is no reduced Brazier inventory page. Use that native window for drag-and-drop to/from characters, quantity/stack/container handling, coin tools and party distribution. PF2E controls those operations and their permissions. The active Party stash is used automatically; an optional Party/loot override is in Caravan Settings. Missing overrides do not silently redirect transfers.

The native stash always acts as the signed-in Foundry account. Its action is disabled while a GM is using View As; return to Storyteller or sign in as the player to use that account's actual permissions. Brazier does not impersonate players or weaken ownership. See [native stash source review](docs/research/native-party-stash.md).

## Optional mechanical benefits

**New source-linked grants are disabled by default.** Under Memories and Shrouds → Campaign Settings, a Storyteller may enable supported mechanical grants after reviewing the integration notes. Existing daily consumable grants do not require this new opt-in.

Supported sources are PF2E feat, action and effect Items; unresolved ChoiceSet sources require configuration first. Stable actor/scope/source markers separate permanent Memory/Curio/talent grants from daily Shroud/rune grants. Synchronization is recoverable and scoped to marked Items. Review marked Items after manual customization; markers identify provenance, not an automatic merge of user edits. Curio bearer/reveal changes require explicit benefit synchronization.

## Data, privacy and rollback

Trees, catalogs and campaign state use world Journal Entries. Storyteller masters are private; players receive allowlisted observer projections. Do not manually edit projection ownership. Requests use Foundry-authored message identity and durable receipts. Player requests may wait until a Storyteller is online.

Base 1 trees, Curios and boon selections are preserved. Legacy Memory options migrate lazily into the additive campaign schema without deleting the old catalog documents. Campaign JSON export/import restores configuration/entitlements while preserving current transaction receipts, requests and activity; it does not restore actor inventory.

Back up the world before upgrade or rollback. Returning to v0.3.1 does not undo actor inventory changes from experimental grants or transfers. Inspect those marked Items before reverting; do not delete unrelated inventory. Previously seen private content cannot be made unknown again by permission changes.

## Development and verification

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/run_qa.py
```

The complete offline gate includes syntax, Node model/document tests and coverage floors, static package checks, development-launcher regressions and browser interaction scenarios using production HTML/CSS/JS with simulated Foundry APIs. `--core-only` explicitly runs only the non-browser portion and never reports the full gate passed.

Run `python tools/preview_server.py` and open http://127.0.0.1:8765/ for disposable Storyteller/player/unassigned/empty/large-catalog fixtures. Run UI Checks verifies repeatable browser flows. The preview labels native sheet handoff as simulated; it does not fabricate actual PF2E inventory behavior. No Foundry license is needed for this preview.

On macOS environments that block Chromium's multiprocess startup, `BRAZIER_CHROMIUM_SINGLE_PROCESS=1` enables a single-process headless test fallback; `BRAZIER_CHROMIUM_PATH` can select an installed Chromium executable. Default CI uses the ordinary multiprocess browser.

See [TEST_REPORT.md](TEST_REPORT.md) for measured results and boundaries, [CHANGELOG.md](CHANGELOG.md) for release changes, [development notes](docs/DEVELOPMENT.md) for remaining roadmap work, and [RELEASING.md](RELEASING.md) for packaging. Optional [native development tools](tools/dev/README.md) remain available for an appropriately licensed test environment; no runtime or license data ships with this module.
