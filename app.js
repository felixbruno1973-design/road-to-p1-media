(()=>{'use strict';
const KEY='roadToP1MediaV100';
const DB_NAME='roadToP1MediaLibraryV2';
const DB_VERSION=1;
const STORE='assets';
const $=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const fd=v=>v?new Date(v).toLocaleDateString('fr-FR'):'—';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sizeText=n=>n<1024?`${n} o`:n<1048576?`${(n/1024).toFixed(1)} Ko`:`${(n/1048576).toFixed(1)} Mo`;
let D={studio:[],reports:[],training:[],learning:[],culture:{correct:0,total:0,level:'pro',byTheme:{},mastery:{},history:[]},english:[],activity:[]};
let libraryCache=[];
let studioSelected=new Set();
let currentQuestion='';
let recognition=null;
let previewUrl='';
let studioStoryboardUrls=[];
let studioRenderBusy=false;
let studioRenderedBlob=null;
let studioRenderedUrl='';
let studioRenderedName='';
let studioEditSettings={transition:'Fondu noir',transitionMs:420,pace:'normal',introMs:null,outroMs:null,notes:''};
let studioStoryPlayTimer=null;
let cultureTheme='';
let cultureIndex=0;
let englishInterview=null;
let englishRecognition=null;

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||'null');
    if(x)D={studio:Array.isArray(x.studio)?x.studio:[],reports:Array.isArray(x.reports)?x.reports:[],training:Array.isArray(x.training)?x.training:[],learning:Array.isArray(x.learning)?x.learning:[],culture:x.culture&&typeof x.culture==='object'?x.culture:{},english:Array.isArray(x.english)?x.english:[],activity:Array.isArray(x.activity)?x.activity:[]};
  }catch(e){}
  D.culture=D.culture&&typeof D.culture==='object'?D.culture:{};
  D.culture.correct=Number(D.culture.correct)||0;
  D.culture.total=Number(D.culture.total)||0;
  D.culture.level=['confirmed','expert','pro'].includes(D.culture.level)?D.culture.level:'pro';
  D.culture.byTheme=D.culture.byTheme&&typeof D.culture.byTheme==='object'?D.culture.byTheme:{};
  D.culture.mastery=D.culture.mastery&&typeof D.culture.mastery==='object'?D.culture.mastery:{};
  D.culture.history=Array.isArray(D.culture.history)?D.culture.history:[];
}
function save(){localStorage.setItem(KEY,JSON.stringify(D));renderHome()}
function uid(p='m'){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(x){const e=$('toast');e.textContent=x;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1800)}
function log(text){D.activity.unshift({at:now(),text});D.activity=D.activity.slice(0,40)}

async function loadOfficialLogo(){
 const img=$('officialLogo');
 const urls=['https://felixbruno1973-design.github.io/road-to-p1-dynamics/','https://felixbruno1973-design.github.io/road-to-p1-dynamics/road_to_p1_dynamics_phase1_v1.0.59.html'];
 for(const url of urls){try{const r=await fetch(url);if(!r.ok)continue;const html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html'),src=doc.querySelector('.official-logo')?.getAttribute('src');if(src){img.src=src.startsWith('data:')?src:new URL(src,url).href;return}}catch(e){}}
 img.alt='ROAD TO P1';
}

const titles={
 home:['Media Center','Créer, structurer, entraîner et conserver.'],
 studio:['Studio','Concevoir articles, montages photo et montages vidéo à partir des ressources de Library.'],
 reports:['Reports','Produire les rapports de course, bilans et contenus structurés.'],
 training:['Media Training','Préparer Lara et Aaron aux interviews françaises et internationales.'],
 library:['Library','Centraliser les photos, vidéos, logos et documents.']
};
function openView(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
 const view=$('view-'+v);if(!view)return;view.classList.add('active');
 $('pageTitle').textContent=titles[v][0];$('pageSubtitle').textContent=titles[v][1];
 if(v==='studio')renderStudio();if(v==='reports')renderReports();if(v==='training')renderTraining();if(v==='library')renderLibrary();
}
function renderHome(){
 $('homeStudio').textContent=D.studio.length;$('homeReports').textContent=D.reports.length;$('homeTraining').textContent=D.training.length;$('homeLibrary').textContent=libraryCache.length;
 const a=$('recentActivity');a.innerHTML=D.activity.length?D.activity.slice(0,8).map(x=>`<div class="activity-item"><b>${esc(x.text)}</b><span>${fd(x.at)}</span></div>`).join(''):'<div class="empty">Aucune activité enregistrée pour le moment.</div>';
}


function normalizeStudioType(type){
 if(['Article','Montage vidéo','Montage photo'].includes(type))return type;
 return /reel|vidéo/i.test(type||'')?'Montage vidéo':'Article';
}
function studioChannelProfile(channel,production){
 if(production==='Montage vidéo'){
  if(channel==='Instagram')return 'Reel vertical 9:16 • rythme court • 20 à 45 s';
  if(channel==='Facebook')return 'Vidéo sociale 4:5 ou 16:9 • 30 à 60 s';
  return 'Vidéo web 16:9 • narration plus posée • 45 à 90 s';
 }
 if(production==='Montage photo'){
  if(channel==='Instagram')return 'Carrousel 4:5 • couverture forte • 5 à 10 visuels';
  if(channel==='Facebook')return 'Publication ou album • 4 à 8 visuels';
  return 'Galerie ou illustration d’article • formats paysage et portrait';
 }
 return channel==='Site internet'?'Article web structuré • titre, chapô, intertitres et médias':'Publication éditoriale adaptée au fil d’actualité';
}

function studioTargetSeconds(){
 const raw=Number($('stDuration')&&$('stDuration').value||60);
 return Math.max(5,Math.min(600,Number.isFinite(raw)?raw:60));
}
function studioFormatSeconds(ms){
 const s=Math.max(0,ms)/1000;
 return (Math.round(s*10)/10).toLocaleString('fr-FR',{maximumFractionDigits:1})+' s';
}
function studioTimeline(assets){
 assets=assets||[];
 const targetMs=Math.round(studioTargetSeconds()*1000);
 let intro=studioEditSettings.introMs==null?Math.min(1200,Math.round(targetMs*.07)):studioEditSettings.introMs;
 let outro=studioEditSettings.outroMs==null?Math.min(1500,Math.round(targetMs*.085)):studioEditSettings.outroMs;
 if(studioEditSettings.pace==='dynamic'){intro=Math.round(intro*.75);outro=Math.round(outro*.75)}
 if(studioEditSettings.pace==='calm'){intro=Math.round(intro*1.2);outro=Math.round(outro*1.15)}
 const minimumContent=assets.length?Math.max(assets.length*350,900):900;
 if(intro+outro>targetMs-minimumContent){
  const available=Math.max(400,targetMs-minimumContent),sum=Math.max(1,intro+outro);
  intro=Math.round(available*(intro/sum));outro=available-intro;
 }
 const budget=Math.max(0,targetMs-intro-outro);
 const weights=assets.map(function(x){
  if(x.category==='Vidéo')return studioEditSettings.pace==='dynamic'?1.05:studioEditSettings.pace==='calm'?1.35:1.2;
  if(x.category==='Logo')return .55;
  return studioEditSettings.pace==='dynamic'?.78:1;
 });
 const weightSum=weights.reduce(function(a,b){return a+b},0)||1;
 let used=0;
 const clips=assets.map(function(x,i){
  const durationMs=i===assets.length-1?budget-used:Math.max(1,Math.round(budget*(weights[i]/weightSum)));
  used+=durationMs;
  return {asset:x,durationMs:durationMs,role:studioRenderRole(i)};
 });
 return {targetMs:targetMs,introMs:intro,outroMs:outro,clips:clips,transition:studioEditSettings.transition,transitionMs:Math.min(studioEditSettings.transitionMs,Math.max(0,Math.floor((clips[0]?.durationMs||1000)/3)))};
}
function resetStudioEditSettings(){
 studioEditSettings={transition:'Fondu noir',transitionMs:420,pace:'normal',introMs:null,outroMs:null,notes:''};
 if($('stEditInstructions'))$('stEditInstructions').value='';
 if($('stEditSummary'))$('stEditSummary').textContent='Les ajustements seront appliqués au storyboard puis au prochain rendu vidéo.';
}
function parseStudioEditInstructions(text){
 const raw=String(text||'').trim(),plain=raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!raw)return {changed:[],summary:'Aucun ajustement saisi.'};
 const changed=[];
 const videoDuration=plain.match(/(?:video|montage|duree|format).{0,28}?(\d+(?:[.,]\d+)?)\s*(?:s|sec|seconde|secondes)\b/);
 const allTimes=[...plain.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|seconde|secondes)\b/g)];
 if(videoDuration){
  const v=parseFloat(videoDuration[1].replace(',','.'));if(Number.isFinite(v)){$('stDuration').value=Math.max(5,Math.min(600,v));changed.push('durée '+studioTargetSeconds()+' s')}
 }else if(allTimes.length===1&&!/(intro|introduction|outro|conclusion|fin)/.test(plain)){
  const v=parseFloat(allTimes[0][1].replace(',','.'));if(Number.isFinite(v)){$('stDuration').value=Math.max(5,Math.min(600,v));changed.push('durée '+studioTargetSeconds()+' s')}
 }
 const intro=plain.match(/(?:intro|introduction).{0,22}?(\d+(?:[.,]\d+)?)\s*(?:s|sec|seconde|secondes)\b/);
 const outro=plain.match(/(?:outro|conclusion|fin).{0,22}?(\d+(?:[.,]\d+)?)\s*(?:s|sec|seconde|secondes)\b/);
 if(intro){studioEditSettings.introMs=Math.round(parseFloat(intro[1].replace(',','.'))*1000);changed.push('intro '+studioFormatSeconds(studioEditSettings.introMs))}
 else if(/intro.{0,12}(plus )?courte/.test(plain)){studioEditSettings.introMs=700;changed.push('intro plus courte')}
 else if(/intro.{0,12}(plus )?longue/.test(plain)){studioEditSettings.introMs=1800;changed.push('intro plus longue')}
 if(outro){studioEditSettings.outroMs=Math.round(parseFloat(outro[1].replace(',','.'))*1000);changed.push('conclusion '+studioFormatSeconds(studioEditSettings.outroMs))}
 else if(/(?:conclusion|fin|outro).{0,12}(plus )?courte/.test(plain)){studioEditSettings.outroMs=800;changed.push('conclusion plus courte')}
 else if(/(?:conclusion|fin|outro).{0,12}(plus )?longue/.test(plain)){studioEditSettings.outroMs=2000;changed.push('conclusion plus longue')}
 if(/sans transition|\bcut\b|cuts|transition.{0,12}(franche|seche|nette)/.test(plain)){studioEditSettings.transition='Cut';studioEditSettings.transitionMs=0;changed.push('Cut net')}
 else if(/flash|blanc/.test(plain)){studioEditSettings.transition='Flash blanc';studioEditSettings.transitionMs=/long|lent/.test(plain)?520:300;changed.push('Flash blanc')}
 else if(/volet|balayage|wipe/.test(plain)){studioEditSettings.transition='Volet';studioEditSettings.transitionMs=/long|lent/.test(plain)?620:380;changed.push('Volet')}
 else if(/fondu|transition.{0,16}(douce|fluide|progressive)/.test(plain)){studioEditSettings.transition='Fondu noir';studioEditSettings.transitionMs=/long|lent|progressif/.test(plain)?700:420;changed.push('Fondu noir')}
 if(/rythme.{0,14}(plus )?(dynamique|rapide)|plans?.{0,14}(plus )?courts?/.test(plain)){studioEditSettings.pace='dynamic';changed.push('rythme plus dynamique')}
 else if(/rythme.{0,14}(plus )?(lent|calme|pose)|plans?.{0,14}(plus )?longs?/.test(plain)){studioEditSettings.pace='calm';changed.push('plans plus longs')}
 studioEditSettings.notes=raw;
 return {changed:changed,summary:changed.length?'Appliqué : '+changed.join(' • '):'Instruction conservée pour le montage : '+raw};
}
function applyStudioEdits(){
 const result=parseStudioEditInstructions($('stEditInstructions').value);
 resetStudioRendered();renderStudioStoryboard();
 $('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets(),$('stChannel').value);
 $('stEditSummary').textContent=result.summary;
 toast(result.changed.length?'Montage recalculé.':'Instruction enregistrée.');
}

function setStudioTransitionPreset(name){
 const presets={
  'Cut':{transition:'Cut',transitionMs:0,label:'Cut net — passage immédiat'},
  'Fondu noir':{transition:'Fondu noir',transitionMs:420,label:'Fondu noir — transition douce'},
  'Flash blanc':{transition:'Flash blanc',transitionMs:300,label:'Flash blanc — effet dynamique'},
  'Volet':{transition:'Volet',transitionMs:380,label:'Volet — balayage rapide'}
 };
 const p=presets[name]||presets['Fondu noir'];studioEditSettings.transition=p.transition;studioEditSettings.transitionMs=p.transitionMs;
 resetStudioRendered();renderStudioStoryboard();
 if($('stEditSummary'))$('stEditSummary').textContent='Transition appliquée : '+p.label+'. Elle sera visible dans le prochain rendu vidéo.';
 document.querySelectorAll('[data-st-transition]').forEach(function(b){b.classList.toggle('active',b.dataset.stTransition===p.transition)});
 toast('Transition '+p.transition+' appliquée.');
}
function reorderStudioSequence(dragId,targetId){
 if(!dragId||!targetId||dragId===targetId)return;
 const ids=[...studioSelected],from=ids.indexOf(dragId),to=ids.indexOf(targetId);if(from<0||to<0)return;
 ids.splice(from,1);ids.splice(to,0,dragId);studioSelected=new Set(ids);
 resetStudioRendered();renderStudioStoryboard();
 $('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets(),$('stChannel').value);
 toast('Ordre des séquences modifié.');
}
function removeStudioSequence(id){
 if(!id||!studioSelected.has(id))return;
 stopStudioStoryboardPlayback();studioSelected.delete(id);resetStudioRendered();
 renderStudioAssets();
 $('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets(),$('stChannel').value);
 const remaining=studioSelected.size,target=studioTargetSeconds();
 if($('stEditSummary'))$('stEditSummary').textContent=remaining?'Séquence retirée. Les '+remaining+' séquence'+(remaining>1?'s':'')+' restante'+(remaining>1?'s':'')+' ont été recalculées pour conserver '+target+' s.':'Toutes les séquences ont été retirées du montage.';
 toast(remaining?'Séquence retirée • durée cible '+target+' s conservée.':'Dernière séquence retirée.');
}
function stopStudioStoryboardPlayback(){
 if(studioStoryPlayTimer){clearTimeout(studioStoryPlayTimer);studioStoryPlayTimer=null}
 document.querySelectorAll('.storyboard-card.playing').forEach(function(card){card.classList.remove('playing');const b=card.querySelector('[data-story-play]');if(b)b.textContent='▶ Lire'});
 document.querySelectorAll('.storyboard-card video').forEach(function(v){try{v.pause();v.currentTime=0;v.muted=true}catch(e){}});
}
function playStudioStoryboardItem(id,durationMs){
 const card=document.querySelector('[data-story-id="'+id+'"]');if(!card)return;
 const already=card.classList.contains('playing');stopStudioStoryboardPlayback();if(already)return;
 card.classList.add('playing');const btn=card.querySelector('[data-story-play]');if(btn)btn.textContent='■ Stop';
 const video=card.querySelector('video');
 if(video){video.loop=true;video.muted=false;video.currentTime=0;video.play().catch(function(){video.muted=true;video.play().catch(function(){})})}
 studioStoryPlayTimer=setTimeout(stopStudioStoryboardPlayback,Math.max(500,Number(durationMs)||2500));
}
function studioTemplate(pilot,type,event,objective,tone,assets,channel){
 const production=normalizeStudioType(type),e=event||'Sujet à préciser',brief=(objective||'').trim()||'Aucun élément ajouté pour le moment.';
 channel=channel||'Instagram';
 const profile=studioChannelProfile(channel,production);
 const sources=assets.length?assets.map(function(x,i){return (i+1)+'. '+x.name+' — '+x.category}).join('\n'):'Aucun média sélectionné.';
 if(production==='Montage vidéo'){
  const timeline=studioTimeline(assets);let cursor=timeline.introMs;
  const sequence=assets.length?timeline.clips.map(function(clip,i){const start=cursor,end=cursor+clip.durationMs;cursor=end;return studioFormatSeconds(start)+' → '+studioFormatSeconds(end)+' • '+clip.asset.name+' • '+clip.role}).join('\n'):'Sélectionner dans Library les vidéos, photos ou logos à intégrer.';
  return [
   'PROPOSITION DE MONTAGE VIDÉO — '+channel.toUpperCase(),'',
   'Durée finale cible : '+studioFormatSeconds(timeline.targetMs),
   'Transitions : '+timeline.transition+(timeline.transitionMs?' ('+studioFormatSeconds(timeline.transitionMs)+')':''),
   'Introduction : '+studioFormatSeconds(timeline.introMs)+' • Conclusion : '+studioFormatSeconds(timeline.outroMs),'',
   'Pilote : '+pilot,'Sujet : '+e,'Format conseillé : '+profile,'Ton : '+tone,'',
   'OBJECTIF / ÉLÉMENTS À RACONTER',brief,'',
   'MÉDIAS SÉLECTIONNÉS',sources,'',
   'PROPOSITION DE MONTAGE',sequence,'',
   'HABILLAGE',
   '• Ouverture : logo ROAD TO P1 + titre court',
   '• Textes écran : résultat, lieu ou message clé uniquement',
   '• Rythme : coupes franches sur l’action, respiration sur les moments humains',
   '• Fin : pilote / prochain rendez-vous / partenaires','',
   'LÉGENDE PROPOSÉE','🏁 '+pilot+' — '+e+'. '+brief,'','#RoadToP1 #Karting #Motorsport'
  ].join('\n');
 }
 if(production==='Montage photo'){
  const roles=['Couverture','Action piste','Détail / préparation','Pilote / émotion','Équipe / coulisses','Partenaires'];
  const sequence=assets.length?assets.map(function(x,i){return (i+1)+'. '+x.name+' — '+roles[i%roles.length]}).join('\n'):'Sélectionner dans Library les photos à utiliser.';
  return [
   'PROPOSITION DE MONTAGE PHOTO — '+channel.toUpperCase(),'',
   'Pilote : '+pilot,'Sujet : '+e,'Format conseillé : '+profile,'Ton : '+tone,'',
   'MESSAGE À FAIRE PASSER',brief,'',
   'SÉLECTION',sources,'',
   'ORDRE PROPOSÉ',sequence,'',
   'TRAITEMENT',
   '• Première image : visuel le plus fort, lisible sans texte long',
   '• Cohérence : même ambiance et même logique de recadrage',
   '• Dernière image : conclusion, partenaires ou prochain rendez-vous','',
   'LÉGENDE PROPOSÉE',pilot+' • '+e,brief,'','#RoadToP1 #Karting #Motorsport'
  ].join('\n');
 }
 const title=tone==='Humain'?pilot+' : ce que '+e+' raconte au-delà du résultat':pilot+' — '+e+' : une nouvelle étape avec ROAD TO P1';
 return [
  'PROPOSITION D’ARTICLE — '+channel.toUpperCase(),'',
  'Pilote : '+pilot,'Sujet : '+e,'Format conseillé : '+profile,'Ton : '+tone,'',
  'ÉLÉMENTS FOURNIS',brief,'',
  'SOURCES / MÉDIAS À EXPLOITER',sources,'',
  'TITRE PROPOSÉ',title,'',
  'ANGLE ÉDITORIAL',
  'Raconter le fait principal, expliquer ce qu’il signifie dans la progression de '+pilot+', puis ouvrir sur la suite du programme ROAD TO P1.','',
  'STRUCTURE',
  '1. Accroche : le fait ou l’image forte.',
  '2. Contexte : course, séance, projet ou actualité.',
  '3. Développement : intégrer les faits fournis, résultats et apprentissages.',
  '4. Dimension humaine : travail, équipe, progression et partenaires.',
  '5. Conclusion : prochaine étape et objectif.','',
  'BASE DE RÉDACTION',
  pilot+' poursuit son parcours avec ROAD TO P1 à l’occasion de '+e+'. '+brief,'',
  'Cette séquence doit être replacée dans une logique de progression : ce qui a été réalisé, ce qui a été appris et ce qui sera travaillé lors de la prochaine étape.','',
  'Les médias sélectionnés peuvent servir d’illustrations, de sources factuelles ou de support à une citation/légende.','',
  'CONCLUSION PROPOSÉE',
  'La suite se construit désormais autour du prochain rendez-vous, avec la même ambition : apprendre, progresser et transformer chaque expérience en étape vers le haut niveau.'
 ].join('\n');
}
function selectedAssets(){
 return [...studioSelected].map(function(id){return libraryCache.find(function(x){return x.id===id})}).filter(Boolean);
}
function visibleStudioAssets(){
 const q=($('stAssetSearch')&&$('stAssetSearch').value||'').toLowerCase();
 const production=normalizeStudioType($('stType')&&$('stType').value||'Article');
 return libraryCache.filter(function(x){
  const compatible=production==='Montage vidéo'?['Vidéo','Photo','Logo'].includes(x.category):production==='Montage photo'?['Photo','Logo'].includes(x.category):true;
  return compatible&&(!q||[x.name,x.pilot,x.event,x.tags,x.category].join(' ').toLowerCase().includes(q));
 });
}
function updateStudioProductionUI(){
 const production=normalizeStudioType($('stType')&&$('stType').value||'Article');
 if($('stType'))$('stType').value=production;
 const article=production==='Article',video=production==='Montage vidéo';
 if($('stProductionHint'))$('stProductionHint').textContent=article?'Ajoutez les faits, messages, résultats ou idées qui doivent apparaître dans l’article.':video?'Sélectionnez les vidéos, photos et logos qui serviront à construire la proposition de montage.':'Sélectionnez les photos et logos à organiser dans le montage ou carrousel.';
 if($('stObjectiveLabel'))$('stObjectiveLabel').textContent=article?'Éléments à intégrer / brief':'Message, rythme et éléments à faire ressortir';
 if($('stOutputLabel'))$('stOutputLabel').textContent=article?'Proposition d’article':video?'Proposition de montage vidéo':'Proposition de montage photo';
 if($('stAssetHint'))$('stAssetHint').textContent=article?'Pour un article, vous pouvez sélectionner photos, vidéos, documents ou logos comme éléments de référence.':video?'Studio affiche les vidéos, photos et logos disponibles pour construire le montage.':'Studio affiche les photos et logos disponibles pour construire la sélection.';
 if($('stRenderPanel'))$('stRenderPanel').hidden=!video;
 if($('stDurationWrap'))$('stDurationWrap').hidden=!video;
 if($('stEditVideo'))$('stEditVideo').hidden=!video;
 renderStudioAssets();
}
function updateStudioAssetSelectionState(list){
 list=list||visibleStudioAssets();
 const all=list.length>0&&list.every(function(x){return studioSelected.has(x.id)});
 if($('stSelectAll')){$('stSelectAll').textContent=all?'Tout désélectionner':'Tout sélectionner';$('stSelectAll').disabled=!list.length}
 if($('stVisibleCount'))$('stVisibleCount').textContent=list.length+' média'+(list.length>1?'s':'')+' affiché'+(list.length>1?'s':'');
 $('stAssetCount').textContent=studioSelected.size+' sélectionné'+(studioSelected.size>1?'s':'');
}
function clearStudioStoryboardUrls(){
 studioStoryboardUrls.forEach(function(url){try{URL.revokeObjectURL(url)}catch(e){}});
 studioStoryboardUrls=[];
}
function studioStoryboardPreview(x){
 if(!(x&&x.blob instanceof Blob))return '<div class="storyboard-placeholder">'+esc(x&&x.category||'Média')+'</div>';
 const type=mediaType(x);
 try{
  const blob=x.blob.type===type?x.blob:x.blob.slice(0,x.blob.size,type);
  const url=URL.createObjectURL(blob);studioStoryboardUrls.push(url);
  if(type.startsWith('image/'))return '<img src="'+url+'" alt="'+esc(x.name)+'">';
  if(type.startsWith('video/'))return '<video src="'+url+'" muted playsinline preload="metadata" aria-label="'+esc(x.name)+'"></video>';
 }catch(e){}
 return '<div class="storyboard-placeholder">'+esc(x.category||'Média')+'</div>';
}
function renderStudioStoryboard(){
 if(!$('stStoryboard'))return;
 stopStudioStoryboardPlayback();clearStudioStoryboardUrls();
 const production=normalizeStudioType($('stType')&&$('stType').value||'Article');
 const channel=$('stChannel')&&$('stChannel').value||'Instagram';
 const assets=selectedAssets(),timeline=production==='Montage vidéo'?studioTimeline(assets):null;
 const title=production==='Article'?'Sources proposées pour l’article':'Pré-montage proposé';
 $('stStoryboardTitle').textContent=title;
 $('stStoryboardMeta').textContent=assets.length?assets.length+' média'+(assets.length>1?'s':'')+' • '+studioChannelProfile(channel,production):'Sélectionnez des médias';
 if($('stDurationSummary'))$('stDurationSummary').textContent=production==='Montage vidéo'?'Durée cible : '+studioFormatSeconds(timeline.targetMs)+' • transition : '+timeline.transition:'';
 document.querySelectorAll('[data-st-transition]').forEach(function(b){b.classList.toggle('active',b.dataset.stTransition===studioEditSettings.transition)});
 if(!assets.length){
  $('stStoryboard').innerHTML='<div class="empty">Le '+(production==='Article'?'plan éditorial':'montage proposé')+' apparaîtra ici à partir des médias sélectionnés.</div>';
  return;
 }
 const videoRoles=['Accroche / action forte','Contexte / paddock','Séquence piste','Moment clé','Pilote / émotion','Partenaires / conclusion'];
 const photoRoles=['Couverture','Action piste','Détail / préparation','Pilote / émotion','Équipe / coulisses','Partenaires'];
 const articleRoles=['Illustration principale','Contexte','Preuve / détail','Citation ou ambiance','Partenaires','Conclusion'];
 let cursor=timeline?timeline.introMs:0;
 $('stStoryboard').innerHTML=assets.map(function(x,i){
  const role=(production==='Montage vidéo'?videoRoles:production==='Montage photo'?photoRoles:articleRoles)[i%6];
  let timing,duration=2500;
  if(production==='Montage vidéo'){
   duration=timeline.clips[i].durationMs;const start=cursor,end=cursor+duration;cursor=end;
   timing=studioFormatSeconds(start)+' → '+studioFormatSeconds(end)+' • '+studioFormatSeconds(duration);
  }else timing=production==='Montage photo'?'Visuel '+(i+1):'Source '+(i+1);
  const play=production==='Montage vidéo'?'<button type="button" class="storyboard-play" data-story-play="'+x.id+'" data-story-duration="'+duration+'">▶ Lire</button>':'';
  const remove=production==='Montage vidéo'?'<button type="button" class="storyboard-remove" data-story-remove="'+x.id+'" title="Retirer cette séquence du montage">✕ Supprimer</button>':'';
  const drag=production==='Montage vidéo'?' draggable="true" data-story-id="'+x.id+'"':'';
  const hint=production==='Montage vidéo'?'<small class="storyboard-drag-hint">Glisser l’image pour déplacer la séquence</small>':'';
  return '<article class="storyboard-card"'+drag+'><div class="storyboard-media">'+studioStoryboardPreview(x)+play+remove+'</div><div class="storyboard-info"><span>'+esc(timing)+'</span><b>'+esc(role)+'</b><small>'+esc(x.name)+'</small>'+hint+'</div></article>';
 }).join('');
 document.querySelectorAll('[data-story-play]').forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();playStudioStoryboardItem(b.dataset.storyPlay,Number(b.dataset.storyDuration)||2500)}});
 document.querySelectorAll('[data-story-remove]').forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();removeStudioSequence(b.dataset.storyRemove)};b.onmousedown=function(e){e.stopPropagation()}});
 if(production==='Montage vidéo'){
  let dragId='';
  document.querySelectorAll('[data-story-id]').forEach(function(card){
   card.ondragstart=function(e){dragId=card.dataset.storyId;card.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)}};
   card.ondragend=function(){card.classList.remove('dragging');document.querySelectorAll('.storyboard-card.drag-over').forEach(function(x){x.classList.remove('drag-over')})};
   card.ondragover=function(e){e.preventDefault();card.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='move'};
   card.ondragleave=function(){card.classList.remove('drag-over')};
   card.ondrop=function(e){e.preventDefault();card.classList.remove('drag-over');const source=(e.dataTransfer&&e.dataTransfer.getData('text/plain'))||dragId;reorderStudioSequence(source,card.dataset.storyId)};
  });
 }
}
function renderStudioAssets(){
 const list=visibleStudioAssets();
 updateStudioAssetSelectionState(list);
 $('stAssetList').innerHTML=list.length?list.map(function(x){
  return '<label class="asset-check"><input type="checkbox" data-st-asset="'+x.id+'" '+(studioSelected.has(x.id)?'checked':'')+'><span><b>'+esc(x.name)+'</b><small>'+esc(x.category)+' • '+esc(x.pilot||'—')+' • '+sizeText(x.size||0)+'</small></span></label>';
 }).join(''):'<div class="empty">Aucun média compatible dans Library.</div>';
 document.querySelectorAll('[data-st-asset]').forEach(function(cb){cb.onchange=function(){cb.checked?studioSelected.add(cb.dataset.stAsset):studioSelected.delete(cb.dataset.stAsset);resetStudioRendered();updateStudioAssetSelectionState(list);renderStudioStoryboard()}});
 renderStudioStoryboard();
}

