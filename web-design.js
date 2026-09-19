(() => {
  'use strict';
  const API = 'https://road-to-p1-media-api.felix-bruno1973.workers.dev';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const devices = {all:'Tous les écrans',mobile:'Mobile',tablet:'Tablette',desktop:'Ordinateur'};
  let key = sessionStorage.getItem('roadToP1MediaPublishKey') || '';
  sessionStorage.removeItem('roadToP1MediaPublishKey'); // Keep credentials in memory only.
  let pages = [], current = null, history = [], busy = false, connected = false, recorder = null, recordingStream = null, recordingTimer = null, sequence = 0, previewReady = false;
  $('view-web').innerHTML = `
    <div class="panel wd-intro"><span class="kicker">VOTRE SITE, À VOTRE DEMANDE</span><h2>Décrivez. Vérifiez. Publiez.</h2><p>Dictez ou écrivez votre modification. Vous gardez la décision de la mettre en ligne.</p></div>
    <div class="panel wd-access"><div><b id="wdConnection">Connexion au site</b><p id="wdConnectionInfo">Votre code Media protège l’analyse et la publication.</p></div><form id="wdConnectForm"><label>Code d’accès Media<input id="wdKey" type="password" autocomplete="off" placeholder="Votre code de publication existant"></label><button class="btn" id="wdConnect" type="submit">Connecter le site</button></form></div>
    <div id="wdMessage" role="status" aria-live="polite" class="wd-message" hidden></div>
    <div class="panel"><div class="panel-head"><h3>1. Votre modification</h3><span>Aucune modification du site à cette étape</span></div>
      <form id="wdForm" class="panel-body form-grid">
        <label>Page<select id="wdPage" required><option value="">Connectez le site pour choisir une page</option></select></label>
        <label>Affichage<select id="wdDevice"><option value="all">Tous les écrans</option><option value="mobile">Mobile uniquement</option><option value="tablet">Tablette uniquement</option><option value="desktop">Ordinateur uniquement</option></select></label>
        <label class="span2">Que souhaitez-vous changer ?<textarea id="wdInstruction" maxlength="4000" required placeholder="Ex. Sur mobile, réduis l’espace noir entre le logo et le titre de l’association."></textarea></label>
        <div class="actions span2"><button type="button" class="btn" id="wdMic">🎙 Dicter une modification</button><button type="button" class="btn" id="wdStop" hidden>■ Arrêter la dictée</button><button type="submit" class="btn primary" id="wdGenerate" disabled>Générer le brouillon</button></div>
        <p class="file-note span2" id="wdVoiceInfo">La dictée dure au maximum 60 secondes. L’audio est envoyé au service de transcription lorsque vous l’arrêtez. Vous pourrez corriger le texte.</p>
      </form>
    </div>
    <section id="wdDraft" class="panel wd-draft" hidden aria-labelledby="wdDraftTitle">
      <div class="panel-head"><h3 id="wdDraftTitle">2. Votre brouillon</h3><span id="wdDraftStatus"></span></div>
      <div class="panel-body"><h3 id="wdSummary"></h3><p id="wdTarget"></p><div id="wdDiff" class="wd-diff"></div>
        <div class="wd-preview-tools"><label>Largeur de l’aperçu<select id="wdViewport"><option value="390">Mobile · 390 px</option><option value="820">Tablette · 820 px</option><option value="1280">Ordinateur · 1280 px</option></select></label><button type="button" class="btn" id="wdLoadPreview">Charger l’aperçu avant / après</button></div>
        <p id="wdPreviewNote" class="file-note"></p>
        <div id="wdPreview" hidden><div class="wd-preview-tabs" role="group" aria-label="Comparer les versions"><button class="btn" id="wdBefore" aria-pressed="false">Avant</button><button class="btn" id="wdAfter" aria-pressed="true">Après proposé</button></div><div class="wd-preview-scroll"><iframe id="wdBeforeFrame" title="Page avant modification" sandbox="" referrerpolicy="no-referrer" hidden></iframe><iframe id="wdAfterFrame" title="Brouillon après modification" sandbox="" referrerpolicy="no-referrer"></iframe></div></div>
        <label class="deploy-confirm" id="wdApprovalLabel"><input type="checkbox" id="wdApproval" disabled><span>J’ai vérifié les changements et l’aperçu. Je valide leur publication sur road-to-p1.com.</span></label>
        <div class="actions"><button class="btn" id="wdEdit" type="button">Modifier la demande</button><button class="btn" id="wdReject" type="button">Rejeter</button><button class="btn primary" id="wdApply" type="button" disabled>Valider et publier</button></div>
      </div>
    </section>
    <div class="panel wd-history"><div class="panel-head"><h3>Historique et sauvegardes</h3><button class="btn" id="wdRefresh">Actualiser</button></div><div class="panel-body" id="wdHistory"><p>Les publications et leurs sauvegardes seront conservées sur le serveur.</p></div></div>
    <details class="panel wd-legacy"><summary>Reprendre une ancienne demande Media</summary><div class="panel-body" id="wdLegacy"></div></details>`;

  function message(text, error = false) { $('wdMessage').hidden = !text; $('wdMessage').textContent = text; $('wdMessage').classList.toggle('error',error); }
  function setBusy(value) {
    busy = value;
    for (const id of ['wdConnect','wdKey','wdPage','wdDevice','wdInstruction','wdGenerate','wdMic','wdEdit','wdReject','wdLoadPreview','wdRefresh']) $(id).disabled = value || (['wdGenerate','wdMic'].includes(id) && !connected);
    document.querySelectorAll('[data-wd-resume],[data-wd-rollback],[data-wd-legacy]').forEach(el=>el.disabled=value);
    $('wdApproval').disabled = value || !previewReady;
    $('wdApply').disabled = value || !previewReady || !$('wdApproval').checked || current?.status !== 'pending';
  }
  async function api(path, body) {
    let response;
    try { response = await fetch(API + path, {method:body===undefined?'GET':'POST', cache:'no-store', signal:AbortSignal.timeout(120000), headers:{'X-RTP1-Key':key,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}); }
    catch { throw new Error('Connexion interrompue. Vérifiez votre connexion et consultez l’historique avant de réessayer une publication.'); }
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.ok) {
      if (response.status === 401) { key=''; connected=false; $('wdKey').hidden=false; $('wdConnectForm').hidden=false; }
      const error = new Error(data.message || 'Le serveur ne répond pas. Consultez l’historique avant de republier.'); error.status=response.status; throw error;
    }
    return data;
  }
  function clearPreview() {
    previewReady=false; $('wdApproval').checked=false; $('wdApproval').disabled=true; $('wdApply').disabled=true; $('wdPreview').hidden=true;
    $('wdBeforeFrame').removeAttribute('srcdoc'); $('wdAfterFrame').removeAttribute('srcdoc');
    if(current) current.reviewHash='';
  }
  function invalidate() {
    sequence++; clearPreview(); current=null; $('wdDraft').hidden=true; localStorage.removeItem('rtp1ActiveDraft');
  }
  function stateLabel(d) { return ({pending: d.expiresAt*1000<Date.now()?'Expiré':'À valider',applied:'Publié',rolled_back:'Annulé',rejected:'Rejeté'})[d.status] || d.status; }
  function valueLabel(value) {
    if(value===null) return 'Valeur héritée / non définie';
    if(typeof value==='object') { if('size' in value) return `${value.size} ${value.unit||''}`; return Object.entries(value).map(([k,v])=>`${k} : ${v}`).join(' · '); }
    return value===''?'Non défini':String(value);
  }
  function changeLabel(change) {
    const names = {'padding-top':'Espacement supérieur','padding-bottom':'Espacement inférieur','padding-left':'Espacement à gauche','padding-right':'Espacement à droite',padding:'Espacement intérieur',margin:'Marge extérieure','margin-top':'Marge supérieure','margin-bottom':'Marge inférieure','margin-left':'Marge à gauche','margin-right':'Marge à droite','min-height':'Hauteur minimale','max-height':'Hauteur maximale',height:'Hauteur',width:'Largeur','max-width':'Largeur maximale',color:'Couleur du texte','background-color':'Couleur de fond','font-size':'Taille du texte','font-weight':'Épaisseur du texte','line-height':'Interligne','letter-spacing':'Espacement des lettres','text-align':'Alignement du texte',gap:'Espacement entre les éléments','row-gap':'Espacement entre les lignes','column-gap':'Espacement entre les colonnes','border-radius':'Arrondi des angles',display:'Affichage du bloc'};
    const property = change.label.split(' · ').at(-1);
    const label = names[property] || change.label;
    return `${change.element === 'HTML' ? 'Bloc de la page' : change.element} · ${label}`;
  }
  function showDraft(draft) {
    current=draft; clearPreview(); localStorage.setItem('rtp1ActiveDraft',draft.id);
    $('wdDraft').hidden=false; $('wdSummary').textContent=draft.summary; $('wdDraftStatus').textContent=stateLabel(draft);
    $('wdTarget').textContent=`${draft.page.title} · ${devices[draft.device]} · Brouillon valable jusqu’à ${new Date(draft.expiresAt*1000).toLocaleTimeString('fr-FR')}`;
    $('wdDiff').innerHTML=draft.diff.map(c=>`<article class="wd-change"><b>${esc(changeLabel(c))}</b><span class="pill">${esc(devices[c.device])}</span><div class="wd-values"><div><small>AVANT</small><p>${esc(valueLabel(c.before))}</p></div><div><small>APRÈS PROPOSÉ</small><p>${esc(valueLabel(c.after))}</p></div></div><p>${esc(c.reason)}</p></article>`).join('');
    $('wdViewport').value=({mobile:'390',tablet:'820',desktop:'1280',all:'1280'})[draft.device]; sizePreview();
    $('wdPreviewNote').textContent='Chargez puis vérifiez l’aperçu pour activer la validation.';
    $('wdLoadPreview').hidden=draft.status!=='pending'; $('wdApprovalLabel').hidden=draft.status!=='pending'; $('wdApply').hidden=draft.status!=='pending'; $('wdReject').hidden=draft.status!=='pending';
  }
  function sizePreview() { for(const id of ['wdBeforeFrame','wdAfterFrame']) $(id).style.width=$('wdViewport').value+'px'; }
  function renderHistory() {
    $('wdHistory').innerHTML=history.length?history.map(d=>`<article class="list-item"><div><h4>${esc(d.summary)}</h4><p>${esc(d.page.title)} · ${new Date(d.createdAt*1000).toLocaleString('fr-FR')}</p><span class="pill">${esc(stateLabel(d))}</span></div><div class="mini-actions"><button data-wd-resume="${esc(d.id)}">${d.status==='pending'?'Ouvrir le brouillon':'Voir le détail'}</button>${d.status==='applied'?`<button data-wd-rollback="${esc(d.id)}">Annuler cette publication</button>`:''}</div></article>`).join(''):'<p>Aucun brouillon pour le moment.</p>';
    document.querySelectorAll('[data-wd-resume]').forEach(b=>b.onclick=()=>resume(b.dataset.wdResume));
    document.querySelectorAll('[data-wd-rollback]').forEach(b=>b.onclick=()=>rollback(b.dataset.wdRollback));
  }
  async function refresh() { const result=await api('/history'); history=result.drafts; renderHistory(); }
  async function connect(event) {
    event?.preventDefault(); if(busy) return;
    key=$('wdKey').value.trim() || key;
    if(!key) { message('Saisissez votre code d’accès Media.',true); $('wdKey').focus(); return; }
    setBusy(true); message('Connexion à WordPress…');
    try {
      const capabilities=await api('/capabilities');
      if(capabilities.version!=='1.1.0' || !capabilities.atomicConflictCheck) throw new Error('Le nouveau service de brouillons doit encore être activé. Aucune publication n’est possible depuis cet écran.');
      const data=await api('/pages'); pages=data.pages;
      $('wdPage').innerHTML='<option value="">Choisir une page…</option>'+pages.map(p=>`<option value="${p.id}">${esc(p.title)} — ${esc(new URL(p.link).pathname)}</option>`).join('');
      connected=true; $('wdKey').value=''; $('wdConnectForm').hidden=true; $('wdConnection').textContent='WordPress connecté';
      $('wdConnectionInfo').textContent='Brouillons privés · validation obligatoire · sauvegarde automatique';
      await refresh();
      const id=localStorage.getItem('rtp1ActiveDraft'); const saved=history.find(d=>d.id===id);
      if(saved) { showDraft(saved); $('wdPage').value=String(saved.page.id); $('wdInstruction').value=saved.instruction; $('wdDevice').value=saved.device; }
      message(capabilities.ai?'Connexion prête. Décrivez votre modification.':'Connexion WordPress prête. Le service IA doit encore être relié dans Cloudflare.',!capabilities.ai);
    } catch(e) { message(e.message,true); } finally { setBusy(false); }
  }
  async function generate(event) {
    event.preventDefault(); if(busy||recorder) return;
    invalidate(); const ticket=sequence; setBusy(true); message('Analyse de la page et préparation du brouillon…');
    try {
      const result=await api('/draft',{pageId:Number($('wdPage').value),device:$('wdDevice').value,instruction:$('wdInstruction').value.trim()});
      if(ticket!==sequence) return;
      if(result.clarification) { message(result.clarification); return; }
      showDraft(result.draft); await refresh(); message('Brouillon préparé. Le site n’a pas été modifié.'); $('wdDraft').scrollIntoView({behavior:'smooth'});
    } catch(e) { message(e.message,true); } finally { setBusy(false); }
  }
  async function loadPreview() {
    if(busy||!current) return; setBusy(true); clearPreview(); message('Préparation de l’aperçu avant / après…');
    try {
      const result=await api('/preview',{draftId:current.id});
      $('wdBeforeFrame').srcdoc=result.before; $('wdAfterFrame').srcdoc=result.after;
      $('wdPreview').hidden=false; $('wdPreviewNote').textContent=result.notice;
      current.reviewHash=result.reviewHash; previewReady=true; message('Comparez les versions, puis cochez la validation si le résultat vous convient.');
    } catch(e) { message(e.message,true); } finally { setBusy(false); }
  }
  async function publish() {
    if(busy||!current||!previewReady||!$('wdApproval').checked) return;
    const draftId=current.id; setBusy(true); message('Publication en cours : vérification de la page et sauvegarde…');
    try {
      const result=await api('/apply',{draftId,reviewHash:current.reviewHash,confirm:true});
      showDraft(result.draft); await refresh(); message(result.warning || 'Modification enregistrée dans WordPress. La sauvegarde est disponible dans l’historique.',Boolean(result.warning));
    } catch(e) {
      clearPreview();
      try { const result=await api('/draft/'+draftId); showDraft(result.draft); if(result.draft.status==='applied') { message('WordPress confirme que la publication a été enregistrée.'); await refresh(); return; } } catch {}
      message(e.message,true);
    } finally { setBusy(false); }
  }
  async function resume(id) {
    if(busy) return; setBusy(true);
    try { const result=await api('/draft/'+id); showDraft(result.draft); $('wdPage').value=String(current.page.id); $('wdDevice').value=current.device; $('wdInstruction').value=current.instruction; $('wdDraft').scrollIntoView({behavior:'smooth'}); message('Brouillon chargé. Un nouvel aperçu est requis avant publication.'); }
    catch(e) { message(e.message,true); } finally { setBusy(false); }
  }
  async function reject() {
    if(busy||!current) return; setBusy(true);
    try { await api('/reject',{draftId:current.id}); invalidate(); await refresh(); message('Brouillon rejeté. Le site n’a pas été modifié.'); }
    catch(e) { message(e.message,true); } finally { setBusy(false); }
  }
  async function rollback(id) {
    if(busy) return;
    const item=history.find(d=>d.id===id);
    if(!confirm(`Restaurer la version précédant « ${item?.summary || 'cette publication'} » ? L’annulation sera bloquée si la page a changé depuis.`)) return;
    setBusy(true); message('Vérification puis restauration de la sauvegarde…');
    try { const result=await api('/rollback',{draftId:id,confirm:true}); if(current?.id===id) showDraft(result.draft); await refresh(); message(result.warning||'Version précédente restaurée.',Boolean(result.warning)); }
    catch(e) { try { await refresh(); } catch {} message(e.message,true); } finally { setBusy(false); }
  }
  function releaseMic() { clearTimeout(recordingTimer); recordingStream?.getTracks().forEach(t=>t.stop()); recordingStream=null; recorder=null; $('wdStop').hidden=true; $('wdMic').hidden=false; }
  async function startRecording() {
    if(busy||recorder) return;
    if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia) { message('Le micro n’est pas disponible dans ce navigateur. Saisissez votre demande.',true); return; }
    invalidate(); setBusy(true);
    try {
      recordingStream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
      recorder=new MediaRecorder(recordingStream,mime?{mimeType:mime}:{}); const chunks=[]; let length=0;
      recorder.ondataavailable=e=>{ if(e.data.size) { chunks.push(e.data); length+=e.data.size; if(length>7*1024*1024&&recorder?.state==='recording') recorder.stop(); } };
      recorder.onerror=()=>{ releaseMic(); setBusy(false); message('Enregistrement interrompu. Réessayez ou saisissez votre demande.',true); };
      recorder.onstop=async()=>{
        const type=recorder?.mimeType||mime||'audio/webm'; releaseMic(); message('Transcription de votre dictée…');
        try { const form=new FormData(); form.set('audio',new Blob(chunks,{type}),'dictee'); const result=await api('/transcribe',form); $('wdInstruction').value=($('wdInstruction').value+' '+result.text).trim().slice(0,4000); message('Dictée transcrite. Corrigez le texte si besoin, puis générez le brouillon.'); }
        catch(e) { message(e.message,true); } finally { setBusy(false); }
      };
      recorder.start(1000); $('wdMic').hidden=true; $('wdStop').hidden=false; $('wdStop').disabled=false; message('Micro actif. Décrivez la modification, puis appuyez sur « Arrêter la dictée ».');
      recordingTimer=setTimeout(()=>{ if(recorder?.state==='recording') recorder.stop(); },60000);
    } catch(e) { releaseMic(); setBusy(false); message('Accès au micro refusé ou indisponible. Vous pouvez saisir votre demande.',true); }
  }
  $('wdConnectForm').onsubmit=connect; $('wdForm').onsubmit=generate; $('wdLoadPreview').onclick=loadPreview; $('wdApply').onclick=publish; $('wdReject').onclick=reject;
  $('wdApproval').onchange=()=>setBusy(busy); $('wdViewport').onchange=sizePreview;
  $('wdBefore').onclick=()=>{ $('wdBeforeFrame').hidden=false; $('wdAfterFrame').hidden=true; $('wdBefore').setAttribute('aria-pressed','true'); $('wdAfter').setAttribute('aria-pressed','false'); };
  $('wdAfter').onclick=()=>{ $('wdBeforeFrame').hidden=true; $('wdAfterFrame').hidden=false; $('wdBefore').setAttribute('aria-pressed','false'); $('wdAfter').setAttribute('aria-pressed','true'); };
  $('wdEdit').onclick=()=>{ invalidate(); message('Modifiez votre demande, puis générez un nouveau brouillon.'); $('wdInstruction').focus(); };
  ['wdPage','wdDevice','wdInstruction'].forEach(id=>$(id).addEventListener('input',invalidate));
  $('wdRefresh').onclick=async()=>{ if(busy) return; setBusy(true); try { await refresh(); message('Historique actualisé.'); } catch(e) { message(e.message,true); } finally { setBusy(false); } };
  $('wdMic').onclick=startRecording; $('wdStop').onclick=()=>{ if(recorder?.state==='recording') recorder.stop(); };
  window.addEventListener('pagehide',()=>{ if(recorder) recorder.onstop=null; releaseMic(); });
  let legacy=[]; try { legacy=JSON.parse(localStorage.getItem('roadToP1MediaV100')||'{}').web||[]; } catch {}
  $('wdLegacy').innerHTML=legacy.length?legacy.map((d,i)=>`<article class="list-item"><div><b>${esc(d.title)}</b><p>${esc(d.desc)}</p></div><button data-wd-legacy="${i}">Reprendre</button></article>`).join(''):'Aucune ancienne demande.';
  document.querySelectorAll('[data-wd-legacy]').forEach(b=>b.onclick=()=>{ if(busy) return; const item=legacy[Number(b.dataset.wdLegacy)]; invalidate(); $('wdInstruction').value=[item.title,item.desc].filter(Boolean).join('\n'); const page=pages.find(p=>String(p.id)===String(item.wpPageId)); if(page) $('wdPage').value=String(page.id); message('Demande reprise. Choisissez la page et l’affichage avant de générer le brouillon.'); });
  setBusy(false); if(key) connect();
})();
