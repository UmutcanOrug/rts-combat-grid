"""Convert selected textures extracted from the user's local games into browser assets."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
source = root.parent / 'output/rts-source'
coh = source / 'coh2/ui/assets/textures'
sc2 = source / 'sc2'
catalog = []

def save(image, group, name, label=None):
    dest = root / 'assets' / group / (name + '.webp')
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.convert('RGBA').save(dest, lossless=True)
    if label:
        catalog.append({'path': f'{group}/{name}.webp', 'name': label})

save(Image.open(coh/'coh2ui_i71c.dds'), 'coh2', 'panel')
frame = Image.open(coh/'coh2ui_i15c.dds').convert('RGBA').crop((983, 13, 1164, 230))
ImageDraw.Draw(frame).rectangle((16, 19, frame.width-18, frame.height-24), fill=(0,0,0,0))
save(frame,'coh2','button-frame')

# Portrait/action atlas: the original 1980 × 2048 atlas uses 154 × 184 cards.
atlas = Image.open(coh/'coh2ui_i5fd.dds').convert('RGBA')
selections = [(7,2,'rifleman','CoH II · Infantry'), (8,2,'medic','CoH II · Medic'), (1,4,'tank','CoH II · Tank'),
              (2,4,'machine-gun','CoH II · Machine gun'), (4,3,'sandbags','CoH II · Sandbags'),
              (8,5,'artillery','CoH II · Artillery'), (3,9,'helmet','CoH II · Helmet'),
              (3,10,'smg','CoH II · SMG'), (7,10,'mortar','CoH II · Mortar'),
              (9,3,'wire','CoH II · Barbed wire'), (2,7,'mine','CoH II · Mine'),
              (4,7,'supply','CoH II · Supplies'), (2,6,'gun','CoH II · Heavy gun')]
for col,row,name,label in selections:
    x=8+(col-1)*154; y=8+(row-1)*192
    save(atlas.crop((x,y,x+136,y+168)), 'coh2',name,label)

names = {'btn-command-move':'move','btn-command-stop':'stop','btn-command-holdposition':'hold',
         'btn-command-attack':'attack','btn-command-patrol':'patrol','btn-ability-terran-stimpack':'stimpack',
         'btn-unit-terran-marine':'marine','ui_console_commandbutton_normal_defaultterran':'button-frame',
         'ui_console_commandbutton_highlighted_defaultterran':'button-highlight',
         'ui_console_menubar_background_defaultterran':'panel'}
for original,name in names.items():
    im=Image.open(sc2/(original+'.dds'))
    print(original,im.size)
    if name in ('button-frame','button-highlight'):
        im=im.convert('RGBA')
        ImageDraw.Draw(im).rectangle((10,10,im.width-11,im.height-11),fill=(0,0,0,0))
    save(im,'sc2',name,('SC II · '+name.title()) if not name.startswith('button') and name!='panel' else None)

(root/'assets/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'assets/SOURCES.md').write_text('''# Local game assets

These textures were extracted from the installed games on this computer on 2026-10-15 for the user’s personal Foundry world.

- CoH II: `CoH2/Archives/UIHigh.sga`, textures `coh2ui_i71c`, `coh2ui_i15c`, and selected cards from `coh2ui_i5fd`.
- SC II 5.0.16.97563: local CASC storage, `mods/liberty.sc2mod/base.sc2assets/assets/textures/`; selected `btn-command-*`, Terran Stimpack/Marine and default Terran console textures.

DDS files were converted to lossless WebP. The CoH frame's interior was made transparent; icon cards were cropped from the atlas. Game artwork remains attributed to its respective game creators. Full game archives and extraction libraries are excluded from the module package.
''',encoding='utf-8')
print(f'{len(catalog)} library images prepared')
