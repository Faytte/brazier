# Native PF2E stash integration — November 11, 2026

## Decision

Remove Brazier's reduced Cargo & Treasury table. Keep Cargo & Treasury as a direct action that opens the existing registered actor sheet on its inventory tab. Do not rebuild the Party sheet, copy its DOM, mount its internal regions in another Application, or intercept its drag/drop events.

This deliberately eliminates the redundant Cargo page. Carriage Outfit is the Caravan landing section. The arrow on Cargo & Treasury indicates that it opens another native window. No extra confirmation or approval is introduced for native transfers.

## Source review

Reviewed the locally available PF2E 8.6.1 sources and the public V14 development sources retrieved November 11. The development branch is a moving reference, not a claim about the exact version installed in the user's world:

- [Party sheet](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/party/sheet.ts): inventory member sidebar, drop-to-member handling, native coin distribution, regular Item sheet/event lifecycle.
- [Base actor sheet](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/sheet/base.ts): Item drag data, inventory drop/sort paths, quantity/stack transfer dialog, destination container selection, item/context actions and native currency dialogs.
- [Actor transfer implementation](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/base.ts): transfer permission checks, quantity limits, stacking and GM-mediated ItemTransfer requests for non-owner loot transfers.
- [Party document](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/party/document.ts): the active party is game.actors.party; modification access may derive from owning a member, not owning the Party actor itself.
- Party sheet templates: the inventory tab includes native coinage, inventory header/search, item lists, Bulk totals and member distribution sidebar.
- [Foundry V14 legacy Application documentation](https://foundryvtt.com/api/classes/foundry.appv1.api.Application.html): PF2E's reviewed Party sheet is a legacy actor sheet. Use its ordinary render call; do not override rendering/injection internals.

## Native behavior retained

| Capability | Responsibility |
| --- | --- |
| Drag stash items to character inventory | Native Item drag data and destination PF2E sheet |
| Drag character/compendium items into stash | Native PF2E drop handler |
| Choose transfer quantity / new stack | PF2E ItemTransferDialog |
| Sort, stack, manage containers and Bulk | Native PF2E inventory implementation |
| View/edit/identify/delete where permitted | Native sheet and current system settings |
| Currency display, add/remove and GM distribution | Native PF2E currency/distribution dialogs |
| Drop items on party member sidebar | Native Party sheet transfer handler |
| Non-owner member permissions and active-GM requirements | Native PF2E document and socket path |
| Live updates and other modules' sheet hooks | Existing registered document sheet |

Brazier neither adds nor bypasses a capability or restriction of the installed native sheet. In particular, container moves follow that version's actual rules; no promise is made that every container/attachment edge case is supported by PF2E itself.

## Implementation

`scripts/native-stash.mjs` resolves the active Party actor, or an explicit configured Party/loot override. An invalid override produces an error rather than silently switching inventories. It checks the native sheet's configured view permission, including LIMITED access rather than imposing Brazier's former OBSERVER requirement. Native transfer permissions are evaluated subsequently by PF2E, not by a Brazier transfer implementation.

For the reviewed PF2E V14 legacy sheet, the action invokes `sheet.render(true, {tab:'inventory', focus:true})`. ApplicationV2-registered sheets receive the corresponding render-options object. No actor Items, coins, ownership or permissions are changed by opening the stash. No replacement native sheet instance is created. The existing sheet and its registered hooks are used.

The native sheet always acts as the signed-in user. GM View As cannot impersonate another account's native permissions; the action is disabled in that perspective and explains how to return to Storyteller or sign in as the player. Real player accounts can open their own permitted stash normally.

Old pending supply requests and receipts remain recoverable through existing Storyteller Requests. New native transfers do not create Brazier supply requests. Talent refund requests remain unchanged.

## Verification boundary

Seven Node test files pass, with 100% line/branch coverage on the native-stash delegation module. Tests verify registered-sheet render signatures, active-party/override selection, LIMITED and stricter configured access, GM View As isolation, missing documents/sheets, error propagation and absence of custom inventory writes. Existing legacy supply-recovery regressions remain for already-saved requests.

Twelve browser scenarios pass against production Brazier UI in a simulated host. The preview visibly labels its native sheet handoff as simulated; it does not fabricate a fully functioning PF2E inventory. Its native controls/drag/drop are not a live PF2E test. The complete headless suite now also passes for v0.4.0 using the single-process fallback; normal CI remains multiprocess.

No licensed Foundry instance was activated and no native transfer was executed. The implementation avoids a second transfer engine precisely so the installed PF2E sheet retains its own complete behavior, but live handoff/transfer confirmation is still pending.
