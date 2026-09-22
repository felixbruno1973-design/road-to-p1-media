# ROAD TO P1 Media Cloud

Backend V2.2 pour synchroniser Library entre plusieurs appareils.

## Ressources Cloudflare

1. Créer un bucket R2 nommé `road-to-p1-media`.
2. Créer une base D1 nommée `road-to-p1-media`.
3. Copier `wrangler.toml.example` vers `wrangler.toml` et renseigner l'identifiant D1.
4. Appliquer `schema.sql` à D1.
5. Définir un secret Worker `AUTH_SECRET`.
6. Déployer le Worker.
7. Dans Media > Library > Configurer la synchronisation cloud, saisir l'URL du Worker et la même clé d'accès.

Le secret n'est jamais commité dans GitHub. Le navigateur envoie les vidéos en morceaux de 8 Mio vers l'API Worker, qui utilise les multipart uploads R2. Les métadonnées sont stockées dans D1.

Pour une version destinée à plusieurs utilisateurs externes, remplacer le secret partagé par une vraie authentification (Cloudflare Access, OAuth ou jetons courts).
