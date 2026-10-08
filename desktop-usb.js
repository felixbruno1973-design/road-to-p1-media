/* Desktop-only USB catalogue. Existing IndexedDB Library remains untouched. */
(() => {
  'use strict';
  const PAGE_SIZE = 50;
  document.addEventListener('DOMContentLoaded', () => {
    const library = document.querySelector('#view-library');
    const invoke = window.__TAURI__?.core?.invoke;
    if (!library || !invoke) return;
    let all = [], source = '', page = 0;
    const selected = new Map();
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.style.cssText = 'margin:0 0 14px;padding:18px';
    const title = document.createElement('h3');
    title.textContent = 'Disque USB — catalogue externe (expérimental)';
    const explanation = document.createElement('p');
    explanation.textContent = 'Fichiers d’origine en lecture seule. Ce catalogue est temporaire et distinct de Library.';
    const button = document.createElement('button');
    button.className = 'btn primary';
    button.type = 'button';
    button.textContent = 'Choisir un dossier du disque USB';
    const status = document.createElement('p');
    status.setAttribute('role','status');
    status.textContent = 'Aucun dossier analysé.';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0';
    const search = document.createElement('input');
    search.placeholder = 'Rechercher nom, dossier, circuit…';
    search.setAttribute('aria-label','Rechercher dans les médias du disque USB');
    search.className = 'search';
    search.style.cssText = 'max-width:320px';
    const type = document.createElement('select');
    type.setAttribute('aria-label','Catégorie de média USB');
    type.className = 'search';
    type.style.cssText = 'max-width:150px';
    for (const [value,label] of [['','Tous les médias'],['Vidéo','Vidéos'],['Photo','Photos'],['Audio','Audio']]) {
      const option = document.createElement('option');
      option.value=value; option.textContent=label; type.append(option);
    }
    const count = document.createElement('p');
    const selectionLabel=document.createElement('p');
    const studioButton=document.createElement('button');
    studioButton.type='button';studioButton.className='btn';studioButton.disabled=true;
    studioButton.textContent='Préparer la sélection Studio';
    function selectionStatus(){selectionLabel.textContent=selected.size+' média(s) sélectionné(s)';studioButton.disabled=!selected.size;}
    studioButton.addEventListener('click',()=>{
      const detail={source,items:[...selected.values()].map(x=>({relativePath:x.relativePath,category:x.category,sizeBytes:x.sizeBytes}))};
      window.dispatchEvent(new CustomEvent('rtp1:usb-media-selected',{detail}));
      selectionLabel.textContent=detail.items.length+' média(s) prêts pour la future liaison Studio (lecture non disponible).';
    });
    count.setAttribute('aria-live','polite');
    const list = document.createElement('div');
    list.style.cssText = 'max-height:360px;overflow:auto';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn';
    more.textContent = 'Afficher 50 fichiers supplémentaires';
    more.hidden=true;
    controls.append(search,type);
    const filtered = () => {
      const q=search.value.trim().toLocaleLowerCase('fr');
      return all.filter(f => (!type.value || f.category===type.value) &&
        (!q || f.relativePath.toLocaleLowerCase('fr').includes(q)));
    };
    function render() {
      const items = filtered();
      const shown = Math.min(items.length,(page+1)*PAGE_SIZE);
      list.replaceChildren();
      for(const file of items.slice(0,shown)) {
        const p=document.createElement('label');
        p.style.cssText='display:flex;gap:8px;align-items:center;margin:6px 0';
        const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(file.relativePath);
        input.addEventListener('change',()=>{if(input.checked)selected.set(file.relativePath,file);else selected.delete(file.relativePath);selectionStatus();});
        const info=document.createElement('span');
        info.textContent=file.category+' · '+file.relativePath+' · '+
          (file.sizeBytes/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
        p.append(input,info);list.append(p);
      }
      count.textContent = shown+' / '+items.length+' résultat(s)'+(source?' — '+source:'');
      more.hidden=shown>=items.length;
    }
    search.addEventListener('input',()=>{page=0;render();});
    type.addEventListener('change',()=>{page=0;render();});
    more.addEventListener('click',()=>{page++;render();});
    button.addEventListener('click', async () => {
      button.disabled=true;
      status.textContent='Analyse du dossier USB…';
      try {
        const result=await invoke('choose_and_scan_folder');
        if(!result) {status.textContent='Sélection annulée.';return;}
        all=result.files; source=result.sourceName; page=0;selected.clear();selectionStatus();
        status.textContent=result.totalCount+' média(s) recensé(s)'+
          (result.warnings.length?' • '+result.warnings.length+' avertissement(s)':'');
        render();
      } catch(err) {
        status.textContent='Analyse impossible : '+String(err);
      } finally {button.disabled=false;}
    });
    panel.append(title,explanation,button,status,controls,count,list,more,selectionLabel,studioButton);
    library.prepend(panel);
    selectionStatus();render();
  });
})();
