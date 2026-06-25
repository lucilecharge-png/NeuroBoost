export const MIGRATIONS: string[] = [
  // v1 — schéma complet NeuroBoost
  `
  -- Profil du joueur (singleton, id = 1)
  CREATE TABLE profil (
    id                   INTEGER PRIMARY KEY DEFAULT 1,
    pseudo               TEXT NOT NULL DEFAULT 'Héros',
    niveau               INTEGER NOT NULL DEFAULT 1,
    xp                   INTEGER NOT NULL DEFAULT 0,
    xp_prochain_niveau   INTEGER NOT NULL DEFAULT 100,
    neurocoins           INTEGER NOT NULL DEFAULT 0,
    streak_jours         INTEGER NOT NULL DEFAULT 0,
    derniere_connexion   TEXT,
    avatar_emoji         TEXT NOT NULL DEFAULT '🧠',
    total_taches_terminees INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO profil (id) VALUES (1);

  -- Tâches / Quêtes
  CREATE TABLE taches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    titre            TEXT NOT NULL,
    description      TEXT,
    niveau_energie   TEXT NOT NULL DEFAULT 'faible'
                     CHECK (niveau_energie IN ('micro', 'faible', 'moyenne', 'haute')),
    duree_estimee_min INTEGER NOT NULL DEFAULT 5,
    xp_recompense    INTEGER NOT NULL DEFAULT 15,
    coins_recompense INTEGER NOT NULL DEFAULT 7,
    statut           TEXT NOT NULL DEFAULT 'active'
                     CHECK (statut IN ('active', 'en_cours', 'terminee', 'ignoree')),
    categorie        TEXT,
    est_mission_jour INTEGER NOT NULL DEFAULT 0,
    completee_le     TEXT,
    cree_le          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX idx_taches_statut ON taches(statut);
  CREATE INDEX idx_taches_mission ON taches(est_mission_jour);

  -- Sessions Focus
  CREATE TABLE sessions_focus (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    tache_id         INTEGER REFERENCES taches(id),
    duree_prevue_min INTEGER NOT NULL,
    duree_reelle_min INTEGER,
    completee        INTEGER NOT NULL DEFAULT 0,
    debut_le         TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    fin_le           TEXT
  );

  -- Achievements (seedés)
  CREATE TABLE achievements (
    id          TEXT PRIMARY KEY,
    titre       TEXT NOT NULL,
    description TEXT NOT NULL,
    icone       TEXT NOT NULL,
    xp_bonus    INTEGER NOT NULL DEFAULT 0,
    debloque_le TEXT
  );

  INSERT INTO achievements (id, titre, description, icone, xp_bonus) VALUES
    ('premier_pas',   'Allumage',              'La première tâche. La plus difficile. Toujours. Bravo.', '🔑', 50),
    ('momentum',      'État de Flow',          'Ton cerveau TDAH en hyperfocus : 3 tâches en une seule journée.', '⚡', 100),
    ('micro_hero',    'Petit Format, Grand Impact', '10 micro-tâches. La preuve que le démarrage bat la perfection.', '🎯', 75),
    ('chrysalide',    'Protocole 2 Minutes',   '5 fois tu as choisi de commencer malgré l''inertie. C''est le vrai skill.', '🦋', 50),
    ('semaine_feu',   'Signal Stable',         '7 jours consécutifs. Pas parfaits — constants. C''est ce qui recâble un cerveau.', '📡', 200),
    ('debloqueur',    'Hack d''Inertie',       'Tu as bloqué. Tu as recommencé quand même. La compétence la plus rare.', '🔓', 100),
    ('chasseur',      'Rafale Neurale',        '3 missions en un seul jour. Le cerveau TDAH peut tout — par sprints.', '🌊', 150),
    ('niveau_5',      'Synapse+',              'Niveau 5. Chaque tâche complétée renforce tes connexions neurales.', '🧬', 100),
    ('collecteur',    'Banque Neuro',          '100 NeuroCoins accumulés. Chaque micro-effort a laissé une trace.', '💎', 50),
    ('inventeur',     'Vide-Cerveau Pro',      '10 captures. Tu externalises enfin ce que ta tête portait seule.', '🗂️', 75),
    ('niveau_10',     'Recâblage',             'Niveau 10. Le TDAH peut être une force. Le tien le prouve maintenant.', '🧠', 300),
    ('marathon',      'Hyperfocus',            '30 min de focus continu. Tu as transformé ton TDAH en superpower.', '🔬', 150),
    ('semaine_feu_2', 'Mise en Orbite',        '30 jours. Tu n''essaies plus. Tu es devenu quelqu''un qui le fait.', '🛸', 500);

  -- Énergie quotidienne
  CREATE TABLE energie_jour (
    date_entree   TEXT PRIMARY KEY,
    niveau        INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 5)
  );

  -- Captures rapides
  CREATE TABLE captures (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    texte                TEXT NOT NULL,
    transformee_en_tache INTEGER NOT NULL DEFAULT 0,
    tache_id             INTEGER REFERENCES taches(id),
    cree_le              TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- Récompenses personnalisées
  CREATE TABLE recompenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    titre       TEXT NOT NULL,
    cout_coins  INTEGER NOT NULL,
    icone       TEXT NOT NULL DEFAULT '🎁',
    utilisee    INTEGER NOT NULL DEFAULT 0
  );

  -- Récompenses exemples
  INSERT INTO recompenses (titre, cout_coins, icone) VALUES
    ('5 min de doomscrolling assumé', 10, '📲'),
    ('Pause étirement — juste s''allonger 5 min', 10, '🛋️'),
    ('Un café ou thé préparé lentement', 15, '☕'),
    ('Écouter une chanson en pleine conscience', 15, '🎧'),
    ('Regarder une vidéo YouTube sans timer', 20, '▶️'),
    ('15 min de réseaux sociaux sans culpabilité', 20, '📱'),
    ('Pause snack — ce que tu veux', 20, '🍫'),
    ('Appel ou message à quelqu''un qui te manque', 25, '💬'),
    ('30 min de jeu vidéo', 30, '🎮'),
    ('Sieste ou repos les yeux fermés — 20 min', 30, '😴'),
    ('Bain ou douche longue sans se presser', 35, '🛁'),
    ('Épisode de série', 50, '🎬'),
    ('Commande un repas que tu aimes', 60, '🍕'),
    ('Après-midi sans obligation', 80, '🌅'),
    ('Sortie ou activité plaisir de ton choix', 100, '🎉'),
    ('Un achat plaisir — budget à toi de fixer', 150, '🛍️');
  `,

  // v2 — Coaching (10 lois + bilan de vie)
  `
  ALTER TABLE taches ADD COLUMN est_pivot INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE affirmations (
    date_entree TEXT PRIMARY KEY,
    texte       TEXT NOT NULL
  );

  CREATE TABLE victoires (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date_entree TEXT NOT NULL,
    texte       TEXT NOT NULL
  );

  CREATE TABLE matrice_controle (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    texte TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('controle', 'non_controle'))
  );

  CREATE TABLE sandbox_reves (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    texte           TEXT NOT NULL,
    action_extraite TEXT,
    tache_id        INTEGER REFERENCES taches(id)
  );

  CREATE TABLE capsules_temps (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    message        TEXT NOT NULL,
    date_ouverture TEXT NOT NULL,
    ouvert         INTEGER NOT NULL DEFAULT 0,
    cree_le        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE bilan_reponses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    reponse     TEXT NOT NULL,
    date_entree TEXT NOT NULL,
    UNIQUE(question_id, date_entree)
  );
  `,

  // v3 — Quêtes exemples issues des screenshots Notion (Maintenant/Après/Plus tard)
  `
  DELETE FROM taches WHERE statut IN ('active', 'en_cours');

  INSERT INTO taches (titre, description, niveau_energie, duree_estimee_min, xp_recompense, coins_recompense, categorie) VALUES
    ('Planifier 2 créneaux de deep work cette semaine',
     'Bloquer 2 plages horaires dans ton agenda pour du travail concentré.',
     'micro', 5, 5, 3, 'Organisation'),
    ('Préparer l''ordre du jour du point hebdo',
     'Lister les sujets à aborder, prioriser et partager l''ODJ avant la réunion.',
     'faible', 15, 15, 7, 'Réunion'),
    ('Relancer 3 prospects par email',
     'Rédiger et envoyer 3 emails de relance personnalisés à des prospects identifiés.',
     'faible', 20, 15, 7, 'Commercial'),
    ('Mettre à jour le tableau de suivi des KPI',
     'Renseigner les indicateurs clés de la semaine dans le tableau de bord.',
     'moyenne', 25, 30, 15, 'Pilotage'),
    ('Analyser les dépenses du mois et identifier 2 économies',
     'Passer en revue les dépenses du mois, repérer les postes à optimiser et proposer 2 économies.',
     'moyenne', 30, 30, 15, 'Finance'),
    ('Rédiger un brouillon de post LinkedIn (thème : productivité)',
     'Écrire un premier jet de post LinkedIn — accroche, contenu, call-to-action.',
     'moyenne', 35, 30, 15, 'Marketing'),
    ('Revoir et organiser les fichiers du drive (dossier "Admin")',
     'Trier, renommer et archiver les fichiers du dossier Admin dans Google Drive.',
     'haute', 60, 60, 30, 'Organisation');
  `,

  // v4 — Récompenses TDAH jeune adulte / adulte
  `
  INSERT INTO recompenses (titre, cout_coins, icone) VALUES
    ('Aller prendre l''air 10 min sans téléphone', 8, '🌿'),
    ('Danser sur 3 chansons — sans se juger', 10, '🕺'),
    ('Doodler librement — zéro objectif', 10, '✏️'),
    ('Faire une liste de tout ce qu''on rêve de faire', 10, '📋'),
    ('Scroll TikTok / Reels assumé — 15 min chrono', 15, '📲'),
    ('Moment cocooning : plaid + boisson chaude', 15, '🧸'),
    ('Écouter un épisode de podcast', 20, '🎙️'),
    ('Session jeu mobile sans culpabilité — 20 min', 20, '📱'),
    ('Commander un café ou une douceur en terrasse', 25, '☕'),
    ('Faire un tour à pied sans destination', 25, '🚶'),
    ('Appeler quelqu''un qui te fait du bien', 25, '📞'),
    ('Après-midi créativité libre — dessin, musique, écriture', 40, '🎨'),
    ('Séance ciné ou série en mode sieste-canapé', 50, '🍿'),
    ('Sortie spontanée — café, parc, musée, brocante', 60, '🗺️'),
    ('Une nuit sans alarme — dormir jusqu''au bout', 80, '🌙'),
    ('Achat plaisir coup de cœur — vêtement, livre, gadget', 120, '🛍️');
  `,

  // v5 — Revue hebdomadaire
  `
  CREATE TABLE IF NOT EXISTS revue_hebdo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semaine TEXT UNIQUE NOT NULL,
    reponses TEXT NOT NULL DEFAULT '[]',
    xp_attribue INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  `,

  // v6 — Pourquoi émotionnel (par tâche) + mode Journée Sans (par jour)
  `
  ALTER TABLE taches ADD COLUMN pourquoi TEXT;

  CREATE TABLE IF NOT EXISTS journee_sans (
    date_entree TEXT PRIMARY KEY
  );
  `,

  // v7 — Rendez-vous Fantômes (rendez-vous avec soi-même + notification native)
  `
  CREATE TABLE IF NOT EXISTS rendez_vous (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    titre    TEXT NOT NULL,
    moment   TEXT NOT NULL,
    notifie  INTEGER NOT NULL DEFAULT 0,
    cree_le  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  `,

  // v8 — Agenda : catégories, événements, exceptions de récurrence
  `
  CREATE TABLE categorie (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT NOT NULL,
    couleur     TEXT NOT NULL,
    emoji       TEXT,
    est_systeme INTEGER NOT NULL DEFAULT 0
  );

  INSERT INTO categorie (nom, couleur, emoji, est_systeme) VALUES
    ('Perso',   '#7c3aed', '🟣', 1),
    ('Travail', '#3b82f6', '🔵', 1),
    ('Santé',   '#10b981', '🟢', 1),
    ('Admin',   '#f59e0b', '🟡', 1);

  CREATE TABLE evenement (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titre        TEXT NOT NULL,
    debut        TEXT NOT NULL,
    fin          TEXT NOT NULL,
    all_day      INTEGER NOT NULL DEFAULT 0,
    categorie_id INTEGER REFERENCES categorie(id) ON DELETE SET NULL,
    description  TEXT,
    tache_id     INTEGER REFERENCES taches(id) ON DELETE SET NULL,
    recurrence   TEXT,
    rappel_min   INTEGER,
    source       TEXT NOT NULL DEFAULT 'local',
    google_id    TEXT,
    cree_le      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_evenement_debut ON evenement(debut);

  CREATE TABLE evenement_exception (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    evenement_id    INTEGER NOT NULL REFERENCES evenement(id) ON DELETE CASCADE,
    date_occurrence TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('supprimee','deplacee')),
    override_id     INTEGER REFERENCES evenement(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_exception_evenement ON evenement_exception(evenement_id);
  `,

  // v9 — Sous-tâches : relation parent/enfant
  `
  ALTER TABLE taches ADD COLUMN parent_id INTEGER REFERENCES taches(id) ON DELETE CASCADE;
  CREATE INDEX idx_taches_parent ON taches(parent_id);
  `,

  // v10 — Quêtes exemples supplémentaires : perso, travail, admin
  `
  INSERT INTO taches (titre, description, niveau_energie, duree_estimee_min, xp_recompense, coins_recompense, categorie) VALUES
    -- Perso / prendre soin de soi
    ('Boire un grand verre d''eau maintenant',
     'Petit geste pour le corps : un verre d''eau, tout de suite, avant de repartir.',
     'micro', 2, 5, 3, 'Perso'),
    ('Noter 3 trucs qui ont été bien aujourd''hui',
     'Trois petites victoires ou bons moments de la journée — même minuscules.',
     'micro', 5, 5, 3, 'Perso'),
    ('Préparer ses affaires pour demain matin',
     'Sortir les vêtements, le sac, le sport — pour démarrer la journée sans friction.',
     'faible', 10, 15, 7, 'Perso'),
    ('Ranger un coin qui traîne depuis trop longtemps',
     'Choisir UN endroit (bureau, table, étagère) et le remettre d''aplomb en une fois.',
     'moyenne', 25, 30, 15, 'Perso'),

    -- Travail
    ('Noter la première micro-action de la tâche qui fait peur',
     'Pas la tâche entière : juste la toute première action concrète de 2 minutes.',
     'micro', 5, 5, 3, 'Travail'),
    ('Vider sa boîte mail jusqu''à inbox zéro',
     'Traiter, archiver ou supprimer — l''objectif est une boîte de réception propre.',
     'faible', 20, 15, 7, 'Travail'),
    ('Avancer le dossier prioritaire pendant 25 min (1 Pomodoro)',
     'Un seul créneau de 25 minutes concentré sur le dossier le plus important. Pas plus.',
     'moyenne', 25, 30, 15, 'Travail'),
    ('Rédiger la première version d''un livrable important',
     'Un premier jet imparfait mais complet — on peaufinera plus tard.',
     'haute', 60, 60, 30, 'Travail'),

    -- Admin / paperasse
    ('Payer la facture en attente',
     'Régler la facture qui traîne, et la classer dans la foulée.',
     'micro', 5, 5, 3, 'Admin'),
    ('Prendre ou replanifier un rendez-vous (médecin, dentiste...)',
     'Le coup de fil ou la prise de RDV en ligne qu''on repousse depuis des semaines.',
     'faible', 10, 15, 7, 'Admin'),
    ('Classer les papiers et justificatifs du mois',
     'Trier, scanner si besoin et ranger les documents importants du mois.',
     'faible', 20, 15, 7, 'Admin'),
    ('Faire le point sur les abonnements et en résilier 1',
     'Lister les abonnements en cours, repérer l''inutile et en résilier au moins un.',
     'moyenne', 30, 30, 15, 'Admin');
  `
]
