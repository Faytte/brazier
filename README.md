# Brazier — Flame Management (0.2.1)

**Brazier Flame Management.** A standalone, system-independent application with private and shared progression trees. This is an **initial functional release** for personal use, not a polished public release. All world state remains separate for each Foundry world.

## Install

For Molten Hosting, open your hosted Foundry Setup screen, choose **Add-on Modules → Install Module**, and paste this permanent Manifest URL:

`https://github.com/Faytte/brazier/releases/latest/download/module.json`

The manifest points to the matching versioned release ZIP. Foundry's manifest and download fields follow the [official module format](https://foundryvtt.com/article/module-development/).

For manual installation:

1. **Back up your Foundry world.** This module creates Journal Entries to store trees and access-limited projections.
2. Extract the release ZIP contents into a folder named `brazier` so that `module.json` is located inside your Foundry user data directory at `Data/modules/brazier/module.json`. The folder name must be `brazier`.
3. Restart Foundry, then enable **Brazier** under **Game Settings → Manage Modules** for the V14 world.
4. Select **Token Controls** in the left-hand scene toolbar, then click the **Brazier flame** tool. Foundry renders and positions this standard tool alongside the other token tools. Alternatively press **Alt+B**. Each player has their own button.
5. As the Storyteller, select **New Tree** and **Tree Settings** to assign users, award points, and set tree visibility. GM sees all trees. Players see only the trees they're explicitly allowed to see.

### Four sections

- **Skill Trees**: implemented.
- **Benison Boons**: placeholder.
- **Curio**: placeholder.
- **Caravan**: placeholder.

### Tree editor (Storyteller)

- Create any number of named trees and give each a description.
- Create talents via **Add Talent**. The first starter node is placed in the middle of the canvas; place subsequent nodes anywhere in 2D space by dragging them in edit mode.
- The **Connect** tool: click the prerequisite talent, then click the dependent talent. Repeat the same connection to remove it. You may also check prerequisites in **Talent Properties**. Cyclic prerequisite relationships are blocked.
- Click a talent to edit its name, description, icon, cost, rank cap, and prerequisites. You may select custom image paths using Foundry's FilePicker.
- Drag empty canvas space to pan; use the mouse wheel to zoom; use **Center View** to recenter. Tree layouts are fully radial/freeform rather than fixed left-to-right.
- Tree Settings configures access (**All Players**, **Selected Players**, **Storyteller Only**), fog of war (**Full**, **Frontier**, **Discovered**), progression (**Shared** or **Personal**), available points, currency label/icon, backgrounds, custom image, connector theme, connector color, and subtle glow strength.
- Trees can be exported to JSON or imported as a **new template tree**. Imports deliberately reset spent points/unlocks and use a new tree ID. The import button is available while editing a tree.

### Player experience and privacy

- Players are only given observer access to **their own per-tree projection Journal Entry**. Unassigned trees do not appear in the selector; they receive no corresponding projection document at all.
- A separate GM-only master Journal Entry stores all nodes, unlocks, and player access rules. Player projections include only the currently visible nodes and metadata.
- **Full**: show all nodes and their prerequisites.
- **Frontier**: show unlocked talents and nodes whose prerequisites are already acquired. No other node names or secrets are in the projection.
- **Discovered**: show only nodes with at least one purchased rank.
- **Shared** progress: one point balance and unlocked ranks for everyone with access. **Personal** progress: separate point balance and unlocked ranks for each player.
- Players cannot edit projection documents (observer permission). When purchasing a talent, the app creates a private Foundry chat request to the GM accounts. An active GM client validates the author, tree assignment, available points, prerequisites and rank cap against the **GM-only master** and commits the update. Pending requests are processed when the GM logs in.
- The chat request is visible in the GM's chat history. It is intentionally not disguised or hidden. Requests are processed automatically by the GM client, **without manual approval** in this version.

### Storage notes

Each tree adds one GM-only world Journal Entry (`Brazier • [Name] [Storyteller]`) and one observer-only projection Journal Entry per permitted non-GM player (`Brazier • [Name]`). These entries are visible in the journal directory to authorized users and can be managed/backed up using Foundry's normal document mechanisms. **Do not manually adjust projection ownership or content**: Brazier maintains projections from the GM master. Removing the module does not automatically delete these Journal Entries.

Skill trees never rely on Scene Notes, tokens, maps, characters, or a particular game system. Curio inventory items and the consumable picker require PF2E. Most functions require an active Storyteller client for changes to propagate (the same as many GM-authoritative Foundry features).

### Curio and Benison Boons (v0.2.0)

