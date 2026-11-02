# Jenga-Code Cellular Studio

## Install
Extract index.html, css/, js/, images/, patterns/ and licenses/ into public_html/apps/game-of-life/, replacing the corresponding app files. Keep the patterns directory structure and index.json. Refresh with Ctrl+F5. The existing /apps/game-of-life/ link remains valid. No backend, npm installation or build process is needed. Serve through HTTP/HTTPS rather than opening index.html as file://: the catalogue uses local fetch requests.

## What is included
- Copper editorial three-column page, the existing shared compass SVG and a new instrument engraving.
- 209 real Golly pattern files with original comments retained, including 12 Wireworld circuits/computer patterns, large HashLife macrocells and compatible Life-like rules. The left catalogue lists names and folders, without thumbnail cards.
- An original multistate HashLife engine. Immutable canonical quadtree nodes share equal regions; cached center-half evolution advances powers of two generations. Rule instances isolate their state tables and caches. This is not the old sparse engine renamed.
- Conway Life, Wireworld and binary B/S rules without B0. The rule selector lists common choices; loading another supported pattern adds its declared rule automatically.
- A separate sparse reference-style mode for small irregular patterns, one generation per frame. HashLife is not always fastest for chaotic populations.
- Run/Pause/Step, exact generation jumps, cancellation between chunks, undo/redo (24 actions), zoom, pan, fit, fullscreen, cream/dark views and optional grid.
- Rule-specific drawing states; whole-pattern rotation/flips; random fields; original pattern descriptions.
- RLE, macrocell, Wireworld MCell and Life-coordinate file import; gzip import in browsers supporting DecompressionStream; folder import retaining folder names.
- Local browser saving and RLE/macrocell download writers. Existing v1 Jenga Life saved patterns are migrated without deleting the original storage keys.

## Files and saving
Open file and Import folder read user-selected local files. Save pattern stores a macrocell in this browser's localStorage. Export downloads an actual .mc or .rle file: it does not write into the hosting server's filesystem. Save PNG exports the current viewport. Export files for backups; browser storage can fill or be cleared. Macrocell export preserves pattern geometry/states, not screen pan, generation history or original coordinates.

## Practical limits
This is a browser workbench, not a port of every Golly feature. Arbitrary rule-table formats, B0 infinite-background rules, bounded topologies, 3D automata and Golly scripts are not implemented. The catalogue excludes unsupported rules; patterns/unsupported.json records excluded rule variants. Bundled gzip sources were decompressed when building the catalogue.

One jump accepts 1–1,000,000,000 generations and is decomposed into exact power-of-two steps. The engine stops a single calculation after roughly 2.5 seconds of uncached work or at 900,000 interned nodes. Cancel takes effect after the current synchronous power-of-two chunk; a difficult chunk can briefly pause the interface. On failure, completed chunks remain and Undo restores the starting pattern. This is not a guarantee that any pattern can advance a billion generations. Chaotic patterns may need smaller jumps or sparse mode.

Imports are limited to 30 MB, explicit RLE cells to one million, RLE exports to 500,000 cells, transforms to 300,000 and sparse mode to 200,000. Macrocell stores huge repeated regions without enumerating every cell. Coordinates are finite safe JavaScript numbers; this is an expanding universe within a defined numeric range, not mathematically unlimited precision. Very large populations are labelled approximate if they exceed safe-integer precision.

## Validation
- 120 randomized exact-state comparisons between HashLife and an independent generation-by-generation oracle across Conway Life, Wireworld, HighLife and Seeds.
- One billion-generation still-life test.
- All 209 catalogue files parsed and passed population-count checks after both macrocell export/re-import and RLE export/re-import for smaller patterns.
- 35 small Golly patterns and 11 Wireworld patterns matched reference evolution for 16 generations, with exact-state normalized export roundtrips.
- Browser checks covered a 1,024-generation Life jump, 65,536-generation Wireworld jump, mode switching, undo/redo, rotation, run/pause, save-to-browser and export dialog. Phone and tablet document widths had no horizontal overflow. Physical touch devices and every huge-pattern jump were not tested.

Developer checks: node tests/engine.cjs; node tests/catalogue.cjs; node tests/patterns.cjs.
Rebuild catalogue: python3 tools/build_catalogue.py /path/to/golly-5.0-win-64bit.zip. This is an optional offline maintenance tool, not a runtime server requirement. Inspect/test newly included patterns before publishing.

## Canvas activity palette
Empty cells use dark ink; live cells use ivory. Optional Life activity colours count visible sampled appearances (ivory/gold/mint) and show previously observed cells in slate. This is not exact lifespan or complete history across jumps. History is display-only, limited to 100,000 visible cells, resets on edits/rewind/new patterns, and is omitted when cells are smaller than two device pixels. Wireworld retains distinct head, tail and conductor states using ice, coral and dark blue.
