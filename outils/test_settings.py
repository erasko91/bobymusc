import sys, os, time, json
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

URL = 'http://localhost:8765/'
SHOTS = sys.argv[1]
OUT = sys.argv[2]
errors = []
stamp = str(int(time.time()))

def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))

def phone(b, label):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{label} PAGEERROR {e.stack}'))
    page.on('console', lambda m: errors.append(f'{label} CONSOLE {m.text}') if m.type == 'error' else None)
    page.goto(URL)
    for _ in range(3):
        page.click('[data-a="ob-next"]')
    return page

def setting(page, k, v):
    page.select_option(f'select[data-setting="{k}"]', str(v))

def toggle(page, k, on):
    box = page.locator(f'input[data-setting="{k}"]')
    if box.is_checked() != on:
        box.click()

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    a = phone(b, 'A')

    # 1) Première séance : 3 x 60 kg au squat + 2 km de course
    a.goto(URL + '#/settings')
    shot(a, 's01_reglages_haut')
    a.screenshot(path=os.path.join(SHOTS, 's01b_reglages_complet.png'), full_page=True)
    a.click('[data-a="start-empty"]') if a.locator('[data-a="start-empty"]').count() else None
    a.goto(URL + '#/home'); a.click('[data-a="start-empty"]')
    a.click('[data-a="add-ex"]'); a.click('[data-a="pk-item"][data-id="squat_barre"]'); a.click('[data-a="pk-item"][data-id="course"]'); a.click('[data-a="pk-ok"]')
    for si in range(3):
        row = a.locator(f'input.in[data-ei="0"][data-si="{si}"]')
        row.nth(0).fill('60'); row.nth(1).fill('5')
        a.click(f'[data-a="set-done"][data-ei="0"][data-si="{si}"]')
    print('minuteur lancé automatiquement :', a.locator('#restbar:not([hidden])').count() == 1)
    a.click('[data-a="rest-skip"]')
    a.locator('input.in[data-ei="1"][data-si="0"]').nth(0).fill('2')
    a.locator('input.in[data-ei="1"][data-si="0"]').nth(1).fill('12')
    a.click('[data-a="set-done"][data-ei="1"][data-si="0"]')
    a.click('[data-a="finish"]'); a.click('[data-a="finish-save"]'); a.wait_for_timeout(500)
    a.click('.celebrate [data-a="close-modal"]')

    # 2) Réglages : pas de minuteur auto, pré-remplissage, miles, dimanche, 4 séries, grande taille, son cloche
    a.goto(URL + '#/settings')
    toggle(a, 'autoRest', False)
    toggle(a, 'prefill', True)
    setting(a, 'dist', 'mi'); setting(a, 'weekStart', 'sun'); setting(a, 'defSets', 4)
    setting(a, 'sound', 'cloche'); setting(a, 'textSize', 110)
    a.click('[data-a="test-sound"]')
    s = a.evaluate("JSON.parse(localStorage.getItem('bobmusc-data-v1')).settings")
    print('réglages enregistrés :', {k: s[k] for k in ['autoRest', 'prefill', 'dist', 'weekStart', 'defSets', 'sound', 'textSize']})
    print('zoom appliqué :', a.evaluate("document.body.style.zoom"))

    # 3) Nouvelle séance : le squat doit être pré-rempli (60 / 5), la course en miles, pas de minuteur
    a.goto(URL + '#/home'); a.click('[data-a="start-empty"]')
    a.click('[data-a="add-ex"]'); a.click('[data-a="pk-item"][data-id="squat_barre"]'); a.click('[data-a="pk-item"][data-id="course"]'); a.click('[data-a="pk-item"][data-id="leg_ext"]'); a.click('[data-a="pk-ok"]')
    first = a.locator('input.in[data-ei="0"][data-si="0"]')
    print('pré-rempli :', first.nth(0).input_value(), 'kg x', first.nth(1).input_value())
    print('course affichée :', a.locator('input.in[data-ei="1"][data-si="0"]').nth(0).input_value(), a.inner_text('.ex-card:nth-of-type(2) thead'))
    print('séries pour un exercice jamais fait :', a.locator('input.in[data-ei="2"][data-in="w"]').count())
    a.click('[data-a="set-done"][data-ei="0"][data-si="0"]')
    print('minuteur auto désactivé :', a.locator('#restbar:not([hidden])').count() == 0)
    shot(a, 's02_seance_prerempli')
    a.click('[data-a="discard"]'); a.click('[data-a="menu-pick"]')

    # 4) Profil (calendrier commence le dimanche) et export CSV
    a.goto(URL + '#/profile')
    print('calendrier :', a.inner_text('.cal b:first-child'))
    a.goto(URL + '#/settings')
    with a.expect_download() as dl:
        a.click('[data-a="export-csv"]')
    path = os.path.join(SHOTS, 'export.csv')
    dl.value.save_as(path)
    print('CSV :', open(path, encoding='utf-8-sig').read().splitlines()[:3])
    setting(a, 'textSize', 100)

    # 5) Mode privé + suppression de compte avec deux comptes de test
    bpage = phone(b, 'B')
    def signup(page, name, email):
        page.goto(URL + '#/friends')
        page.wait_for_selector('[data-a="acc-signup"]', timeout=20000)
        page.click('[data-a="acc-signup"]')
        page.fill('#acc-name', name); page.fill('#acc-email', email); page.fill('#acc-pw', 'TestBoby123!')
        page.click('[data-a="acc-submit"]')
        page.wait_for_function("document.querySelector('.friend-code') && document.querySelector('.friend-code').textContent.startsWith('BOBY-')", timeout=20000)
        return page.inner_text('.friend-code').strip()
    code_a = signup(a, 'Alice Test', f'test-alice-{stamp}@example.com')
    a.wait_for_timeout(2500)
    signup(bpage, 'Bob Test', f'test-bob-{stamp}@example.com')
    uids = [a.evaluate('Cloud.state.user.uid'), bpage.evaluate('Cloud.state.user.uid')]
    open(OUT, 'w').write(json.dumps({'uids': uids}))
    bpage.fill('#friend-code', code_a); bpage.click('[data-a="add-friend"]')
    a.wait_for_selector('[data-a="req-ok"]', timeout=20000); a.click('[data-a="req-ok"]'); a.wait_for_timeout(1500)
    n1 = bpage.evaluate(f"Cloud.friendWorkouts('{uids[0]}', 5).then(r => r.length).catch(e => e.code)")
    print('Bob voit les séances d’Alice :', n1)
    a.goto(URL + '#/settings')
    a.locator('input[data-cloud="share"]').click()
    a.wait_for_timeout(1500)
    shot(a, 's03_compte_prive')
    n2 = bpage.evaluate(f"Cloud.friendWorkouts('{uids[0]}', 5).then(r => r.length).catch(e => e.code)")
    print('Après mode privé, Bob voit :', n2)
    bpage.goto(URL + '#/friend/' + uids[0]); bpage.wait_for_timeout(2500)
    print('Message chez Bob :', bpage.inner_text('#view .empty'))
    # Alice supprime son compte
    a.click('[data-a="delete-account"]'); a.click('[data-a="menu-pick"]')
    a.wait_for_timeout(5000)
    print('Alice déconnectée après suppression :', a.evaluate('Cloud.state.user') is None)
    bpage.goto(URL + '#/friends'); bpage.wait_for_timeout(2000)
    print('Amis de Bob après suppression :', bpage.evaluate('Cloud.state.friends.length'))
    b.close()

print('\n'.join(errors) if errors else 'AUCUNE ERREUR')