function resetStudioRendered(){
 if(studioRenderedUrl){try{URL.revokeObjectURL(studioRenderedUrl)}catch(e){}}
 studioRenderedUrl='';studioRenderedBlob=null;studioRenderedName='';
 if($('stRenderPreview')){$('stRenderPreview').pause();$('stRenderPreview').removeAttribute('src');$('stRenderPreview').hidden=true}
 if($('stDownloadRender')){$('stDownloadRender').hidden=true;$('stDownloadRender').removeAttribute('href')}
 if($('stSaveRender'))$('stSaveRender').disabled=true;
 if($('stRenderFormat'))$('stRenderFormat').textContent='Aucun rendu';
 if($('stRenderProgressBar'))$('stRenderProgressBar').style.width='0%';
 if($('stRenderStatus'))$('stRenderStatus').textContent='Le rendu est effectué uniquement sur cet appareil.';
}
function studioRenderMime(){
 const candidates=[
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
 ];
 if(!window.MediaRecorder)return '';
 return candidates.find(function(x){try{return MediaRecorder.isTypeSupported(x)}catch(e){return false}})||'';
}
function studioRenderSize(channel){
 if(channel==='Instagram')return {w:720,h:1280,label:'9:16'};
 if(channel==='Facebook')return {w:720,h:900,label:'4:5'};
 return {w:1280,h:720,label:'16:9'};
}
function studioRenderRole(i){
 return ['Accroche / action forte','Contexte / paddock','Séquence piste','Moment clé','Pilote / émotion','Partenaires / conclusion'][i%6];
}
function studioRenderFileName(mime){
 const ext=mime.indexOf('mp4')>=0?'mp4':'webm';
 const pilot=($('stPilot')?.value||'road-to-p1').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const event=($('stEvent')?.value||today()).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45);
 return 'road-to-p1-'+pilot+'-'+(event||today())+'.'+ext;
}
function drawStudioCover(ctx,source,w,h){
 const sw=source.videoWidth||source.naturalWidth||source.width||w,sh=source.videoHeight||source.naturalHeight||source.height||h;
 const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale,dx=(w-dw)/2,dy=(h-dh)/2;
 ctx.drawImage(source,dx,dy,dw,dh);
}
function drawStudioWrappedText(ctx,text,x,y,maxWidth,lineHeight,maxLines){
 const words=String(text||'').split(/\s+/);let line='',lines=[];
 for(const word of words){
  const test=line?line+' '+word:word;
  if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;if(lines.length>=maxLines)break}else line=test;
 }
 if(lines.length<maxLines&&line)lines.push(line);
 lines.slice(0,maxLines).forEach(function(l,i){ctx.fillText(l,x,y+i*lineHeight)});
 return lines.length;
}
function drawStudioFrame(ctx,source,w,h,role,name,pilot,event,logo){
 ctx.fillStyle='#080b10';ctx.fillRect(0,0,w,h);
 if(source)drawStudioCover(ctx,source,w,h);
 const grad=ctx.createLinearGradient(0,h*.52,0,h);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,.88)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#e4323b';ctx.fillRect(0,h-12,w,12);
 const pad=Math.round(w*.055),base=h-Math.round(h*.075);
 ctx.textBaseline='alphabetic';ctx.fillStyle='#ffffff';ctx.font='700 '+Math.max(20,Math.round(w*.035))+'px Arial';
 drawStudioWrappedText(ctx,role,pad,base-Math.round(h*.09),w-pad*2,Math.round(w*.047),2);
 ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='500 '+Math.max(14,Math.round(w*.021))+'px Arial';
 drawStudioWrappedText(ctx,name,pad,base-Math.round(h*.025),w-pad*2,Math.round(w*.03),1);
 ctx.fillStyle='#f28d92';ctx.font='700 '+Math.max(13,Math.round(w*.018))+'px Arial';ctx.fillText((pilot||'ROAD TO P1')+' • '+(event||'Studio'),pad,base,w-pad*2);
 if(logo&&logo.complete&&logo.naturalWidth){
  const lw=Math.round(w*.22),lh=lw*(logo.naturalHeight/logo.naturalWidth);ctx.globalAlpha=.94;ctx.drawImage(logo,w-pad-lw,pad,lw,lh);ctx.globalAlpha=1;
 }else{
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.font='900 '+Math.max(16,Math.round(w*.024))+'px Arial';ctx.textAlign='right';ctx.fillText('ROAD TO P1',w-pad,pad+Math.round(w*.03));ctx.textAlign='left';
 }
}
function drawStudioTitleCard(ctx,w,h,title,sub,logo){
 ctx.fillStyle='#080b10';ctx.fillRect(0,0,w,h);
 const g=ctx.createRadialGradient(w*.72,h*.2,10,w*.72,h*.2,Math.max(w,h)*.75);g.addColorStop(0,'rgba(228,50,59,.34)');g.addColorStop(1,'rgba(8,11,16,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#e4323b';ctx.fillRect(0,h-14,w,14);
 const pad=Math.round(w*.08);ctx.fillStyle='#ffffff';ctx.font='900 '+Math.max(34,Math.round(w*.07))+'px Arial';ctx.textBaseline='middle';
 drawStudioWrappedText(ctx,title,pad,h*.48,w-pad*2,Math.round(w*.082),3);
 ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='600 '+Math.max(18,Math.round(w*.028))+'px Arial';drawStudioWrappedText(ctx,sub,pad,h*.72,w-pad*2,Math.round(w*.04),2);
 if(logo&&logo.complete&&logo.naturalWidth){const lw=Math.round(w*.3),lh=lw*(logo.naturalHeight/logo.naturalWidth);ctx.drawImage(logo,pad,pad,lw,lh)}
}
function studioSleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function studioSetProgress(done,total,label){
 const pct=Math.max(0,Math.min(100,Math.round(done/Math.max(1,total)*100)));
 if($('stRenderProgressBar'))$('stRenderProgressBar').style.width=pct+'%';
 if($('stRenderStatus'))$('stRenderStatus').textContent=label+' • '+pct+'%';
}
function drawStudioTransition(ctx,w,h,elapsed,duration){
 const t=Math.max(0,Number(studioEditSettings.transitionMs)||0),name=studioEditSettings.transition||'Cut';
 if(!t||name==='Cut')return;
 const edge=elapsed<t?1-elapsed/t:duration-elapsed<t?1-(duration-elapsed)/t:0;if(edge<=0)return;
 const alpha=Math.max(0,Math.min(1,edge));
 if(name==='Flash blanc'){
  ctx.fillStyle='rgba(255,255,255,'+Math.min(.95,alpha*.95)+')';ctx.fillRect(0,0,w,h);return;
 }
 if(name==='Volet'){
  const entering=elapsed<t,progress=entering?1-alpha:alpha,width=Math.round(w*Math.max(0,Math.min(1,progress)));
  ctx.fillStyle='rgba(8,11,16,.94)';if(entering)ctx.fillRect(width,0,w-width,h);else ctx.fillRect(0,0,width,h);return;
 }
 ctx.fillStyle='rgba(0,0,0,'+Math.min(.96,alpha*.96)+')';ctx.fillRect(0,0,w,h);
}
async function studioRenderStatic(ctx,canvas,source,duration,meta,totalState,logo){
 const start=performance.now();
 while(performance.now()-start<duration){
  const elapsed=Math.min(duration,performance.now()-start);drawStudioFrame(ctx,source,canvas.width,canvas.height,meta.role,meta.name,meta.pilot,meta.event,logo);drawStudioTransition(ctx,canvas.width,canvas.height,elapsed,duration);
  studioSetProgress(totalState.done+elapsed,totalState.total,'Génération du montage');
  await studioSleep(33);
 }
 totalState.done+=duration;
}
async function studioLoadImage(blob){
 return new Promise(function(resolve,reject){
  const url=URL.createObjectURL(blob),img=new Image();
  img.onload=function(){resolve({img:img,url:url})};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Image illisible'))};img.src=url;
 });
}
async function studioLoadVideo(blob){
 return new Promise(function(resolve,reject){
  const url=URL.createObjectURL(blob),video=document.createElement('video');video.playsInline=true;video.preload='auto';video.src=url;
  const fail=function(){URL.revokeObjectURL(url);reject(new Error('Vidéo illisible'))};
  video.onerror=fail;video.onloadedmetadata=function(){resolve({video:video,url:url})};video.load();
 });
}
async function studioRenderVideoAsset(ctx,canvas,x,index,duration,totalState,logo,audioCtx,audioDest){
 const type=mediaType(x),meta={role:studioRenderRole(index),name:x.name,pilot:$('stPilot').value,event:$('stEvent').value.trim()||'Studio'};
 if(type.startsWith('image/')){
  const loaded=await studioLoadImage(x.blob);try{await studioRenderStatic(ctx,canvas,loaded.img,duration,meta,totalState,logo)}finally{URL.revokeObjectURL(loaded.url)};return;
 }
 if(!type.startsWith('video/'))return;
 const loaded=await studioLoadVideo(x.blob),video=loaded.video;
 let audioNode=null;
 try{
  if(audioCtx&&audioDest){try{audioNode=audioCtx.createMediaElementSource(video);audioNode.connect(audioDest)}catch(e){}}
  video.currentTime=0;video.loop=true;video.volume=1;video.muted=!audioNode;
  try{await video.play()}catch(e){video.muted=true;await video.play()}
  const start=performance.now();
  while(performance.now()-start<duration){
   const elapsed=Math.min(duration,performance.now()-start);
   drawStudioFrame(ctx,video,canvas.width,canvas.height,meta.role,meta.name,meta.pilot,meta.event,logo);drawStudioTransition(ctx,canvas.width,canvas.height,elapsed,duration);
   studioSetProgress(totalState.done+elapsed,totalState.total,'Génération du montage');
   await new Promise(function(resolve){requestAnimationFrame(resolve)});
  }
  video.pause();totalState.done+=duration;
 }finally{
  try{if(audioNode)audioNode.disconnect()}catch(e){};video.removeAttribute('src');video.load();URL.revokeObjectURL(loaded.url);
 }
}
async function generateStudioVideo(){
 if(studioRenderBusy)return;
 if(normalizeStudioType($('stType').value)!=='Montage vidéo')return toast('Choisissez Montage vidéo.');
 const assets=selectedAssets().filter(function(x){return x.blob instanceof Blob&&['Vidéo','Photo','Logo'].includes(x.category)});
 if(!assets.length)return toast('Sélectionnez au moins un média.');
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return toast('Ce navigateur ne permet pas encore le rendu vidéo local.');
 const mime=studioRenderMime();if(!mime)return toast('Aucun format vidéo exportable n’est disponible dans ce navigateur.');
 studioRenderBusy=true;resetStudioRendered();$('stRenderVideo').disabled=true;$('stSaveRender').disabled=true;
 const channel=$('stChannel').value,size=studioRenderSize(channel),canvas=document.createElement('canvas');canvas.width=size.w;canvas.height=size.h;
 const ctx=canvas.getContext('2d',{alpha:false}),fps=30,canvasStream=canvas.captureStream(fps);
 let audioCtx=null,audioDest=null;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(AC){audioCtx=new AC();await audioCtx.resume();audioDest=audioCtx.createMediaStreamDestination()}
 }catch(e){audioCtx=null;audioDest=null}
 const stream=new MediaStream(canvasStream.getVideoTracks().concat(audioDest?audioDest.stream.getAudioTracks():[]));
 let recorder;try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6500000})}catch(e){recorder=new MediaRecorder(stream)}
 const chunks=[];recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data)};
 const stopped=new Promise(function(resolve,reject){recorder.onstop=resolve;recorder.onerror=function(e){reject(e.error||new Error('Erreur d’encodage'))}});
 const pilot=$('stPilot').value,event=$('stEvent').value.trim()||'ROAD TO P1 Studio',logo=$('officialLogo'),timeline=studioTimeline(assets);
 const state={done:0,total:timeline.targetMs};
 try{
  recorder.start(1000);
  const introStart=performance.now();
  while(performance.now()-introStart<timeline.introMs){drawStudioTitleCard(ctx,canvas.width,canvas.height,pilot,event,logo);studioSetProgress(Math.min(timeline.introMs,performance.now()-introStart),state.total,'Création de l’introduction');await studioSleep(33)}
  state.done+=timeline.introMs;
  for(let i=0;i<assets.length;i++)await studioRenderVideoAsset(ctx,canvas,assets[i],i,timeline.clips[i].durationMs,state,logo,audioCtx,audioDest);
  const outroStart=performance.now();
  while(performance.now()-outroStart<timeline.outroMs){drawStudioTitleCard(ctx,canvas.width,canvas.height,'ROAD TO P1','Chaque tour construit la suite.',logo);studioSetProgress(state.done+Math.min(timeline.outroMs,performance.now()-outroStart),state.total,'Création de la conclusion');await studioSleep(33)}
  state.done+=timeline.outroMs;recorder.stop();await stopped;
  const finalMime=recorder.mimeType||mime||'video/webm';studioRenderedBlob=new Blob(chunks,{type:finalMime});studioRenderedUrl=URL.createObjectURL(studioRenderedBlob);studioRenderedName=studioRenderFileName(finalMime);
  $('stRenderPreview').src=studioRenderedUrl;$('stRenderPreview').hidden=false;
  $('stDownloadRender').href=studioRenderedUrl;$('stDownloadRender').download=studioRenderedName;$('stDownloadRender').hidden=false;$('stDownloadRender').textContent='Télécharger '+studioRenderedName.split('.').pop().toUpperCase();
  $('stSaveRender').disabled=false;$('stRenderFormat').textContent=(finalMime.indexOf('mp4')>=0?'MP4':'WebM')+' • '+size.label+' • cible '+studioFormatSeconds(timeline.targetMs)+' • '+sizeText(studioRenderedBlob.size);
  studioSetProgress(state.total,state.total,'Montage terminé');log('Studio • vidéo générée localement • '+pilot+' • '+channel);save();toast('Vidéo générée.');
 }catch(e){
  console.error(e);if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch(_){}}
  if($('stRenderStatus'))$('stRenderStatus').textContent='Le rendu a échoué : '+(e&&e.message?e.message:'erreur inconnue');toast('Impossible de terminer le rendu vidéo.');
 }finally{
  stream.getTracks().forEach(function(t){t.stop()});if(audioCtx){try{await audioCtx.close()}catch(e){}}studioRenderBusy=false;$('stRenderVideo').disabled=false;
 }
}
async function saveStudioRenderToLibrary(){
 if(!studioRenderedBlob)return;
 try{
  await dbPut({id:uid('a'),name:studioRenderedName||('road-to-p1-studio-'+today()+'.webm'),type:studioRenderedBlob.type||'video/webm',size:studioRenderedBlob.size,lastModified:Date.now(),pilot:$('stPilot').value,category:'Vidéo',event:$('stEvent').value.trim()||'Studio',date:today(),tags:'studio, rendu, montage',created:now(),blob:studioRenderedBlob});
  log('Library • rendu Studio ajouté');save();await refreshLibrary();toast('Rendu ajouté à Library.');
 }catch(e){console.error(e);toast('Impossible d’ajouter le rendu à Library.')}
}

