# Sources and attribution

## Golly pattern collection
The 209 files under patterns/ were extracted from the user's supplied Golly 5.0 Windows distribution. Pattern comments, creator names, copyright notices and rule declarations are retained in the source files and visible through Pattern details. Source folder paths are recorded in patterns/index.json. Golly's supplied licence document is retained at licenses/Golly-License.html; keep it and any individual pattern notices with redistribution. No claim is made that the collection is public domain.
Golly project: https://golly.sourceforge.io/

## Engine and interface
HashLife.js, Formats.js, Viewport.js and the new interface/controller are original implementation for Jenga-Code. HashLife is Bill Gosper's algorithmic approach; this implementation uses canonical quadtrees and memoized evolution for supported binary rules and Wireworld. The classic sparse stepping approach is also provided as an alternative. No Golly executable, Golly C++ source or third-party JavaScript engine is bundled. The copy/life project was evaluated as a reference; its source is not used in the runtime package.

## Artwork and fonts
images/cellular-study.png: original AI-generated scientific instrument engraving for this app. Decorative only; the canvas, pattern catalogue, labels and simulation data are actual software-rendered elements.
Shared compass SVG: existing Jenga-Code masthead, reused unchanged.
Cormorant Garamond and DM Sans are requested through Google Fonts CSS; system fallbacks are included.
