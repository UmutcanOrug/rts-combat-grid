# RTS Combat Grid · SWADE

A compact RTS command panel for **Foundry VTT 13.339+ / 13.x**, **SWADE 5.x**, and **SWADE Tools 2.2.2+**. Open a token's normal HUD, then click its **grid icon**. Right-clicking a token alone does not open this panel. Argon and Token Action HUD are not required.

The module interface and documentation are in **English**. Actor names, item names, custom labels, and system condition names keep their original text.

## Installation

In Foundry's **Add-on Modules → Install Module**, paste:

```text
https://github.com/UmutcanOrug/rts-combat-grid/releases/latest/download/module.json
```

Enable **SWADE Tools** and **RTS Combat Grid · SWADE** in your world. The manifest points to the author's [SWADE Tools build](https://github.com/UmutcanOrug/swade-tools-fix/releases), which provides the weapon panel used by this grid.

For an existing installation, check for module updates and reload the world. Manual installation: extract the release ZIP into your user data's `Data/modules` folder. The manifest belongs at `Data/modules/rts-combat-grid/module.json`.

## One Base page

The default 5 × 3 grid uses this arrangement. Every slot can be reassigned, cleared, moved, or given a custom icon.

| | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- | --- |
| Row 1 | 1st Weapon | Prone | Movement | Skills | Attributes |
| Row 2 | 2nd Weapon | Run | Use Item | Status | Powers |
| Row 3 | Sidearm | Custom item | Custom item | Custom item | Custom item |

Automatic weapon slots prefer equipped weapons. The sidearm slot recognizes pistol, handgun, revolver, and sidearm names/categories, or falls back to the third weapon. Assign a specific actor item to override this choice. The small weapon icon in the header opens the full weapon list.

The four bottom slots start empty for grenades, consumables, macros, or any other commands. Drag actor items onto them or Shift-click to assign an entry. **Use Item** lists available gear and consumables; cards retain the system's normal use controls. The grid does not invent or automatically spend consumable quantities.

**Actions** is always visible in the header. It lists actor Action items, additional weapon/power actions, available Aim/Defend/Hold/Wild Attack statuses, and Support/Test and recovery roll shortcuts. **Browse Action Library** finds accessible Action items in world items and installed Item compendiums. Using a library entry explicitly adds a copy to this actor and opens it in SWADE Tools. Rules content is supplied by your installed SWADE content; this module does not bundle rulebook Action items.

The header also includes Spend a Benny and Effects. Click the portrait to open the character sheet. Base and any custom page tabs share the header; there is no duplicate Sheet/Target toolbar or instructional footer.

## Five themes

**CoH II · Frontline** and **SC II · Terran** include selected interface textures from the author's locally installed games.

![CoH II](previews/coh2-panel.png)

![SC II](previews/sc2-panel.png)

**Ironclad**, **Arcane**, and **Desert** use original styling.

![Ironclad](previews/ironclad-panel.png)

![Arcane](previews/arcane-panel.png)

![Desert](previews/desert-panel.png)

The editor includes 20 game icons and 15 original command icons. Choose your own images, background, portrait, transparent button frame, accent color, and button labels. Each actor can use a different theme; the GM sets the default for new actors. See [asset sources](assets/SOURCES.md).

## Wounds

The portrait card uses the actor's actual wound capacity, including zero for ordinary Extras and modified capacities for other actors. Click a segment to set the wound count; clicking the last filled segment removes it. Small **− / +** controls remove or add one wound, just like the actor sheet.

An Extra with zero wound capacity has a compact READY/DOWN indicator instead of three fake bars. Values above capacity show incapacitation on the card. Wound changes update `system.wounds.value`; SWADE and SWADE Tools own penalties and configured status automation. This is a manual wound control, not a damage/soak resolver. Status conditions remain available through Status.

## Movement and voice macros

**Movement** selects this token and activates the normal token movement tool. It does not spend movement or move the token automatically.

