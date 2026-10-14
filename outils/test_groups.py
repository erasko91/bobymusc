import sys, os, time
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

URL = sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:8765/'
SHOTS = sys.argv[1]
PHOTO = sys.argv[2]
errors = []
stamp = str(int(time.time()))

def shot(page, name):
    page.wait_for_timeout(500)
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
    page.fill('#acc-name', name); page.fill('#acc-email', email); page.fill('#acc-pw', 'TestBoby123!')
    page.click('[data-a="acc-submit"]')
    page.wait_for_function("document.querySelector('.friend-code') && document.querySelector('.friend-code').textContent.startsWith('BOBY-')", timeout=20000)
    return page.inner_text('.friend-code').strip()

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    a, bob, c = phone(b, 'ALICE'), phone(b, 'BOB'), phone(b, 'CHARLIE')

    # Alice fait une séance (pour pouvoir la partager)
    a.click('#nav a[data-tab="train"]'); a.click('[data-a="add-template"][data-i="2"]'); a.click('[data-a="start-routine"]')
    a.locator('input.in[data-ei="1"][data-si="0"]').nth(0).fill('80')
    a.click('[data-a="set-done"][data-ei="0"][data-si="0"]'); a.click('[data-a="set-done"][data-ei="1"][data-si="0"]')
    a.click('[data-a="finish"]'); a.fill('#fin-name', 'Pull du mercredi'); a.click('[data-a="finish-save"]')
    a.wait_for_timeout(500); a.click('.celebrate [data-a="close-modal"]')

    code_a = signup(a, 'Alice Test', f'test-alice-{stamp}@example.com')
    signup(bob, 'Bob Test', f'test-bob-{stamp}@example.com')
    signup(c, 'Charlie Test', f'test-charlie-{stamp}@example.com')
    bob.fill('#friend-code', code_a); bob.click('[data-a="add-friend"]')
    a.wait_for_selector('[data-a="req-ok"]', timeout=20000); a.click('[data-a="req-ok"]')
    a.wait_for_timeout(1500)

    # Alice crée le groupe avec Bob
    a.click('[data-a="friends-tab"][data-v="groups"]')
    shot(a, 'g01_groupes_vide')
    a.click('[data-a="group-new"]')
    a.fill('#g-name', 'Les gros bras')
    a.click('[data-a="g-emoji"][data-v="🦍"]')
    a.click('[data-a="g-friend"]')
    shot(a, 'g02_creation')
    a.click('[data-a="g-save"]')
    a.wait_for_selector('#msg-in', timeout=20000)
    gid = a.evaluate('location.hash').split('/')[-1]
    a.fill('#msg-in', 'Salut la team 💪 qui vient à la salle ce soir ?')
    a.click('[data-a="send-msg"]')
    a.wait_for_timeout(800)
    a.set_input_files('#photo-in', PHOTO)
    a.wait_for_selector('.msg-img', timeout=20000)
    size = a.evaluate("document.querySelector('.msg-img').src.length")
    print('photo envoyée, taille compressée ≈', size * 3 // 4 // 1024, 'Ko')
    a.click('[data-a="share-workout"]'); a.click('[data-a="menu-pick"][data-i="0"]')
    a.wait_for_selector('.msg-workout', timeout=20000)
    shot(a, 'g03_discussion_alice')

    # Bob : pastille non lu, puis lecture et réponse
    bob.goto(URL + '#/home'); bob.wait_for_timeout(2500)
    print('pastille Bob :', bob.inner_text('#nav-badge'), '| cachée :', bob.evaluate("document.querySelector('#nav-badge').hidden"))
    bob.goto(URL + '#/friends'); bob.click('[data-a="friends-tab"][data-v="groups"]')
    shot(bob, 'g04_bob_liste_groupes')
    bob.click('.group-item')
    bob.wait_for_selector('.msg-workout', timeout=20000)
    print('Bob voit', bob.locator('.msg').count(), 'messages')
    bob.fill('#msg-in', 'Grave ! J’arrive à 19 h 🔥')
    bob.click('[data-a="send-msg"]')
    bob.wait_for_timeout(1500)
    shot(bob, 'g05_discussion_bob')
    a.wait_for_timeout(1500)
    print('Alice reçoit la réponse en direct :', 'J’arrive à 19 h' in a.inner_text('#msgs'))
    # Photo plein écran + infos du groupe
    bob.click('.msg-img'); shot(bob, 'g06_photo_plein_ecran'); bob.click('.sheet [data-a="close-modal"]')
    bob.goto(URL + f'#/groupinfo/{gid}'); bob.wait_for_selector('.photo-grid img', timeout=20000)
    shot(bob, 'g07_infos_groupe')

    # Sécurité : Charlie (non membre) ne peut rien lire
    r1 = c.evaluate(f"new Promise(res => {{ const u = Cloud.watchMessages('{gid}', (m, e) => {{ u(); res(e ? 'refusé : ' + e.code : 'LU ' + m.length + ' messages (PROBLEME)'); }}); }})")
    print('Charlie lit les messages ->', r1)
    r2 = c.evaluate(f"Cloud.sendMessage('{gid}', {{ text: 'intrus' }}).then(() => 'ENVOYÉ (PROBLEME)').catch(e => 'refusé : ' + e.code)")
    print('Charlie écrit dans le groupe ->', r2)

    # Bob supprime son message, puis quitte le groupe ; Alice supprime le groupe
    bob.goto(URL + f'#/group/{gid}'); bob.wait_for_selector('.msg.mine .bubble', timeout=20000)
    bob.click('.msg.mine .bubble'); bob.click('text=Supprimer le message'); bob.wait_for_timeout(1500)
    print('message de Bob supprimé :', 'J’arrive à 19 h' not in bob.inner_text('#msgs'))
    bob.goto(URL + f'#/groupinfo/{gid}'); bob.click('[data-a="group-leave"]'); bob.click('[data-a="menu-pick"]'); bob.wait_for_timeout(1500)
    print('groupes de Bob après départ :', bob.evaluate('Cloud.state.groups.length'))
    a.goto(URL + f'#/groupinfo/{gid}'); a.wait_for_timeout(1000)
    print('membres restants :', a.evaluate(f"Cloud.state.groups.find(g => g.id === '{gid}').members.length"))
    a.click('[data-a="group-delete"]'); a.click('[data-a="menu-pick"]'); a.wait_for_timeout(2500)
    print('groupes d’Alice après suppression :', a.evaluate('Cloud.state.groups.length'))
    b.close()

print('\n'.join(errors) if errors else 'AUCUNE ERREUR')
