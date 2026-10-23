# PF2E integration research

Reviewed 2026-10-23. This is a source-backed working reference for Brazier development, not a claim to have read every published Pathfinder option or tested an integration in Foundry. Runtime integration is not implemented by these notes. Brazier remains at 0.1.5.

## Version baseline

| Component | Reviewed release | Source revision | Declared Foundry compatibility |
| --- | --- | --- | --- |
| PF2E system | [8.6.1](https://github.com/foundryvtt/pf2e/releases/tag/pf2e-8.6.1) | `28d9d156f252d084371d994dc359509b49eadf18` | minimum 14.361; verified 14.369 |
| PF2e Dailies | [4.23.1](https://github.com/reonZ/pf2e-dailies/releases/tag/4.23.1) | `855a56ab2ef6caae21f69b613ccaae7be0fcb11c` | minimum 14.360; verified 14.369 |
| Dailies build helper | foundry-helpers dependency in its lockfile | `6fb6d3829ff2c99cdc9ea395dc54476c7217247e` | build dependency, not an additional module requirement |

The user reports latest releases and Foundry 14.369; installed system/module version numbers have not been inspected inside their world. These releases were selected from GitHub release metadata on the review date. PF2E shares a repository with SF2E: the repository's generic latest-release redirect can resolve to **Starfinder**, so filter stable releases by the `pf2e-` tag prefix. Do not substitute a development branch for an installed stable release.

Dailies 4.23.1 declares PF2E >=8.6.0 and requires libWrapper. Declared compatibility is evidence about supported versions, not proof that Brazier works with them.

## Reading map and limits

See [rules and coverage](rules-and-coverage.md) for reviewed rules, source links, and remaining study. The deeper code review below follows the paths most relevant to permanent progression and daily boons. It does not cover every system class, item, spell, creature, migration, module feature, or interaction.

## PF2E system architecture

Source links below are pinned to the reviewed revision. Useful entry points:

- [Public game.pf2e API](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/scripts/set-game-pf2e.ts)
- [Actor document lifecycle and condition methods](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/actor/base.ts)
- [Rule-element registry](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/rules/index.ts)
- [Predicates](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/system/predication.ts)
- [Item source identity](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/item/base/document.ts)
- [Rest for the Night](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/scripts/macros/rest-for-the-night.ts)

### Documents, preparation, and rules

Actor preparation rebuilds derived data. Base preparation initializes roll options and derived structures; embedded items prepare sibling/actor data and rule elements; rule elements then contribute synthetics and derived statistics. Rule ordering includes item type and rule priority. Directly assigning a calculated statistic is therefore not a persistent or reliable way to implement a talent.

Use Foundry document creation/update/deletion for persistent data. Represent applicable mechanics on PF2E items with rule elements, letting PF2E calculate stacking, predicates and roll context. Prefer an existing supported rule element over a new wrapper or custom rule class. `game.pf2e` exposes utilities, conditions, actions and rule classes, but their presence does not promise that every internal method is a stable module API.

Important reviewed rule types:

| Rule | Appropriate use and caveat |
| --- | --- |
| [FlatModifier](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/rules/rule-element/flat-modifier.ts) | Typed bonus/penalty through selectors and predicates. Its deferred modifiers enter actor synthetics. It also accounts for Automatic Bonus Progression suppression; adding a number directly would bypass that behavior. |
| [ActiveEffectLike](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/rules/rule-element/ae-like.ts) | Prepared property changes with explicit mode, path, priority and phase. This is a PF2E rule element; do not assume a generic Foundry ActiveEffect has identical behavior. |
| [ChoiceSet](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/rules/rule-element/choice-set/rule-element.ts) | User choice and injectable selection. An unresolved required choice can disable other rules on the same item. Creation may prompt; it cannot be treated as a silent, unconditional grant. |
| [GrantItem](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/rules/rule-element/grant-item/rule-element.ts) | Linked item grants, choice preselection, source identity and deletion policies. Duplicate handling and cascade/detach/restrict behavior matter when refunding a talent. Do not manually remove an item without considering its grant relationships. |

Predicates test roll-option sets, supporting logical and numeric statements. Exact selector/domain and option names must be verified for each mechanic. A tree prerequisite and a PF2E roll predicate solve different problems; satisfying one does not establish the other.

Item identity uses UUID/source metadata, not its displayed name. In the reviewed system `sourceId` resolves a compendium document's own UUID, otherwise duplicateSource or compendiumSource. Preserve origin metadata and independently record Brazier's ownership/provenance. Never delete a player's pre-existing feat merely because its source matches a talent grant.

### Conditions, effects, and rest

Actor condition helpers include get/has/increase/decrease/toggle. `increaseCondition` is an increment operation for existing valued conditions, not an unconditional assignment. Conditions may have locked/in-memory or multiple-source behavior. Use the appropriate system operation after checking its semantics.

[PF2E effects](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/item/effect/document.ts) track start time/initiative, duration, expiry and badges. Expired owned effects ignore their rules. Model timed benefits using this lifecycle rather than browser timers. Encounter/turn timing still requires live validation.

PF2E's rest action handles healing, recoverable conditions, temporary inventory cleanup, recharge, spell slots, frequencies and optional stamina. It calls `pf2e.restForTheNight` before creating its result chat messages. Dailies wraps the encompassing action and performs its cleanup after the original resolves. Consequently, that hook is not proof that Dailies cleanup has finished; avoid relying on assumed ordering or doing asynchronous work that the synchronous hook caller does not await.

## PF2e Dailies extension model

Primary sources: [main API](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/main.ts), [definition types](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/daily.ts), [registration/discovery](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/dailies.ts), [custom registration](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/custom/custom.ts), [processing](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/interface/process.ts), [rest cleanup](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/rest.ts).

### API availability

The locked helper's [module registration](https://github.com/reonZ/foundry-helpers/blob/6fb6d3829ff2c99cdc9ea395dc54476c7217247e/src/module.ts) installs **`game.dailies.api`** at init. Check the module's active state and required functions when integrating; do not assume `game.modules.get("pf2e-dailies").api` is the published namespace.

Reviewed exports include registerCustomDailies, canPrepareDailies, openDailiesInterface, getDailiesSummary, getDisabledDailies, retraining helpers, dailyHelpers, utils and nested animist/commander/staves/spellServers APIs. The current nested shape differs from older flat examples in the [wiki](https://github.com/reonZ/pf2e-dailies/wiki/API). Source also shows canPrepareDailies returning a **boolean**, despite the wiki's Promise<void> annotation. That predicate alone is insufficient: opening the UI additionally checks character type and ownership.

### Definitions and processing

A module registers object definitions through `registerCustomDailies`. Definitions need a unique key, rows and process callbacks, plus a condition or item selectors. Keys receive a `module.` prefix internally; use a Brazier-specific key to avoid collisions with other registering modules. Duplicate registrations are ignored rather than replacing the prior definition. Registration invokes asynchronous parsing without returning its completion promise, so do not register and immediately assume a refreshed UI model is ready.

Item discovery uses source UUIDs, skips suppressed feats and uninvested physical items, and filters required items/conditions. Optional items may change available rows. Supported row families include select, combo, input, random, drop, alert and notify. Saved row values have different shapes; drop rows supply UUID/name, combo rows selected/input, simple selections strings. UI filtering is useful, but is not a complete PF2E prerequisite or authorization engine.

Processing provides addItem/addFeat/addRule, item updates/deletions, replacement, messages and extra flags. Temporary is the default for added items. Added rules receive a Dailies marker. An afterItemAdded callback can inspect actual created documents; item creation may itself invoke PF2E choices/grants. Processing batches later updates, links spells to casting entries, updates focus resources, records a summary, and marks preparation used. This is a sequence of operations, not a guaranteed cross-document transaction. Failures and retries need explicit handling in a Brazier adapter.

The built-in [Combat Flexibility](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/data/combat-flexibility.ts) is a useful selectable temporary-feat example. [Root Magic](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/data/root-magic.ts) illustrates an important limit: its process callback adds a summary link/target name; it does not itself apply the effect to that target. Do not infer automation from a summary message.

World-authored custom dailies are a separate executable-code feature, with injected helpers and schema version 3.0.0. Module object registration does not inherit that injected lexical scope. Obtain helpers from the actual API. Brazier player-authored tree data should remain data, not code to execute through this facility.

### Cleanup boundary

Dailies wraps rest through libWrapper and also wraps preparation/spellcasting/sheet methods. Reuse the extension API; do not duplicate those wrappers.

After a successful system rest, Dailies invokes registered rest callbacks, removes its temporary items and marked rules, adjusts feat grant links, restores temporarily deleted item sources and resets its bookkeeping/preparation state. Permanent Brazier purchases must therefore live in Brazier's own authoritative store. A daily benefit can be recreated from that permanent entitlement after rest. Never use Dailies temporary flags as the only record of an earned boon.

## Proposed Brazier boundary (design, not implemented)

1. Keep tree definitions, visibility, purchases and receipts under the existing GM-authoritative Brazier store.
2. Add a PF2E adapter that resolves actor UUIDs and source UUIDs, checks permissions, and translates a narrow supported benefit schema into PF2E items/rules. Avoid arbitrary system paths or executable player input.
3. Record provenance linking purchase, actor, created item and benefit version. Reconcile idempotently; handle manually removed/replaced items without deleting unrelated grants. Cross-document failures need recoverable status and retry behavior.
4. Register an optional Dailies definition for owned eligible characters. Read permanent eligibility from Brazier; let Dailies own daily selection/results. Define what happens if a talent is refunded or changes mid-day.
5. Preserve current system-independent Brazier behavior when PF2E or Dailies is absent. Do not make Dailies mandatory until a specific feature needs it.

Before implementing a benefit, specify its typed bonus, selectors, prerequisites, rank/level scaling, targets, duration, frequency/recharge and stacking interactions. Resolve remaster/legacy and variant-rule differences explicitly.

## Validation required before shipping an adapter

- Pure checks for benefit validation, permission decisions, provenance/reconciliation and retry handling.
- Integration checks against the pinned system/module versions and real document hooks.
- Live Foundry checks for linked and unlinked actors, GM/player ownership, unresolved choices, duplicate grants, refunds, reload, preparation/rest, suppressed or uninvested sources, expired effects and disabled Dailies.
- Scenarios with ABP/Free Archetype and applicable remaster/legacy content; test only claims actually supported.

No PF2E/Dailies integration or live Foundry test was performed in this research pass.
