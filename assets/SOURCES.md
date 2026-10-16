# Local game assets

These textures were extracted from the installed games on this computer on 2026-10-15 for the user’s personal Foundry world.

- CoH II: `CoH2/Archives/UIHigh.sga`, textures `coh2ui_i71c`, `coh2ui_i15c`, and selected cards from `coh2ui_i5fd`.
- SC II 5.0.16.97563: local CASC storage, `mods/liberty.sc2mod/base.sc2assets/assets/textures/`; selected `btn-command-*`, Terran Stimpack/Marine and default Terran console textures.

DDS files were converted to lossless WebP. The CoH frame's interior was made transparent; icon cards were cropped from the atlas. Game artwork remains attributed to its respective game creators. Full game archives and extraction libraries are excluded from the module package.

The 15 SVG icons in `commands/` are original vector artwork for this module. Ironclad, Arcane, and Desert themes use original CSS styling.

Version 0.3 adds 13 CoH II command tiles from `coh2ui_i276.dds`. Tile coordinates (column, row), using 64 px tiles on a 66 px grid: Movement (25,13), Prone (20,13), Skills (23,4), Attributes (14,7), Run (18,2), Use Item (10,9), Status (13,4), Powers (0,0), Shaken (12,1), Weapons (11,8), Actions (0,7), Effects (5,6), Benny (4,9).

SC II commands in version 0.3 use the actual game textures. Additional Cloak, Snipe, Scanner Sweep, EMP, Heal, Defensive Matrix, and Protoss Charge textures were extracted from local Liberty assets. Run uses Charge's speeding legs; Movement uses the game's Move command; Use Item uses Stimpack. The previous original SVG icons are retained only for existing custom icon paths. No full archives are included.

Version 0.3.1 uses the extracted SC II icons as the default for every theme and restores `sc2/button-frame.webp` in the SC II theme. CoH II command tiles remain available as an explicit optional icon set.
