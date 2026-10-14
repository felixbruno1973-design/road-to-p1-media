# ROAD TO P1 MEDIA — Moteur local USB / montage IA

Statut : **architecture de référence, phase 0**. Cette branche ne change pas encore le comportement de Media V2.4.

## État constaté (code actuel)

- Interface existante : `index.html`, `style.css`, `app.js` (HTML/CSS/JavaScript sans React).
- Studio : storyboard, séquences réordonnables, transitions, durées individuelles, rendu navigateur et annulation.
- Library : magasin IndexedDB `roadToP1MediaLibraryV2` / `assets`. Des fichiers sont copiés dans le stockage de l'application web ; ce n'est **pas** un catalogue de références externes.
- Scripts existants : `npm test` et `npm run check` ; les conserver inchangés.

## Architecture retenue

1. **Tauri 2** encapsule l'interface existante, avec accès aux dossiers explicitement autorisés par l'utilisateur.
2. **Service natif local (Rust)** : indexation incrémentale en lecture seule, chemins canoniques, empreinte rapide (taille / date), identification du volume et détection de disparition du disque.
3. **SQLite locale** sur disque interne : références de médias et métadonnées (pas les blobs d'origine). FTS5 pour texte libre si disponible.
4. **FFprobe** : durée, codecs, dimensions, FPS et audio ; **FFmpeg** : proxies, découpes et exports, via appels natifs contrôlés sans shell ni arguments utilisateur arbitraires.
5. **Studio** conserve son mode navigateur et ajoute un mode `Rendu local` avec job, progression, annulation et reprise.
6. **Assistant IA** produit exclusivement un plan de montage structuré validé et modifiable ; ne reçoit jamais de chemin système ni d'accès brut aux fichiers. Analyse locale par défaut ; tout envoi distant demande opt-in spécifique.

### Flux

`USB (lecture seule) → indexeur natif → SQLite / cache interne → Library → Studio → plan JSON validé → FFmpeg → MP4`.

## Sécurité et intégrité

- Sélection explicite d'un répertoire racine dans le dialogue natif.
- Rejet des traversées `..`, liens symboliques sortants, chemins hors racine et types non autorisés.
- Le disque externe reste en lecture seule ; caches, projets et exports sur le disque interne.
- Ne pas exposer d'API HTTP ouverte sur le réseau local. Favoriser les commandes IPC Tauri.
- Les originaux ne sont jamais supprimés / déplacés lors de suppressions depuis Library.
- L'identité logique du support ne repose pas uniquement sur la lettre du lecteur Windows.
- Si USB absent : catalogue consultable mais média indisponible, export bloqué proprement.
- Respect des licences des musiques ; aucune publication automatique.

## Modèle de données minimal

```sql
CREATE TABLE media_sources (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  volume_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES media_sources(id),
  relative_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('video','image','audio')),
  file_size INTEGER NOT NULL,
  modified_at TEXT NOT NULL,
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  fps_num INTEGER,
  fps_den INTEGER,
  status TEXT NOT NULL DEFAULT 'available',
  UNIQUE (source_id, relative_path)
);
CREATE TABLE edit_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  edit_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## API native planifiée

- `select_media_folder()` : autorisation de la racine.
- `scan_media_source(source_id)` : scan récursif incrémental, progression.
- `list_media(filters, cursor)` : pagination locale.
- `probe_media(asset_id)` : FFprobe contrôlé.
- `create_proxy(asset_id, profile)` : proxy dans cache interne.
- `render_project(project_id, output_profile)` : rendu avec validation du plan.
- `get_job(job_id)`, `cancel_job(job_id)` : état et annulation.

Ne jamais faire remonter des chemins système absolus à l'IA : elle référence uniquement des `asset_id`.

## Contrat du plan de montage

Voir `docs/local-edit-plan.example.json`. Chaque clip fait référence à un média indexé, à des points d'entrée/sortie valides et à un profil de sortie. Les valeurs sont revalidées nativement avant toute commande FFmpeg.

## Phases et critères d'acceptation

**P1 — Bibliothèque USB** : ouvrir un dossier USB, indexer sans copier les originaux, consulter/filtrer, rebrancher avec une autre lettre, conserver les anciens médias IndexedDB.

**P2 — Rendu local** : monter 3 vidéos et 2 photos depuis l'USB, exporter H.264/AAC en 1080×1920, afficher progression, pouvoir annuler, ne jamais altérer les sources.

**P3 — Prompt** : transformer consigne en plan éditable ; aucune sélection IA ne part à l'export sans confirmation.

**P4 — Vision karting** : classement de moments prometteurs puis validation humaine des dépassements, pilotes et circuits. Pas de promesse de reconnaissance parfaite.

## Points à vérifier sur un PC Windows avant déploiement

- Versions Windows et dépendances du runtime WebView2.
- Permissions USB, volume de médias, codecs réels et performance disque/cache.
- Packaging/licences FFmpeg et politique de mises à jour.
- Chemin réel de déploiement du site existant et sauvegarde d'IndexedDB.
- Couverture des tests de non-régression Studio/Library/Reports/Media Training.

## Important

Ce document est une base technique concrète. **Il n'installe pas le moteur sur le PC et ne connecte pas encore le disque USB.** Les tâches P1-P4 exigent du code, un build Windows et une validation locale.
