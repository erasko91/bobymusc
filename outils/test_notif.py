"""Mise à jour du programme en fin de séance + notifications du minuteur quand on quitte l'appli."""
import sys, os
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
SHOTS = sys.argv[1]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.grant_permissions(['notifications'], origin='http://localhost:8765')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e.stack)))
    page.goto('http://localhost:8765/')
    for _ in range(3):
        page.click('[data-a="ob-next"]')

    # 1) Programme « Full body », séance avec un poids changé + un exercice ajouté
    page.click('#nav a[data-tab="train"]'); page.click('[data-a="add-template"][data-i="0"]')
    page.click('[data-a="start-routine"]')
    row = page.locator('input.in[data-ei="0"][data-si="0"]')
    row.nth(0).fill('100'); row.nth(1).fill('5')
    page.click('[data-a="set-done"][data-ei="0"][data-si="0"]'); page.click('[data-a="rest-skip"]')
    page.click('[data-a="add-ex"]'); page.fill('input[data-q="pk"]', 'face pull'); page.click('[data-a="pk-item"][data-id="face_pull"]'); page.click('[data-a="pk-ok"]')
    last = page.locator('.ex-card').count() - 1
    r2 = page.locator(f'input.in[data-ei="{last}"][data-si="0"]')
    r2.nth(0).fill('20'); r2.nth(1).fill('15')
    page.click(f'[data-a="set-done"][data-ei="{last}"][data-si="0"]'); page.click('[data-a="rest-skip"]')
    page.click('[data-a="finish"]')
    print('case « mettre à jour le programme » :', page.locator('#fin-upd').is_checked())
    page.screenshot(path=os.path.join(SHOTS, 'n01_terminer.png'))
    page.click('[data-a="finish-save"]'); page.wait_for_timeout(600)
    r = page.evaluate("JSON.parse(localStorage.getItem('bobmusc-data-v1')).routines[0]")
    sq = r['exercises'][0]
    print('programme, squat :', [(s['w'], s['r']) for s in sq['sets']], '| exercices :', len(r['exercises']), '| dernier :', r['exercises'][-1]['ex'])

    # 2) Notifications : activer dans les réglages, lancer un repos, « quitter » l'appli
    page.goto('http://localhost:8765/#/settings')
    page.locator('input[data-setting="notif"]').click(); page.wait_for_timeout(800)
    print('réglage notifications :', page.evaluate("JSON.parse(localStorage.getItem('bobmusc-data-v1')).settings.notif"))
    page.goto('http://localhost:8765/#/home'); page.click('[data-a="start-empty"]')
    page.click('[data-a="add-ex"]'); page.click('[data-a="pk-item"][data-id="pompes"]'); page.click('[data-a="pk-ok"]')
    page.locator('input.in[data-ei="0"][data-si="0"]').nth(0).fill('12')
    page.click('[data-a="set-done"][data-ei="0"][data-si="0"]')
    page.evaluate("db.active.rest.end = Date.now() + 3000; db.active.rest.total = 3")
    # Simule le passage en arrière-plan
    page.evaluate("""Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'))""")
    page.wait_for_timeout(800)
    get = "navigator.serviceWorker.ready.then(r => r.getNotifications({ tag: 'bobymusc-timer' })).then(l => l.map(n => n.title + ' | ' + n.body))"
    print('notification en cours :', page.evaluate(get))
    page.wait_for_timeout(3500)
    print('notification de fin :', page.evaluate(get))
    # Retour dans l'appli : la notification disparaît
    page.evaluate("""Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'))""")
    page.wait_for_timeout(800)
    print('après retour dans l’appli :', page.evaluate(get))
    b.close()
print('\n'.join(errs) or 'AUCUNE ERREUR')
