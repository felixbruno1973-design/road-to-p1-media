# ROAD TO P1 Media — V2.3

ROAD TO P1 Media est organisé autour de quatre modules complémentaires :

- **Studio** : création de posts, stories, reels, scripts vidéo, annonces avant-course et contenus partenaires à partir des ressources disponibles.
- **Reports** : rapports de course, bilans partenaires, bilans mensuels ou de saison et communiqués structurés.
- **Media Training** : bases de la communication, simulations médias, Culture automobile niveau expert et entretien vocal « Improve Your English ».
- **Library** : bibliothèque centrale locale de photos, vidéos, logos et documents, stockés directement sur l’appareil via IndexedDB.

## Studio V2.3

La V2.3 consolide l'atelier de montage vidéo local : choix de transition directement visible, prévisualisation des séquences, réordonnancement par glisser-déposer, suppression de séquences, durée réglable par plan, durée globale recalculée et annulation du rendu en cours. Les médias restent stockés localement dans la Library.

## Media Training — Culture automobile expert

Le quiz léger de V2.1 devient un véritable parcours d'apprentissage :

- 8 thèmes : histoire automobile, Formule 1, endurance/Le Mans, rallye/WRC, technique/dynamique, karting, circuits et grandes figures, sécurité.
- 40 questions réparties en niveaux **Confirmé**, **Expert** et **Pro**.
- Après chaque réponse : justification, résumé historique ou technique, points à retenir, explication des mauvaises propositions, question d'oral et source ouverte.
- Suivi de la maîtrise par thème et mémorisation des notions déjà acquises.
- Les données V2.1 restent compatibles.

## Library V2.2 — stockage local

La Library fonctionne désormais exclusivement en stockage local sur l’appareil utilisé.

Fonctions disponibles :

- classement par dossiers / événements ;
- recherche par nom, pilote, événement, tag ou catégorie ;
- tri par date, nom, type, taille ou pilote ;
- sélection individuelle par case à cocher ;
- bouton **Tout sélectionner / Tout désélectionner** ;
- suppression groupée des médias sélectionnés ;
- aperçu des images, vidéos et PDF ;
- détection améliorée du type des anciens fichiers lorsque le navigateur n’a pas enregistré correctement leur type MIME.

Les fichiers sont enregistrés directement dans IndexedDB sur l’appareil utilisé.

## Media Training

Les six leçons de communication et les simulations médias FR/EN sont conservées. Improve Your English utilise toujours la reconnaissance et la synthèse vocales du navigateur ; l'interface reste préparée pour une future connexion sécurisée à OpenAI Realtime pour des relances réellement génératives.
