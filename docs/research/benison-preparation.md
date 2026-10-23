# Benison preparation adapter

Reviewed 2026-10-23. Baseline: PF2E 8.6.1 (`28d9d156f252d084371d994dc359509b49eadf18`), PF2e Dailies 4.23.1 (`855a56ab2ef6caae21f69b613ccaae7be0fcb11c`). No live integration test.

## Upstream behavior

- [Alchemist crafting ability](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/actor/character/crafting/ability.ts): clones sources, calculates quantities, sets temporary and actor size; alchemical items receive infused. Benison uses temporary without inventing infused for non-alchemical gifts.
- [Daily crafting lifecycle](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/actor/character/crafting/crafting.ts): resets temporary inventory, resources and formula expenditure; daily crafting adds inventory with stacking. Benison deliberately creates separate stacks to preserve normal inventory provenance.
- [Inventory temporary cleanup](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/module/actor/inventory/index.ts) and [Rest for the Night](https://github.com/foundryvtt/pf2e/blob/28d9d156f252d084371d994dc359509b49eadf18/src/scripts/macros/rest-for-the-night.ts): core rest deletes temporary items. Cleanup can therefore occur before the next preparation.
- [Dailies registration](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/custom/custom.ts): public `game.dailies.api.registerCustomDailies` accepts condition-only definitions with rows/process/rest. Brazier registers once on ready and checks the API.
- [Dailies processing](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/interface/process.ts): notify rows participate in processing; process callbacks run before final rested=false bookkeeping. Its addItem helper marks Dailies-specific temporary flags and creates documents later.
- [Dailies rest](https://github.com/reonZ/pf2e-dailies/blob/855a56ab2ef6caae21f69b613ccaae7be0fcb11c/src/rest.ts): wraps and awaits core rest, invokes custom rest callbacks, cleans its own marked items, and resets preparation state.

## Adapter decisions

Uses a public custom daily and public actor embedded-document methods. It does not patch system crafting, wrap rest, or write private Dailies flags. Direct document creation with stable IDs and keepId allows recovery when creation succeeds but receipt storage fails. A per-client in-flight operation coalesces duplicate clicks; IDs also reject concurrent duplicate creation from different clients. The persistent actor cycle receipt prevents consumed gifts from being refilled before rest. The rest callback advances that cycle and schedules only Brazier-provenance cleanup. After resolving the entire new plan, preparation creates missing stacks, verifies them, removes obsolete own stacks and stores the receipt.

The callback is part of Dailies processing, not a transaction over all other daily definitions. If a later, unrelated daily operation fails, a retry retains the already-created Benison stacks rather than granting again. Errors are shown to the user. Native core cleanup remains broader than the Benison adapter, as expected for system temporary items. Real Foundry document schemas, multiplayer races and complete Dailies interactions still require live validation.

## Consumable trait verification

The pinned PF2E equipment directory contains 1,973 entries with consumable in traits: 1,587 consumable documents, 174 weapon documents (bombs), and 212 ammo documents. There are 1,724 documents whose type is consumable; type alone includes non-consumable-trait items such as wands. The picker now requires the consumable trait on one of those three physical types.

Toothwort Extract (`k5A8zFQuDtGqNnk5`) has additive1. Only the known additive/additive1/additive2/additive3 family is normalized for display/filtering; source data and numeric trait values remain untouched. Each item contributes once to the Additive count.