function renderStudio(){
 const q=($('stSearch')&&$('stSearch').value||'').toLowerCase();
 const L=D.studio.filter(function(x){return !q||[x.pilot,x.type,x.channel,x.event,x.status,x.objective].join(' ').toLowerCase().includes(q)});
 $('stCount').textContent=L.length+' production'+(L.length>1?'s':'');
 $('stList').innerHTML=L.length?L.map(function(x){
  return '<div class="list-item"><div><h4>'+esc(x.event||x.type)+'</h4><div class="list-meta">'+esc(x.pilot)+' • '+esc(normalizeStudioType(x.type))+' • '+esc(x.channel||'Instagram')+' • '+fd(x.updated||x.created)+'</div><p>'+esc((x.text||'').slice(0,160))+((x.text||'').length>160?'…':'')+'</p></div><div class="mini-actions"><span class="pill '+(x.status==='Publié'?'done':x.status==='Prêt'?'valid':'')+'">'+esc(x.status)+'</span><button data-st-open="'+x.id+'">Ouvrir</button><button class="danger" data-st-del="'+x.id+'">Supprimer</button></div></div>';
 }).join(''):'<div class="empty">Aucune production Studio.</div>';
 document.querySelectorAll('[data-st-open]').forEach(function(b){b.onclick=function(){openStudioDraft(b.dataset.stOpen)}});
 document.querySelectorAll('[data-st-del]').forEach(function(b){b.onclick=function(){delStudioDraft(b.dataset.stDel)}});
 updateStudioProductionUI();
}
function openStudioDraft(id){
 const x=D.studio.find(function(x){return x.id===id});if(!x)return;
 $('stPilot').value=x.pilot;$('stType').value=normalizeStudioType(x.type);$('stChannel').value=x.channel||(/facebook/i.test(x.type||'')?'Facebook':'Instagram');$('stEvent').value=x.event;$('stStatus').value=x.status;$('stTone').value=x.tone||'Sportif';$('stObjective').value=x.objective||'';$('stText').value=x.text||'';$('stDuration').value=x.duration||60;
 studioEditSettings=Object.assign({transition:'Fondu noir',transitionMs:420,pace:'normal',introMs:null,outroMs:null,notes:''},x.editSettings||{});$('stEditInstructions').value=x.editInstructions||studioEditSettings.notes||'';studioSelected=new Set(x.mediaIds||[]);$('stSave').dataset.edit=id;updateStudioProductionUI();toast('Production chargée.');window.scrollTo({top:0,behavior:'smooth'});
}
function delStudioDraft(id){if(!confirm('Supprimer cette production Studio ?'))return;D.studio=D.studio.filter(function(x){return x.id!==id});log('Production Studio supprimée');save();renderStudio()}
function saveStudio(){
 const id=$('stSave').dataset.edit||uid('s'),old=D.studio.find(function(x){return x.id===id});
 const x={id:id,pilot:$('stPilot').value,type:normalizeStudioType($('stType').value),channel:$('stChannel').value,event:$('stEvent').value.trim(),status:$('stStatus').value,tone:$('stTone').value,objective:$('stObjective').value.trim(),text:$('stText').value,duration:studioTargetSeconds(),editInstructions:$('stEditInstructions').value.trim(),editSettings:Object.assign({},studioEditSettings),mediaIds:[...studioSelected],created:old&&old.created||now(),updated:now()};
 const i=D.studio.findIndex(function(x){return x.id===id});if(i>=0)D.studio[i]=x;else D.studio.unshift(x);
 log((i>=0?'Production Studio mise à jour':'Nouvelle production Studio')+' • '+x.pilot+' • '+x.type+' • '+x.channel);delete $('stSave').dataset.edit;save();renderStudio();toast('Production enregistrée.');
}

function reportTemplate(pilot,type,event,facts){
 const e=event||'Période non renseignée',f=facts?.trim()||'À compléter avec les résultats, enseignements et prochaines étapes.';
 if(type==='Bilan partenaires')return `${pilot} — BILAN PARTENAIRES\n\nPériode / événement : ${e}\n\n1. Résumé\nROAD TO P1 poursuit l’accompagnement de ${pilot} dans son parcours sportif.\n\n2. Faits marquants\n${f}\n\n3. Visibilité et communication\n• Contenus publiés\n• Présence partenaires\n• Activations et retombées à compléter\n\n4. Prochaines étapes\n• Prochaine échéance sportive\n• Objectifs de progression\n• Actions de communication\n\nMerci à nos partenaires pour leur confiance.`;
 if(type==='Bilan mensuel'||type==='Bilan de saison')return `${pilot} — ${type.toUpperCase()}\n\nPériode : ${e}\n\nSYNTHÈSE\n${f}\n\nPERFORMANCE\n• Résultats clés\n• Progression observée\n• Points de travail\n\nCOMMUNICATION\n• Publications et contenus marquants\n• Partenaires mis en avant\n\nSUITE DU PROGRAMME\n• Objectifs\n• Prochaines courses / entraînements`;
 if(type==='Communiqué')return `COMMUNIQUÉ ROAD TO P1\n\n${pilot} — ${e}\n\nROAD TO P1 accompagne ${pilot} dans une nouvelle étape de son parcours en sport automobile.\n\n${f}\n\nCette démarche s’inscrit dans l’ambition de ROAD TO P1 : accompagner de jeunes pilotes vers le haut niveau et promouvoir l’égalité des chances dans le sport automobile.\n\nContact : ROAD TO P1`;
 return `${pilot} — RAPPORT DE COURSE\n\nÉvénement : ${e}\n\nRÉSUMÉ DU WEEK-END\n${f}\n\nPERFORMANCE\n• Qualifications :\n• Manches :\n• Finale :\n• Meilleur tour :\n\nPOINTS POSITIFS\n• \n\nPOINTS À TRAVAILLER\n• \n\nENSEIGNEMENTS\n• \n\nPROCHAINE ÉTAPE\n• \n\nMerci aux partenaires et à l’équipe qui accompagnent ROAD TO P1.`;
}
function renderReports(){
 const q=($('repSearch')?.value||'').toLowerCase(),L=D.reports.filter(x=>!q||[x.pilot,x.type,x.event,x.status].join(' ').toLowerCase().includes(q));
 $('repCount').textContent=`${L.length} rapport${L.length>1?'s':''}`;
 $('repList').innerHTML=L.length?L.map(x=>`<div class="list-item"><div><h4>${esc(x.event||x.type)}</h4><div class="list-meta">${esc(x.pilot)} • ${esc(x.type)} • ${fd(x.date||x.created)}</div><p>${esc((x.text||'').slice(0,150))}${(x.text||'').length>150?'…':''}</p></div><div class="mini-actions"><span class="pill ${x.status==='Envoyé'?'done':x.status==='Validé'?'valid':''}">${esc(x.status)}</span><button data-rep-open="${x.id}">Ouvrir</button><button class="danger" data-rep-del="${x.id}">Supprimer</button></div></div>`).join(''):'<div class="empty">Aucun rapport enregistré.</div>';
 document.querySelectorAll('[data-rep-open]').forEach(b=>b.onclick=()=>openReport(b.dataset.repOpen));document.querySelectorAll('[data-rep-del]').forEach(b=>b.onclick=()=>delReport(b.dataset.repDel));
}
function openReport(id){const x=D.reports.find(x=>x.id===id);if(!x)return;$('repPilot').value=x.pilot;$('repType').value=x.type;$('repEvent').value=x.event;$('repDate').value=x.date||'';$('repStatus').value=x.status;$('repFacts').value=x.facts||x.angle||'';$('repText').value=x.text||'';$('repSave').dataset.edit=id;toast('Rapport chargé.');window.scrollTo({top:0,behavior:'smooth'})}
function delReport(id){if(!confirm('Supprimer ce rapport ?'))return;D.reports=D.reports.filter(x=>x.id!==id);log('Rapport supprimé');save();renderReports()}
function saveReport(){
 const id=$('repSave').dataset.edit||uid('r'),old=D.reports.find(x=>x.id===id),x={id,pilot:$('repPilot').value,type:$('repType').value,event:$('repEvent').value.trim(),date:$('repDate').value,status:$('repStatus').value,facts:$('repFacts').value.trim(),text:$('repText').value,created:old?.created||now(),updated:now()};
 const i=D.reports.findIndex(x=>x.id===id);i>=0?D.reports[i]=x:D.reports.unshift(x);log(`${i>=0?'Rapport mis à jour':'Nouveau rapport'} • ${x.pilot} • ${x.type}`);delete $('repSave').dataset.edit;save();renderReports();toast('Rapport enregistré.');
}

const LESSONS=[
 {id:'message',number:'01',title:'Construire son message',duration:'8 min',summary:'Trouver l’idée principale et la formuler simplement.',content:['Une bonne réponse commence par une idée forte : ce que le public doit retenir.','Utilise la structure Message – Preuve – Projection : annonce ton idée, illustre-la par un fait concret, puis ouvre sur la suite.','Pour une interview courte, vise trois phrases utiles plutôt qu’une longue explication.'],exercise:'Résume ton dernier week-end de course en trois phrases : résultat, apprentissage, prochaine étape.',source:'Toastmasters International — Public Speaking Tips',url:'https://www.toastmasters.org/resources/public-speaking-tips'},
 {id:'interview',number:'02',title:'Préparer une interview',duration:'10 min',summary:'Anticiper le contexte, les questions et les messages clés.',content:['Avant de parler, identifie le média, le public et la durée disponible.','Prépare trois messages : performance, apprentissage et remerciement.','Écoute la question jusqu’au bout, prends une courte respiration, puis réponds directement.'],exercise:'Prépare trois messages essentiels pour une interview après-course.',source:'BBC Academy — Interviews',url:'https://www.bbc.co.uk/academy'},
 {id:'body',number:'03',title:'Voix et langage corporel',duration:'7 min',summary:'Regard, posture, sourire, débit et respiration.',content:['Regarde le journaliste plutôt que la caméra, sauf indication contraire.','Garde une posture ouverte, les épaules relâchées et les mains calmes.','Parle légèrement plus lentement qu’en conversation et marque une pause entre deux idées.'],exercise:'Filme une réponse de 30 secondes et vérifie regard, posture, débit et sourire.',source:'Toastmasters International — Gestures and Body Language',url:'https://www.toastmasters.org/resources'},
 {id:'difficult',number:'04',title:'Répondre aux questions difficiles',duration:'9 min',summary:'Rester honnête, calme et constructif après un moment compliqué.',content:['Ne critique jamais un concurrent, un officiel ou ton équipe sous le coup de l’émotion.','Reconnais le fait sans chercher d’excuse, puis explique l’apprentissage et la prochaine action.','Si tu ne sais pas, dis-le simplement. Ne spécule pas et ne révèle pas une information confidentielle.'],exercise:'Réponds à : « Cette erreur vous coûte la course. Que s’est-il passé ? »',source:'FIA — Media and communications resources',url:'https://www.fia.com/'},
 {id:'partners',number:'05',title:'Représenter ses partenaires',duration:'8 min',summary:'Remercier avec naturel et donner du sens au partenariat.',content:['Un partenaire n’attend pas seulement son nom : montre ce que son soutien rend possible.','Cite-le au moment pertinent, avec un exemple concret et sans transformer la réponse en publicité.','Respecte les valeurs de ROAD TO P1 : travail, égalité des chances, progression et collectif.'],exercise:'Remercie un partenaire en reliant son aide à un progrès concret.',source:'FIA — Motorsport communication',url:'https://www.fia.com/'},
 {id:'social',number:'06',title:'Communiquer sur les réseaux',duration:'8 min',summary:'Publier avec justesse, prudence et cohérence.',content:['Ne publie jamais sous le coup de la colère. Vérifie les faits, les droits d’image et les personnes visibles.','Protège les données personnelles, la localisation en temps réel et les informations techniques sensibles.','Distingue clairement un fait, une opinion et un contenu sponsorisé.'],exercise:'Transforme un résultat décevant en publication honnête et constructive.',source:'CNIL — Protéger sa vie privée en ligne',url:'https://www.cnil.fr/fr/maitriser-mes-donnees'}
];

