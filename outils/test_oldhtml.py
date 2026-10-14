import sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
# Le serveur 8766 sert une copie où index.html n'a PAS motivation.js (comme l'ancienne page en mémoire)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    page = b.new_page(viewport={'width': 390, 'height': 844})
    navs = []
    page.on('framenavigated', lambda f: navs.append(f.url) if f == page.main_frame else None)
    page.goto('http://localhost:8766/#/home')
    page.wait_for_timeout(3000)
    print('navigations :', len(navs), '| url finale :', page.url.split('/')[-1])
    print('rechargé une seule fois (pas de boucle) :', len(navs) == 2 and 'fresh=' in page.url)
    b.close()
