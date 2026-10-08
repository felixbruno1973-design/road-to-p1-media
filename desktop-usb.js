/* Progressive Windows desktop feature: does not change the existing IndexedDB media store. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const library = document.querySelector('#view-library');
    if (!library) return;
    const desktop = window.__TAURI__?.core?.invoke;
    if (!desktop) return; // Hosted site stays unchanged.

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.style.cssText = 'margin:0 0 14px;padding:18px';
    const title = document.createElement('h3');
    title.textContent = 'Disque USB — catalogue externe (expérimental)';
    const explanation = document.createElement('p');
    explanation.textContent = 'Analyse en lecture seule : aucune copie ni suppression des vidéos originales.';
    const button = document.createElement('button');
    button.className = 'btn primary';
    button.type = 'button';
    button.textContent = 'Choisir un dossier du disque USB';
    const status = document.createElement('p');
    status.setAttribute('role','status');
    status.textContent = 'Aucun dossier analysé.';
    const list = document.createElement('div');
    list.style.cssText = 'max-height:300px;overflow:auto';
    button.addEventListener('click', async () => {
      button.disabled=true;
      status.textContent='Analyse du dossier…';
      list.replaceChildren();
      try {
        const result = await desktop('choose_and_scan_folder');
        if (!result) {status.textContent='Sélection annulée.';return;}
        status.textContent = result.totalCount+' média(s) trouvé(s) dans '+result.sourceName+
          (result.warnings.length ? ' • '+result.warnings.length+' avertissement(s)' : '');
        for(const file of result.files.slice(0,300)) {
          const p=document.createElement('p');
          p.textContent=file.category+' · '+file.relativePath+' · '+Math.round(file.sizeBytes/1048576*10)/10+' Mo';
          list.appendChild(p);
        }
        if (result.totalCount>300) {
          const more=document.createElement('p');
          more.textContent='Aperçu limité aux 300 premiers fichiers ; le scan a recensé tous les médias.';
          list.appendChild(more);
        }
      } catch(err) {
        status.textContent='Erreur : '+String(err);
      } finally {button.disabled=false;}
    });
    panel.append(title,explanation,button,status,list);
    library.prepend(panel);
  });
})();
