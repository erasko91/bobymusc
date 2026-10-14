import sys, os, time, json
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
URL = sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:8765/'
SHOTS = sys.argv[1]
OUT = sys.argv[2]  # fichier où écrire les uid créés (pour le nettoyage)
os.makedirs(SHOTS, exist_ok=True)
errors = []
stamp = str(int(time.time()))

def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))

def phone(b, label):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{label} PAGEERROR {e.stack}'))
    page.on('console', lambda m: errors.append(f'{label} CONSOLE {m.text}') if m.type == 'error' else None)
    page.goto(URL)
    for _ in range(3):
        page.click('[data-a="ob-next"]')
    return page

def signup(page, name, email):
    page.goto(URL + '#/friends')
    page.wait_for_selector('[data-a="acc-signup"]', timeout=20000)
    page.click('[data-a="acc-signup"]')
    page.fill('#acc-name', name)
    page.fill('#acc-email', email)
    page.fill('#acc-pw', 'TestBoby123!')
    page.click('[data-a="acc-submit"]')
    page.wait_for_selector('.friend-code', timeout=20000)
    page.wait_for_function("document.querySelector('.friend-code').textContent.startsWith('BOBY-')", timeout=20000)
    return page.inner_text('.friend-code').strip()

uids = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    alice = phone(b, 'ALICE')
    bob = phone(b, 'BOB')

    # Alice fait une séance AVANT de créer son compte (test de la synchro)
    alice.click('#nav a[data-tab="train"]')
    alice.click('[data-a="add-template"][data-i="1"]')
    alice.click('[data-a="start-routine"]')
    alice.locator('input.in[data-ei="0"][data-si="0"]').nth(0).fill('70')
    alice.click('[data-a="set-done"][data-ei="0"][data-si="0"]')
    alice.click('[data-a="manual-rest"]')
    shot(alice, 'f00_minuteur_manuel')
    alice.click('text=⏱ 2 min')
    shot(alice, 'f01_minuteur_lance')
    alice.click('[data-a="finish"]')
    alice.fill('#fin-name', 'Push du mardi')
    alice.click('[data-a="finish-save"]')
    alice.wait_for_timeout(500)
    alice.click('.celebrate [data-a="close-modal"]')

    code_a = signup(alice, 'Alice Test', f'test-alice-{stamp}@example.com')
    print('code Alice :', code_a)
    alice.wait_for_timeout(3000)  # synchro de la séance
    shot(alice, 'f02_alice_amis')
    code_b = signup(bob, 'Bob Test', f'test-bob-{stamp}@example.com')
    print('code Bob :', code_b)
    uids = [alice.evaluate('Cloud.state.user.uid'), bob.evaluate('Cloud.state.user.uid')]
    open(OUT, 'w').write(json.dumps({'uids': uids, 'codes': [code_a, code_b]}))

    # Bob ajoute Alice
    bob.fill('#friend-code', code_a.lower().replace('boby-', ''))
    bob.click('[data-a="add-friend"]')
    bob.wait_for_timeout(1500)
    shot(bob, 'f03_bob_demande_envoyee')

    # Alice voit la demande et accepte
    alice.wait_for_selector('[data-a="req-ok"]', timeout=20000)
    print('badge Alice :', alice.inner_text('#nav-badge'))
    shot(alice, 'f04_alice_demande_recue')
    alice.click('[data-a="req-ok"]')
    alice.wait_for_timeout(2000)

    # Bob voit le fil d'actualité avec la séance d'Alice
    bob.click('[data-a="feed-refresh"]')
    bob.wait_for_selector('.wcard .author', timeout=20000)
    shot(bob, 'f05_bob_fil')
    bob.click('.wcard')
    bob.wait_for_selector('.react-bar', timeout=20000)
    bob.click('[data-a="react"][data-e="💪"]')
    bob.wait_for_timeout(1500)
    shot(bob, 'f06_bob_reaction')

    # Profil d'Alice vu par Bob
    bob.goto(URL + '#/friend/' + uids[0])
    bob.wait_for_selector('.wcard', timeout=20000)
    shot(bob, 'f07_bob_profil_alice')

    # Alice voit la réaction sur sa séance
    alice.goto(URL + '#/home')
    alice.click('.wcard')
    alice.wait_for_selector('.react-line', timeout=20000)
    shot(alice, 'f08_alice_voit_reaction')
    print('réaction vue par Alice :', alice.inner_text('.react-line'))

    # Sécurité : un inconnu (Charlie) ne doit PAS pouvoir lire les séances d'Alice
    charlie = phone(b, 'CHARLIE')
    signup(charlie, 'Charlie Test', f'test-charlie-{stamp}@example.com')
    uids.append(charlie.evaluate('Cloud.state.user.uid'))
    open(OUT, 'w').write(json.dumps({'uids': uids}))
    res = charlie.evaluate(f"Cloud.friendWorkouts('{uids[0]}', 5).then(() => 'LU (PROBLEME)').catch(e => 'refusé : ' + e.code)")
    print('Charlie lit les séances d’Alice ->', res)
    b.close()

print('\n'.join(errors) if errors else 'AUCUNE ERREUR')
