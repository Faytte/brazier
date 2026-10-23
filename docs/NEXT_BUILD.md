# Completed in v0.3.0

## Normalize the Additive trait filter

User instruction, October 23, 2026: include this with the next substantive build; do not publish a standalone release for it.

- Display one **Additive** trait filter rather than separate Additive 1/2/3 options.
- Selecting Additive must match source trait slugs `additive`, `additive1`, `additive2`, and `additive3`, including Toothwort Extract.
- Preserve the original item trait data and numeric values; normalize only the filter vocabulary and matching.
- Count each matching item once in the Additive chip count. Preserve all/any matching with other selected traits.
- Add a regression check proving that selecting Additive finds Toothwort Extract's `additive1` source data.
- Keep this scoped to the known Additive family rather than stripping numeric suffixes from arbitrary traits.

Implemented with the Benison preparation build, including Additive family regression tests. Source traits remain unchanged.