const CULTURE_LEVELS={confirmed:1,expert:2,pro:3};
const CULTURE={
 histoire:{
  label:"Histoire de l’automobile",
  intro:"Des pionniers de la fin du XIXe siècle à l’industrialisation et aux grandes ruptures techniques.",
  questions:[
   {id:"hist-benz",level:"confirmed",q:"Pourquoi le Benz Patent-Motorwagen de 1886 est-il généralement présenté comme un jalon fondateur de l’automobile moderne ?",options:["Parce qu’il est le premier véhicule à dépasser 100 km/h","Parce qu’il a été conçu comme un véhicule complet autour d’un moteur à combustion interne","Parce qu’il inaugure la production à la chaîne"],answer:1,why:"Le Patent-Motorwagen n’était pas une voiture hippomobile simplement motorisée : Benz avait conçu ensemble moteur, châssis et transmission pour un véhicule autonome.",dossier:"Karl Benz dépose en janvier 1886 le brevet de son véhicule à trois roues. Son importance historique vient surtout de la conception intégrée du véhicule autour du moteur à combustion interne. Bertha Benz contribue ensuite à démontrer sa viabilité en réalisant en 1888 un long trajet devenu célèbre.",key:["1886 : brevet du Patent-Motorwagen","1888 : voyage de Bertha Benz","Conception intégrée moteur–châssis–transmission"],traps:["La vitesse n’est pas la raison de son statut historique.","Bonne réponse.","La chaîne de montage mobile viendra bien plus tard, notamment chez Ford."],follow:"En quoi le voyage de Bertha Benz peut-il être considéré comme un premier test grandeur nature de l’automobile ?",source:"Mercedes-Benz — Benz Patent Motor Car",url:"https://www.mercedes-benz.com/en/innovation/milestones/benz-patent-motor-car/"},
   {id:"hist-ford-line",level:"expert",q:"Quelle est la vraie portée historique de la chaîne de montage mobile introduite par Ford en 1913 ?",options:["Ford invente l’automobile","Elle réduit fortement le temps d’assemblage et rend la production de masse beaucoup plus efficace","Elle crée le premier moteur à quatre temps"],answer:1,why:"Ford n’invente ni l’automobile ni la chaîne de production, mais perfectionne l’organisation industrielle avec une ligne mobile qui fait passer le produit devant des postes spécialisés.",dossier:"L’innovation de Highland Park tient à la combinaison de pièces standardisées, de spécialisation des tâches et d’une chaîne en mouvement. Le temps nécessaire à l’assemblage d’un Model T chute spectaculairement. Cette organisation contribue à abaisser les coûts et à démocratiser l’automobile.",key:["1913 : chaîne mobile à Highland Park","Standardisation des pièces","Production de masse et baisse des coûts"],traps:["L’automobile existe plusieurs décennies avant Ford.","Bonne réponse.","Le cycle quatre temps est associé à Nikolaus Otto au XIXe siècle."],follow:"Pourquoi la standardisation des pièces est-elle aussi importante que la chaîne elle-même ?",source:"Ford Heritage — Moving Assembly Line",url:"https://corporate.ford.com/articles/history/moving-assembly-line.html"},
   {id:"hist-grandprix-1906",level:"expert",q:"Pourquoi le Grand Prix de l’Automobile Club de France de 1906 occupe-t-il une place majeure dans l’histoire de la compétition ?",options:["Il est souvent considéré comme le premier Grand Prix automobile au sens moderne","Il est la première édition des 24 Heures du Mans","Il crée le championnat du monde de Formule 1"],answer:0,why:"L’épreuve de 1906, disputée dans la Sarthe sur un circuit routier fermé, est un jalon majeur dans la naissance du concept de Grand Prix.",dossier:"Organisé par l’Automobile Club de France, le Grand Prix de 1906 se déroule sur deux jours. Il marque une évolution vers de grandes compétitions internationales structurées par un règlement technique et sportif, et participe à l’ancrage très précoce de la Sarthe dans l’histoire du sport automobile.",key:["1906 : Grand Prix de l’ACF","Sarthe","Préfigure les grands Grands Prix internationaux"],traps:["Bonne réponse.","Le Mans débute en 1923.","Le championnat du monde de F1 débute en 1950."],follow:"Quel lien historique existe entre la tradition automobile sarthoise et la naissance des 24 Heures du Mans ?",source:"Automobile Club de l’Ouest — Grand Prix de 1906",url:"https://www.lemans.org/"},
   {id:"hist-motorsport-lab",level:"pro",q:"Pourquoi dit-on souvent que la compétition automobile est un laboratoire technologique, tout en évitant l’idée simpliste que toute innovation vient de la course ?",options:["Parce que toute technologie routière est d’abord interdite en compétition","Parce que la course accélère le développement de certaines solutions sous fortes contraintes, mais les transferts avec la série vont dans les deux sens","Parce que les voitures de course et de série utilisent exactement les mêmes cahiers des charges"],answer:1,why:"La compétition impose des contraintes extrêmes de masse, température, fiabilité, performance et rapidité de développement. Mais de nombreuses technologies naissent aussi hors compétition puis sont adaptées à la course.",dossier:"Freinage, lubrification, matériaux, aérodynamique, hybridation, pneumatiques ou simulation peuvent profiter de la compétition. Cependant, sécurité, coût, confort, émissions et durée de vie rendent le cahier des charges d’une voiture routière très différent. Le bon raisonnement consiste à parler de transferts technologiques réciproques plutôt que d’un sens unique.",key:["Contraintes extrêmes","Cycles de développement courts","Transferts course ↔ série"],traps:["La compétition n’interdit évidemment pas systématiquement les technologies routières.","Bonne réponse.","Les cahiers des charges sont profondément différents."],follow:"Cite une technologie dont la compétition a accéléré le développement et explique la limite de la comparaison avec la route.",source:"FIA — Innovation & Technology",url:"https://www.fia.com/"},
   {id:"hist-regulation",level:"pro",q:"Pourquoi l’histoire du sport automobile ne peut-elle pas être comprise uniquement à travers les pilotes et les voitures ?",options:["Parce que les règlements déterminent aussi l’architecture des voitures, les stratégies et parfois les cycles technologiques","Parce que les règlements ne changent jamais","Parce que la technique n’a aucune influence sur les résultats"],answer:0,why:"Un changement de cylindrée, de masse minimale, d’aérodynamique, de carburant ou d’homologation peut totalement redistribuer les solutions techniques efficaces.",dossier:"L’histoire de la compétition est aussi celle de ses règlements. Les ingénieurs travaillent dans un espace défini par les textes : ce sont souvent les changements réglementaires qui provoquent les grandes ruptures, comme les moteurs 1,5 litre en F1 en 1961, le Groupe B en rallye, le Groupe C en endurance ou les générations hybrides modernes.",key:["Le règlement façonne la technique","Les ruptures réglementaires créent des cycles","Lire l’histoire sportive avec l’histoire technique"],traps:["Bonne réponse.","Les règlements changent régulièrement.","La technique est évidemment une dimension majeure de la performance."],follow:"Donne un exemple où un changement de règlement a avantagé une équipe mieux préparée que ses concurrentes.",source:"Formula 1 — Key regulation changes",url:"https://www.formula1.com/en/latest/article/the-key-regulation-changes-in-f1-history-and-the-teams-that-nailed-them.2iq8c5E6S1HOffT5PBLl6i"}
  ]
 },
 f1:{
  label:"Formule 1",
  intro:"Histoire du championnat du monde, ruptures réglementaires, architecture des monoplaces et grandes ères techniques.",
  questions:[
   {id:"f1-1950",level:"confirmed",q:"Que se passe-t-il en 1950 dans l’histoire de la Formule 1 ?",options:["Création du championnat du monde des pilotes","Première utilisation d’un moteur turbo","Création du championnat constructeurs"],answer:0,why:"1950 est la première saison du championnat du monde des pilotes organisé selon la réglementation de Formule 1.",dossier:"Le championnat 1950 compte sept manches, dont les 500 Miles d’Indianapolis. Le championnat des constructeurs n’apparaît qu’en 1958. Giuseppe Farina devient le premier champion du monde des pilotes.",key:["1950 : premier championnat du monde des pilotes","Giuseppe Farina : premier champion","Constructeurs : championnat à partir de 1958"],traps:["Bonne réponse.","Le turbo arrivera bien plus tard.","Le championnat constructeurs commence en 1958."],follow:"Pourquoi Indianapolis figure-t-il au calendrier du championnat du monde jusqu’en 1960 malgré le faible croisement des concurrents ?",source:"Formula 1 — Origins of the championship",url:"https://www.formula1.com/en/latest/article/why-is-it-called-formula-1-and-12-other-questions-about-the-championships.1GHeel6u4jga6hMpX2eFs1"},
   {id:"f1-rear-engine",level:"expert",q:"Pourquoi les Cooper à moteur placé derrière le pilote ont-elles provoqué une rupture à la fin des années 1950 ?",options:["Leur architecture permet notamment une voiture plus compacte, légère et agile, avec une meilleure répartition des masses","Elles avaient quatre roues motrices obligatoires","Le moteur arrière supprimait tout besoin d’aérodynamique"],answer:0,why:"La compacité et la répartition des masses de la configuration Cooper ont montré qu’une petite monoplace agile pouvait battre les puissantes voitures à moteur avant.",dossier:"Stirling Moss gagne en Argentine en 1958 sur une Cooper-Climax engagée par Rob Walker. Jack Brabham remporte ensuite les titres 1959 et 1960 avec Cooper. La disposition moteur derrière le pilote devient rapidement la norme de la F1 moderne.",key:["1958 : victoire de Moss en Cooper","1959–1960 : titres de Jack Brabham","Disparition rapide du moteur avant en F1"],traps:["Bonne réponse.","Ce n’était pas la caractéristique déterminante.","L’aérodynamique reste essentielle."],follow:"Pourquoi une meilleure centralisation des masses aide-t-elle une voiture à changer de direction ?",source:"Formula 1 — Cooper rear-engined revolution",url:"https://www.formula1.com/"},
   {id:"f1-ground-effect",level:"expert",q:"Quel principe a rendu les Lotus 78 puis 79 emblématiques de l’effet de sol en F1 ?",options:["Créer une dépression sous la voiture avec des profils de type aile inversée et mieux contrôler l’écoulement latéral","Augmenter uniquement la puissance moteur","Faire travailler la carrosserie comme un parachute"],answer:0,why:"L’objectif est d’accélérer et contrôler l’air sous la voiture afin de réduire la pression et générer de l’appui avec relativement moins de traînée qu’un appui produit uniquement par de grandes ailes.",dossier:"À la fin des années 1970, Lotus développe des pontons en forme de profils inversés et utilise des jupes pour limiter les fuites latérales. Le concept transforme l’aérodynamique de la F1 et déclenche une course au développement de l’effet de sol.",key:["Dépression sous la voiture","Lotus 78/79","Appui aérodynamique généré par le plancher"],traps:["Bonne réponse.","La puissance moteur n’explique pas l’effet de sol.","Un parachute augmenterait surtout la traînée."],follow:"Pourquoi une voiture à effet de sol est-elle très sensible à sa hauteur de caisse ?",source:"Formula 1 — Technical history",url:"https://www.formula1.com/"},
   {id:"f1-turbo-1983",level:"pro",q:"Pourquoi le titre de Nelson Piquet en 1983 est-il techniquement important ?",options:["Il s’agit du premier titre pilotes de l’ère moderne remporté avec un moteur turbocompressé","C’est le premier titre d’une voiture électrique","Il marque l’interdiction immédiate du turbo"],answer:0,why:"La Brabham-BMW de Piquet démontre que le turbo est devenu une technologie capable de conquérir le championnat pilotes.",dossier:"Les moteurs turbo apparaissent en F1 avec Renault en 1977. Leur puissance augmente fortement au début des années 1980. En 1983, Nelson Piquet gagne le championnat avec une Brabham propulsée par le quatre-cylindres BMW turbo. La technologie domine ensuite avant son interdiction à la fin de 1988.",key:["Renault introduit le turbo en 1977","Piquet champion 1983 avec BMW turbo","Fin de la première ère turbo après 1988"],traps:["Bonne réponse.","La propulsion électrique n’est pas concernée.","Le turbo reste plusieurs saisons."],follow:"Pourquoi un moteur turbo peut-il délivrer beaucoup de puissance malgré une cylindrée plus faible ?",source:"Formula 1 — Regulation changes and turbo era",url:"https://www.formula1.com/"},
   {id:"f1-hybrid-2014",level:"pro",q:"Qu’est-ce qui distingue fondamentalement les groupes propulseurs introduits en F1 en 2014 d’un simple moteur V6 turbo ?",options:["Ils associent moteur thermique, turbo et systèmes de récupération/déploiement d’énergie électrique","Ils fonctionnent sans carburant","Ils utilisent obligatoirement un moteur atmosphérique V12"],answer:0,why:"Le terme power unit reflète l’intégration du V6 turbo avec des systèmes électriques de récupération et de déploiement d’énergie.",dossier:"En 2014, la F1 passe aux V6 1,6 litre turbocompressés hybrides. L’ERS récupère de l’énergie et la restitue pour la performance. Cette architecture impose une gestion fine de l’énergie, du refroidissement, de l’efficacité thermique et du déploiement sur un tour.",key:["V6 1,6 L turbo","Hybridation et récupération d’énergie","Performance = puissance + efficacité + gestion énergétique"],traps:["Bonne réponse.","Le carburant reste nécessaire.","Le V12 n’est pas la formule 2014."],follow:"Pourquoi la gestion énergétique peut-elle modifier la façon dont un pilote attaque ou défend pendant un tour ?",source:"FIA — Formula 1 technical regulations",url:"https://www.fia.com/regulation/category/110"}
  ]
 },
 endurance:{
  label:"Endurance & Le Mans",
  intro:"24 Heures du Mans, grandes ères techniques, gestion de course, fiabilité et stratégie.",
  questions:[
   {id:"end-1923",level:"confirmed",q:"Quel était l’objectif fondateur des premières 24 Heures du Mans en 1923 ?",options:["Tester l’endurance et la fiabilité des automobiles sur une très longue durée","Déterminer la vitesse maximale absolue","Créer immédiatement un championnat de monoplaces"],answer:0,why:"Le projet est pensé comme un immense banc d’essai de fiabilité et d’endurance pour des voitures proches de la production.",dossier:"La première édition se déroule les 26 et 27 mai 1923. Le règlement originel est plus complexe qu’un simple classement à la distance : les concurrents doivent notamment atteindre des objectifs liés à la cylindrée, dans le cadre d’une coupe prévue sur plusieurs années.",key:["1923 : première édition","Fiabilité et endurance au cœur du concept","Règlement initial différent du classement moderne"],traps:["Bonne réponse.","La vitesse pure n’est pas l’objectif principal.","Le Mans concerne les voitures de sport/endurance."],follow:"Pourquoi le règlement de 1923 ne peut-il pas être résumé par « celui qui parcourt le plus de kilomètres gagne » ?",source:"ACO — Naissance des 24 Heures du Mans",url:"https://www.lemans.org/en/news/aco/the-aco-s-120th-anniversary-how-the-24-hours-of-le-mans-came-into-being-60406"},
   {id:"end-1966",level:"expert",q:"Pourquoi l’édition 1966 des 24 Heures du Mans est-elle devenue un symbole de l’histoire industrielle du sport automobile ?",options:["Ford y met fin à la série de victoires Ferrari au général avec la GT40","Porsche y gagne pour la première fois avec la 917","Une voiture diesel gagne pour la première fois"],answer:0,why:"Ford remporte le général en 1966 avec la GT40 après plusieurs années d’efforts, mettant fin à la domination Ferrari du début des années 1960.",dossier:"Le programme GT40 est intimement lié à la rivalité Ford–Ferrari. Après des échecs initiaux, Ford réalise un triplé en 1966 et gagne ensuite Le Mans quatre années de suite, de 1966 à 1969.",key:["1966 : première victoire Ford au général","GT40","Quatre victoires consécutives 1966–1969"],traps:["Bonne réponse.","La première victoire Porsche au général avec la 917 arrive en 1970.","La première victoire diesel arrivera en 2006 avec Audi."],follow:"Pourquoi la GT40 illustre-t-elle autant l’importance de la fiabilité que celle de la vitesse ?",source:"ACO — 24 Hours of Le Mans history",url:"https://www.lemans.org/"},
   {id:"end-groupc",level:"expert",q:"Quelle idée réglementaire est centrale dans le Groupe C lancé en 1982 ?",options:["Limiter principalement la quantité de carburant disponible plutôt que fixer seulement une architecture moteur","Imposer le même moteur à tous les constructeurs","Interdire l’aérodynamique sous la voiture"],answer:0,why:"Le Groupe C encadre fortement la consommation, poussant les constructeurs à rechercher simultanément performance et efficacité énergétique.",dossier:"Le règlement Groupe C ouvre une période majeure de l’endurance. Les ingénieurs disposent d’une liberté moteur relativement importante mais doivent respecter une allocation de carburant. Cela favorise l’efficacité, la gestion de course et des prototypes très rapides comme les Porsche 956/962.",key:["1982 : début du Groupe C","Allocation de carburant","Performance + efficacité"],traps:["Bonne réponse.","Les moteurs ne sont pas monotypes.","L’aérodynamique devient au contraire cruciale."],follow:"Pourquoi une limitation de carburant change-t-elle la stratégie de pilotage même si la voiture est très rapide ?",source:"FIA / ACO — Endurance heritage",url:"https://www.fia.com/"},
   {id:"end-hybrid-2012",level:"pro",q:"Que représente la victoire de l’Audi R18 e-tron quattro au Mans en 2012 ?",options:["La première victoire au général d’une voiture hybride aux 24 Heures du Mans","La première victoire d’une voiture à essence","La dernière course avec ravitaillement"],answer:0,why:"Audi remporte l’épreuve avec une architecture hybride, étape importante dans l’intégration de l’électrification en endurance.",dossier:"La R18 e-tron quattro associe un moteur diesel à un système hybride récupérant de l’énergie au freinage et entraînant l’essieu avant lors du déploiement autorisé. L’endurance devient alors un terrain de développement majeur pour les chaînes de traction électrifiées.",key:["2012 : première victoire hybride au général","Récupération d’énergie au freinage","Hybridation utilisée pour performance et efficacité"],traps:["Bonne réponse.","Les voitures à essence gagnent depuis l’origine.","Le ravitaillement reste un élément stratégique."],follow:"Pourquoi l’endurance est-elle particulièrement pertinente pour développer l’efficacité énergétique ?",source:"ACO — Le Mans history",url:"https://www.lemans.org/"},
   {id:"end-strategy",level:"pro",q:"À rythme au tour égal, quelle équipe possède généralement l’avantage en endurance ?",options:["Celle qui réduit le temps total perdu dans les stands, les erreurs et les phases lentes tout en conservant la fiabilité","Celle qui réalise uniquement le meilleur tour absolu","Celle qui change systématiquement de pneus à chaque arrêt"],answer:0,why:"L’endurance se gagne sur la performance totale : rythme, consommation, pneus, trafic, neutralisations, fiabilité et qualité des arrêts.",dossier:"Une stratégie d’endurance raisonne en temps de course cumulé. Quelques dixièmes gagnés par tour peuvent être annulés par un arrêt plus long, une pénalité ou une dégradation mal anticipée. Le pilote doit aussi gérer le trafic multi-catégories et communiquer précisément avec le stand.",key:["Temps total plutôt que seul meilleur tour","Fiabilité et exécution","Gestion trafic / pneus / énergie / neutralisations"],traps:["Bonne réponse.","Le meilleur tour seul ne suffit pas.","La stratégie pneus dépend du contexte."],follow:"Explique comment une Safety Car ou une Slow Zone peut bouleverser une fenêtre d’arrêt.",source:"FIA WEC — Sporting framework",url:"https://www.fia.com/events/world-endurance-championship"}
  ]
 },
 rallye:{
  label:"Rallye & WRC",
  intro:"Évolution du championnat du monde, transmission intégrale, Groupe B, notes et stratégie sur routes variables.",
  questions:[
   {id:"ral-wrc1973",level:"confirmed",q:"En quelle année débute le Championnat du monde des rallyes de la FIA ?",options:["1973","1950","1987"],answer:0,why:"Le WRC débute en 1973, d’abord avec un championnat des constructeurs.",dossier:"Le Championnat du monde des rallyes est créé en 1973 à partir d’épreuves internationales déjà célèbres. Le titre mondial pilotes n’est instauré qu’ensuite. Le rallye se distingue par des spéciales chronométrées reliées par des secteurs routiers.",key:["1973 : naissance du WRC","Spéciales chronométrées","Épreuves historiques intégrées au championnat"],traps:["Bonne réponse.","1950 correspond au début du championnat du monde F1.","1987 marque surtout le passage de l’après-Groupe B au Groupe A."],follow:"Pourquoi un rallye est-il plus qu’une simple addition de chronos de spéciales ?",source:"WRC — History",url:"https://www.wrc.com/en/misc/wrc-history"},
   {id:"ral-quattro",level:"expert",q:"Pourquoi l’Audi quattro change-t-elle profondément le rallye au début des années 1980 ?",options:["Elle démontre le potentiel de la transmission intégrale combinée à un moteur turbo","Elle supprime le besoin d’un copilote","Elle impose le moteur arrière à tout le plateau"],answer:0,why:"La transmission intégrale permet de transmettre plus efficacement la puissance sur des surfaces à faible adhérence, particulièrement avec des moteurs turbo très puissants.",dossier:"La FIA autorise la transmission intégrale dès 1979, mais beaucoup doutent de son intérêt à cause du poids et de la complexité. Audi démontre rapidement l’avantage du quattro, notamment sur terre, neige ou conditions mixtes. La solution devient une référence du rallye moderne.",key:["4 roues motrices","Turbo","Motricité sur faible adhérence"],traps:["Bonne réponse.","Le copilote reste indispensable.","Le moteur arrière n’est pas imposé."],follow:"Pourquoi la transmission intégrale peut-elle améliorer l’accélération en sortie de virage sur gravier ?",source:"WRC — Group B history",url:"https://www.wrc.com/en/misc/wrc-history"},
   {id:"ral-groupb",level:"expert",q:"Quelle combinaison décrit le mieux l’ère Groupe B du WRC ?",options:["Faible nombre d’exemplaires d’homologation, grande liberté technique et puissances très élevées","Monotype strict et moteurs identiques","Voitures de série presque totalement inchangées"],answer:0,why:"Le Groupe B permet des voitures très spécialisées avec des exigences d’homologation relativement limitées et une grande liberté technique.",dossier:"Introduit au début des années 1980, le Groupe B produit des voitures spectaculaires dépassant parfois 500 ch. La vitesse, l’évolution rapide des performances et les enjeux de sécurité aboutissent à son arrêt à l’issue de la saison 1986.",key:["1982–1986","Grande liberté technique","Fin après une série d’accidents graves"],traps:["Bonne réponse.","Le Groupe B est l’inverse d’un monotype.","Les voitures sont fortement développées pour la compétition."],follow:"Pourquoi une réglementation très libre peut-elle accélérer simultanément innovation et risques ?",source:"WRC — Group B: 1982–1986",url:"https://www.wrc.com/en/misc/wrc-history"},
   {id:"ral-pacenotes",level:"pro",q:"Pourquoi les notes du copilote sont-elles un outil de performance et pas seulement de navigation ?",options:["Elles permettent au pilote d’anticiper géométrie, rythme, dangers et enchaînements avant de les voir","Elles donnent automatiquement la trajectoire parfaite","Elles remplacent l’analyse des conditions de route"],answer:0,why:"Le pilote peut préparer mentalement le virage et ajuster vitesse, placement et freinage avant que toutes les informations visuelles soient disponibles.",dossier:"Les notes codent l’ouverture des virages, distances, bosses, compressions, changements d’adhérence et dangers. Leur efficacité dépend d’un langage commun extrêmement précis entre pilote et copilote. Une note parfaite sur une route qui a évolué reste néanmoins à interpréter.",key:["Anticipation","Langage pilote–copilote","Adaptation aux conditions réelles"],traps:["Bonne réponse.","La trajectoire reste une décision du pilote.","La route peut changer entre reconnaissances et compétition."],follow:"Pourquoi un équipage peut-il modifier ses notes après une première boucle ou des informations d’ouvreurs ?",source:"FIA / WRC — Rally fundamentals",url:"https://www.wrc.com/"},
   {id:"ral-weight-transfer",level:"pro",q:"Dans un virage lent de rallye, pourquoi un bref transfert de charge peut-il aider à faire pivoter la voiture ?",options:["Parce qu’il modifie momentanément la répartition de l’adhérence disponible entre les essieux","Parce qu’il augmente mécaniquement la puissance moteur","Parce qu’il annule les lois de l’adhérence"],answer:0,why:"Freinage, lever de pied ou mouvements de caisse modifient les charges verticales et donc l’équilibre de grip entre avant et arrière.",dossier:"Le pilotage en rallye exploite souvent les transferts pour orienter la voiture avant de remettre la puissance. Le phénomène n’est pas magique : le potentiel d’adhérence d’un pneu n’augmente pas proportionnellement à la charge, et le résultat dépend de la surface, du différentiel, du réglage et du type de transmission.",key:["Transfert longitudinal et latéral","Équilibre avant/arrière","Préparer la rotation avant la remise des gaz"],traps:["Bonne réponse.","Le transfert ne crée pas de puissance.","L’adhérence reste soumise aux lois physiques."],follow:"Pourquoi la même technique doit-elle être adaptée entre asphalte sec, terre et neige ?",source:"FIA — Rally technical resources",url:"https://www.fia.com/"}
  ]
 },
 technique:{
  label:"Technique & dynamique",
  intro:"Adhérence, pneus, aérodynamique, différentiel, transfert de charge et lecture de la télémétrie.",
  questions:[
   {id:"tech-understeer",level:"confirmed",q:"Qu’est-ce que le sous-virage ?",options:["Le train avant atteint sa limite d’adhérence avant le train arrière et la voiture élargit la trajectoire","Le train arrière décroche avant l’avant","Le moteur perd automatiquement de la puissance"],answer:0,why:"Le sous-virage correspond à un déficit relatif de capacité directionnelle du train avant par rapport à ce que demande le pilote.",dossier:"Dire qu’une voiture 'sous-vire' décrit un comportement global. La cause peut être une vitesse d’entrée trop élevée, une sollicitation excessive des pneus avant, un réglage, une température ou une pression de pneus inadaptée, une aérodynamique déséquilibrée ou plusieurs facteurs combinés.",key:["Limite avant atteinte en premier","La voiture ouvre sa trajectoire","Comportement ≠ cause unique"],traps:["Bonne réponse.","Cela décrit plutôt le survirage.","La puissance moteur n’est pas la définition."],follow:"Comment distinguer à la télémétrie un sous-virage provoqué par une entrée trop rapide d’un problème de remise de gaz ?",source:"FIA — Technical education",url:"https://www.fia.com/"},
   {id:"tech-slipangle",level:"expert",q:"Pourquoi un pneu peut-il générer une force latérale alors que sa roue pointe légèrement différemment de sa trajectoire réelle ?",options:["À cause de la déformation de la carcasse et de l’empreinte au sol, ce qui crée un angle de dérive","Parce que le pneu glisse forcément complètement","Parce que la jante tourne moins vite que la voiture"],answer:0,why:"Le pneu se déforme sous charge : l’orientation de la roue et la direction réelle du déplacement ne coïncident pas exactement.",dossier:"L’angle de dérive augmente avec la demande de force latérale jusqu’à une zone de performance maximale puis, selon le pneu, la force peut plafonner ou diminuer. Un pilote rapide travaille donc près de la zone efficace sans dépasser durablement le potentiel du pneu.",key:["Déformation de l’empreinte","Angle de dérive","Pic d’adhérence puis saturation"],traps:["Bonne réponse.","Un angle de dérive n’implique pas un glissement total.","La vitesse de rotation de la jante n’explique pas la force latérale."],follow:"Pourquoi davantage d’angle volant peut-il parfois ne plus faire tourner davantage la voiture ?",source:"FIA — Vehicle dynamics resources",url:"https://www.fia.com/"},
   {id:"tech-diff",level:"expert",q:"À quoi sert principalement un différentiel sur un essieu moteur ?",options:["Permettre aux deux roues de tourner à des vitesses différentes tout en transmettant du couple","Forcer les deux roues à toujours tourner exactement à la même vitesse","Remplacer les freins arrière"],answer:0,why:"En virage, la roue extérieure parcourt une distance plus grande. Le différentiel gère cette différence de vitesse tout en transmettant du couple.",dossier:"En compétition, les différentiels peuvent être ouverts, autobloquants ou pilotés selon la catégorie. Leur tarage influence motricité, rotation à l’entrée, stabilité au freinage et comportement à la remise des gaz.",key:["Différence de vitesse gauche/droite","Transmission du couple","Réglage influençant l’équilibre"],traps:["Bonne réponse.","Un blocage à 100 % n’est pas le fonctionnement normal de tous les différentiels.","Le différentiel ne remplace pas les freins."],follow:"Pourquoi un autobloquant trop agressif peut-il modifier la capacité de la voiture à pivoter en entrée ou en sortie ?",source:"FIA — Technical regulations & education",url:"https://www.fia.com/"},
   {id:"tech-aero",level:"pro",q:"Pourquoi ajouter de l’appui aérodynamique n’est-il pas automatiquement bénéfique sur tout circuit ?",options:["Parce que l’appui s’accompagne généralement de traînée et peut pénaliser vitesse de pointe et efficacité","Parce que l’appui ne fonctionne qu’à l’arrêt","Parce qu’un aileron augmente toujours la consommation sans augmenter le grip"],answer:0,why:"Le réglage aérodynamique est un compromis : plus d’appui peut améliorer le temps dans les virages mais coûter en ligne droite.",dossier:"La bonne configuration dépend de la proportion de virages rapides, des lignes droites, des possibilités de dépassement et de la sensibilité de la voiture. L’appui augmente avec la vitesse, ce qui explique son rôle majeur dans les courbes rapides et son effet plus faible à basse vitesse.",key:["Compromis appui / traînée","Effet croissant avec la vitesse","Réglage dépendant du circuit"],traps:["Bonne réponse.","L’aérodynamique dépend justement du mouvement de l’air.","L’appui augmente bien la charge disponible sur les pneus."],follow:"Pourquoi Monaco et Monza conduisent-ils traditionnellement à des compromis aérodynamiques très différents ?",source:"Formula 1 — Technical features",url:"https://www.formula1.com/"},
   {id:"tech-telemetry",level:"pro",q:"Quel est le meilleur usage d’une télémétrie pilote ?",options:["Corréler plusieurs signaux et le contexte pour comprendre où et pourquoi le temps est gagné ou perdu","Chercher uniquement la vitesse maximale","Modifier un réglage dès qu’une courbe semble différente sans vérifier le reste"],answer:0,why:"Une donnée isolée explique rarement une performance. Il faut croiser vitesse, frein, accélérateur, volant, régime, GPS, températures et contexte.",dossier:"Une comparaison utile synchronise des tours comparables et distingue cause et conséquence. Une vitesse minimale plus faible peut par exemple venir d’un freinage trop tardif, d’une trajectoire différente ou d’un manque d’adhérence. La télémétrie sert à tester des hypothèses, pas à produire automatiquement une vérité.",key:["Corrélation multi-signaux","Comparer des conditions cohérentes","Distinguer cause et conséquence"],traps:["Bonne réponse.","La vitesse maximale n’explique qu’une petite partie d’un tour.","Un seul signal peut être trompeur."],follow:"Si un pilote réaccélère plus tôt mais sort moins vite du virage, quelles autres courbes regarderais-tu ?",source:"FIA — Data and technical education",url:"https://www.fia.com/"}
  ]
 },
 karting:{
  label:"Karting & filière pilote",
  intro:"Dynamique spécifique d’un kart sans différentiel, pneus, réglages, télémétrie et progression vers le haut niveau.",
  questions:[
   {id:"kart-solidaxle",level:"confirmed",q:"Pourquoi un kart de compétition doit-il délester une roue arrière intérieure en virage ?",options:["Parce que l’essieu arrière rigide impose sinon aux deux roues arrière de vouloir tourner à la même vitesse","Pour empêcher les roues avant de braquer","Pour refroidir le moteur"],answer:0,why:"Sans différentiel, les deux roues arrière sont liées par un essieu rigide. En virage, il faut réduire l’appui de la roue intérieure pour limiter le ripage.",dossier:"Le châssis du kart est conçu pour se déformer et créer un transfert diagonal qui aide la roue arrière intérieure à se délester. C’est l’une des raisons pour lesquelles le réglage du train avant, de la chasse, des voies et de la rigidité du châssis influence fortement la rotation.",key:["Pas de différentiel","Essieu arrière rigide","Délestage de la roue arrière intérieure"],traps:["Bonne réponse.","Le braquage avant reste indispensable.","Le délestage n’a pas pour fonction première le refroidissement."],follow:"Pourquoi trop ou trop peu de délestage peut-il rendre un kart lent malgré une bonne adhérence apparente ?",source:"FIA Karting — Technical regulations",url:"https://www.fiakarting.com/"},
   {id:"kart-caster",level:"expert",q:"Quel effet général produit une augmentation de la chasse sur un kart ?",options:["Elle tend à renforcer l’effet de levage diagonal et la mise en charge du train avant","Elle supprime totalement le transfert de charge","Elle réduit toujours et dans tous les cas l’adhérence avant"],answer:0,why:"La géométrie de chasse contribue au jacking effect qui aide à délester la roue arrière intérieure quand le volant est braqué.",dossier:"Plus de chasse peut améliorer la rotation dans certaines conditions, mais elle peut aussi rendre le kart nerveux, fatiguer davantage les pneus ou créer trop de transfert. L’effet réel dépend du châssis, du grip, des pneus, de la voie, de la hauteur et du style de pilotage.",key:["Chasse → jacking effect","Aide au délestage arrière intérieur","Un réglage n’a jamais un effet universel"],traps:["Bonne réponse.","Le transfert reste fondamental.","L’effet n’est pas universellement une perte de grip avant."],follow:"Pourquoi le même réglage de chasse peut-il être efficace le matin et excessif quand la piste gomme ?",source:"FIA Karting — Technical regulations",url:"https://www.fiakarting.com/"},
   {id:"kart-pressure",level:"expert",q:"Pourquoi la pression à froid d’un pneu kart ne doit-elle pas être choisie uniquement pour obtenir le plus de grip au premier tour ?",options:["Parce qu’elle influence aussi la montée en température, l’évolution de pression et la performance sur toute la durée du relais","Parce qu’elle ne change jamais une fois en piste","Parce qu’elle sert seulement à régler la hauteur du kart"],answer:0,why:"La pression évolue avec la température. Un réglage performant doit viser la fenêtre de fonctionnement pendant la phase importante de la course.",dossier:"Une pression initiale plus élevée peut accélérer la montée en température mais aussi conduire à une pression chaude excessive selon le pneu et les conditions. La lecture doit intégrer température de piste, durée du run, style de pilotage et comportement des quatre pneus.",key:["Pression froide ≠ pression de fonctionnement","Température et durée du run","Observer les quatre pneus"],traps:["Bonne réponse.","La pression évolue fortement avec la température.","La hauteur n’est pas sa fonction principale."],follow:"Pourquoi deux pilotes sur le même kart pourraient-ils nécessiter des pressions initiales légèrement différentes ?",source:"FIA Karting — Tyres & technical framework",url:"https://www.fiakarting.com/"},
   {id:"kart-overlap",level:"pro",q:"Que peut révéler un chevauchement frein–accélérateur visible en télémétrie ?",options:["Il peut être volontaire dans certains contextes, mais aussi révéler une transition inefficace ou un automatisme à analyser","Il prouve toujours une erreur grave","Il signifie que le capteur GPS est en panne"],answer:0,why:"Le chevauchement n’a de sens qu’avec le contexte : type de virage, moteur, style, stabilité recherchée et effet réel sur la vitesse.",dossier:"En kart, une analyse sérieuse regarde la durée de chevauchement, la vitesse, le régime, l’angle de volant et le gain/perte au chrono. Une trace différente n’est pas automatiquement mauvaise : il faut vérifier si elle produit une meilleure phase de freinage, rotation et accélération.",key:["Contextualiser les données","Corréler avec vitesse et chrono","Éviter les jugements sur un signal isolé"],traps:["Bonne réponse.","Un chevauchement peut parfois être intentionnel.","Le GPS n’est pas l’explication."],follow:"Comment vérifier si ce chevauchement aide réellement le pilote à faire pivoter le kart ?",source:"FIA Karting — Driver development resources",url:"https://www.fiakarting.com/"},
   {id:"kart-racecraft",level:"pro",q:"Dans une bataille, pourquoi la trajectoire théoriquement la plus rapide n’est-elle pas toujours la meilleure décision ?",options:["Parce que la position de l’adversaire, la défense, le croisement et la sortie du virage peuvent rendre une trajectoire tactique plus rentable","Parce que le chrono n’a aucune importance en course","Parce qu’il faut systématiquement rester à l’intérieur"],answer:0,why:"Le racecraft optimise la position et le temps futur, pas uniquement le temps du virage isolé.",dossier:"Une attaque peut sacrifier l’entrée pour obtenir l’intérieur, préparer un switchback ou empêcher une riposte. À l’inverse, une défense trop agressive peut détruire la vitesse de sortie et exposer au virage suivant. Le pilote doit penser plusieurs secondes et parfois plusieurs virages à l’avance.",key:["Trajectoire chrono ≠ trajectoire tactique","Penser au virage suivant","Position, sortie et possibilité de riposte"],traps:["Bonne réponse.","Le chrono reste central.","L’intérieur n’est pas toujours la meilleure option."],follow:"Décris une situation où laisser l’adversaire plonger à l’intérieur peut préparer un meilleur croisement en sortie.",source:"FIA Karting — Sporting framework",url:"https://www.fiakarting.com/"}
  ]
 },
 circuits:{
  label:"Circuits & monuments",
  intro:"Origine et caractéristiques des grands circuits : Monaco, Monza, Nürburgring, Indianapolis et Le Mans.",
  questions:[
   {id:"cir-monaco",level:"confirmed",q:"En quelle année se dispute le premier Grand Prix de Monaco ?",options:["1929","1950","1966"],answer:0,why:"Le premier Grand Prix de Monaco est organisé en 1929, bien avant la création du championnat du monde de F1.",dossier:"Antony Noghès joue un rôle central dans la création de l’épreuve. Le tracé urbain, étroit et très proche des rails, devient ensuite l’une des courses les plus célèbres du calendrier international.",key:["1929","Antony Noghès","Circuit urbain de la Principauté"],traps:["Bonne réponse.","1950 est l’année du premier championnat F1.","1966 n’est pas l’année de création."],follow:"Pourquoi Monaco constitue-t-il un défi de précision très différent d’un circuit moderne permanent ?",source:"Automobile Club de Monaco — History",url:"https://acm.mc/"},
   {id:"cir-monza",level:"expert",q:"Pourquoi Monza, inauguré en 1922, est-il historiquement associé à la très haute vitesse ?",options:["Son dessin comporte de longues lignes droites et des sections historiquement très rapides, auxquelles s’ajoutait autrefois l’anneau incliné","Parce qu’il ne comporte aucun virage","Parce qu’il est intégralement souterrain"],answer:0,why:"Le Temple of Speed a toujours favorisé des configurations à faible traînée et de très hautes vitesses moyennes.",dossier:"Monza est l’un des plus anciens circuits permanents d’Europe. Son anneau relevé historique et son tracé routier témoignent de différentes époques de conception des circuits. Le tracé moderne impose de gros freinages après de longues phases à pleine charge.",key:["1922","Très haute vitesse","Compromis faible traînée / freinage"],traps:["Bonne réponse.","Le circuit comporte évidemment plusieurs virages et chicanes.","Aucune partie n’est intégralement souterraine."],follow:"Pourquoi une faible traînée est-elle particulièrement recherchée à Monza ?",source:"Autodromo Nazionale Monza — History",url:"https://www.monzanet.it/"},
   {id:"cir-nordschleife",level:"expert",q:"Qu’est-ce qui rend la Nordschleife particulièrement exigeante techniquement ?",options:["Sa longueur, son relief, le grand nombre de virages et la variété des compressions et bosses","Une ligne droite unique sans freinage","Un revêtement parfaitement uniforme sur un tour très court"],answer:0,why:"La Nordschleife cumule énormément de variables sur un seul tour, ce qui complique pilotage, réglage et mémorisation.",dossier:"Ouverte en 1927 autour de Nürburg, la Nordschleife est devenue un monument du sport automobile. Son relief et sa longueur signifient aussi que les conditions peuvent varier d’une portion à l’autre du circuit.",key:["1927","Plus de 20 km selon la configuration","Relief et variété exceptionnels"],traps:["Bonne réponse.","Le circuit possède une multitude de virages.","Le tracé est long et très varié."],follow:"Pourquoi un réglage parfait pour une zone de la Nordschleife peut-il être un compromis ailleurs ?",source:"Nürburgring — History",url:"https://www.nuerburgring.de/"},
   {id:"cir-indy1911",level:"pro",q:"Que faut-il retenir de la première Indianapolis 500 en 1911 ?",options:["Elle installe une épreuve de 500 miles qui deviendra l’un des monuments mondiaux du sport automobile","Elle est la première course automobile de l’histoire","Elle fait déjà partie du championnat IndyCar moderne"],answer:0,why:"L’Indy 500 de 1911 fixe le format de 500 miles qui devient une référence internationale.",dossier:"Ray Harroun remporte l’édition inaugurale. L’Indianapolis Motor Speedway lui-même ouvre avant cela, en 1909. L’épreuve aura plus tard un lien singulier avec la F1 puisqu’elle compte pour le championnat du monde de 1950 à 1960.",key:["1911 : première Indy 500","500 miles","Présente au championnat du monde F1 1950–1960"],traps:["Des compétitions automobiles existent bien avant 1911.","Bonne réponse.","Le cadre sportif actuel est postérieur."],follow:"Pourquoi l’intégration de l’Indy 500 au championnat F1 n’a-t-elle pas créé un véritable affrontement régulier entre les deux mondes ?",source:"Indianapolis Motor Speedway — History",url:"https://www.indianapolismotorspeedway.com/"},
   {id:"cir-le-mans",level:"pro",q:"Pourquoi le circuit des 24 Heures du Mans est-il un cas particulier parmi les grands circuits ?",options:["Il combine des portions permanentes avec des routes normalement ouvertes à la circulation","Il est entièrement dessiné dans un stade","Il n’a jamais été modifié depuis 1923"],answer:0,why:"Le circuit de la Sarthe est un tracé semi-permanent qui utilise encore des sections de routes publiques.",dossier:"Le tracé a beaucoup évolué pour des raisons de vitesse, de sécurité et d’aménagement. Son caractère semi-permanent et ses longues phases à haute vitesse imposent des compromis uniques en aérodynamique, freinage et fiabilité.",key:["Circuit semi-permanent","Routes publiques intégrées","Évolution régulière du tracé"],traps:["Bonne réponse.","Le Mans n’est pas un circuit de stade.","Le tracé a été modifié de nombreuses fois."],follow:"Pourquoi les longues lignes droites du Mans influencent-elles fortement le compromis entre appui et traînée ?",source:"ACO — Circuit history",url:"https://www.lemans.org/"}
  ]
 },
 legends:{
  label:"Pilotes & grandes figures",
  intro:"Pilotes, ingénieurs et personnalités dont la carrière aide à comprendre l’évolution du sport automobile.",
  questions:[
   {id:"leg-fangio",level:"confirmed",q:"Pourquoi Juan Manuel Fangio est-il une figure exceptionnelle des années 1950 ?",options:["Il remporte cinq titres mondiaux F1 avec quatre constructeurs différents","Il est le premier pilote à gagner neuf titres WRC","Il gagne les 24 Heures du Mans six fois"],answer:0,why:"Fangio remporte cinq championnats entre 1951 et 1957 en pilotant pour Alfa Romeo, Maserati, Mercedes et Ferrari.",dossier:"Son palmarès est d’autant plus remarquable que les saisons sont courtes et les voitures très dangereuses. Son titre de 1957, à 46 ans, reste associé à sa célèbre remontée au Nürburgring.",key:["5 titres F1","4 constructeurs différents","Dernier titre en 1957"],traps:["Bonne réponse.","Les neuf titres WRC concernent Sébastien Loeb.","Les six victoires au Mans sont associées notamment à Jacky Ickx."],follow:"Que révèle la capacité de Fangio à gagner avec plusieurs constructeurs sur son adaptabilité ?",source:"Formula 1 — Hall of Fame / Juan Manuel Fangio",url:"https://www.formula1.com/"},
   {id:"leg-grahamhill",level:"expert",q:"Pourquoi Graham Hill est-il associé à la « Triple Crown » du sport automobile ?",options:["Il est le seul pilote à avoir remporté Monaco en F1, les 500 Miles d’Indianapolis et les 24 Heures du Mans","Il a remporté F1, WRC et MotoGP","Il a gagné trois fois chaque Grand Prix"],answer:0,why:"La Triple Crown traditionnelle associe le Grand Prix de Monaco, l’Indy 500 et les 24 Heures du Mans. Graham Hill est le seul pilote à avoir gagné les trois.",dossier:"Hill gagne Monaco à cinq reprises, Indianapolis en 1966 et Le Mans en 1972. La Triple Crown n’est pas un championnat officiel mais une référence culturelle majeure du sport automobile.",key:["Monaco","Indianapolis 500","24 Heures du Mans"],traps:["Bonne réponse.","Cette combinaison n’est pas la Triple Crown.","Le terme ne signifie pas trois victoires partout."],follow:"Pourquoi ces trois épreuves demandent-elles des qualités de pilotage et de préparation très différentes ?",source:"Formula 1 / ACO / IMS histories",url:"https://www.formula1.com/"},
   {id:"leg-mouton",level:"expert",q:"Quel exploit résume le mieux l’importance de Michèle Mouton dans l’histoire du WRC ?",options:["Elle remporte plusieurs rallyes mondiaux et termine vice-championne du monde en 1982","Elle devient championne du monde F1","Elle gagne l’Indy 500 cinq fois"],answer:0,why:"Michèle Mouton gagne quatre rallyes WRC et se bat pour le titre 1982, qu’elle termine à la deuxième place.",dossier:"Pilote officielle Audi, elle devient en 1981 la première femme à remporter une manche du championnat du monde des rallyes, au Sanremo. Sa saison 1982 constitue l’une des performances majeures de l’histoire du rallye.",key:["Victoire WRC au Sanremo 1981","4 victoires WRC","Vice-championne 1982"],traps:["Bonne réponse.","Elle n’a pas couru pour un titre F1.","Elle n’a pas remporté l’Indy 500."],follow:"Pourquoi l’ère Audi quattro était-elle particulièrement exigeante pour les pilotes au début des années 1980 ?",source:"WRC — History & legends",url:"https://www.wrc.com/"},
   {id:"leg-ickx",level:"pro",q:"Pourquoi Jacky Ickx est-il indissociable de l’histoire des 24 Heures du Mans ?",options:["Ses six victoires au général ont longtemps constitué le record de l’épreuve","Il y a remporté quinze titres de F1","Il a conçu le premier moteur diesel"],answer:0,why:"Jacky Ickx remporte Le Mans six fois entre 1969 et 1982 et devient l’une des grandes références de l’endurance.",dossier:"Sa carrière montre aussi la polyvalence des pilotes de son époque : F1, endurance, Can-Am et rallye-raid. Son départ volontairement lent au Mans 1969 est également resté célèbre dans le débat sur la sécurité du départ traditionnel.",key:["6 victoires au Mans","1969–1982","Polyvalence F1 / endurance / rallye-raid"],traps:["Bonne réponse.","Il n’a pas remporté quinze titres F1.","Il n’est pas le concepteur du premier diesel."],follow:"Pourquoi le départ du Mans traditionnel posait-il un problème de sécurité que certains pilotes dénonçaient ?",source:"ACO — Le Mans legends",url:"https://www.lemans.org/"},
   {id:"leg-loeb",level:"pro",q:"Qu’est-ce qui rend la série de titres de Sébastien Loeb particulièrement exceptionnelle en WRC ?",options:["Neuf titres consécutifs de 2004 à 2012","Neuf titres répartis sur trente ans","Neuf victoires aux 24 Heures du Mans"],answer:0,why:"Loeb remporte neuf championnats du monde des rallyes consécutifs avec Citroën, de 2004 à 2012.",dossier:"Au-delà du nombre de titres, sa carrière se distingue par une très forte polyvalence de surfaces et une remarquable régularité. Il réussit également dans d’autres disciplines, ce qui renforce son statut de référence du sport automobile français.",key:["9 titres WRC","2004–2012","Citroën"],traps:["Bonne réponse.","Ils sont consécutifs.","Le Mans n’est pas concerné."],follow:"Pourquoi la polyvalence asphalte/terre/neige est-elle essentielle pour dominer un championnat WRC ?",source:"WRC — Sébastien Loeb",url:"https://www.wrc.com/"}
  ]
 },
 safety:{
  label:"Sécurité & évolution",
  intro:"Cellule de survie, HANS, Halo, circuits et évolution de la culture de sécurité.",
  questions:[
   {id:"safe-hans",level:"confirmed",q:"Quelle est la fonction principale du système HANS / FHR ?",options:["Limiter les mouvements relatifs dangereux de la tête et du cou lors d’un choc frontal","Augmenter l’appui aérodynamique","Maintenir la température du pilote"],answer:0,why:"Le dispositif limite le déplacement de la tête par rapport au torse et réduit les risques de lésions graves de la tête et du cou lors de fortes décélérations.",dossier:"Le HANS est développé à partir des années 1980. La FIA s’y intéresse dans les années 1990 et il devient obligatoire en F1 en 2003, avant une généralisation progressive dans les grandes catégories.",key:["Protection tête/cou","F1 : obligatoire en 2003","FHR = Frontal Head Restraint"],traps:["Bonne réponse.","Le HANS n’est pas un élément aérodynamique.","Il n’est pas un système de refroidissement."],follow:"Pourquoi une ceinture seule ne suffit-elle pas à protéger le cou lors d’un choc frontal violent ?",source:"FIA — Safety in our HANS",url:"https://www.fia.com/news/auto-medical-safety-our-hans"},
   {id:"safe-halo",level:"expert",q:"À partir de quelle saison le Halo devient-il obligatoire en Formule 1 ?",options:["2018","2003","1994"],answer:0,why:"La FIA confirme son introduction pour la saison 2018 après plusieurs années de recherche sur la protection frontale du cockpit.",dossier:"Le Halo est un dispositif de protection de la tête destiné notamment aux risques de gros objets ou d’impacts autour de l’ouverture du cockpit. Il devient ensuite obligatoire dans les catégories de monoplaces FIA.",key:["2018 en F1","Protection frontale du cockpit","Déploiement dans les monoplaces FIA"],traps:["Bonne réponse.","2003 correspond à l’obligation du HANS en F1.","1994 marque une accélération majeure des travaux de sécurité mais pas l’arrivée du Halo."],follow:"Pourquoi la sécurité moderne combine-t-elle plusieurs couches de protection plutôt qu’un dispositif unique ?",source:"FIA — Halo confirmed for 2018",url:"https://www.fia.com/news/f1-strategy-group-meeting-fia-confirms-halo-system-use-2018-fia-formula-one-world-championship"},
   {id:"safe-1994",level:"expert",q:"Pourquoi le week-end d’Imola 1994 constitue-t-il un tournant majeur pour la sécurité en F1 ?",options:["Les accidents mortels de Roland Ratzenberger et Ayrton Senna accélèrent une refonte profonde des mesures de sécurité","La F1 y interdit définitivement les casques","Il marque la première course sans commissaires"],answer:0,why:"La tragédie d’Imola accélère une série de changements touchant voitures, circuits, procédures et recherche médicale.",dossier:"Après 1994, la FIA renforce son approche systémique : crash-tests, structures de survie, circuits, protection de la tête, recherche accidentologique et intervention médicale. La sécurité devient de plus en plus une discipline d’ingénierie mesurée et continue.",key:["Imola 1994","Approche systémique","Voitures + circuits + médecine + procédures"],traps:["Bonne réponse.","Les casques sont évidemment essentiels.","Les commissaires restent indispensables."],follow:"Pourquoi une amélioration de sécurité efficace doit-elle agir à la fois sur la voiture, le circuit et l’intervention médicale ?",source:"FIA — Legacy of Safety",url:"https://www.fia.com/news/legacy-safety-how-fia-responded-tragedy-imola-1994-and-launched-drive-safer-racing"},
   {id:"safe-survivalcell",level:"pro",q:"Quel est le principe d’une cellule de survie moderne ?",options:["Créer un volume extrêmement résistant autour du pilote tout en laissant d’autres structures absorber progressivement l’énergie du choc","Rendre toute la voiture totalement rigide","Empêcher toute déformation de l’avant et de l’arrière"],answer:0,why:"Une structure de sécurité efficace protège l’habitacle tout en utilisant des zones conçues pour se déformer et dissiper l’énergie.",dossier:"La sécurité passive ne consiste pas à fabriquer une voiture indéformable. Une décélération trop brutale serait dangereuse pour le corps humain. Les structures d’impact, crash-boxes et barrières travaillent avec la cellule de survie et les systèmes de retenue pour gérer l’énergie.",key:["Cellule résistante autour du pilote","Zones sacrificielles d’absorption","Gestion de la décélération"],traps:["Bonne réponse.","Une rigidité totale transmettrait davantage d’énergie au pilote.","Les structures externes sont justement conçues pour absorber de l’énergie."],follow:"Pourquoi une barrière déformable peut-elle être plus sûre qu’un mur parfaitement rigide ?",source:"FIA — Safety research",url:"https://www.fia.com/safety"},
   {id:"safe-data",level:"pro",q:"Pourquoi l’analyse détaillée des accidents est-elle devenue une composante essentielle de la sécurité moderne ?",options:["Parce que les données permettent de comprendre les mécanismes d’impact et de tester objectivement les améliorations","Parce qu’elle sert seulement à attribuer des responsabilités","Parce qu’un accident n’apporte aucune information technique"],answer:0,why:"Les données d’accident transforment un événement en informations utilisables pour améliorer véhicules, équipements, circuits et procédures.",dossier:"La FIA utilise notamment enregistreurs de données, caméras haute vitesse et analyses biomécaniques. L’objectif est d’identifier les charges, trajectoires d’impact et défaillances potentielles afin de faire évoluer normes et équipements.",key:["Accident data recorders","Caméras haute vitesse","Boucle d’amélioration continue"],traps:["Bonne réponse.","L’objectif sécurité dépasse largement la recherche de responsabilité.","Un accident réel fournit de précieuses données."],follow:"Quel avantage apporte une caméra à haute fréquence d’images pour comprendre le mouvement de la tête du pilote ?",source:"FIA — Safety research after Imola",url:"https://www.fia.com/news/legacy-safety-how-fia-responded-tragedy-imola-1994-and-launched-drive-safer-racing"}
  ]
 }
};

