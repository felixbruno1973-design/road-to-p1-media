# Premier export MP4 local (prototype expérimental)

Le programme `scripts/render-local-mp4.mjs` transforme un fichier JSON exporté depuis Studio USB en MP4 vertical H.264, sur un ordinateur possédant FFmpeg et Node.js. Il ne nécessite pas de cloud.

Exemple PowerShell après installation de FFmpeg :

```powershell
node scripts/render-local-mp4.mjs --project C:\\Temp\\road-to-p1-montage-projet.json --root E:\\Karting --output C:\\Temp\\reel.mp4
```

Limites **importantes** : pas encore relié au bouton Studio ni empaqueté dans l'installateur Tauri ; pas de musique, transitions, ralentis, découpe intelligente ou analyse IA. Le prototype répartit la durée cible également entre les médias et supprime pour l'instant l'audio des clips. Une vidéo source trop courte pourra produire un montage plus court que prévu. Aucun original n'est modifié ; les segments temporaires sont créés hors du disque USB et nettoyés à la fin.

Avant la mise à disposition de cette fonction dans l'application Windows : contrôle FFprobe de la durée et des codecs ; streaming des longues vidéos ; annulation et progression ; durée par clip ; validation du projet natif ; choix d'une sortie autorisée et tests d'intégration avec de vrais médias de démonstration.
