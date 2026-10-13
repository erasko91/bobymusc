'use strict';
/* Bibliothèque d'exercices de BobyMusc.
   type : wr = poids + reps, bw = reps seulement, time = durée (secondes), cardio = distance + minutes */

const MUSCLES = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras', 'Abdos', 'Quadriceps',
  'Ischios', 'Fessiers', 'Adducteurs', 'Mollets', 'Trapèzes', 'Lombaires', 'Corps entier', 'Cardio'];

const EQUIPS = ['Barre', 'Haltères', 'Machine', 'Poulie', 'Poids du corps', 'Kettlebell', 'Barre EZ',
  'Smith', 'Élastique', 'Autre'];

const EX_TYPES = { wr: 'Poids + répétitions', bw: 'Répétitions seulement', time: 'Durée', cardio: 'Distance + durée' };

const EXERCISES = [
  // Pectoraux
  ['dc_barre', 'Développé couché (barre)', 'Pectoraux', 'Barre'],
  ['dc_halteres', 'Développé couché (haltères)', 'Pectoraux', 'Haltères'],
  ['di_barre', 'Développé incliné (barre)', 'Pectoraux', 'Barre'],
  ['di_halteres', 'Développé incliné (haltères)', 'Pectoraux', 'Haltères'],
  ['dd_barre', 'Développé décliné (barre)', 'Pectoraux', 'Barre'],
  ['dc_machine', 'Développé couché (machine)', 'Pectoraux', 'Machine'],
  ['di_machine', 'Développé incliné (machine)', 'Pectoraux', 'Machine'],
  ['dc_smith', 'Développé couché (Smith)', 'Pectoraux', 'Smith'],
  ['ecarte_halteres', 'Écarté couché (haltères)', 'Pectoraux', 'Haltères'],
  ['ecarte_incline', 'Écarté incliné (haltères)', 'Pectoraux', 'Haltères'],
  ['pec_deck', 'Pec deck (butterfly)', 'Pectoraux', 'Machine'],
  ['vis_a_vis', 'Écarté à la poulie (vis-à-vis)', 'Pectoraux', 'Poulie'],
  ['pompes', 'Pompes', 'Pectoraux', 'Poids du corps', 'bw'],
  ['pompes_inclinees', 'Pompes inclinées', 'Pectoraux', 'Poids du corps', 'bw'],
  ['pompes_declinees', 'Pompes déclinées', 'Pectoraux', 'Poids du corps', 'bw'],
  ['dips_pecs', 'Dips (pectoraux)', 'Pectoraux', 'Poids du corps', 'bw'],
  ['pullover', 'Pull-over (haltère)', 'Pectoraux', 'Haltères'],
  // Dos
  ['tractions', 'Tractions (pronation)', 'Dos', 'Poids du corps', 'bw'],
  ['chin_up', 'Tractions (supination)', 'Dos', 'Poids du corps', 'bw'],
  ['tractions_lestees', 'Tractions lestées', 'Dos', 'Autre'],
  ['traction_assistee', 'Tractions assistées (machine)', 'Dos', 'Machine'],
  ['tirage_vertical', 'Tirage vertical (poulie haute)', 'Dos', 'Poulie'],
  ['tirage_vertical_serre', 'Tirage vertical prise serrée', 'Dos', 'Poulie'],
  ['tirage_horizontal', 'Tirage horizontal (poulie basse)', 'Dos', 'Poulie'],
  ['rowing_barre', 'Rowing barre', 'Dos', 'Barre'],
  ['rowing_haltere', 'Rowing un bras (haltère)', 'Dos', 'Haltères'],
  ['rowing_t', 'Rowing T-bar', 'Dos', 'Barre'],
  ['rowing_machine', 'Rowing assis (machine)', 'Dos', 'Machine'],
  ['souleve_terre', 'Soulevé de terre', 'Dos', 'Barre'],
  ['pullover_poulie', 'Pull-over à la poulie', 'Dos', 'Poulie'],
  ['hyperextension', 'Extensions lombaires', 'Lombaires', 'Poids du corps', 'bw'],
  ['superman', 'Superman', 'Lombaires', 'Poids du corps', 'bw'],
  ['shrug_barre', 'Shrug (barre)', 'Trapèzes', 'Barre'],
  ['shrug_halteres', 'Shrug (haltères)', 'Trapèzes', 'Haltères'],
  // Épaules
  ['dm_barre', 'Développé militaire (barre)', 'Épaules', 'Barre'],
  ['dm_halteres', 'Développé épaules (haltères)', 'Épaules', 'Haltères'],
  ['dm_machine', 'Développé épaules (machine)', 'Épaules', 'Machine'],
  ['arnold', 'Développé Arnold', 'Épaules', 'Haltères'],
  ['elev_lat', 'Élévations latérales (haltères)', 'Épaules', 'Haltères'],
  ['elev_lat_poulie', 'Élévations latérales (poulie)', 'Épaules', 'Poulie'],
  ['elev_lat_machine', 'Élévations latérales (machine)', 'Épaules', 'Machine'],
  ['elev_front', 'Élévations frontales (haltères)', 'Épaules', 'Haltères'],
  ['oiseau', 'Oiseau (haltères)', 'Épaules', 'Haltères'],
  ['reverse_pec_deck', 'Pec deck inversé', 'Épaules', 'Machine'],
  ['face_pull', 'Face pull', 'Épaules', 'Poulie'],
  ['rowing_menton', 'Rowing menton (barre)', 'Épaules', 'Barre'],
  // Biceps
  ['curl_barre', 'Curl (barre)', 'Biceps', 'Barre'],
  ['curl_ez', 'Curl (barre EZ)', 'Biceps', 'Barre EZ'],
  ['curl_halteres', 'Curl (haltères)', 'Biceps', 'Haltères'],
  ['curl_marteau', 'Curl marteau', 'Biceps', 'Haltères'],
  ['curl_incline', 'Curl incliné (haltères)', 'Biceps', 'Haltères'],
  ['curl_pupitre', 'Curl pupitre', 'Biceps', 'Barre EZ'],
  ['curl_concentre', 'Curl concentré', 'Biceps', 'Haltères'],
  ['curl_poulie', 'Curl à la poulie', 'Biceps', 'Poulie'],
  ['curl_machine', 'Curl (machine)', 'Biceps', 'Machine'],
  // Triceps
  ['barre_front', 'Barre au front', 'Triceps', 'Barre EZ'],
  ['ext_poulie', 'Extension triceps à la poulie (barre)', 'Triceps', 'Poulie'],
  ['ext_corde', 'Extension triceps à la corde', 'Triceps', 'Poulie'],
  ['ext_nuque', 'Extension nuque (haltère)', 'Triceps', 'Haltères'],
  ['kickback', 'Kickback (haltère)', 'Triceps', 'Haltères'],
  ['dips_triceps', 'Dips (triceps)', 'Triceps', 'Poids du corps', 'bw'],
  ['dips_banc', 'Dips entre deux bancs', 'Triceps', 'Poids du corps', 'bw'],
  ['dc_serre', 'Développé couché prise serrée', 'Triceps', 'Barre'],
  ['pompes_diamant', 'Pompes diamant', 'Triceps', 'Poids du corps', 'bw'],
  ['dips_machine', 'Dips (machine)', 'Triceps', 'Machine'],
  // Avant-bras
  ['curl_poignet', 'Curl poignets (barre)', 'Avant-bras', 'Barre'],
  ['curl_poignet_inverse', 'Curl poignets inversé', 'Avant-bras', 'Barre'],
  ['farmer', 'Marche du fermier', 'Avant-bras', 'Haltères'],
  // Abdos
  ['crunch', 'Crunch', 'Abdos', 'Poids du corps', 'bw'],
  ['crunch_poulie', 'Crunch à la poulie', 'Abdos', 'Poulie'],
  ['crunch_machine', 'Crunch (machine)', 'Abdos', 'Machine'],
  ['releve_jambes', 'Relevé de jambes suspendu', 'Abdos', 'Poids du corps', 'bw'],
  ['releve_jambes_sol', 'Relevé de jambes au sol', 'Abdos', 'Poids du corps', 'bw'],
  ['planche', 'Gainage (planche)', 'Abdos', 'Poids du corps', 'time'],
  ['planche_laterale', 'Gainage latéral', 'Abdos', 'Poids du corps', 'time'],
  ['russian_twist', 'Russian twist', 'Abdos', 'Poids du corps', 'bw'],
  ['roue', 'Roue abdominale', 'Abdos', 'Autre', 'bw'],
  ['mountain_climbers', 'Mountain climbers', 'Abdos', 'Poids du corps', 'bw'],
  ['sit_up', 'Sit-up', 'Abdos', 'Poids du corps', 'bw'],
  ['crunch_velo', 'Crunch vélo', 'Abdos', 'Poids du corps', 'bw'],
  ['hollow', 'Hollow hold', 'Abdos', 'Poids du corps', 'time'],
  // Quadriceps
  ['squat_barre', 'Squat (barre)', 'Quadriceps', 'Barre'],
  ['squat_avant', 'Squat avant (front squat)', 'Quadriceps', 'Barre'],
  ['squat_goblet', 'Goblet squat', 'Quadriceps', 'Haltères'],
  ['squat_smith', 'Squat (Smith)', 'Quadriceps', 'Smith'],
  ['hack_squat', 'Hack squat (machine)', 'Quadriceps', 'Machine'],
  ['presse', 'Presse à cuisses', 'Quadriceps', 'Machine'],
  ['leg_ext', 'Leg extension', 'Quadriceps', 'Machine'],
  ['fentes_halteres', 'Fentes (haltères)', 'Quadriceps', 'Haltères'],
  ['fentes_marchees', 'Fentes marchées', 'Quadriceps', 'Haltères'],
  ['squat_bulgare', 'Squat bulgare (haltères)', 'Quadriceps', 'Haltères'],
  ['squat_pdc', 'Squat (poids du corps)', 'Quadriceps', 'Poids du corps', 'bw'],
  ['fentes_pdc', 'Fentes (poids du corps)', 'Quadriceps', 'Poids du corps', 'bw'],
  ['step_up', 'Montées sur banc (haltères)', 'Quadriceps', 'Haltères'],
  ['chaise', 'Chaise contre le mur', 'Quadriceps', 'Poids du corps', 'time'],
  // Ischios
  ['sdt_roumain', 'Soulevé de terre roumain', 'Ischios', 'Barre'],
  ['sdt_jambes_tendues', 'Soulevé de terre jambes tendues (haltères)', 'Ischios', 'Haltères'],
  ['good_morning', 'Good morning', 'Ischios', 'Barre'],
  ['leg_curl_allonge', 'Leg curl allongé', 'Ischios', 'Machine'],
  ['leg_curl_assis', 'Leg curl assis', 'Ischios', 'Machine'],
  ['nordic', 'Nordic curl', 'Ischios', 'Poids du corps', 'bw'],
  // Fessiers / adducteurs
  ['hip_thrust', 'Hip thrust (barre)', 'Fessiers', 'Barre'],
  ['hip_thrust_machine', 'Hip thrust (machine)', 'Fessiers', 'Machine'],
  ['pont_fessier', 'Pont fessier', 'Fessiers', 'Poids du corps', 'bw'],
  ['abducteurs', 'Abduction (machine)', 'Fessiers', 'Machine'],
  ['kickback_poulie', 'Kickback fessier (poulie)', 'Fessiers', 'Poulie'],
  ['swing_kb', 'Kettlebell swing', 'Fessiers', 'Kettlebell'],
  ['adducteurs', 'Adduction (machine)', 'Adducteurs', 'Machine'],
  // Mollets
  ['mollets_debout', 'Mollets debout (machine)', 'Mollets', 'Machine'],
  ['mollets_assis', 'Mollets assis (machine)', 'Mollets', 'Machine'],
  ['mollets_presse', 'Mollets à la presse', 'Mollets', 'Machine'],
  ['mollets_halteres', 'Mollets debout (haltères)', 'Mollets', 'Haltères'],
  // Corps entier
  ['burpees', 'Burpees', 'Corps entier', 'Poids du corps', 'bw'],
  ['power_clean', 'Épaulé (power clean)', 'Corps entier', 'Barre'],
  ['thruster', 'Thruster (barre)', 'Corps entier', 'Barre'],
  ['jumping_jacks', 'Jumping jacks', 'Corps entier', 'Poids du corps', 'bw'],
  // Cardio
  ['course', 'Course à pied', 'Cardio', 'Autre', 'cardio'],
  ['tapis', 'Tapis de course', 'Cardio', 'Machine', 'cardio'],
  ['velo', 'Vélo', 'Cardio', 'Autre', 'cardio'],
  ['velo_appart', "Vélo d'appartement", 'Cardio', 'Machine', 'cardio'],
  ['elliptique', 'Vélo elliptique', 'Cardio', 'Machine', 'cardio'],
  ['rameur', 'Rameur', 'Cardio', 'Machine', 'cardio'],
  ['marche', 'Marche', 'Cardio', 'Autre', 'cardio'],
  ['natation', 'Natation', 'Cardio', 'Autre', 'cardio'],
  ['corde_sauter', 'Corde à sauter', 'Cardio', 'Autre', 'time'],
  ['stairmaster', 'Escalier (stairmaster)', 'Cardio', 'Machine', 'time'],
].map(([id, name, muscle, equip, type]) => ({ id, name, muscle, equip, type: type || 'wr' }));

