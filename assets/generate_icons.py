"""Original built-in Curio inventory badges; no external font or image dependency."""
from pathlib import Path
shapes={
'flame':'<path d="M32 8c4 14-13 15-9 27 2 6 9 7 11 1 2-5-1-8 1-12 17 17 15 32-3 32C11 56 9 40 19 27c-1 10 5 11 4 3C22 21 32 19 32 8z"/>',
'star':'<path d="m32 9 7 15 17 2-12 12 3 17-15-8-15 8 3-17L8 26l17-2z"/>',
'moon':'<path d="M43 10C12 9 7 47 35 54c10 2 17-4 20-11-27 7-35-22-12-33z"/>',
'shield':'<path d="m32 8 21 8v17c0 13-21 23-21 23S11 46 11 33V16z"/><path d="M32 10v44"/>',
'book':'<path d="M32 18C21 10 13 11 7 13v36c8-3 16-2 25 5 9-7 17-8 25-5V13c-9-2-16-1-25 5v36"/>',
'leaf':'<path d="M53 9C15 8 5 25 16 44c16 16 36 0 37-35zM10 55l32-32"/>',
'skull':'<path d="M22 48C3 40 11 10 32 10s29 30 10 38v8H22z"/><circle cx="23" cy="31" r="6"/><circle cx="41" cy="31" r="6"/><path d="m29 43 3-5 3 5M28 49v7m8-7v7"/>',
'compass':'<circle cx="32" cy="32" r="23"/><path d="m42 20-6 17-16 7 7-17zM32 4v6m0 44v6M4 32h6m44 0h6"/>',
'crown':'<path d="m10 20 13 10 9-19 9 19 13-10-5 30H15zM16 43h32"/>',
'tent':'<path d="m6 53 26-43 26 43zM32 10v43m-14 0 14-24 14 24"/>',
'heart':'<path d="M32 55 12 35C-4 17 18 2 32 20 46 2 68 17 52 35z"/>',
'gem':'<path d="m8 23 12-13h24l12 13-24 32zM8 23h48M20 10l-3 13 15 32 15-32-3-13M32 10l-9 13 9 32 9-32z"/>',
'eye':'<path d="M5 32s10-19 27-19 27 19 27 19-10 19-27 19S5 32 5 32z"/><circle cx="32" cy="32" r="10"/>',
'sun':'<circle cx="32" cy="32" r="13"/><path d="M32 3v10m0 38v10M3 32h10m38 0h10M11 11l7 7m28 28 7 7M11 53l7-7m28-28 7-7"/>',
'hand':'<path d="M12 51h13l19-12c7-5 4-10-2-7l-11 5H19V22h-7v29zm13-14 6-6h9M44 7v14m-7-7h14M53 23v10m-5-5h10"/>',
'bolt':'<path d="M35 5 12 36h17l-3 23 26-34H35z"/>',
'sword':'<path d="m20 41 26-30 8-1-1 8-29 27M13 36l18 16M10 54l10-11M6 52l6 6"/>',
'key':'<circle cx="24" cy="23" r="14"/><circle cx="24" cy="23" r="5"/><path d="m34 33 22 22m-13-13 6-6m0 12 6-6"/>',
'circle':'<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="6"/>',
'wagon':'<path d="M9 20h41l-5 25H15zM5 12h12l3 8M14 31h33"/><circle cx="19" cy="52" r="5"/><circle cx="42" cy="52" r="5"/>'}
out=Path(__file__).parent/'icons';out.mkdir(exist_ok=True)
for name,shape in shapes.items():
 (out/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="9" fill="#181a1e"/><g fill="none" stroke="#dfb47f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{shape}</g></svg>\n')
print(f'Generated {len(shapes)} original Curio icon badges')
