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
    explanation.textContent='Première version : prépare une proposition locale à partir des noms des médias. Elle ne reconnaît pas encore les actions filmées et ne crée pas encore de MP4.';
    const prompt=document.createElement('textarea');
    prompt.rows=3;prompt.style.cssText='width:100%;min-height:80px';
    prompt.placeholder='Fais-moi un Reel de 45 secondes de Lara à Annéville 2026.';
    prompt.setAttribute('aria-label','Ton objectif de montage vidéo');
    const action=document.createElement('button');
    action.className='btn primary';action.type='button';
    action.textContent='Préparer automatiquement mon montage';
    const result=document.createElement('p');
    result.setAttribute('role','status');
    action.addEventListener('click',()=>{
      const instruction=prompt.value.trim();
      if(!instruction){result.textContent='Décris le montage que tu souhaites.';return;}
      const seconds=/\b(\d{1,3})\s*(?:secondes?|sec|s)\b/i.exec(instruction);
      const targetSeconds=seconds?Math.min(600,Math.max(5,Number(seconds[1]))):45;
      const detail={instruction,targetSeconds,format:/youtube|horizontal|paysage/i.test(instruction)?'16:9':'9:16'};
      window.dispatchEvent(new CustomEvent('rtp1:montage-request',{detail}));
      result.textContent='Recherche du catalogue USB en cours…';
    });
    window.addEventListener('rtp1:montage-selection-result',event=>{
      if(event.detail?.message)result.textContent=event.detail.message;
    });
    panel.append(heading,explanation,prompt,action,result);
    studio.prepend(panel);
  });
})();
