"""Simulation iPhone (moteur WebKit de Safari) : la barre du bas doit toucher le bas de l'écran,
quelle que soit la taille d'affichage choisie dans les réglages."""
import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
errs, ko = [], 0
with sync_playwright() as p:
    b = p.webkit.launch()
    for model in ('iPhone 15 Pro Max', 'iPhone SE'):
        for zoom in (90, 100, 110, 120):
            ctx = b.new_context(**p.devices[model])
            page = ctx.new_page()
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.goto('http://localhost:8765/')
            for _ in range(3):
                page.click('[data-a="ob-next"]')
            page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('bobmusc-data-v1'));
                d.settings.textSize = {zoom}; localStorage.setItem('bobmusc-data-v1', JSON.stringify(d)); }}""")
            page.reload(); page.wait_for_timeout(800)
            # Pixel tout en bas au milieu : doit appartenir à la barre du bas
            bas = page.evaluate("""() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight - 3);
                return el && el.closest('#nav') ? 'barre' : (el ? el.tagName + '#' + el.id : 'rien'); }""")
            ok = bas == 'barre'
            ko += not ok
            print(f"{model:18} taille {zoom:3} % : tout en bas = {bas} {'OK' if ok else '<-- BANDE VIDE'}")
            page.screenshot(path=os.path.join(SHOTS, f"iphone_{model.replace(' ', '_')}_{zoom}.png"))
            ctx.close()
    b.close()
print('\n'.join(errs) or ('AUCUNE ERREUR' if not ko else f'{ko} CAS AVEC BANDE VIDE'))
