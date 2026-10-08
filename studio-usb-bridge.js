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
    let current=null;
    const redraw=()=>{
      list.replaceChildren();
      if (!current?.items?.length) {
        note.textContent='Aucune sélection externe. Dans Library, choisissez des fichiers puis cliquez sur Préparer la sélection Studio.';
        clear.disabled=true;return;
      }
      note.textContent=current.items.length+' fichier(s) préparé(s) depuis '+current.source+'. Pas encore de lecture ni de rendu.';
      clear.disabled=false;
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
    box.append(heading,note,list,clear);
    studio.prepend(box);
  });
})();
