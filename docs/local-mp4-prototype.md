# Export MP4 local et conservation des coupes

Le bouton de l'assistant Studio utilise le moteur natif Tauri avec FFmpeg et FFprobe inclus dans l'installateur. Il produit un MP4 H.264 avec audio AAC et un fichier `.project.json` décrivant le montage réellement rendu.

Le script Node `scripts/render-local-mp4.mjs` permet aussi de rendre un projet exporté, sans réseau :

```powershell
node scripts/render-local-mp4.mjs --project "C:\Exports\projet.json" --root "E:\Karting\Soucy" --output "C:\Exports\soucy-60.mp4" --ffmpeg "C:\Tools\ffmpeg.exe" --ffprobe "C:\Tools\ffprobe.exe"
```

Les entrées/sorties et les références répétées sont conservées. `durationMs` définit la place dans la timeline ; `inMs` et `outMs` définissent l'extrait source. Une source ou coupe trop courte est complétée par une image fixe et du silence. Le son original des extraits est conservé, les plans muets et photos reçoivent une piste silencieuse compatible. L'audio des intermédiaires reste PCM pour éviter d'accumuler des délais d'encodage AAC à chaque coupe ; le montage final est encodé une fois en AAC.

La sortie doit être nouvelle, en dehors du dossier source. Les originaux ne sont jamais modifiés, les intermédiaires sont nettoyés et une sortie dont la durée diffère de plus de 150 ms de la cible n'est pas enregistrée. Le projet voisin conserve les entrées/sorties réellement utilisées et la durée de prolongation éventuelle.

Ce moteur ne génère pas de musique ni de transitions. Les sélections par noms et les détections d'objets restent à vérifier par une personne. Voir [la procédure Windows](windows-build.md) pour l'installation, les tests et les limites.
