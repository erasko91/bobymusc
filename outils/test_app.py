import sys, os, time
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
SHOTS = sys.argv[1]
os.makedirs(SHOTS, exist_ok=True)
errors = []

def shot(page, name):
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e.stack)))
    page.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    page.goto(URL)
    shot(page, '00a_poids')
    page.click('[data-a="ob-adj"][data-d="1"]')
    page.click('[data-a="ob-next"]')
    shot(page, '00b_taille')
    page.fill('#ob-in', '182')
    page.click('[data-a="ob-next"]')
    page.fill('#ob-in', '300')
    page.click('[data-a="ob-next"]')
    shot(page, '00c_age_erreur')
    page.fill('#ob-in', '29')
    page.click('[data-a="ob-next"]')
    shot(page, '01_accueil_vide')

    # Ajouter un programme prêt à l'emploi puis démarrer
    page.click('#nav a[data-tab="train"]')
    page.click('[data-a="add-template"][data-i="0"]')
    shot(page, '02_entrainement')
    page.click('[data-a="start-routine"]')
    page.wait_for_timeout(300)
    shot(page, '03_seance_vide')

    # Remplir 2 séries du squat
    inputs = page.locator('input.in[data-ei="0"]')
    inputs.nth(0).fill('80'); inputs.nth(1).fill('8')
    page.click('[data-a="set-done"][data-ei="0"][data-si="0"]')
    page.wait_for_timeout(1200)
    shot(page, '04_serie_validee_repos')
    page.locator('input.in[data-ei="0"][data-si="1"]').nth(0).fill('85')
    page.click('[data-a="set-done"][data-ei="0"][data-si="1"]')
    page.click('[data-a="rest-skip"]')
    # Développé couché
    page.locator('input.in[data-ei="1"][data-si="0"]').nth(0).fill('60')
    page.click('[data-a="set-done"][data-ei="1"][data-si="0"]')
    # Planche (durée) déjà pré-remplie à 30 s
    page.click('[data-a="set-done"][data-ei="5"][data-si="0"]')
    page.click('[data-a="rest-skip"]')

    # Type de série
    page.click('[data-a="set-menu"][data-ei="0"][data-si="2"]')
    shot(page, '05_menu_serie')
    page.click('text=Échauffement')

    # Ajouter un exercice via le sélecteur
    page.click('[data-a="add-ex"]')
    page.fill('input[data-q="pk"]', 'curl marteau')
    shot(page, '06_selecteur')
    page.click('[data-a="pk-item"][data-id="curl_marteau"]')
    page.click('[data-a="pk-ok"]')
    page.wait_for_timeout(300)

    # Terminer
    page.click('[data-a="finish"]')
    shot(page, '07_terminer')
    page.click('[data-a="finish-save"]')
    page.wait_for_timeout(600)
    shot(page, '08_bravo')
    page.click('.celebrate [data-a="close-modal"]')
    shot(page, '09_detail_seance')

    # Refaire la séance avec plus lourd -> records
    page.click('[data-a="redo"]')
    page.wait_for_timeout(300)
    page.locator('input.in[data-ei="0"][data-si="0"]').nth(0).fill('100')
    page.click('[data-a="set-done"][data-ei="0"][data-si="0"]')
    page.click('[data-a="rest-skip"]')
    page.click('[data-a="finish"]')
    page.click('[data-a="finish-save"]')
    page.wait_for_timeout(600)
    shot(page, '10_records')
    page.click('.celebrate [data-a="close-modal"]')

    page.goto(URL + '#/home'); shot(page, '11_accueil')
    page.goto(URL + '#/exercise/squat_barre'); shot(page, '12_exercice')
    page.goto(URL + '#/exercises'); shot(page, '13_bibliotheque')
    page.goto(URL + '#/profile'); shot(page, '14_profil')
    page.screenshot(path=os.path.join(SHOTS, '14b_profil_full.png'), full_page=True)
    page.goto(URL + '#/settings'); shot(page, '15_reglages')
    page.click('[data-a="accent"][data-v="vert"]')
    page.select_option('select[data-setting="theme"]', 'light')
    page.goto(URL + '#/home'); shot(page, '16_clair_vert')
    page.goto(URL + '#/measures')
    page.click('[data-a="measure-add"]')
    page.fill('#ms-weight', '78,5')
    page.click('[data-a="measure-save"]')
    shot(page, '17_mesures')
    page.goto(URL + '#/routine/new')
    page.fill('input[data-f="name"]', 'Mon test')
    page.click('[data-a="add-ex"]')
    page.click('[data-a="pk-item"][data-id="pompes"]')
    page.click('[data-a="pk-ok"]')
    shot(page, '18_editeur_programme')
    page.click('[data-a="routine-save"]')
    page.wait_for_timeout(300)
    shot(page, '19_programmes')
    data = page.evaluate("localStorage.getItem('bobmusc-data-v1')")
    print('taille données :', len(data))
    b.close()

print('\n'.join(errors) if errors else 'AUCUNE ERREUR')
