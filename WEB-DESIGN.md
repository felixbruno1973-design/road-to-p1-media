# Web Design — version 1.1.0

1. Connecter Media avec le code d’accès existant.
2. Choisir la page et l’affichage, puis dicter ou saisir la demande en français.
3. Générer le brouillon : le Worker lit l’état réel et repère les blocs à partir des textes visibles, de leurs parents et de leur ordre. Aucune connaissance de la structure n’est attendue de l’utilisateur. Une demande comme « réduis cet espace » peut donner lieu à une proposition mesurée, à vérifier dans l’aperçu. Si plusieurs cibles sont réellement plausibles, une question porte sur ce qui est visible ; le champ « Votre précision » permet de répondre sans perdre la demande initiale.
4. Examiner les différences et l’aperçu avant/après. Cocher la validation puis cliquer sur **Valider et publier**.
5. Le serveur vérifie à nouveau la version, sauvegarde l’original et applique le brouillon. L’historique permet d’annuler tant que la page n’a pas changé depuis.

Les brouillons sont privés, stockés dans WordPress et valables une heure. Les sauvegardes de publication restent conservées après expiration. Le navigateur conserve seulement l’identifiant du brouillon ; le code d’accès reste en mémoire.

## Architecture et déploiement

- Interface statique : `index.html`, `app.js`, `style.css`, `web-design.js`, `web-design.css`. Pages publie seulement ces fichiers. Reports et Media Training conservent leurs données locales.
- Worker existant `road-to-p1-media-api` : `worker/index.js`, `worker/wrangler.toml`. Les anciennes routes de publication directe sont désactivées.
- Extension WordPress : `wordpress/rtp1-media/rtp1-media.php`. Installer le dossier ZIP et activer l’extension avant le Worker et l’interface.
- Réutilise l’utilisateur WordPress existant, qui doit pouvoir modifier/publier les pages et éditer la page concernée.
- Cloudflare conserve `WP_USERNAME`, `WP_APP_PASSWORD`, `WP_URL`. Migrer le code de publication existant dans le secret `WRITE_KEY`. Aucun secret dans GitHub.
- Relier **Workers AI**, liaison `AI`. Modèles : `@cf/meta/llama-3.3-70b-instruct-fp8-fast` et `@cf/openai/whisper-large-v3-turbo`. Aucune clé OpenAI requise. Respecter le quota du compte ; ne pas activer de forfait payant automatiquement.
- `OPENAI_API_KEY` facultative active Responses (`OPENAI_MODEL`, défaut `gpt-4.1-mini`) et transcription (`TRANSCRIPTION_MODEL`, défaut `gpt-4o-mini-transcribe`).

## Protections

- Authentification sur toutes les routes de données, analyse, dictée et écriture ; contrôle d’origine ; aucune identité WordPress dans le diagnostic public.
- Plans structurés uniquement. WordPress revalide les identifiants, types, unités et opérations. Le navigateur ne fournit jamais le contenu à publier.
- Les définitions identiques de réglages sont partagées dans le contexte d’analyse, sans perdre de valeurs. Une proposition refusée par le validateur peut être corrigée une seule fois avec les réglages réellement disponibles. Un conflit ou une erreur de connexion ne déclenche jamais cette correction automatique.
- Pour un affichage précis, le catalogue d’analyse ne propose que ses contrôles ; les valeurs héritées et les styles restent disponibles pour comprendre la page. Une question technique déclenche une nouvelle analyse interne, dans la limite de deux analyses par demande. Une question technique persistante est remplacée par une question portant sur les textes visibles. Les protections de publication restent indépendantes de l’IA.
- Empreinte incluant Elementor, réglages de page, titre, contenu, statut et dates, vérifiée sous verrous de lignes InnoDB au moment de l’écriture.
- Écriture et reçu de sauvegarde dans une seule transaction. Sans stockage transactionnel, publication bloquée.
- Publication et annulation idempotentes. Après interruption réseau, relire l’historique plutôt que réécrire.
- Retour arrière sur la sauvegarde exacte, bloqué après une modification concurrente.
- Aucun enregistrement de la page lors du brouillon ou de l’aperçu. L’aperçu reprend le DOM public et génère le CSS Elementor en mémoire. Iframe sandboxée, sans scripts, formulaires ni navigation.
- Régénération du CSS Elementor et purge WP-Optimize après écriture. Une erreur de cache est un avertissement distinct d’un échec d’écriture.
- Audio : 8 Mo maximum, 60 secondes dans l’interface. Analyse et transcription : 30 demandes par heure et par compte WordPress.

## Périmètre

Textes des widgets natifs heading/button/text-editor, liens HTTPS ou ancres, couleurs, tailles, marges, espacements, alignements et visibilité lorsque le contrôle Elementor existe. Pour les widgets HTML de l’accueil : remplacement d’un texte unique et ajout de styles à propriétés/sélecteurs limités. Les styles HTML mobiles utilisent ≤767 px, tablette 768–1024 px, ordinateur ≥1025 px ; ces limites sont indiquées dans l’aperçu.

Pas de JavaScript/PHP, HTML libre, modèles globaux ni restructuration arbitraire de blocs. Les valeurs globales/dynamiques sont protégées. L’aperçu est statique ; animations et widgets interactifs désactivés. Un contenu sans aperçu précis bloque la publication.

## Vérifications

```
npm run check
npm test
php -l wordpress/rtp1-media/rtp1-media.php
php tests/backend.php
```

La suite PHP utilise SQLite pour tester transactions et états avec le code de l’extension. Elle ne remplace pas un test de concurrence sur MySQL/InnoDB. Les tests n’écrivent pas sur road-to-p1.com.

Vérification en ligne le 19 septembre 2026 : connexion, liste des pages, historique, génération d’un brouillon réel pour l’accueil et aperçu isolé. Espacement supérieur mesuré dans l’aperçu : mobile 120 → 80 px ; tablette 120 → 120 px ; ordinateur 150 → 150 px. Publication désactivée avant aperçu et tant que la validation n’est pas cochée. Aucun changement éditorial publié pendant ces tests. Publication, sauvegarde et retour arrière vérifiés avec la suite PHP ; dictée au microphone et écriture sur le site réel restent à vérifier lors d’une utilisation explicitement validée.

Documentation : [Cloudflare JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/), [Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/), [WordPress REST](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/), [Elementor CSS](https://github.com/elementor/elementor/blob/main/core/files/css/post.php), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
