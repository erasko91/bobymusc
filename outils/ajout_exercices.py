"""Ajoute des exercices à exercises.js à partir d'un fichier JSON [[id, nom, muscle, matériel, type, id_free-exercise-db], ...]
puis régénère la liste EX_IMG d'après les photos présentes dans img/ex.
Usage : python ajout_exercices.py nouveaux.json"""
import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, 'exercises.js')
src = open(path, encoding='utf-8').read()
existing = set(re.findall(r"^  \['([a-z0-9_]+)', ", src, re.M))
new = [n for n in json.load(open(sys.argv[1], encoding='utf-8')) if n[0] not in existing]

def line(n):
    parts = [n[0], n[1], n[2], n[3]] + ([n[4]] if n[4] != 'wr' else [])
    return '  [' + ', '.join("'" + p.replace("'", "\\'") + "'" for p in parts) + '],'

if new:
    marker = "].map(([id, name, muscle, equip, type]) =>"
    assert marker in src, 'marqueur introuvable'
    block = '  // Ajouts (variantes et exercices courants en salle)\n' + '\n'.join(line(n) for n in new) + '\n'
    src = src.replace(marker, block + marker, 1)

# Liste des exercices avec photos, d'après les fichiers présents
imgs = sorted(f[:-6] for f in os.listdir(os.path.join(ROOT, 'img', 'ex')) if f.endswith('-t.jpg'))
src = re.sub(r'const EX_IMG = new Set\(\[.*?\]\);', 'const EX_IMG = new Set([' + ', '.join(f"'{i}'" for i in imgs) + ']);', src, flags=re.S)
open(path, 'w', encoding='utf-8', newline='\n').write(src)
print(f'{len(new)} exercices ajoutés ; {len(imgs)} exercices avec photos')