const ENGLISH_QUESTIONS={
 starter:{pre:['Hello! Can you introduce yourself and tell me what you are racing today?','What is your main goal for this race?','What do you enjoy most about karting?'],post:['How was your race today?','What did you learn?','Who would you like to thank?'],podium:['How do you feel after this result?','What was the key moment of your race?','What is your next goal?'],difficult:['It was a difficult day. What happened?','What positive lesson can you take from today?','How will you prepare for the next race?'],partner:['Can you introduce ROAD TO P1?','Why are partners important to your project?','What would you like to say to them?']},
 racing:{pre:['How have you prepared for this race weekend?','What will be the biggest technical challenge today?','What result would make this a successful weekend?'],post:['Talk me through the most important moment of your race.','Where did you make the biggest step forward this weekend?','What will you work on before the next event?'],podium:['How did you manage the pressure in the closing laps?','What made the difference today?','How important was your team in achieving this result?'],difficult:['The result did not meet your expectations. How do you assess the weekend?','Was there anything you could have done differently?','How do you turn disappointment into progress?'],partner:['How does partner support improve your sporting programme?','What values do you share with ROAD TO P1 partners?','How could a company become part of your journey?']},
 pro:{pre:['What are the key performance indicators you will focus on this weekend?','How do you balance outright pace with consistency and race management?','What message would you like to send to your competitors?'],post:['How did the evolving track conditions influence your decisions?','Which part of your performance gives you the most confidence for the next round?','How would you summarize the weekend for your team and partners?'],podium:['At what point did you believe the result was within reach?','How did you control your emotions under pressure?','Where does this performance fit into your long-term ambition?'],difficult:['Some observers say you failed to deliver when it mattered. How do you respond?','How much responsibility do you take for today’s result?','What concrete change will you make before the next event?'],partner:['What measurable value can your project offer to a partner?','How would you activate a partnership beyond logo visibility?','Why is equality of opportunity central to ROAD TO P1?']}
};