/* Programmes prêts à l'emploi : [exercice, séries, reps (ou secondes pour une durée)] */
const TEMPLATES = [
  { name: 'Full body débutant', desc: '3 fois par semaine, idéal pour commencer', ex: [
    ['squat_barre', 3, 8], ['dc_barre', 3, 8], ['rowing_barre', 3, 8],
    ['dm_halteres', 3, 10], ['curl_halteres', 2, 12], ['planche', 3, 30]] },
  { name: 'Push (poussée)', desc: 'Pectoraux, épaules, triceps', ex: [
    ['dc_barre', 4, 6], ['di_halteres', 3, 10], ['dm_halteres', 3, 10],
    ['elev_lat', 3, 15], ['ext_corde', 3, 12], ['barre_front', 3, 10]] },
  { name: 'Pull (tirage)', desc: 'Dos, arrière des épaules, biceps', ex: [
    ['tractions', 4, 8], ['rowing_barre', 3, 8], ['tirage_vertical', 3, 10],
    ['face_pull', 3, 15], ['curl_barre', 3, 10], ['curl_marteau', 3, 12]] },
  { name: 'Legs (jambes)', desc: 'Quadriceps, ischios, fessiers, mollets', ex: [
    ['squat_barre', 4, 6], ['sdt_roumain', 3, 8], ['presse', 3, 12],
    ['leg_curl_allonge', 3, 12], ['leg_ext', 3, 15], ['mollets_debout', 4, 15]] },
  { name: 'Haut du corps', desc: 'Programme Haut / Bas, séance A', ex: [
    ['dc_barre', 4, 6], ['rowing_barre', 4, 8], ['dm_halteres', 3, 10],
    ['tirage_vertical', 3, 10], ['curl_halteres', 3, 12], ['ext_corde', 3, 12]] },
  { name: 'Bas du corps', desc: 'Programme Haut / Bas, séance B', ex: [
    ['squat_barre', 4, 6], ['sdt_roumain', 3, 8], ['fentes_halteres', 3, 10],
    ['leg_curl_assis', 3, 12], ['mollets_debout', 4, 15], ['releve_jambes', 3, 12]] },
  { name: 'Maison sans matériel', desc: 'Juste le poids du corps', ex: [
    ['pompes', 4, 15], ['squat_pdc', 4, 20], ['fentes_pdc', 3, 12],
    ['dips_banc', 3, 12], ['pont_fessier', 3, 15], ['planche', 3, 45], ['burpees', 3, 10]] },
];
