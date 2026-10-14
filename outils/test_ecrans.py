"""Bas de l'écran sur différentes tailles d'écran, thèmes et tailles d'affichage : la barre du bas doit coller au bord."""
import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
ECRANS = {'grand_tel': (430, 932), 'tel_android': (412, 915), 'tablette': (800, 1280), 'pc': (1366, 768)}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    for nom, (w, h) in ECRANS.items():
        for zoom in (90, 100, 120):
            page = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1).new_page()
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.goto('http://localhost:8765/')
            for _ in range(3):
                page.click('[data-a="ob-next"]')
            page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('bobmusc-data-v1'));
                d.settings.textSize = {zoom}; d.settings.theme = 'light'; localStorage.setItem('bobmusc-data-v1', JSON.stringify(d)); }}""")
            page.reload(); page.wait_for_timeout(600)
            r = page.evaluate("""() => { const n = document.querySelector('#nav').getBoundingClientRect();
                const z = parseFloat(document.body.style.zoom || 1);
                return { haut: Math.round(n.top * z), bas: Math.round(n.bottom * z), gauche: Math.round(n.left * z), droite: Math.round(n.right * z), ecran: innerHeight, largeur: innerWidth }; }""")
            vide = r['ecran'] - r['bas']
            print(f"{nom:12} zoom {zoom:3} % : barre {r['haut']}→{r['bas']} px sur {r['ecran']} (vide sous la barre : {vide} px) ; largeur {r['gauche']}→{r['droite']} sur {r['largeur']}")
            page.screenshot(path=os.path.join(SHOTS, f'ecran_{nom}_{zoom}.png'))
            page.context.close()
    b.close()
print('\n'.join(errs) or 'AUCUNE ERREUR')
