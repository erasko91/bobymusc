"""Recherche d'exercices : synonymes, pluriels, ordre des mots."""
import sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
CAS = {
    'développé militaire haltère': 'Développé militaire (haltères)',
    'developpe militaire': 'Développé militaire (barre)',
    'shoulder press': 'Développé militaire (haltères)',
    'dc': 'Développé couché (barre)',
    'deadlift': 'Soulevé de terre',
    'tirage poitrine': 'Tirage vertical (poulie haute)',
    'hammer curl': 'Curl marteau',
    'leg press': 'Presse à cuisses',
    'squat bulgare': 'Squat bulgare (haltères)',
    'curl haltères': 'Curl (haltères)',
}
errs, ko = [], 0
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    page = b.new_page(viewport={'width': 390, 'height': 844})
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:8765/')
    for _ in range(3):
        page.click('[data-a="ob-next"]')
    page.goto('http://localhost:8765/#/exercises')
    for q, attendu in CAS.items():
        page.fill('input[data-q="ex"]', q)
        page.wait_for_timeout(150)
        noms = page.locator('#ex-list .ex-name').all_inner_texts()
        ok = any(attendu in n for n in noms)
        ko += not ok
        print(f"{'OK ' if ok else 'KO '} « {q} » -> {len(noms)} résultat(s){'' if ok else ' ; attendu : ' + attendu + ' ; trouvés : ' + str(noms[:5])}")
    b.close()
print('\n'.join(errs) or ('AUCUNE ERREUR' if not ko else f'{ko} RECHERCHE(S) RATÉE(S)'))
