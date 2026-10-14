import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    page = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    page.on('pageerror', lambda e: errs.append(str(e.stack)))
    page.clock.install()
    page.goto('http://localhost:8765/')
    for _ in range(3):
        page.click('[data-a="ob-next"]')
    page.click('#nav a[data-tab="timer"]')
    page.clock.run_for(500)
    page.screenshot(path=os.path.join(SHOTS, 'tm01_rebours.png'))

    # Compte à rebours 30 s
    page.click('[data-a="tm-preset"][data-v="30"]')
    page.click('[data-a="tm-start"]')
    page.clock.run_for(12000)
    print('après 12 s :', page.inner_text('#tm-time'), '| onglet :', page.inner_text('#nav-timer-label'))
    page.screenshot(path=os.path.join(SHOTS, 'tm02_en_cours.png'))
    page.click('#nav a[data-tab="home"]'); page.clock.run_for(1000)
    print('sur l’accueil, onglet affiche :', page.inner_text('#nav-timer-label'))
    page.clock.run_for(20000)
    print('fin :', page.inner_text('#toast'), '| onglet :', page.inner_text('#nav-timer-label'))

    # Chrono avec 2 tours
    page.click('#nav a[data-tab="timer"]'); page.click('[data-a="tm-mode"][data-v="chrono"]')
    page.click('[data-a="tm-start"]'); page.clock.run_for(65000); page.click('[data-a="tm-lap"]')
    page.clock.run_for(30000); page.click('[data-a="tm-lap"]'); page.click('[data-a="tm-pause"]')
    print('chrono :', page.inner_text('#tm-time'), '| tours :', page.locator('.tm-laps .rec').count())
    page.screenshot(path=os.path.join(SHOTS, 'tm03_chrono.png'))

    # Intervalles Tabata : 5 s de préparation + 8 x (20 s / 10 s) - 10 s = 4 min 5 s
    page.click('[data-a="tm-mode"][data-v="hiit"]')
    page.click('[data-a="tm-hiit-preset"][data-w="20"]')
    page.screenshot(path=os.path.join(SHOTS, 'tm04_intervalles.png'))
    print('durée totale affichée :', page.inner_text('#tm-time'))
    page.click('[data-a="tm-start"]')
    page.clock.run_for(7000)
    print('à 7 s :', page.inner_text('#tm-sub'), page.inner_text('#tm-time'))
    page.screenshot(path=os.path.join(SHOTS, 'tm05_effort.png'))
    page.clock.run_for(20000)
    print('à 27 s :', page.inner_text('#tm-sub'), page.inner_text('#tm-time'))
    page.screenshot(path=os.path.join(SHOTS, 'tm06_repos.png'))
    page.clock.run_for(230000)
    print('fin intervalles :', page.inner_text('#toast'))
    b.close()
print('\n'.join(errs) or 'AUCUNE ERREUR')