Shift-click the Movement button and choose an optional **Movement voice macro**. Click Movement, then move the token normally: the macro runs once after this user's next confirmed position change for this token. Another user's movement does not trigger it. Closing the panel, switching to another token, or changing scenes cancels the pending movement voice.

The macro receives `{actor, token, tokenDocument, from, to}`. `from` and `to` contain scene coordinates. This allows your own speech, audio, or animation macros to react to an RTS movement command.

Two hooks are also available:

- `rtsCombatGridMovementArmed(scope)` fires when Movement is clicked.
- `rtsCombatGridMovement(scope)` fires once on the subsequent movement, even without an assigned macro.

## Controls and editing

| Control | Result |
| --- | --- |
| Token HUD grid icon | Open/close this token's panel |
| Left-click a slot | Use its assigned item or command |
| Right-click a slot | Attack/use, damage, reload, chat card, item sheet, additional item actions, or edit |
| Pencil | Toggle edit mode; click to assign/clear; drag to swap |
| Shift-click a slot | Edit directly |
| Drag from actor sheet | Assign that actor's item |
| Drag a world macro | Assign an executable macro |
| Gear | Appearance, grid size, pages, import/export |
| Pin | Keep the panel on this token |
| Drag header background | Move the panel |
| Escape or × | Close |
| Ctrl + Shift + R | Toggle the selected token's panel |
| Alt + 1…9 | Optional first-nine-slot shortcuts, enabled in module settings |

Layouts are stored at `flags.rts-combat-grid.grid`. Linked tokens share their actor's layout; unlinked tokens use their synthetic actor. Panel position is saved per user. The unpinned panel can follow the selected token and closes on ownership loss or a scene change.

The editor supports 3–8 columns, 2–6 rows, 40–96 px buttons, and up to 12 custom pages. Shrinking the grid preserves hidden slots. Add page names on separate lines; removing a line removes that page's buttons. **Rebuild layout from actor items → Save** restores the single Base layout. JSON import/export transfers appearance and ID-based bindings; reassign missing items when importing to another actor.

Version 0.1 default category tabs migrate to Base. Custom pages and custom buttons are retained; customized buttons from old default tabs appear in Saved Buttons pages. Export before rebuilding if you want to keep a separate copy.

## SWADE Tools integration

Weapons and powers call `game.swadetools.item` with the exact selected token. Action items use the public `game.swade.swadetoolsAttack(actor, item, true)` dialog bridge. Skill, attribute, and running rolls use `game.swadetools.skill`, `.attribute`, and `.run`. Reload and item cards use their native item operations.

SWADE Tools owns range, RoF, modifiers, attack/damage rolls, ammunition, and Power Point consumption. The grid opens its dialogs rather than rolling or consuming those resources a second time. An additional item action is highlighted and made the default in the matching Tools dialog; the player still confirms it there.

Status toggles actual actor conditions. Effects enables/disables editable active effects. Spend a Benny spends one; it does not automatically soak or reroll. Give a Benny is available in the editor for GMs only. Macros retain the current user's execution permissions.

## Validation

Automated tests cover the Base arrangement, migration, ownership, Tools delegation, actual Action items, additional-action dialog selection, macros, movement arming, wounds, and layout validation. Browser checks exercise all five themes, player commands, Action selection, wound segments and Extras, one-shot movement voice, editing/import/dragging, the launcher, ownership loss, and small viewports.

Browser checks use a simulated Foundry/SWADE Tools host. API signatures were checked against local Foundry V13, SWADE 5.0.8, and the author's SWADE Tools 2.2.2 source. A live Foundry world is still needed to verify real dice dialogs and interaction with other enabled modules. Foundry V14 is outside this release's scope.

## Development

- `npm test` — core, action, and English-interface checks.
- `npm run preview` — local interface preview at `http://127.0.0.1:4176`.
- `npm run package` — build the installable ZIP in `dist/`.
- `tools/browser-check.mjs` — UI checks with Playwright and Chrome.
- `tools/verify-package.py` — ZIP structure, manifest paths, and asset verification.

Full game archives, extraction libraries, and local Foundry system files are excluded from the repository and ZIP. Normal builds use the prepared assets.
