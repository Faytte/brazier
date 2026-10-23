# Rules study and coverage ledger

Reviewed 2026-10-23. This ledger separates actual reading from material still needing study. It is deliberately not a claim of comprehensive mastery of every PF2E publication. The system source is an implementation reference; published rules and current errata remain the rules authority.

## Reviewed rules and development implications

| Area and source | Findings relevant to Brazier |
| --- | --- |
| [Character creation](https://2e.aonprd.com/Rules.aspx?ID=2027&NoRedirect=1), [leveling](https://2e.aonprd.com/Rules.aspx?ID=2065&NoRedirect=1) | Reviewed introductory progression material; the complete class-specific progression corpus remains open. Talent-tree points are homebrew resources and must not silently replace normal advancement. |
| [Checks](https://2e.aonprd.com/Rules.aspx?ID=2278&NoRedirect=1) | Reviewed checks, proficiency, typed stacking, degrees, natural die adjustments, fortune/misfortune, MAP and basic saves. Same-type bonuses use the highest and penalties the worst; untyped penalties stack. Natural 20/1 shift degree rather than guaranteeing a hit/miss. Route mechanics through the system rather than a second calculation engine. |
| [Damage](https://2e.aonprd.com/Rules.aspx?ID=2301&NoRedirect=1), [IWR](https://2e.aonprd.com/Rules.aspx?ID=2312&NoRedirect=1) | Reviewed damage framework and IWR. Damage type/component and timing matter; persistent damage is not ordinary immediate damage. Do not implement resistance as a blanket subtraction from an entire mixed-type roll. |
| [HP, healing and dying](https://2e.aonprd.com/Rules.aspx?ID=2319&NoRedirect=1) | Reviewed initial HP/healing/knockout sections. Temporary HP, nonlethal knockouts, initiative changes and wounded interact. Full recovery/death exceptions and individual abilities remain to verify before automation. |
| [Actions](https://2e.aonprd.com/Rules.aspx?ID=2335&NoRedirect=1), [encounters](https://2e.aonprd.com/Rules.aspx?ID=2421&NoRedirect=1) | Reviewed action types, activities, subordinate actions, trigger restrictions, initiative and start-of-turn sequence. An activity containing Strike is not itself the Strike action for quickened restrictions. End-of-turn exceptions and individual basic actions need targeted review. |
| [Movement](https://2e.aonprd.com/Rules.aspx?ID=2345&NoRedirect=1) | Reviewed movement types, falling, move reactions, diagonals and introductory space/reach. Land Speed is not automatically every movement type. Movement-triggered reactions have exceptions; use native movement support. |
| [Detection](https://2e.aonprd.com/Rules.aspx?ID=2400&NoRedirect=1) | Reviewed lighting, precise/imprecise/vague senses and detection relationships. Hidden/observed state is relative to a viewer. Brazier's tree fog and document visibility are a separate feature; avoid repurposing combat detection flags. |
| [Conditions](https://2e.aonprd.com/Rules.aspx?ID=2455&NoRedirect=1) | Reviewed condition groups, action loss, redundant values/durations and suppression. Multiple durations can require retaining lower-valued sources. Individual condition definitions have not all been reread. |
| [Skills](https://2e.aonprd.com/Rules.aspx?ID=2134&NoRedirect=1), [feats](https://2e.aonprd.com/Rules.aspx?ID=2142&NoRedirect=1) | Reviewed general skill/feat framework. Proficiency grants and skill increases have distinct redundancy rules. Category, prerequisite and access checks are required; displaying an option in a tree is not sufficient eligibility. Each skill action still needs its own exact text reviewed. |
| [Archetypes](https://2e.aonprd.com/Rules.aspx?ID=2127&NoRedirect=1) | Reviewed dedication restrictions, granted feats, spellcasting/alchemical benefits and temporary items. Grant chains do not necessarily count as multiple dedication feats. Free Archetype and class-archetype exceptions require separate treatment. |
| [Spells](https://2e.aonprd.com/Rules.aspx?ID=2221&NoRedirect=1), [counteracting introduction](https://2e.aonprd.com/Rules.aspx?ID=2250&NoRedirect=1) | Reviewed traditions, prepared/spontaneous slots, heightening, signature exceptions, cantrips, focus, innate spells, casting, targets, durations, sustain and spellshape. Prepared, innate and focus grants require different data/lifecycle handling. Full counteract resolution, rituals and spell-specific exceptions remain open. |
| [Exploration](https://2e.aonprd.com/Rules.aspx?ID=2440&NoRedirect=1) | Reviewed travel and selected activities plus rest/preparation. Rest and daily preparation are distinct rules events: usually eight hours of rest then about one hour of preparations, once daily. Avoid equating a calendar change with a completed preparation. |
| [Downtime](https://2e.aonprd.com/Rules.aspx?ID=2444&NoRedirect=1) | Reviewed income overview, long-term rest, retraining, shopping and crafting overview. A refund interface does not automatically satisfy retraining's time, choice and prerequisite requirements. Detailed Craft/Earn Income actions remain open. |
| [Equipment](https://2e.aonprd.com/Rules.aspx?ID=2143&NoRedirect=1) | Reviewed purchase/access, currency, item level, held/worn/stowed usage, hands and Bulk. Carrying an item is not wielding or investing it. Detailed runes, activation, staves, wands and crafting rules remain open. |
| [DCs](https://2e.aonprd.com/Rules.aspx?ID=2627&NoRedirect=1), [encounter design](https://2e.aonprd.com/Rules.aspx?ID=2715&NoRedirect=1) | Reviewed simple versus level DCs, adjustments and encounter-budget introduction. Extra permanent power changes encounter assumptions; a talent's price is not an official PF2E balance measure. |
| [Subsystems](https://2e.aonprd.com/Rules.aspx?ID=3026&NoRedirect=1) | Reviewed introduction and index, not every subsystem procedure. Victory Points, influence, research, chases, infiltration, reputation, duels, leadership, hexploration and vehicles are indexed for later feature-specific study. Caravan is not yet assigned one of these rules frameworks. |

## Remaining breadth

The [rules index](https://2e.aonprd.com/Rules.aspx) is the navigation starting point, not evidence that every linked chapter was read. Outstanding comprehensive coverage includes:

- Every ancestry, heritage, background, class/subclass, archetype and level progression, including newer books and remaster/legacy substitutions.
- Individual skill actions, all conditions/traits, all spells/rituals and item activation rules; full affliction, counteracting, environmental and hazard procedures.
- Equipment/runes/treasure, detailed crafting, companions/familiars, creature abilities, army/kingdom and adventure-specific systems.
- Complete GM subsystems, variant rules (including ABP, proficiency without level, stamina, Free Archetype and mythic), plus their interactions.
- Current book-specific errata. [Paizo FAQ/errata](https://paizo.com/pathfinder/faq) and [remaster FAQ](https://paizo.com/pathfinder/remaster/faq) were located, but full pages were inaccessible in this session (403/internal fetch errors). Do not describe them as fully reviewed.

Archives of Nethys was readable through the web tool; direct scripted requests returned 403. No access restriction was bypassed. AoN pages can contain legacy text and updated sections together: verify the actual source printing and relevant errata for any mechanic we implement.

## Source-code review depth

**Read in depth:** PF2E public API setup; selected Actor preparation/condition methods; rule registry, FlatModifier and ActiveEffectLike; substantial ChoiceSet/GrantItem creation logic; predicates; item source identity; effects; Rest for the Night. Dailies API exposure and pinned helper namespace, registration/discovery/custom schema, definition types, interface processing, rest cleanup, ownership/preparation checks, wrappers and selected built-in examples. Dailies wiki API/custom-definition and built-in documentation were also compared with source.

**Located or partially examined:** character-derived data, general system settings and migrations; Dailies animist/staff/spell-server and other built-in feature families. Source trees are available locally for further targeted reading, but availability is not coverage.

**Not validated:** PF2E/Dailies builds, their upstream test suites, an actual Brazier adapter, real compendium grants, real sheet behavior, live timing/permissions, or any live Foundry installation. Existing Brazier offline QA is a separate claim and does not establish this integration.

## Maintenance procedure

For each new mechanic, add its exact source/errata, rule interpretation, applicable actor/item data, supported versions and concrete scenarios to these notes before implementation. Distinguish a source-confirmed behavior from a proposed design and a live-tested result. On an upstream update, refresh version pins and inspect API/schema/rest/grant changes before expanding compatibility claims.
