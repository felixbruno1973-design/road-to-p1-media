# Build Windows — ROAD TO P1 Media (prototype USB)

## Prérequis

Windows 10/11, Node.js 20+, Rust stable (toolchain MSVC), Microsoft C++ Build Tools et WebView2 Runtime. Installer les prérequis Tauri 2 avant de compiler.

## Commandes

```powershell
git switch feature/local-usb-video-engine
npm test
npm run check
npm run desktop:prepare
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri build
```

**Note :** si `cargo tauri` est inconnu, installer le CLI Tauri version 2 avec `cargo install tauri-cli --version "^2" --locked`.

Le contenu du navigateur à emballer est produit dans `desktop-dist/` et ne comprend pas les sources Rust, les tests ni le dépôt Git.

## Vérification manuelle

1. Lancer l'application Windows sur le même PC que le disque USB.
2. Dans Library, cliquer « Choisir un dossier du disque USB ».
3. Sélectionner un petit dossier de test (images + vidéos).
4. Vérifier noms, décompte, tailles et absence de modification des originaux.
5. Fermer puis relancer l'application : **le catalogue USB de ce prototype n'est pas encore sauvegardé**.
6. Vérifier dans la version web que le nouveau panneau est **absent** et que l'import IndexedDB fonctionne comme auparavant.

## Limites actuelles

- Le scanner natif parcourt le dossier synchroniquement et renvoie jusqu'à 500 000 métadonnées en une fois. Pour une grande vidéothèque, prévoir tâche asynchrone, pagination et SQLite avant le déploiement.
- Les fichiers USB ne sont pas encore visibles dans le navigateur de médias Studio ; aucun rendu FFmpeg.
- L'identification des karts et la sélection IA ne sont pas développées.
- Ne pas fusionner sur `main` avant tests.
