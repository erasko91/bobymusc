"""Photos des exercices : vignettes dans les listes, démo animée, démo pendant la séance et dans le sélecteur."""
import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    page = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    page.on('pageerror', lambda e: errs.append(str(e.stack)))
    page.on('requestfailed', lambda r: errs.append('IMAGE MANQUANTE ' + r.url) if '/img/' in r.url else None)
    page.goto('http://localhost:8765/')
    for _ in range(3):
        page.click('[data-a="ob-next"]')

    # Bibliothèque : vignettes chargées
    page.goto('http://localhost:8765/#/exercises'); page.wait_for_timeout(1500)
    for _ in range(12): page.mouse.wheel(0, 2000); page.wait_for_timeout(150)
    page.wait_for_timeout(800)
    stats = page.evaluate("""() => { const imgs = [...document.querySelectorAll('#ex-list img.ex-icon')];
      return { photos: imgs.length, cassees: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
               sans_photo: document.querySelectorAll('#ex-list div.ex-icon').length }; }""")
    print('bibliothèque :', stats)
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=os.path.join(SHOTS, 'p01_bibliotheque.png'))

    # Page d'un exercice au nom compliqué
    page.goto('http://localhost:8765/#/exercise/good_morning'); page.wait_for_timeout(1200)
    print('démo good morning :', page.evaluate("[...document.querySelectorAll('.ex-demo img')].map(i => i.naturalWidth)"))
    page.screenshot(path=os.path.join(SHOTS, 'p02_demo.png'))
    page.wait_for_timeout(1300)
    page.screenshot(path=os.path.join(SHOTS, 'p02b_demo_arrivee.png'))

    # Séance : appui sur la photo = démo par-dessus, la séance reste
    page.goto('http://localhost:8765/#/home'); page.click('[data-a="start-empty"]')
    page.click('[data-a="add-ex"]')
    page.fill('input[data-q="pk"]', 'face')
    page.click('#pk-list img[data-a="ex-demo"]')
    page.wait_for_timeout(500)
    print('démo depuis le sélecteur :', page.locator('#demo.open').count() == 1, '| sélecteur toujours ouvert :', page.locator('#modal.open').count() == 1)
    page.screenshot(path=os.path.join(SHOTS, 'p03_demo_selecteur.png'))
    page.click('#demo .btn.primary')
    page.click('[data-a="pk-item"][data-id="face_pull"]'); page.click('[data-a="pk-ok"]')
    page.click('.ex-card [data-a="ex-demo"]'); page.wait_for_timeout(400)
    print('démo pendant la séance :', page.locator('#demo.open').count() == 1, '| toujours sur la séance :', page.url.endswith('#/active'))
    page.click('#demo [data-a="demo-close"].btn')
    page.screenshot(path=os.path.join(SHOTS, 'p04_seance.png'))
    b.close()
print('\n'.join(errs) or 'AUCUNE ERREUR')