- **Curio → New Curio**: enter a name, choose one of the same 20 icon themes used by talents, or browse/upload custom art. Add a private description and select the players allowed to read details.
- Add any number of **Relic Gifts**, subject to Foundry document size limits. Each has a name, aspect, minor/major/grand tier, and effect/activation/frequency text. Use **Choose Compendium Gift**, load installed Item compendiums, search by name/source and select a gift to import its name/text. The picker supports optional relic-gift modules without requiring one. You can also enter a source Item UUID or write a fully custom gift. Imported GM-secret HTML sections are omitted.
- **Save Curio & Sync Item** creates one PF2E equipment item in the world Items directory, or updates the existing item by its stable Brazier Curio ID. You can drag that item to a character. Later saves update names, descriptions and art on marked actor copies while preserving inventory state and manually authored rule elements. A copied Curio item remains linked to its catalog entry; duplicate templates with the same marker are reported rather than guessed at. Use Retry Item Sync after a partial failure.
- **Gifts currently store text and source links.** Importing an automated effect does not automatically transfer its rule elements, actions or resources to the bearer. These require a future PF2E mechanics adapter; the source sheet remains available for reference.
- Every player can see Curio names/icons. Descriptions/gifts live in a separate restricted journal document; the GM master is private. The generated world item is shared only with selected players. Giving it to an actor also shares its contents with that actor's owners. Revoking catalog access cannot erase a previously received item copy or knowledge already seen.
- **Benison Boons** has Consumables, Runes, and Memories and Shrouds tabs. Consumables supports indexed search across accessible installed Item compendiums, filtered to PF2E consumable documents, with name, level range, category, rarity, trait and source filters. Add/remove entries in the curated list; duplicates are ignored.
- Set **Global number of consumable choices**, then click **Save Choice Count**. This is one number of player choices from the curated list, not stock or a per-item quantity. Selections are now saved per player; item distribution is not automated. Runes has a property/accessory rune catalog with its own choice count. Memories and Shrouds supports named options. No rune etching or item granting occurs from these lists.
- Catalog state uses world Journal Entries under the separate `brazier.catalog` flag. Curio public summaries contain only ID/name/icon/art; restricted details are separate. Curio item provenance uses `brazier.curioId`. Existing tree documents are unchanged. Research for future adapters is in [docs/research](docs/research/README.md).

### Catalog modes and player perspective (v0.2.1)

- Consumables and Runes open in **Overview** with current options and the global choice count. **Manage Options** exposes search, additions and removal. The sections keep independent filters.
- Traits are searchable checkbox chips with readable labels, item counts and **all/any** matching. They come from actual items in the current consumable/rune pool. Rare valid traits remain available: PF2E 8.6.1 includes aura on Magnetic Suit/Wind Ocarina and additive1 on Toothwort Extract.
- Property runes support weapon, armor, and item/accessory targets. Fundamental potency, striking, resilient and reinforcing runes are excluded. Identity metadata is pinned to PF2E 8.6.1. Regenerate it with `tools/build_rune_reference.py` against the upstream equipment source directory when updating PF2E; review the resulting categories.
- The Storyteller-only **View as** selector spans every section, shows the selected player's published tree/Curio access, hides management, and offers **Return to Storyteller**. It never changes Foundry's logged-in user or session. External Foundry sheets still use the logged-in account.
- Tree purchases and **Save Choices** in this mode make real changes for the selected player. Players receive choice controls without perspective or management controls. Player requests use server-authored message identity; the primary active Storyteller validates them. Durable receipts prevent an acknowledged request replay from overwriting later selections. Requests wait if no Storyteller is online.
- Choices persist until changed; no daily reset, item distribution, or rune etching is performed. Consumables and Runes enforce separate global counts. Memories and Shrouds permits selecting its named options without a separately configured limit.

### Important limitations

- **Not yet tested inside a live Foundry installation.** This build's JavaScript syntax and rule/model tests pass, and its module format follows published V14 APIs. Test it in a disposable V14 world before enabling in either campaign.
- Does not award effects, execute macros, or change character sheets upon unlock. Talents track progression only in this release.
- The Storyteller can delete trees. No undo history yet; export backups often.
- Requests generate private whisper chat messages. Hidden future nodes stay out of player projections, but an authorized player can reveal/redistribute the content they are allowed to see (as with other Foundry documents).
- The native Journal sidebar still shows authorized projection Journal Entries. This is a deliberate tradeoff for using core document ownership permissions securely without depending on a third-party server or socket extension.
- The permanent manifest URL above supports installation and future updates after release publication. The manifest declares Foundry **14.369** as its compatibility target. This is based on API review and offline QA; live Foundry operation has not been tested.
- Icons use Foundry's built-in Font Awesome library; five original vector background presets ship in `assets/`. Custom images can be chosen through the Foundry FilePicker.

