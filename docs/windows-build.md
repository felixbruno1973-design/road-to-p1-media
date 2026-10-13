# Road to P1 Media Windows — test USB 0.1.1

Le travail reste sur `feature/local-usb-video-engine`. Aucun workflow ne fusionne cette branche dans `main` et aucun média local n'est envoyé à GitHub.

## Télécharger l'installateur

Dans [GitHub Actions](https://github.com/felixbruno1973-design/road-to-p1-media/actions/workflows/windows-desktop.yml), ouvrir une exécution **Windows installer** réussie correspondant au commit à tester. Le résumé contient le lien **Télécharger l’installateur Windows**. L'archive `road-to-p1-media-windows-<commit>` contient le `.exe`, `SHA256SUMS.txt` et `BUILD.txt` (commit et exécution). Les artefacts sont conservés 30 jours ; GitHub peut demander une connexion.

Les push sur la branche expérimentale lancent la compilation. Un lancement manuel est aussi possible avec `workflow_dispatch` lorsque le workflow est accessible dans l'interface GitHub. L'installateur n'est publié que si les tests JavaScript, les tests natifs, le rendu natif de 60 secondes et la compilation réussissent.

## Test depuis Soucy

1. Installer puis ouvrir Road to P1 Media sur Windows 10/11 x64.
2. Dans Library, choisir le dossier Soucy du disque USB. Le catalogue reste temporaire pour cette session.
3. Dans Studio, saisir « Fais-moi un montage de 60 secondes depuis Soucy » puis créer le montage. La durée par défaut est 60 s ; « horizontal » produit du 1920 × 1080, sinon le rendu est vertical 1080 × 1920, à 30 images/s.
4. Choisir **un nouveau nom** dans un dossier situé en dehors des médias sources. Les fichiers existants ne sont jamais écrasés.
5. Vérifier le MP4 et le fichier voisin `<nom>.project.json` : ce dernier conserve les références répétées, l'ordre, les entrées/sorties effectivement utilisées, le son et les éventuelles prolongations d'image.

Le son de la première piste audio de chaque vidéo est conservé et réencodé en AAC stéréo. Les photos et vidéos muettes reçoivent du silence. Si une coupe est plus courte que sa place dans le montage, la dernière image est prolongée et le complément audio reste silencieux. Un point d'entrée hors de la vidéo est refusé ; il n'est pas déplacé silencieusement.

Les scènes vérifiées dans Library priment sur la sélection par noms. L'identification d'objets reste indicative : elle ne prouve pas une conversation, une opération mécanique ni l'identité d'un pilote. Les originaux sont uniquement lus, les intermédiaires sont temporaires et la sortie est vérifiée avant son enregistrement.

## Compiler et tester localement

Prérequis : Node.js 22, Rust stable MSVC, Microsoft C++ Build Tools, WebView2 et FFmpeg/FFprobe. Le CLI Tauri est une dépendance npm verrouillée ; aucune installation globale n'est nécessaire.

```powershell
npm ci
npm run check
npm test
npm run desktop:model
npm run desktop:prepare
# Placer les vrais binaires ffmpeg.exe et ffprobe.exe dans src-tauri/resources/.
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml renders_sixty_seconds -- --ignored --nocapture
$env:RTP1_FFMPEG = (Resolve-Path src-tauri/resources/ffmpeg.exe).Path
$env:RTP1_FFPROBE = (Resolve-Path src-tauri/resources/ffprobe.exe).Path
node --test tests/render-integration.test.mjs
npm run desktop:build
```

Le téléchargement du modèle a lieu pendant la préparation, puis le modèle et les moteurs vidéo sont inclus dans l'application. La compilation CI installe FFmpeg et copie ses exécutables réels. La sortie NSIS se trouve dans `src-tauri/target/release/bundle/nsis/`.

## Limites du prototype

- Le catalogue et les classifications manuelles ne sont pas restaurés au redémarrage ; exporter le projet pour conserver les coupes.
- La progression détaillée et l'annulation d'un rendu natif ne sont pas encore disponibles.
- L'assistant natif accepte jusqu'à 30 références de médias et 5 à 600 secondes ; les photos compatibles sont JPG, PNG et WebP.
- L'installateur de test n'est pas signé avec un certificat éditeur. Le workflow ne publie aucune version stable.