function openTrainingTab(tab){document.querySelectorAll('[data-training-tab]').forEach(b=>b.classList.toggle('active',b.dataset.trainingTab===tab));document.querySelectorAll('.training-pane').forEach(p=>p.classList.toggle('active',p.id===`training-${tab}`));if(tab==='learning')renderLessons();if(tab==='culture')renderCultureThemes();}
function renderLessons(){
 $('learningModules').innerHTML=LESSONS.map(l=>`<article class="lesson-card ${D.learning.includes(l.id)?'done':''}" data-lesson="${l.id}"><div class="lesson-number">${l.number}</div><div><span>${D.learning.includes(l.id)?'TERMINÉ':'LEÇON'} • ${l.duration}</span><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p></div></article>`).join('');
 document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>showLesson(b.dataset.lesson));updateTrainingProgress();
}
function showLesson(id){const l=LESSONS.find(x=>x.id===id);if(!l)return;$('lessonPanel').innerHTML=`<div class="lesson-content"><div class="lesson-kicker">LEÇON ${l.number} • ${l.duration}</div><h2>${esc(l.title)}</h2>${l.content.map((p,i)=>`<div class="lesson-point"><b>${i+1}</b><p>${esc(p)}</p></div>`).join('')}<div class="lesson-exercise"><span>À TOI DE JOUER</span><p>${esc(l.exercise)}</p></div><div class="lesson-footer"><a href="${l.url}" target="_blank" rel="noopener">Source ouverte : ${esc(l.source)} ↗</a><button class="btn primary" id="completeLesson">${D.learning.includes(id)?'Leçon terminée ✓':'Marquer comme terminée'}</button></div></div>`;$('completeLesson').onclick=()=>{if(!D.learning.includes(id)){D.learning.push(id);log(`Media Training • Leçon terminée • ${l.title}`);save();renderLessons();showLesson(id);toast('Progression enregistrée.')}}}
function cultureMasteryCount(theme,level=D.culture.level){
 const qs=(CULTURE[theme]?.questions||[]).filter(q=>CULTURE_LEVELS[q.level]<=CULTURE_LEVELS[level]);
 const mastered=D.culture.mastery?.[theme]||{};
 return {done:qs.filter(q=>mastered[q.id]).length,total:qs.length};
}
function cultureOverallMastery(){
 return Object.keys(CULTURE).reduce((a,t)=>{const m=cultureMasteryCount(t);a.done+=m.done;a.total+=m.total;return a},{done:0,total:0});
}
function updateTrainingProgress(){const lessonPart=D.learning.length/LESSONS.length*50,practicePart=Math.min(D.training.length,5)/5*25,m=cultureOverallMastery(),culturePart=m.total?m.done/m.total*15:0,englishPart=Math.min(D.english.length,2)/2*10;$('trainingProgress').textContent=`${Math.round(lessonPart+practicePart+culturePart+englishPart)}%`}
function getCultureQuestions(theme){
 const level=$('cultureLevel')?.value||D.culture.level||'pro';
 D.culture.level=level;
 return (CULTURE[theme]?.questions||[]).filter(q=>CULTURE_LEVELS[q.level]<=CULTURE_LEVELS[level]);
}
function renderCultureThemes(){
 if($('cultureLevel'))$('cultureLevel').value=D.culture.level||'pro';
 $('cultureThemes').innerHTML=Object.entries(CULTURE).map(([id,t])=>{const m=cultureMasteryCount(id);return `<button class="culture-theme ${cultureTheme===id?'active':''}" data-culture-theme="${id}"><span>◉</span><b>${esc(t.label)}</b><small>${m.done}/${m.total} maîtrisées</small></button>`}).join('');
 document.querySelectorAll('[data-culture-theme]').forEach(b=>b.onclick=()=>startCulture(b.dataset.cultureTheme));
 const all=cultureOverallMastery();
 $('cultureScore').textContent=`${all.done}/${all.total} notions maîtrisées`;
 if($('cultureStats'))$('cultureStats').innerHTML=`<b>${all.total?Math.round(all.done/all.total*100):0}%</b><span>maîtrise globale • niveau ${D.culture.level==='confirmed'?'confirmé':D.culture.level==='expert'?'expert':'pro'}</span><small>${D.culture.total||0} réponses données</small>`;
}
function startCulture(theme){cultureTheme=theme;cultureIndex=0;renderCultureThemes();showCultureQuestion()}
function showCultureQuestion(){
 const qs=getCultureQuestions(cultureTheme),q=qs[cultureIndex%Math.max(1,qs.length)];if(!q)return;
 const theme=CULTURE[cultureTheme],m=cultureMasteryCount(cultureTheme);
 $('cultureBadge').textContent=`${theme.label.toUpperCase()} • ${q.level.toUpperCase()}`;
 $('cultureQuestion').innerHTML=`<span class="culture-question-count">QUESTION ${cultureIndex%qs.length+1}/${qs.length} • ${m.done} NOTION${m.done>1?'S':''} MAÎTRISÉE${m.done>1?'S':''}</span>${esc(q.q)}`;
 $('cultureOptions').innerHTML=q.options.map((o,i)=>`<button data-culture-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${esc(o)}</button>`).join('');
 $('cultureFeedback').innerHTML='';
 $('cultureFeedback').className='quiz-feedback';
 if($('cultureDossier'))$('cultureDossier').innerHTML=`<div class="culture-intro"><b>À connaître avant de répondre</b><p>${esc(theme.intro)}</p></div>`;
 $('cultureNext').disabled=true;
 document.querySelectorAll('[data-culture-answer]').forEach(b=>b.onclick=()=>answerCulture(Number(b.dataset.cultureAnswer),q));
}
function answerCulture(choice,q){
 document.querySelectorAll('[data-culture-answer]').forEach((b,i)=>{b.disabled=true;b.classList.toggle('correct',i===q.answer);b.classList.toggle('wrong',i===choice&&choice!==q.answer)});
 D.culture.total=(D.culture.total||0)+1;
 if(choice===q.answer)D.culture.correct=(D.culture.correct||0)+1;
 D.culture.byTheme[cultureTheme]=D.culture.byTheme[cultureTheme]||{correct:0,total:0};
 D.culture.byTheme[cultureTheme].total++;
 if(choice===q.answer)D.culture.byTheme[cultureTheme].correct++;
 D.culture.mastery[cultureTheme]=D.culture.mastery[cultureTheme]||{};
 if(choice===q.answer)D.culture.mastery[cultureTheme][q.id]=true;
 D.culture.history.unshift({theme:cultureTheme,id:q.id,level:q.level,correct:choice===q.answer,at:now()});
 D.culture.history=D.culture.history.slice(0,250);
 $('cultureFeedback').className=`quiz-feedback ${choice===q.answer?'correct':'wrong'}`;
 $('cultureFeedback').innerHTML=`<b>${choice===q.answer?'Bonne réponse.':'Réponse à revoir.'}</b> ${esc(q.why)}`;
 const wrongs=q.traps.map((t,i)=>i===q.answer?'':`<li><b>${String.fromCharCode(65+i)}.</b> ${esc(t)}</li>`).filter(Boolean).join('');
 $('cultureDossier').innerHTML=`<article class="culture-dossier"><div class="dossier-head"><span>FICHE EXPLICATIVE</span><b>${esc(CULTURE[cultureTheme].label)} • ${q.level.toUpperCase()}</b></div><p class="dossier-summary">${esc(q.dossier)}</p><div class="dossier-grid"><div><h4>À retenir</h4><ul>${q.key.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h4>Pourquoi les autres réponses ne conviennent pas</h4><ul>${wrongs}</ul></div></div><div class="dossier-follow"><span>QUESTION D’ORAL</span><p>${esc(q.follow)}</p></div><a class="dossier-source" href="${q.url}" target="_blank" rel="noopener">Source ouverte : ${esc(q.source)} ↗</a></article>`;
 $('cultureNext').disabled=false;save();renderCultureThemes();updateTrainingProgress();
}
function nextCulture(){if(!cultureTheme)return;const qs=getCultureQuestions(cultureTheme);cultureIndex=(cultureIndex+1)%Math.max(1,qs.length);showCultureQuestion()}
function speakEnglish(text){if(!('speechSynthesis'in window))return;$('enStatus').textContent='Journalist speaking';$('enStatusDot').classList.add('live');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=.92;u.onend=()=>{$('enStatus').textContent='Your turn';$('enStatusDot').classList.remove('live')};speechSynthesis.speak(u)}
function appendSpeech(role,text){$('enConversation').insertAdjacentHTML('beforeend',`<div class="speech ${role}"><b>${role==='journalist'?'Journalist':esc($('enPilot').value)}</b><p>${esc(text)}</p></div>`);$('enConversation').scrollTop=$('enConversation').scrollHeight}
function startEnglish(){const level=$('enLevel').value,scenario=$('enScenario').value,questions=ENGLISH_QUESTIONS[level][scenario];englishInterview={level,scenario,questions,index:0,answers:[],started:now()};$('enConversation').innerHTML='';askEnglishQuestion();$('enStatus').textContent='Interview started';$('enHint').textContent='Listen to the journalist, then press “Answer” and speak naturally.'}
function askEnglishQuestion(){if(!englishInterview)return endEnglish();const q=englishInterview.questions[englishInterview.index];if(!q)return endEnglish();appendSpeech('journalist',q);speakEnglish(q)}
function listenEnglish(){if(englishInterview)speakEnglish(englishInterview.questions[englishInterview.index])}
function answerEnglish(){if(!englishInterview)return toast('Start the interview first.');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('enHint').textContent='Voice recognition is not available in this browser.';return}if(englishRecognition)try{englishRecognition.stop()}catch(e){};englishRecognition=new SR();englishRecognition.lang='en-GB';englishRecognition.interimResults=false;$('enStatus').textContent='Listening…';$('enStatusDot').classList.add('live');englishRecognition.onresult=e=>{const answer=e.results[0][0].transcript;englishInterview.answers.push({question:englishInterview.questions[englishInterview.index],answer});appendSpeech('driver',answer);englishInterview.index++;setTimeout(askEnglishQuestion,500)};englishRecognition.onerror=e=>{$('enHint').textContent=`Microphone: ${e.error}`};englishRecognition.onend=()=>{$('enStatusDot').classList.remove('live');englishRecognition=null};try{englishRecognition.start()}catch(e){}}
function endEnglish(){if(!englishInterview)return;const x={id:uid('e'),pilot:$('enPilot').value,level:englishInterview.level,scenario:englishInterview.scenario,answers:englishInterview.answers,created:now()};D.english.unshift(x);log(`Improve Your English • ${x.pilot} • ${x.answers.length} réponse${x.answers.length>1?'s':''}`);save();const words=x.answers.reduce((n,a)=>n+a.answer.split(/\s+/).length,0);$('enSummary').innerHTML=`<div class="english-report"><span>INTERVIEW COMPLETE</span><h3>${esc(x.pilot)} • ${esc($('enLevel').selectedOptions[0].textContent)}</h3><div class="english-metrics"><div><b>${x.answers.length}</b><small>answers</small></div><div><b>${words}</b><small>words spoken</small></div><div><b>${x.answers.length?Math.round(words/x.answers.length):0}</b><small>words / answer</small></div></div><p><b>Next step:</b> use one clear idea, one concrete example and a short closing sentence in every answer.</p><p class="api-note">Preview mode: the browser provides speech recognition and voice. The secure OpenAI Realtime connection will add truly adaptive follow-up questions and detailed pronunciation feedback.</p></div>`;$('enStatus').textContent='Complete';englishInterview=null;updateTrainingProgress()}

