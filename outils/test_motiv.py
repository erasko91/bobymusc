import sys, os, time
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

URL = 'http://localhost:8765/'
SHOTS = sys.argv[1]
PHOTO = sys.argv[2]
errors = []
stamp = str(int(time.time()))

def shot(page, name, full=False):
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)

def phone(b, label):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
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
    page.fill('#acc-name', name); page.fill('#acc-email', email); page.fill('#acc-pw', 'TestBoby123!')
    page.click('[data-a="acc-submit"]')
    page.wait_for_function("document.querySelector('.friend-code') && document.querySelector('.friend-code').textContent.startsWith('BOBY-')", timeout=20000)
    return page.inner_text('.friend-code').strip()

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    a = phone(b, 'A')
    shot(a, 'm01_accueil_serie')

    # Objectifs : 100 kg au squat, 2 séances, peser 70 kg
    a.goto(URL + '#/profile')
    shot(a, 'm02_profil_vide', True)
    a.click('[data-a="goal-new"]')
    a.click('[data-a="goal-ex"]'); a.fill('input[data-q="pk"]', 'squat (barre)'); a.click('[data-a="pk-item"][data-id="squat_barre"]')
    a.fill('#gl-target', '100'); a.fill('#gl-date', '2026-12-31')
    a.click('[data-a="goal-save"]')
    a.goto(URL + '#/goals')
    a.click('[data-a="goal-new"]'); a.select_option('#gl-type', 'sessions'); a.fill('#gl-target', '2'); a.click('[data-a="goal-save"]')
    a.click('[data-a="goal-new"]'); a.select_option('#gl-type', 'bodyweight'); a.fill('#gl-target', '70'); a.click('[data-a="goal-save"]')
    shot(a, 'm03_objectifs')
    print('objectifs :', a.locator('.goal').count())

    # Séance : squat 100 kg x 5 (+ pecs pour la carte des muscles)
    a.goto(URL + '#/home'); a.click('[data-a="start-empty"]')
    a.click('[data-a="add-ex"]')
    for x in ['squat_barre', 'dc_barre', 'rowing_barre']:
        a.click(f'[data-a="pk-item"][data-id="{x}"]')
    a.click('[data-a="pk-ok"]')
    for ei, (kg, r) in enumerate([('100', '5'), ('70', '8'), ('60', '10')]):
        for si in range(3):
            row = a.locator(f'input.in[data-ei="{ei}"][data-si="{si}"]')
            row.nth(0).fill(kg); row.nth(1).fill(r)
            a.click(f'[data-a="set-done"][data-ei="{ei}"][data-si="{si}"]')
            if a.locator('[data-a="rest-skip"]').count(): a.click('[data-a="rest-skip"]')
    a.click('[data-a="finish"]'); a.click('[data-a="finish-save"]'); a.wait_for_timeout(700)
    shot(a, 'm04_bravo_badges')
    print('fin de séance :', ' | '.join(a.inner_text('.celebrate').split('\n')[:14]))
    a.click('.celebrate [data-a="close-modal"]')

    # Mesure 70 kg -> objectif poids atteint
    a.goto(URL + '#/measures'); a.click('[data-a="measure-add"]'); a.fill('#ms-weight', '70'); a.click('[data-a="measure-save"]')
    a.wait_for_timeout(300)
    print('toast mesure :', a.inner_text('#toast'))

    a.goto(URL + '#/home'); shot(a, 'm05_accueil_apres')
    a.goto(URL + '#/goals'); shot(a, 'm06_objectifs_atteints')
    a.goto(URL + '#/badges'); shot(a, 'm07_badges'); print('badges :', a.inner_text('.card.center h2'))
    a.goto(URL + '#/recap'); shot(a, 'm08_bilan')
    with a.expect_download() as dl:
        a.click('[data-a="recap-share"]')
    dl.value.save_as(os.path.join(SHOTS, 'm09_bilan_image.png'))

    # Profil : photo + bio
    a.goto(URL + '#/profile')
    a.click('[data-a="profile-edit"]')
    a.set_input_files('#avatar-in', PHOTO)
    a.wait_for_selector('.avatar-edit img.avatar', timeout=10000)
    a.fill('#pf-name', 'Alice Test')
    a.fill('#pf-bio', 'Objectif 100 kg au squat 🦍 Salle le soir')
    shot(a, 'm10_edition_profil')
    a.click('[data-a="profile-save"]')
    shot(a, 'm11_profil', True)
    a.click('[data-a="map-days"][data-v="30"]'); a.wait_for_timeout(200)

    # En ligne : l'ami voit la photo et la bio
    code_a = signup(a, 'Alice Test', f'test-alice-{stamp}@example.com')
    a.wait_for_timeout(3000)
    bob = phone(b, 'B')
    signup(bob, 'Bob Test', f'test-bob-{stamp}@example.com')
    bob.fill('#friend-code', code_a); bob.click('[data-a="add-friend"]')
    a.goto(URL + '#/friends'); a.wait_for_selector('[data-a="req-ok"]', timeout=20000); a.click('[data-a="req-ok"]')
    a.wait_for_timeout(2000)
    uid_a = a.evaluate('Cloud.state.user.uid')
    print('photo en ligne :', a.evaluate("Cloud.friendProfile(Cloud.state.user.uid).then(p => (p.avatar || '').length + ' caractères, bio : ' + p.bio)"))
    print('Bob lit le profil d’Alice :', bob.evaluate(f"Cloud.friendProfile('{uid_a}').then(p => p ? 'OK avatar=' + !!p.avatar : 'vide').catch(e => 'ERREUR ' + e.code)"))
    print('amis de Bob :', bob.evaluate('Cloud.state.friends.map(f => f.name)'))
    bob.goto(URL + '#/friend/' + uid_a)
    bob.wait_for_timeout(4000)
    print('clés du cache :', bob.evaluate("Object.keys(net).join(' ; ')"))
    shot(bob, 'm12_debug')
    bob.wait_for_selector('.profile-head img.avatar', timeout=20000)
    bob.wait_for_selector('.body-map', timeout=20000)
    shot(bob, 'm12_bob_voit_alice', True)
    print('bio vue par Bob :', bob.inner_text('.bio'))
    bob.goto(URL + '#/friends'); bob.click('[data-a="friends-tab"][data-v="list"]'); bob.wait_for_timeout(1500)
    print('avatar dans la liste :', bob.locator('.list-item img.avatar').count())
    b.close()

print('\n'.join(errors) if errors else 'AUCUNE ERREUR')
