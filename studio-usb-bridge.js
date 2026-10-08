/* Temporary read-only bridge: USB selections are metadata, not imported IndexedDB assets. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__TAURI__?.core?.invoke) return;
    const studio=document.querySelector('#view-studio');
    if (!studio) return;
    const box=document.createElement('section');
    box.className='panel';
    box.style.cssText='padding:16px;margin-bottom:14px';
    const heading=document.createElement('h3');
    heading.textContent='Médias sélectionnés sur le disque USB';
    const note=document.createElement('p');
    note.textContent='Aucune sélection externe. Dans Library, choisissez des fichiers puis cliquez sur Préparer la sélection Studio.';
    const list=document.createElement('ol');
    list.style.cssText='max-height:240px;overflow:auto;padding-left:24px';
    const clear=document.createElement('button');
    clear.type='button';clear.className='btn';clear.textContent='Effacer la préparation';
    clear.disabled=true;
    const duration=document.createElement('input');
    duration.type='number';duration.min='5';duration.max='600';duration.value='45';
    duration.setAttribute('aria-label','Durée cible en secondes');
    duration.style.cssText='width:90px';
    const exportButton=document.createElement('button');
    exportButton.type='button';exportButton.className='btn';exportButton.disabled=true;
    exportButton.textContent='Exporter le projet JSON';
    exportButton.addEventListener('click',()=>{
      if(!current?.items?.length)return;
      const seconds=Number(duration.value);
      if(!Number.isFinite(seconds)||seconds<5||seconds>600){note.textContent='Durée invalide (5 à 600 s).';return;}
      const project={
        schemaVersion:1,kind:'road-to-p1-usb-draft',createdAt:new Date().toISOString(),
        sourceLabel:current.source,targetDurationMs:Math.round(seconds*1000),
        output:{width:1080,height:1920,fps:30},
        clips:current.items.map((item,i)=>({
          assetId:'usb-'+i,relativePath:item.relativePath,category:item.category,
          order:i,inMs:null,outMs:null,durationMs:null
        }))
      };
      const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;link.download='road-to-p1-montage-projet.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    let current=null;
    const redraw=()=>{
      list.replaceChildren();
      if (!current?.items?.length) {
        note.textContent='Aucune sélection externe. Dans Library, choisissez des fichiers puis cliquez sur Préparer la sélection Studio.';
        clear.disabled=true;exportButton.disabled=true;return;
      }
      note.textContent=current.items.length+' fichier(s) préparé(s) depuis '+current.source+'. Pas encore de lecture ni de rendu.';
      clear.disabled=false;exportButton.disabled=false;
      for (const item of current.items) {
        const li=document.createElement('li');
        li.textContent=item.category+' — '+item.relativePath;
        list.append(li);
      }
    };
    clear.addEventListener('click',()=>{current=null;redraw();});
    window.addEventListener('rtp1:usb-media-selected',event=>{
      const data=event.detail;
      if (!data || !Array.isArray(data.items)) return;
      current={source:String(data.source||'USB'),items:data.items.filter(x=>x&&typeof x.relativePath==='string'&&typeof x.category==='string').slice(0,5000)};
      redraw();
      document.querySelector('[data-view="studio"]')?.click();
    });
    const controls=document.createElement('div');
    controls.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    const label=document.createElement('label');label.textContent='Durée cible (s) : ';
    label.append(duration);controls.append(label,exportButton,clear);
    box.append(heading,note,list,controls);
    studio.prepend(box);
  });
})();