const QUESTIONS={fr:{race:['Comment résumerais-tu ta course en trois phrases ?','Quel a été le moment le plus difficile de ton week-end ?','De quoi es-tu le plus satisfait aujourd’hui ?','Qu’as-tu appris pendant cette course ?','Quel est ton objectif pour la prochaine épreuve ?','Comment expliques-tu ta progression aujourd’hui ?'],sponsor:['Que représente le soutien des partenaires pour ton projet ?','Comment présenterais-tu ROAD TO P1 à une entreprise ?','Pourquoi une marque devrait-elle suivre ton aventure ?','Comment remercierais-tu un partenaire après une course ?'],quick:['Quel est ton objectif cette saison ?','Pourquoi aimes-tu le karting ?','Quelle est ta plus grande qualité en piste ?','Quel pilote t’inspire et pourquoi ?'],pressure:['Tu as fait une erreur qui t’a coûté plusieurs places. Que réponds-tu ?','Ton résultat est décevant : qu’est-ce que tu retiens malgré tout ?','Un concurrent te critique après la course. Comment réagis-tu au micro ?','Pourquoi devrions-nous croire à ton projet si les résultats tardent à venir ?']},en:{race:['How would you summarize your race weekend in three sentences?','What was the most difficult moment of the weekend?','What are you most satisfied with today?','What did you learn during this race?','What is your goal for the next event?'],sponsor:['What does partner support mean to your racing project?','How would you introduce ROAD TO P1 to a company?','Why should a brand follow your journey?','How would you thank a partner after a race?'],quick:['What is your main goal this season?','Why do you enjoy karting?','What is your strongest quality on track?','Which driver inspires you and why?'],pressure:['You made a mistake that cost you several positions. How do you explain it?','The result is disappointing. What can you still take from the weekend?','A rival criticizes you after the race. How do you respond?','Why should a partner believe in your project before major results arrive?']}};
function newQuestion(){const lang=$('trLang').value,format=$('trFormat').value,a=QUESTIONS[lang][format];currentQuestion=a[Math.floor(Math.random()*a.length)];$('trQuestion').textContent=currentQuestion;$('trAnswer').value='';$('trEvaluation').className='evaluation empty-eval';$('trEvaluation').textContent='Répondez puis lancez l’évaluation.';$('trBadge').textContent=`${$('trPilot').value.toUpperCase()} • ${lang.toUpperCase()}`;$('trFormatLabel').textContent=$('trFormat').selectedOptions[0].textContent}
function evaluate(){
 const answer=$('trAnswer').value.trim();if(!currentQuestion)return toast('Lancez d’abord une question.');if(!answer)return toast('Ajoutez une réponse.');
 const lang=$('trLang').value,words=answer.split(/\s+/).filter(Boolean),sent=(answer.match(/[.!?]/g)||[]).length;let clarity=Math.min(100,55+Math.min(30,sent*8)+Math.min(15,words.length/4));let concision=Math.max(45,100-Math.max(0,words.length-75)*.8);let structure=Math.min(100,50+(sent>=2?20:0)+(words.length>=20?15:0)+(words.length<=90?15:5));const fillers=lang==='fr'?['euh','bah','du coup','voilà','genre']:['um','uh','like','you know'];const hits=fillers.reduce((n,w)=>n+(answer.toLowerCase().split(w).length-1),0);let fluency=Math.max(40,92-hits*12);const avg=Math.round((clarity+concision+structure+fluency)/4);const tips=[];
 if(words.length<18)tips.push(lang==='fr'?'Développer davantage la réponse.':'Develop the answer a little more.');if(words.length>95)tips.push(lang==='fr'?'Raccourcir pour garder un message fort.':'Make the answer shorter and more focused.');if(sent<2)tips.push(lang==='fr'?'Structurer en 2 ou 3 idées distinctes.':'Structure the answer into 2 or 3 clear ideas.');if(hits)tips.push(lang==='fr'?'Réduire les mots de remplissage.':'Reduce filler words.');if(!tips.length)tips.push(lang==='fr'?'Bonne base : travailler maintenant le ton, le regard et le sourire.':'Good base: now work on tone, eye contact and smile.');
 const x={id:uid('t'),pilot:$('trPilot').value,lang,format:$('trFormat').value,question:currentQuestion,answer,scores:{clarity:Math.round(clarity),concision:Math.round(concision),structure:Math.round(structure),fluency:Math.round(fluency),avg},tips,created:now()};D.training.unshift(x);log(`Media Training • ${x.pilot} • ${lang.toUpperCase()} • ${avg}/100`);save();showEval(x);renderTraining();toast('Session enregistrée.');
}
function showEval(x){$('trEvaluation').className='evaluation';$('trEvaluation').innerHTML=`<div class="score-grid"><div class="score-box"><b>${x.scores.clarity}</b><span>Clarté</span></div><div class="score-box"><b>${x.scores.concision}</b><span>Concision</span></div><div class="score-box"><b>${x.scores.structure}</b><span>Structure</span></div><div class="score-box"><b>${x.scores.fluency}</b><span>Aisance</span></div></div><p><b>Score global : ${x.scores.avg}/100</b></p>${x.tips.map(t=>`<p>• ${esc(t)}</p>`).join('')}`}
function renderTraining(){
 $('trCount').textContent=`${D.training.length} session${D.training.length>1?'s':''}`;
 $('trList').innerHTML=D.training.length?D.training.slice(0,30).map(x=>`<div class="list-item"><div><h4>${esc(x.pilot)} • ${x.lang.toUpperCase()} • ${x.scores.avg}/100</h4><div class="list-meta">${fd(x.created)} • ${esc(x.question)}</div><p>${esc(x.answer.slice(0,170))}${x.answer.length>170?'…':''}</p></div><div class="mini-actions"><button data-tr-open="${x.id}">Voir</button></div></div>`).join(''):'<div class="empty">Aucune session enregistrée.</div>';
 document.querySelectorAll('[data-tr-open]').forEach(b=>b.onclick=()=>{const x=D.training.find(x=>x.id===b.dataset.trOpen);if(!x)return;currentQuestion=x.question;$('trPilot').value=x.pilot;$('trLang').value=x.lang;$('trFormat').value=x.format;$('trQuestion').textContent=x.question;$('trAnswer').value=x.answer;$('trBadge').textContent=`${x.pilot.toUpperCase()} • ${x.lang.toUpperCase()}`;showEval(x);window.scrollTo({top:0,behavior:'smooth'})});
 renderLessons();renderCultureThemes();updateTrainingProgress();
}
function startMic(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('trHint').textContent='Reconnaissance vocale indisponible dans ce navigateur. Vous pouvez répondre au clavier.';return}stopMic();recognition=new SR();recognition.lang=$('trLang').value==='en'?'en-GB':'fr-FR';recognition.continuous=true;recognition.interimResults=false;$('trHint').textContent='Micro actif — parlez naturellement.';recognition.onresult=e=>{const text=Array.from(e.results).slice(e.resultIndex).filter(r=>r.isFinal).map(r=>r[0].transcript).join(' ');$('trAnswer').value+=( $('trAnswer').value?' ':'')+text};recognition.onerror=e=>{$('trHint').textContent='Dictée interrompue : '+e.error};recognition.onend=()=>{recognition=null};try{recognition.start()}catch(e){}}
function stopMic(){if(recognition){try{recognition.stop()}catch(e){}recognition=null}$('trHint').textContent='Dictée arrêtée. Vous pouvez corriger la réponse au clavier.'}

