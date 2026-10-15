# RTS Combat Grid · SWADE

An RTS-style command panel for **Foundry VTT 13.339+ / 13.x** and **SWADE 5.x**. Right-click a token to open its grid. Customize weapons, powers, skills, macros, conditions, icons, and pages for each actor. Argon and Token Action HUD are not required.

The module interface and documentation are in **English**. Actor names, item names, custom labels, and system-provided condition names retain their original text.

## Installation

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```text
https://github.com/UmutcanOrug/rts-combat-grid/releases/latest/download/module.json
```

Then enable **RTS Combat Grid · SWADE** in your world's **Manage Modules** window. Right-click a token you own to open the panel.

For manual installation, download the ZIP from [Releases](https://github.com/UmutcanOrug/rts-combat-grid/releases), extract its `rts-combat-grid` folder into your Foundry user data's `Data/modules` folder, and restart Foundry. The manifest must be at `Data/modules/rts-combat-grid/module.json`.

## Themes

Two base themes are included. Both use selected interface textures extracted from the author's locally installed games.

**CoH II · Frontline**

![CoH II theme](previews/coh2-panel.png)

**SC II · Terran**

![SC II theme](previews/sc2-panel.png)

The button editor includes **20 game icons**. You can also choose your own Foundry images. Each actor can use a different theme. The GM can set the default theme for new actors in Module Settings. Asset sources and attribution are documented in [assets/SOURCES.md](assets/SOURCES.md).

## Controls

| Control | Action |
| --- | --- |
| Right-click a token | Open the panel alongside the normal token HUD |
| Left-click a button | Use the assigned weapon, power, skill, attribute, or macro |
| Right-click a button | Choose attack, damage, reload, item sheet, chat card, or an additional item action |
| Pencil | Toggle edit mode; click a slot to assign or clear a button |
| Shift + left-click | Edit that button directly |
| Drag in edit mode | Swap buttons; hover another page tab while dragging to move between pages |
| Drag from an actor sheet | Assign that actor's weapon, power, skill, or item to a slot |
| Drag a world macro | Assign a macro you can execute |
| Gear | Configure the theme, grid, pages, portrait, icons, background, frame, and accent color |
| Pin in the header | Keep the panel bound to the current token |
| Drag the header | Move the panel; its position is saved for your user |
| Esc or × | Close the panel |
| Ctrl + Shift + R | Toggle the selected token's panel |
| Alt + 1…9 | Use the first nine slots, when enabled in Module Settings |

The panel stays open when the normal token HUD closes so that you can select targets and use roll dialogs. An unpinned panel follows another controlled token. It closes when the scene changes or you lose ownership. Hidden or invisible token information is not shown to players.

## Customization and storage

On first use, weapons, powers, skills, and commands are organized into pages automatically. The editor supports **3–8 columns**, **2–6 rows**, **40–96 px buttons**, optional button labels, and up to **12 pages**.

Settings are stored on the actor at `flags.rts-combat-grid.grid`. Linked tokens share their actor's layout; unlinked tokens use their synthetic actor. Panel position is stored per user.

In Panel Settings, enter one page name per line. Append a line to create a new empty page. Deleting a line removes that page and its buttons. Shrinking the grid preserves hidden slots; expanding it restores them.

After customizing a layout, drag newly added items onto the grid. **Rebuild layout from actor items → Save** replaces the current arrangement with a fresh automatic layout.

JSON import/export transfers the appearance and button layout. Item and macro references use IDs. When importing to a different actor, reassign missing references using the button editor. Deleted items and macros are dimmed.

## SWADE integration

Weapon and power buttons call SWADE's `itemChatCardHelper.handleAction` API: `formula` for attacks, `damage` for damage, `reload` for reloading, and the item's own key for additional actions. SWADE handles rolls and ammunition/Power Point consumption; this module does not spend those resources a second time. Native `swadeAction` hooks are preserved.

Set each weapon's **Trait/Skill** to the appropriate actor skill. Configure power modifiers and detailed costs on the item's own sheet or chat card. Under **No Power Points**, the grid passes the current power-cost penalty to the trait roll using the same calculation as SWADE's chat card.

Built-in commands include running, Spirit and Vigor rolls, spending a Benny, toggling combat membership, selecting/clearing targets, attribute rolls, and toggling conditions. **Run** rolls SWADE's running die; it does not move the token automatically. **Spend a Benny** spends a Benny; it does not automatically start a soak or reroll.

Macros execute with the current user's permissions and receive `{actor, token, tokenDocument}`. Existing attack-automation macros can be assigned to macro buttons.

## Validation and limitations

Core/action tests cover native action delegation, No Power Points, macro scope, permissions, item deletion, inventory pagination, layout validation, and slot moves. Browser checks cover both themes and their assets, attacks, the context menu, editing, import, drag-and-drop, reopening, ownership loss, and small viewports.

Browser tests use a simulated Foundry/SWADE host. API signatures were checked against local Foundry V13 source and the official SWADE 5.0.8 release. Real-world dice workflows and interaction with other modules still require verification in a running SWADE world. Foundry V14 is outside this release's scope.

## Development

- `npm test` — run core/action and English-interface checks.
- `npm run preview` — serve a local preview at `http://127.0.0.1:4176`.
- `npm run package` — build the installable ZIP in `dist/`.
- `tools/browser-check.mjs` — run UI checks with Playwright and Chrome. The checks serve local files to the browser and do not connect to a Foundry world.
- `tools/verify-package.py` — verify the ZIP structure, manifest paths, and bundled assets.

Full game archives, extraction libraries, and local Foundry system files are excluded from both the repository and installable ZIP. The optional asset-conversion script expects previously extracted local textures; normal builds use the prepared assets in this repository.