### Developer checks

From the unpacked **source archive** (Node 22+, Python 3.10+, Playwright with Chromium to run the browser simulation):

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/run_qa.py
```

See [RELEASING.md](RELEASING.md) for repository organization, packaging, and future release steps.

The offline QA suite covers including 3,478 deterministic randomized/malformed-input assertions, simulated document permission checks for several users, concurrent purchase serialization, repeated-request prevention, access revocation, a headless Chromium UI exercise (real pointer events, pan, zoom, editor persistence and launcher hook), import/manifest/static asset checks, and JS syntax.

**Important boundary:** the browser test runs the *real Brazier scripts and stylesheet*, but supplies a simulated Foundry host. No licensed V14 server/client was available in this build environment. No claim of successful live Foundry integration, validated ownership enforcement by the actual Foundry server, or zero-defect release is made. The manifest compatibility target is 14.369; this does not represent a completed live Foundry test. See `TEST_REPORT.md` in source and install archives.

### Changes in v0.1.1

- Added strict validation for imported and edited trees, including point balances, player assignments, rank limits, node properties, supported cosmetics, and prerequisite cycles.
- Serialized tree writes and purchases; stale GM edits now report conflicts instead of overwriting more recent changes.
- A projection sync failure after saving no longer triggers a retry that could double-charge a purchase. A Storyteller world reload retries projections.
- Fixed drag vs click behavior under browser pointer capture, preventing missing or duplicate talent selection.
- Error handling for imports now displays actionable Foundry notifications; imports are size limited.
- Expanded offline regression coverage, including browser-based interaction tests and packaging audits.

### Design defaults

The interface uses matte charcoal, restrained copper/bronze accents, small side rails and inspectors, original dark vector backgrounds, and minimal automatic line glow. Talent graphs permit free placement in all directions with an initial node at (0, 0).

### Changes in v0.1.2 (DCC-guided expanded QA)

- Reproduced and fixed broken cross-world import caused by stale revision timestamps; failed imports now clean up the provisional master record.
- Reproduced and fixed prerequisite checkboxes incorrectly updating a talent with a Boolean value.
- Rejects prototype-reserved talent IDs and invalid document revision timestamps.
- Adds persistent request receipts on the master tree so a failed chat acknowledgment followed by a retry cannot charge talent points twice.
- Editor-only talent notes and internal purchase receipt IDs are removed from player-facing tree projections.
- Serializes tree deletion with outstanding purchases/saves to prevent orphan projection documents.
- Prevents duplicate UI event listeners when an ApplicationV2 part is rerendered without replacing its root.
- Relocates an existing launcher into the Foundry sidebar when its navigation becomes available after the module initializes.
- Added Playwright tests for XSS escaping, the launcher, rerenders, physical click/drag, window resizing, and the existing canvas UI.
- Added DCC-style coverage measurement and thresholds using Node 22's built-in V8 coverage, without requiring Vitest or a network install.

**Not tested:** proprietary Foundry runtime `DataModel` schemas and real multiplayer networking, which require the licensed application or its `common/` code; this package has never been installed into Foundry. DCC's real integration/E2E tiers were studied, but cannot be executed as authentic Foundry tests in this environment. ApplicationV2 template compilation and Foundry server permission filtering are consequently **not certified**. The browser test uses real Brazier JS/CSS on a mocked host and is not a substitute for Foundry E2E.

### Changes in v0.1.3

- Shortened the module synopsis to “Brazier Flame Management”.
- Added an explicit Foundry 14.369 compatibility declaration. The previous release omitted `compatibility.verified`, leaving the compatibility badge without a declared target.
- Preserved all existing runtime code and assets. Validation remains offline QA and public API review; no live Foundry installation was tested.

### Changes in v0.1.4

- Retains the application template wrapper so New Tree, section tabs, and other delegated controls receive clicks.
- Keeps an independent floating flame launcher outside hidden/replaced sidebar containers, using an SVG icon that does not depend on the Font Awesome font.
- Replaces the browser fixture with the real Handlebars template and adds physical-click regression coverage for section tabs, New Tree, Add Talent and Tree Settings.
- Offline tests still use a simulated Foundry host; actual Foundry operation has not been tested by the publishing agent.

### Changes in v0.1.5

- Registers the Brazier flame as a native button tool under Token Controls using Foundry’s `getSceneControlButtons` hook. Removes the floating launcher and its custom positioning/styles. Available to GMs and players; Alt+B remains available.
- Makes locked talent symbols fully opaque so connecting lines do not show through them.
- Adds offline regression checks for native tool registration/opening, existing tool preservation, player visibility, repeat registration, and talent opacity.