function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbAll(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
async function dbPut(x){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(x);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbRemove(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function categoryFor(file,chosen){if(chosen&&chosen!=='Automatique')return chosen;if(file.type.startsWith('image/'))return 'Photo';if(file.type.startsWith('video/'))return 'Vidéo';return 'Document'}

const librarySelected=new Set();
let libraryFolder=null,libraryBusy=false,previewAssetId='';
const folderName=x=>(x.event||'').trim()||'Sans dossier';
function mediaType(x){
 const type=x.type||x.blob?.type||'';
 if(type&&type!=='application/octet-stream')return type;
 const ext=(x.name||'').split('.').pop().toLowerCase();
 return ({mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm',ogv:'video/ogg',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf'})[ext]||type;
}
function visibleLibrary(){
 const q=($('libSearch')?.value||'').toLocaleLowerCase('fr'),type=$('libTypeFilter')?.value||'';
 const list=libraryCache.filter(x=>(libraryFolder===null||folderName(x)===libraryFolder)&&(!type||x.category===type)&&(!q||[x.name,x.pilot,x.event,x.tags,x.category].join(' ').toLocaleLowerCase('fr').includes(q)));
 const sort=$('libSort')?.value||'date-desc',compare=(a,b)=>String(a||'').localeCompare(String(b||''),'fr',{numeric:true,sensitivity:'base'});
 const date=x=>Date.parse(x.date||x.created)||Number(x.lastModified)||0;
 return list.sort((a,b)=>{
  let n=sort==='date-asc'?date(a)-date(b):sort==='name'?compare(a.name,b.name):sort==='type'?compare(a.category,b.category):sort==='size'?Number(b.size||0)-Number(a.size||0):sort==='pilot'?compare(a.pilot,b.pilot):date(b)-date(a);
  return n||compare(a.name,b.name)||compare(a.id,b.id);
 });
}
async function refreshLibrary(){
 try{libraryCache=await dbAll();for(const id of librarySelected)if(!libraryCache.some(x=>x.id===id))librarySelected.delete(id);renderLibrary();renderStudioAssets();renderHome()}
 catch(e){console.error(e);toast('Impossible de lire la bibliothèque locale.')}
}
async function addLibraryFiles(){
 const files=[...$('libFiles').files];if(!files.length)return toast('Sélectionnez au moins un fichier.');
 $('libSave').disabled=true;let added=0;
 try{
  for(const file of files){
   const type=mediaType(file)||'application/octet-stream';
   await dbPut({id:uid('a'),name:file.name,type,size:file.size,lastModified:file.lastModified,pilot:$('libPilot').value,category:categoryFor({type},$('libCategory').value),event:$('libEvent').value.trim(),date:$('libDate').value,tags:$('libTags').value.trim(),created:now(),blob:file});added++;
  }
  $('libFiles').value='';$('libFileNote').textContent='Aucun fichier sélectionné.';toast('Ajouté à Library.');
 }catch(e){console.error(e);toast('Import interrompu. Vérifiez l’espace disponible sur cet appareil.')}
 finally{if(added){log('Library • '+added+' fichier(s) ajouté(s)');save()}await refreshLibrary();$('libSave').disabled=false}
}
function updateLibrarySelection(){
 const list=visibleLibrary(),all=list.length>0&&list.every(x=>librarySelected.has(x.id));
 $('libSelectAll').textContent=all?'Tout désélectionner':'Tout sélectionner';
 $('libSelectAll').disabled=libraryBusy||!list.length;
 $('libDeleteSelected').disabled=libraryBusy||!librarySelected.size;
 $('libSelectionCount').textContent=librarySelected.size+' sélectionné(s)';
 document.querySelectorAll('[data-lib-select]').forEach(b=>{b.checked=librarySelected.has(b.dataset.libSelect);b.disabled=libraryBusy});
}
function renderLibrary(){
 if(!$('libList'))return;
 const folders=[...new Set(libraryCache.map(folderName))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
 if(libraryFolder!==null&&!folders.includes(libraryFolder))libraryFolder=null;
 $('libFolderList').innerHTML='<button type="button" class="folder-button '+(libraryFolder===null?'active':'')+'" data-folder-all>Tous les dossiers <span>'+libraryCache.length+'</span></button>'+folders.map((name,i)=>'<button type="button" class="folder-button '+(libraryFolder===name?'active':'')+'" data-folder-index="'+i+'">▣ '+esc(name)+' <span>'+libraryCache.filter(x=>folderName(x)===name).length+'</span></button>').join('');
 $('libFolderOptions').innerHTML=folders.filter(x=>x!=='Sans dossier').map(x=>'<option value="'+esc(x)+'"></option>').join('');
 document.querySelector('[data-folder-all]').onclick=()=>{libraryFolder=null;librarySelected.clear();renderLibrary()};
 document.querySelectorAll('[data-folder-index]').forEach(b=>b.onclick=()=>{libraryFolder=folders[Number(b.dataset.folderIndex)];librarySelected.clear();renderLibrary()});
 const list=visibleLibrary(),total=libraryCache.reduce((n,x)=>n+Number(x.size||0),0);
 $('libStats').textContent=libraryCache.length+' fichier(s) • '+sizeText(total)+' • local';
 $('libFolderTitle').textContent=libraryFolder===null?'Tous les dossiers':libraryFolder;
 const groups=new Map();
 for(const x of list){const name=folderName(x);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(x)}
 $('libList').innerHTML=list.length?[...groups].map(([name,items])=>'<section class="library-folder"><h4 class="folder-heading">▣ '+esc(name)+' <small>'+items.length+' fichier(s)</small></h4>'+items.map(x=>'<div class="library-item"><input type="checkbox" class="library-select" data-lib-select="'+esc(x.id)+'" aria-label="Sélectionner '+esc(x.name)+'"><div class="file-icon">'+(x.category==='Photo'?'▧':x.category==='Vidéo'?'▶':x.category==='Logo'?'◆':'▤')+'</div><div class="file-info"><h4>'+esc(x.name)+'</h4><div class="list-meta">'+esc(x.category)+' • '+esc(x.pilot||'—')+' • '+sizeText(Number(x.size)||0)+' • '+fd(x.date||x.created)+'</div><p>'+esc(x.tags||'')+'</p></div><div class="mini-actions"><button data-lib-open="'+esc(x.id)+'">Aperçu</button><button class="danger" data-lib-del="'+esc(x.id)+'" '+(libraryBusy?'disabled':'')+'>Supprimer</button></div></div>').join('')+'</section>').join(''):'<div class="empty">Aucun fichier correspondant.</div>';
 document.querySelectorAll('[data-lib-open]').forEach(b=>b.onclick=()=>previewAsset(b.dataset.libOpen));
 document.querySelectorAll('[data-lib-del]').forEach(b=>b.onclick=()=>deleteAssets([b.dataset.libDel]));
 document.querySelectorAll('[data-lib-select]').forEach(b=>b.onchange=()=>{b.checked?librarySelected.add(b.dataset.libSelect):librarySelected.delete(b.dataset.libSelect);updateLibrarySelection()});
 updateLibrarySelection();
}
function clearLibraryPreview(){
 const player=$('libPreview').querySelector('video');if(player){player.pause();player.removeAttribute('src');player.load()}
 if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';previewAssetId='';
 $('libPreviewMeta').textContent='Sélectionnez un média';$('libPreview').innerHTML='<div class="empty">Aucun média sélectionné.</div>';
}
async function previewAsset(id){
 const x=libraryCache.find(x=>x.id===id);if(!x)return;
 clearLibraryPreview();previewAssetId=id;
 $('libPreviewMeta').textContent=x.name+' • '+x.category+' • '+sizeText(Number(x.size)||0);
 const panel=$('libPreview').closest('.library-preview-panel');panel.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  if(!(x.blob instanceof Blob))throw new Error('Fichier absent');
  const type=mediaType(x);previewUrl=URL.createObjectURL(x.blob.type===type?x.blob:x.blob.slice(0,x.blob.size,type));
  const download='<a class="btn" href="'+previewUrl+'" download="'+esc(x.name)+'">Télécharger / ouvrir le fichier</a>';
  let html=type.startsWith('image/')?'<img src="'+previewUrl+'" alt="'+esc(x.name)+'">':type.startsWith('video/')?'<video src="'+previewUrl+'" controls playsinline preload="metadata" aria-label="'+esc(x.name)+'"></video>':type==='application/pdf'?'<iframe title="'+esc(x.name)+'" src="'+previewUrl+'"></iframe>':'<div class="document-preview"><b>'+esc(x.name)+'</b><span>'+esc(type||'Document')+'</span></div>';
  $('libPreview').innerHTML=html+'<p id="libPreviewHint" role="status"></p>'+download;
  const player=$('libPreview').querySelector('video');
  if(player){
   const hint=$('libPreviewHint');
   player.onerror=()=>{hint.textContent='Ce format ou codec vidéo ne peut pas être lu dans ce navigateur. Téléchargez le fichier pour l’ouvrir avec votre lecteur vidéo.'};
   try{await player.play()}catch(e){if(previewAssetId===id&&!player.error)hint.textContent='Appuyez sur ▶ dans le lecteur pour lancer la vidéo.'}
  }
 }catch(e){console.error(e);$('libPreview').innerHTML='<div class="empty">Le fichier local est introuvable ou illisible. Réimportez-le depuis cet appareil.</div>'}
}
async function dbRemoveMany(ids){
 const db=await openDb();
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');for(const id of ids)tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Suppression annulée'))}});
}
async function deleteAssets(ids){
 if(libraryBusy)return;
 const items=libraryCache.filter(x=>ids.includes(x.id));if(!items.length)return;
 if(!confirm('Supprimer définitivement '+(items.length===1?'« '+items[0].name+' »':items.length+' fichiers sélectionnés')+' de Library sur cet appareil ?'))return;
 libraryBusy=true;renderLibrary();
 try{
  await dbRemoveMany(items.map(x=>x.id));
  for(const x of items){librarySelected.delete(x.id);studioSelected.delete(x.id)}
  if(items.some(x=>x.id===previewAssetId))clearLibraryPreview();
  log('Library • '+items.length+' fichier(s) supprimé(s)');save();await refreshLibrary();toast(items.length+' fichier(s) supprimé(s).');
 }catch(e){console.error(e);toast('Suppression impossible. Les fichiers ont été conservés.')}
 finally{libraryBusy=false;renderLibrary()}
}

function bind(){
 document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>openView(b.dataset.view));document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openView(b.dataset.open));
 document.querySelectorAll('[data-training-tab]').forEach(b=>b.onclick=()=>openTrainingTab(b.dataset.trainingTab));
 $('stGenerate').onclick=function(){$('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets(),$('stChannel').value);renderStudioStoryboard();toast('Proposition Studio créée.')};$('stSave').onclick=saveStudio;$('stSearch').oninput=renderStudio;$('stAssetSearch').oninput=renderStudioAssets;$('stSelectAll').onclick=function(){const list=visibleStudioAssets(),all=list.length>0&&list.every(function(x){return studioSelected.has(x.id)});list.forEach(function(x){all?studioSelected.delete(x.id):studioSelected.add(x.id)});resetStudioRendered();renderStudioAssets()};$('stEditVideo').onclick=function(){$('stEditPanel').hidden=!$('stEditPanel').hidden};document.querySelectorAll('[data-st-transition]').forEach(function(b){b.onclick=function(){setStudioTransitionPreset(b.dataset.stTransition)}});$('stApplyEdits').onclick=applyStudioEdits;$('stDuration').onchange=function(){resetStudioRendered();renderStudioStoryboard();$('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets(),$('stChannel').value)};$('stRenderVideo').onclick=generateStudioVideo;$('stSaveRender').onclick=saveStudioRenderToLibrary;$('stType').onchange=function(){studioSelected.clear();resetStudioRendered();resetStudioEditSettings();updateStudioProductionUI()};$('stChannel').onchange=function(){resetStudioRendered();updateStudioProductionUI();renderStudioStoryboard()};
 $('repDate').value=today();$('repGenerate').onclick=()=>{$('repText').value=reportTemplate($('repPilot').value,$('repType').value,$('repEvent').value.trim(),$('repFacts').value.trim());toast('Trame générée.')};$('repSave').onclick=saveReport;$('repSearch').oninput=renderReports;
 $('trStart').onclick=newQuestion;$('trEvaluate').onclick=evaluate;$('trMic').onclick=startMic;$('trStop').onclick=stopMic;
 $('cultureNext').onclick=nextCulture;if($('cultureLevel'))$('cultureLevel').onchange=()=>{D.culture.level=$('cultureLevel').value;cultureIndex=0;save();renderCultureThemes();if(cultureTheme)showCultureQuestion()};$('enStart').onclick=startEnglish;$('enListen').onclick=listenEnglish;$('enAnswer').onclick=answerEnglish;$('enEnd').onclick=endEnglish;
 $('libDate').value=today();
 $('libFiles').onchange=()=>{$('libFileNote').textContent=$('libFiles').files.length?[...$('libFiles').files].map(f=>f.name+' ('+sizeText(f.size)+')').join(' • '):'Aucun fichier sélectionné.'};
 $('libSave').onclick=addLibraryFiles;
 const filterLibrary=()=>{librarySelected.clear();renderLibrary()};
 $('libSearch').oninput=filterLibrary;$('libTypeFilter').onchange=filterLibrary;$('libSort').onchange=renderLibrary;
 $('libSelectAll').onclick=()=>{const list=visibleLibrary(),all=list.every(x=>librarySelected.has(x.id));list.forEach(x=>all?librarySelected.delete(x.id):librarySelected.add(x.id));updateLibrarySelection()};
 $('libDeleteSelected').onclick=()=>deleteAssets([...librarySelected]);
 window.addEventListener('beforeunload',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);clearStudioStoryboardUrls();if(studioRenderedUrl)URL.revokeObjectURL(studioRenderedUrl)});

}

async function init(){load();bind();renderHome();renderStudio();renderReports();renderTraining();loadOfficialLogo();await refreshLibrary();updateStudioProductionUI()}
init();
})();
