from zipfile import ZipFile
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
version = json.loads((root/'module.json').read_text())['version']
with ZipFile(root/f'dist/rts-combat-grid-v{version}.zip') as package:
    assert package.testzip() is None
    names=set(package.namelist())
    manifest=json.loads(package.read('rts-combat-grid/module.json'))
    assert all('rts-combat-grid/'+p in names for p in manifest['esmodules']+manifest['styles'])
    assert not any(p.endswith(('.exe','.dll','.sga','.dds','.zip')) for p in names)
    css=package.read('rts-combat-grid/styles/grid.css').decode()
    assets=re.findall(r'url\("\.\./([^"]+)"\)',css)
    assert all('rts-combat-grid/'+p in names for p in assets)
    catalogue=json.loads(package.read('rts-combat-grid/assets/catalog.json'))
    assert all('rts-combat-grid/assets/'+p['path'] in names for p in catalogue)
    print(f'Package verified: {len(names)} files, {len(catalogue)} icon assets, {len(assets)} CSS textures.')
