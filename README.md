# ROAD TO P1 Media — V2.2

ROAD TO P1 Media est organisé autour de quatre modules complémentaires :

- **Studio** : création de posts, stories, reels, scripts vidéo, annonces avant-course et contenus partenaires à partir des ressources disponibles.
- **Reports** : rapports de course, bilans partenaires, bilans mensuels ou de saison et communiqués structurés.
- **Media Training** : bases de la communication, simulations médias, Culture automobile niveau expert et entretien vocal « Improve Your English ».
- **Library** : bibliothèque centrale de photos, vidéos, logos et documents, utilisable en stockage local ou via une API Cloudflare R2 + D1.

## Media Training V2.2 — Culture automobile expert

Le quiz léger de V2.1 devient un véritable parcours d'apprentissage :

- 8 thèmes : histoire automobile, Formule 1, endurance/Le Mans, rallye/WRC, technique/dynamique, karting, circuits et grandes figures, sécurité.
- 40 questions réparties en niveaux **Confirmé**, **Expert** et **Pro**.
- Après chaque réponse : justification, résumé historique ou technique, points à retenir, explication des mauvaises propositions, question d'oral et source ouverte.
- Suivi de la maîtrise par thème et mémorisation des notions déjà acquises.
- Les données V2.1 restent compatibles.

## Library V2.2 — multi-appareils

La Library conserve le mode IndexedDB local par défaut. La V2.2 ajoute un client cloud optionnel :

- **Cloudflare R2** pour les fichiers (photos, vidéos, logos, documents).
- **Cloudflare D1** pour le catalogue et les métadonnées.
- Upload multipart par morceaux pour mieux supporter les vidéos volumineuses.
- Aucun secret R2 n'est intégré au code public de l'application.
- Si le cloud est indisponible, l'application retombe sur la Library locale.

Le backend prêt à déployer se trouve dans `cloud/` :

- `cloud/worker.js` : API Worker sécurisée.
- `cloud/schema.sql` : schéma D1.
- `cloud/wrangler.toml.example` : exemple de configuration R2/D1.
- `cloud/README.md` : procédure de mise en service.

> Tant que le Worker Cloudflare n'est pas déployé et configuré dans l'interface, la Library continue de fonctionner en mode local.

## Media Training

Les six leçons de communication et les simulations médias FR/EN sont conservées. Improve Your English utilise toujours la reconnaissance et la synthèse vocales du navigateur ; l'interface reste préparée pour une future connexion sécurisée à OpenAI Realtime pour des relances réellement génératives.
