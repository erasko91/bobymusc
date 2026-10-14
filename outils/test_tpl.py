import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    page = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    page.on('pageerror', lambda e: errs.append(str(e.stack)))
    page.goto('http://localhost:8765/')
    for _ in range(3):
        page.click('[data-a="ob-next"]')
    page.click('#nav a[data-tab="train"]')
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(SHOTS, 't01_liste.png'), full_page=True)
    page.click('.tpl-info[data-i="3"]')
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(SHOTS, 't02_apercu.png'))
    print('exercices affichés :', page.locator('.tpl-list .list-item').count())
    page.click('.sheet [data-a="add-template"]')
    page.wait_for_timeout(400)
    print('programmes après ajout :', page.evaluate("JSON.parse(localStorage.getItem('bobmusc-data-v1')).routines.map(r => r.name)"))
    print('fenêtre fermée :', page.locator('#modal.open').count() == 0)
    b.close()
print('\n'.join(errs) or 'AUCUNE ERREUR')
