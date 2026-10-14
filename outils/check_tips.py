"""Vérifie que chaque exercice de la bibliothèque a ses consignes (EX_TIPS) dans exercises.js."""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
s = open(r'E:\urbex\BobMusc\exercises.js', encoding='utf-8').read()
ids = set(re.findall(r"^  \['([a-z0-9_]+)', ", s, re.M))
tips = set(re.findall(r'^  ([a-z0-9_]+): \[', s, re.M))
print('exercices', len(ids), '| consignes', len(tips), '| manquantes', sorted(ids - tips), '| en trop', sorted(tips - ids))
