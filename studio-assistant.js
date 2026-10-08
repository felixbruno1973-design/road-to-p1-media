/* First-step automatic montage assistant: local, metadata-only suggestions.
   Visual action recognition and MP4 export are not available yet. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__TAURI__?.core?.invoke) return;
    const studio=document.querySelector('#view-studio');
    if (!studio) return;
    const panel=document.createElement('section');
    panel.className='panel';
    panel.style.cssText='padding:18px;margin-bottom:14px';
    const heading=document.createElement('h3');
    heading.textContent='Assistant vidéo — donne ton objectif';
    const explanation=document.createElement('p');
    explanation.textContent='Prototype : recherche les vidéos par nom sur le disque USB et tente de générer un MP4 local avec FFmpeg. Ne reconnaît pas encore les actions filmées ; FFmpeg doit être installé.';
    const prompt=document.createElement('textarea');
    prompt.rows=3;prompt.style.cssText='width:100%;min-height:80px';
    prompt.placeholder='Fais-moi un Reel de 45 secondes de Lara à Annéville 2026.';
    prompt.setAttribute('aria-label','Ton objectif de montage vidéo');
    const action=document.createElement('button');
    action.className='btn primary';action.type='button';
    action.textContent='Créer mon premier montage MP4';
    const result=document.createElement('p');
    result.setAttribute('role','status');
    let waiting=false;
    const engine=document.createElement('p');
    engine.setAttribute('role','status');
    engine.textContent='Vérification du moteur vidéo…';
    window.__TAURI__.core.invoke('check_video_engine').then(status=>{
      engine.textContent=status.ffmpegAvailable
        ?'Moteur MP4 disponible sur ce PC.'
        :'Moteur MP4 non disponible : FFmpeg devra être intégré à l’application avant de créer les vidéos.';
    }).catch(()=>{engine.textContent='Impossible de vérifier le moteur vidéo.';});
    action.addEventListener('click',()=>{
      const instruction=prompt.value.trim();
      if(!instruction){result.textContent='Décris le montage que tu souhaites.';return;}
      const seconds=/\b(\d{1,3})\s*(?:secondes?|sec|s)\b/i.exec(instruction);
      const targetSeconds=seconds?Math.min(600,Math.max(5,Number(seconds[1]))):45;
      const detail={instruction,targetSeconds,format:/youtube|horizontal|paysage/i.test(instruction)?'16:9':'9:16'};
      waiting=true;
      window.dispatchEvent(new CustomEvent('rtp1:montage-request',{detail}));
      result.textContent='Recherche du catalogue USB en cours…';
    });
    window.addEventListener('rtp1:montage-selection-result',async event=>{
      const info=event.detail;
      if(info?.message)result.textContent=info.message;
      if(!waiting||!info?.count)return;
      waiting=false;
      const paths=(info.items||[]).filter(x=>x.category==='Vidéo').slice(0,10).map(x=>x.relativePath);
      if(!paths.length){result.textContent='Aucune vidéo compatible trouvée pour le montage.';return;}
      const requested=/\b(\d{1,3})\s*(?:secondes?|sec|s)\b/i.exec(prompt.value);
      const targetSeconds=requested?Math.min(600,Math.max(5,Number(requested[1]))):45;
      action.disabled=true;
      result.textContent='Sélection de '+paths.length+' vidéo(s). Choisis où enregistrer le MP4, puis attends le rendu local…';
      try{
        const output=await window.__TAURI__.core.invoke('render_auto_montage',{
          request:{relativePaths:paths,targetSeconds}
        });
        result.textContent=output?'Montage enregistré : '+output:'Enregistrement annulé.';
      }catch(error){
        result.textContent='Rendu MP4 non terminé : '+String(error)+'. Vérifie notamment que FFmpeg est installé.';
      }finally{action.disabled=false;}
    });
    panel.append(heading,explanation,engine,prompt,action,result);
    studio.prepend(panel);
  });
})();
