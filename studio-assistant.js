/* Local desktop MP4 assistant. Visual action recognition is not yet available. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.__TAURI__?.core?.invoke) return;
    const studio=document.querySelector('#view-studio');
    if (!studio) return;
    const {montageRequest,renderRequest}=await import('./studio-project.mjs');
    const panel=document.createElement('section');
    panel.className='panel';
    panel.style.cssText='padding:18px;margin-bottom:14px';
    const heading=document.createElement('h3');
    heading.textContent='Assistant vidéo — donne ton objectif';
    const explanation=document.createElement('p');
    explanation.textContent='Montage MP4 local : sélectionne les vidéos du disque USB selon leurs noms et crée le clip sans transférer tes fichiers. La reconnaissance visuelle des actions reste à développer.';
    const prompt=document.createElement('textarea');
    prompt.rows=3;prompt.style.cssText='width:100%;min-height:80px';
    prompt.placeholder='Fais-moi un montage de 60 secondes depuis Soucy.';
    prompt.setAttribute('aria-label','Ton objectif de montage vidéo');
    const action=document.createElement('button');
    action.className='btn primary';action.type='button';
    action.textContent='Créer mon premier montage MP4';
    const result=document.createElement('p');
    result.setAttribute('role','status');
    let waiting=false, pending=null;
    const engine=document.createElement('p');
    engine.setAttribute('role','status');
    engine.textContent='Vérification du moteur vidéo…';
    window.__TAURI__.core.invoke('check_video_engine').then(status=>{
      engine.textContent=status.ffmpegAvailable && status.ffprobeAvailable
        ?'Moteur MP4 disponible sur ce PC.'
        :'Moteur MP4 non disponible : FFmpeg devra être intégré à l’application avant de créer les vidéos.';
    }).catch(()=>{engine.textContent='Impossible de vérifier le moteur vidéo.';});
    action.addEventListener('click',()=>{
      const instruction=prompt.value.trim();
      if(!instruction){result.textContent='Décris le montage que tu souhaites.';return;}
      if(waiting||action.disabled)return;
      const detail=montageRequest(instruction);
      pending=detail;
      action.disabled=true;
      waiting=true;
      result.textContent='Recherche du catalogue USB en cours…';
      window.dispatchEvent(new CustomEvent('rtp1:montage-request',{detail}));
    });
    window.addEventListener('rtp1:montage-selection-result',async event=>{
      const info=event.detail;
      if(info?.message)result.textContent=info.message;
      if(!waiting)return;
      if(!info?.count){if(!info?.pending){waiting=false;action.disabled=false;}return;}
      waiting=false;
      const request=renderRequest(info.items||[],pending);
      if(!request.relativePaths.length){action.disabled=false;result.textContent='Aucun média compatible.';return;}
      action.disabled=true;
      result.textContent='Montage de '+request.relativePaths.length+' extraits à partir du disque USB. Choisis où enregistrer le MP4, puis attends le rendu local…';
      try{
        const output=await window.__TAURI__.core.invoke('render_auto_montage',{
          request
        });
        result.textContent=output?'Montage enregistré : '+output+' — points de coupe sauvegardés dans le fichier .project.json associé.':'Enregistrement annulé.';
      }catch(error){
        result.textContent='Rendu MP4 non terminé : '+String(error)+'. Le moteur vidéo est intégré à l’installateur.';
      }finally{action.disabled=false;}
    });
    panel.append(heading,explanation,engine,prompt,action,result);
    studio.prepend(panel);
  });
})();
