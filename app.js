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
let D={studio:[],reports:[],training:[],learning:[],culture:{correct:0,total:0},english:[],activity:[]};
let libraryCache=[];
let studioSelected=new Set();
let currentQuestion='';
let recognition=null;
let previewUrl='';
let cultureTheme='';
let cultureIndex=0;
let englishInterview=null;
let englishRecognition=null;

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||'null');
    if(x)D={studio:Array.isArray(x.studio)?x.studio:[],reports:Array.isArray(x.reports)?x.reports:[],training:Array.isArray(x.training)?x.training:[],learning:Array.isArray(x.learning)?x.learning:[],culture:x.culture&&typeof x.culture==='object'?x.culture:{correct:0,total:0},english:Array.isArray(x.english)?x.english:[],activity:Array.isArray(x.activity)?x.activity:[]};
  }catch(e){}
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
 studio:['Studio','Créer les contenus ROAD TO P1 à partir des ressources de Library.'],
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

function studioTemplate(pilot,type,event,objective,tone,assets){
 const e=event||'ce rendez-vous',o=objective?`\n\n${objective.trim()}`:'',media=assets.length?`\n\nMédias retenus : ${assets.map(x=>x.name).join(' • ')}`:'';
 const thanks='\n\nMerci à toutes les personnes et partenaires qui accompagnent ROAD TO P1.';
 if(type==='Story')return `${pilot} • ${e}\n\n🏁 En piste.\n📈 Une nouvelle étape de progression.\n🔥 Objectif : continuer à avancer.${o}${thanks}${media}`;
 if(type==='Reel / vidéo courte')return `SCRIPT REEL — ${pilot} / ${e}\n\n0–3 s : ouverture forte / action piste\n3–8 s : paddock + préparation\n8–14 s : séquence course / dépassement / rythme\n14–19 s : résultat ou enseignement principal\n19–24 s : ${pilot} face caméra\n24–28 s : partenaires + logo ROAD TO P1\n\nTexte écran : « Chaque tour construit la suite. »${o}${media}`;
 if(type==='Contenu partenaire')return `PARTENAIRE • ${pilot} • ${e}\n\nROAD TO P1 poursuit son projet d’accompagnement vers le haut niveau en sport automobile. ${pilot} franchit une nouvelle étape à ${e}.${o}\n\nCette progression est rendue possible par l’engagement de nos partenaires, présents à nos côtés dans la durée.${thanks}${media}`;
 if(type==='Annonce avant-course')return `🏁 PROCHAIN RENDEZ-VOUS — ${e}\n\n${pilot} retrouve la piste avec ROAD TO P1 pour une nouvelle étape de la saison.${o}\n\nObjectif : travailler, progresser et transformer chaque tour en expérience.${thanks}${media}`;
 const opener=tone==='Humain'?`Derrière chaque tour, il y a du travail, des doutes, des progrès et beaucoup d’envie.`:tone==='Énergique'?`🔥 Nouveau week-end, nouveau défi, même ambition !`:`🏁 ${pilot} poursuit sa progression avec ROAD TO P1 à ${e}.`;
 return `${opener}\n\n${pilot} franchit une nouvelle étape à ${e}. Le week-end permet de continuer à apprendre, progresser et construire la suite.${o}${thanks}\n\n#RoadToP1 #Karting #Motorsport #YoungDrivers${media}`;
}
function selectedAssets(){return libraryCache.filter(x=>studioSelected.has(x.id))}
function renderStudioAssets(){
 const q=($('stAssetSearch')?.value||'').toLowerCase();
 const list=libraryCache.filter(x=>!q||[x.name,x.pilot,x.event,x.tags,x.category].join(' ').toLowerCase().includes(q));
 $('stAssetCount').textContent=`${studioSelected.size} sélectionné${studioSelected.size>1?'s':''}`;
 $('stAssetList').innerHTML=list.length?list.map(x=>`<label class="asset-check"><input type="checkbox" data-st-asset="${x.id}" ${studioSelected.has(x.id)?'checked':''}><span><b>${esc(x.name)}</b><small>${esc(x.category)} • ${esc(x.pilot||'—')} • ${sizeText(x.size||0)}</small></span></label>`).join(''):'<div class="empty">Library est vide. Ajoutez d’abord des médias.</div>';
 document.querySelectorAll('[data-st-asset]').forEach(cb=>cb.onchange=()=>{cb.checked?studioSelected.add(cb.dataset.stAsset):studioSelected.delete(cb.dataset.stAsset);$('stAssetCount').textContent=`${studioSelected.size} sélectionné${studioSelected.size>1?'s':''}`});
}
function renderStudio(){
 const q=($('stSearch')?.value||'').toLowerCase(),L=D.studio.filter(x=>!q||[x.pilot,x.type,x.event,x.status,x.objective].join(' ').toLowerCase().includes(q));
 $('stCount').textContent=`${L.length} création${L.length>1?'s':''}`;
 $('stList').innerHTML=L.length?L.map(x=>`<div class="list-item"><div><h4>${esc(x.event||x.type)}</h4><div class="list-meta">${esc(x.pilot)} • ${esc(x.type)} • ${fd(x.updated||x.created)}</div><p>${esc((x.text||'').slice(0,160))}${(x.text||'').length>160?'…':''}</p></div><div class="mini-actions"><span class="pill ${x.status==='Publié'?'done':x.status==='Prêt'?'valid':''}">${esc(x.status)}</span><button data-st-open="${x.id}">Ouvrir</button><button class="danger" data-st-del="${x.id}">Supprimer</button></div></div>`).join(''):'<div class="empty">Aucune création Studio.</div>';
 document.querySelectorAll('[data-st-open]').forEach(b=>b.onclick=()=>openStudioDraft(b.dataset.stOpen));
 document.querySelectorAll('[data-st-del]').forEach(b=>b.onclick=()=>delStudioDraft(b.dataset.stDel));
 renderStudioAssets();
}
function openStudioDraft(id){
 const x=D.studio.find(x=>x.id===id);if(!x)return;
 $('stPilot').value=x.pilot;$('stType').value=x.type;$('stEvent').value=x.event;$('stStatus').value=x.status;$('stTone').value=x.tone||'Sportif';$('stObjective').value=x.objective||'';$('stText').value=x.text||'';
 studioSelected=new Set(x.mediaIds||[]);$('stSave').dataset.edit=id;renderStudioAssets();toast('Création chargée.');window.scrollTo({top:0,behavior:'smooth'});
}
function delStudioDraft(id){if(!confirm('Supprimer cette création Studio ?'))return;D.studio=D.studio.filter(x=>x.id!==id);log('Création Studio supprimée');save();renderStudio()}
function saveStudio(){
 const id=$('stSave').dataset.edit||uid('s'),old=D.studio.find(x=>x.id===id),x={id,pilot:$('stPilot').value,type:$('stType').value,event:$('stEvent').value.trim(),status:$('stStatus').value,tone:$('stTone').value,objective:$('stObjective').value.trim(),text:$('stText').value,mediaIds:[...studioSelected],created:old?.created||now(),updated:now()};
 const i=D.studio.findIndex(x=>x.id===id);i>=0?D.studio[i]=x:D.studio.unshift(x);log(`${i>=0?'Création Studio mise à jour':'Nouvelle création Studio'} • ${x.pilot} • ${x.type}`);delete $('stSave').dataset.edit;save();renderStudio();toast('Création enregistrée.');
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

const CULTURE={
 histoire:{label:'Histoire de l’automobile',questions:[['Quelle invention de Karl Benz est généralement considérée comme la première automobile moderne ?',['Le véhicule à moteur à explosion','La voiture électrique','La transmission intégrale'],0,'Le Patent-Motorwagen de 1886 utilisait un moteur à combustion interne.'],['Quelle course créée en 1923 est devenue une référence mondiale de l’endurance ?',['Les 24 Heures du Mans','Le Grand Prix de Monaco','Le Rallye Monte-Carlo'],0,'Les 24 Heures du Mans ont été disputées pour la première fois en 1923.']]},
 f1:{label:'Formule 1',questions:[['En quelle année débute le championnat du monde de Formule 1 ?',['1950','1935','1966'],0,'Le premier championnat du monde de F1 est organisé en 1950.'],['Que signale un drapeau bleu en course ?',['Un véhicule plus rapide va dépasser','La course est terminée','La piste est entièrement neutralisée'],0,'Il avertit principalement un pilote qu’un concurrent plus rapide s’apprête à le dépasser.']]},
 endurance:{label:'Endurance',questions:[['Quel est l’objectif essentiel d’une course d’endurance ?',['Parcourir la plus grande distance dans le temps imparti','Réaliser un seul tour rapide','Éliminer progressivement les voitures'],0,'La performance associe vitesse, régularité, stratégie et fiabilité.'],['Que désigne un relais ?',['La période conduite par un pilote entre deux arrêts','Le tour de formation','Une pénalité en temps'],0,'En endurance, plusieurs pilotes se partagent la voiture au fil des relais.']]},
 rallye:{label:'Rallye',questions:[['Comment appelle-t-on les portions chronométrées d’un rallye ?',['Les épreuves spéciales','Les manches libres','Les relais'],0,'Les épreuves spéciales sont courues sur routes fermées et chronométrées.'],['Quel est le rôle principal du copilote ?',['Annoncer les notes et aider à la navigation','Réparer le moteur en roulant','Contrôler les commissaires'],0,'Le copilote annonce les virages et informations consignés dans les notes.']]},
 karting:{label:'Karting & filière pilote',questions:[['Pourquoi le karting est-il une école majeure du pilotage ?',['Il développe trajectoires, freinage, sensations et confrontation directe','Il supprime toute notion de réglage','Il se pratique sans règlement'],0,'Le karting forme aux fondamentaux du pilotage et de la compétition.'],['Que signifie défendre sa position proprement ?',['Choisir une ligne autorisée sans changement dangereux','Changer plusieurs fois de direction','Pousser le concurrent hors piste'],0,'La défense doit rester prévisible et respecter les règles sportives.']]},
 circuits:{label:'Circuits & légendes',questions:[['Dans quelle ville se dispute un célèbre Grand Prix urbain depuis 1929 ?',['Monaco','Le Mans','Monza'],0,'Le Grand Prix de Monaco se déroule dans les rues de la principauté.'],['Le circuit de la Sarthe est associé à quelle épreuve ?',['Les 24 Heures du Mans','Les 500 Miles d’Indianapolis','Le Dakar'],0,'Le circuit accueille les 24 Heures du Mans.']]}
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
function updateTrainingProgress(){const lessonPart=D.learning.length/LESSONS.length*50,practicePart=Math.min(D.training.length,5)/5*25,culturePart=Math.min(D.culture.correct||0,5)/5*15,englishPart=Math.min(D.english.length,2)/2*10;$('trainingProgress').textContent=`${Math.round(lessonPart+practicePart+culturePart+englishPart)}%`}
function renderCultureThemes(){$('cultureThemes').innerHTML=Object.entries(CULTURE).map(([id,t])=>`<button class="culture-theme ${cultureTheme===id?'active':''}" data-culture-theme="${id}"><span>◉</span>${esc(t.label)}</button>`).join('');document.querySelectorAll('[data-culture-theme]').forEach(b=>b.onclick=()=>startCulture(b.dataset.cultureTheme));$('cultureScore').textContent=`${D.culture.correct||0} bonne${D.culture.correct===1?'':'s'} réponse${D.culture.correct===1?'':'s'}`}
function startCulture(theme){cultureTheme=theme;cultureIndex=0;renderCultureThemes();showCultureQuestion()}
function showCultureQuestion(){const q=CULTURE[cultureTheme]?.questions[cultureIndex%CULTURE[cultureTheme].questions.length];if(!q)return;$('cultureBadge').textContent=CULTURE[cultureTheme].label.toUpperCase();$('cultureQuestion').textContent=q[0];$('cultureOptions').innerHTML=q[1].map((o,i)=>`<button data-culture-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${esc(o)}</button>`).join('');$('cultureFeedback').textContent='';$('cultureFeedback').className='quiz-feedback';$('cultureNext').disabled=true;document.querySelectorAll('[data-culture-answer]').forEach(b=>b.onclick=()=>answerCulture(Number(b.dataset.cultureAnswer),q))}
function answerCulture(choice,q){document.querySelectorAll('[data-culture-answer]').forEach((b,i)=>{b.disabled=true;b.classList.toggle('correct',i===q[2]);b.classList.toggle('wrong',i===choice&&choice!==q[2])});D.culture.total=(D.culture.total||0)+1;if(choice===q[2])D.culture.correct=(D.culture.correct||0)+1;$('cultureFeedback').className=`quiz-feedback ${choice===q[2]?'correct':'wrong'}`;$('cultureFeedback').textContent=`${choice===q[2]?'Bonne réponse.':'Pas encore.'} ${q[3]}`;$('cultureNext').disabled=false;save();renderCultureThemes();updateTrainingProgress()}
function nextCulture(){if(!cultureTheme)return;cultureIndex=(cultureIndex+1)%CULTURE[cultureTheme].questions.length;showCultureQuestion()}
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
async function refreshLibrary(){try{libraryCache=(await dbAll()).sort((a,b)=>(b.created||'').localeCompare(a.created||''));renderLibrary();renderStudioAssets();renderHome()}catch(e){$('libList').innerHTML='<div class="empty">Library n’est pas disponible dans ce navigateur.</div>'}}
async function addLibraryFiles(){
 const files=[...($('libFiles').files||[])];if(!files.length)return toast('Sélectionnez au moins un fichier.');
 $('libSave').disabled=true;try{for(const file of files){await dbPut({id:uid('a'),name:file.name,type:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified,pilot:$('libPilot').value,category:categoryFor(file,$('libCategory').value),event:$('libEvent').value.trim(),date:$('libDate').value,tags:$('libTags').value.trim(),created:now(),blob:file})}log(`Library • ${files.length} fichier${files.length>1?'s':''} ajouté${files.length>1?'s':''}`);save();$('libFiles').value='';$('libFileNote').textContent='Aucun fichier sélectionné.';await refreshLibrary();toast('Ajouté à Library.')}catch(e){console.error(e);toast('Impossible d’enregistrer ces fichiers.')}finally{$('libSave').disabled=false}
}
function renderLibrary(){
 if(!$('libList'))return;
 const q=($('libSearch')?.value||'').toLowerCase(),type=$('libTypeFilter')?.value||'',L=libraryCache.filter(x=>(!type||x.category===type)&&(!q||[x.name,x.pilot,x.event,x.tags,x.category].join(' ').toLowerCase().includes(q)));
 const total=libraryCache.reduce((n,x)=>n+(x.size||0),0);$('libStats').textContent=`${libraryCache.length} fichier${libraryCache.length>1?'s':''} • ${sizeText(total)}`;
 $('libList').innerHTML=L.length?L.map(x=>`<div class="library-item"><div class="file-icon">${x.category==='Photo'?'▧':x.category==='Vidéo'?'▶':x.category==='Logo'?'◆':'▤'}</div><div><h4>${esc(x.name)}</h4><div class="list-meta">${esc(x.category)} • ${esc(x.pilot||'—')} • ${sizeText(x.size||0)}</div><p>${esc(x.event||'Sans dossier')}${x.tags?` • ${esc(x.tags)}`:''}</p></div><div class="mini-actions"><button data-lib-open="${x.id}">Aperçu</button><button class="danger" data-lib-del="${x.id}">Supprimer</button></div></div>`).join(''):'<div class="empty">Aucun fichier correspondant.</div>';
 document.querySelectorAll('[data-lib-open]').forEach(b=>b.onclick=()=>previewAsset(b.dataset.libOpen));document.querySelectorAll('[data-lib-del]').forEach(b=>b.onclick=()=>deleteAsset(b.dataset.libDel));
}
function previewAsset(id){
 const x=libraryCache.find(x=>x.id===id);if(!x)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(x.blob);$('libPreviewMeta').textContent=`${x.name} • ${x.category} • ${sizeText(x.size||0)}`;
 let html;if((x.type||'').startsWith('image/'))html=`<img src="${previewUrl}" alt="${esc(x.name)}">`;else if((x.type||'').startsWith('video/'))html=`<video src="${previewUrl}" controls playsinline></video>`;else html=`<div class="document-preview"><b>${esc(x.name)}</b><span>${esc(x.type||'Document')}</span><small>${sizeText(x.size||0)}</small></div>`;
 $('libPreview').innerHTML=html;
}
async function deleteAsset(id){const x=libraryCache.find(x=>x.id===id);if(!x||!confirm(`Supprimer « ${x.name} » de Library ?`))return;await dbRemove(id);studioSelected.delete(id);log(`Library • ${x.name} supprimé`);save();await refreshLibrary();$('libPreviewMeta').textContent='Sélectionnez un média';$('libPreview').innerHTML='<div class="empty">Aucun média sélectionné.</div>';toast('Média supprimé.')}

function bind(){
 document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>openView(b.dataset.view));document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openView(b.dataset.open));
 document.querySelectorAll('[data-training-tab]').forEach(b=>b.onclick=()=>openTrainingTab(b.dataset.trainingTab));
 $('stGenerate').onclick=()=>{$('stText').value=studioTemplate($('stPilot').value,$('stType').value,$('stEvent').value.trim(),$('stObjective').value.trim(),$('stTone').value,selectedAssets());toast('Proposition générée.')};$('stSave').onclick=saveStudio;$('stSearch').oninput=renderStudio;$('stAssetSearch').oninput=renderStudioAssets;
 $('repDate').value=today();$('repGenerate').onclick=()=>{$('repText').value=reportTemplate($('repPilot').value,$('repType').value,$('repEvent').value.trim(),$('repFacts').value.trim());toast('Trame générée.')};$('repSave').onclick=saveReport;$('repSearch').oninput=renderReports;
 $('trStart').onclick=newQuestion;$('trEvaluate').onclick=evaluate;$('trMic').onclick=startMic;$('trStop').onclick=stopMic;
 $('cultureNext').onclick=nextCulture;$('enStart').onclick=startEnglish;$('enListen').onclick=listenEnglish;$('enAnswer').onclick=answerEnglish;$('enEnd').onclick=endEnglish;
 $('libDate').value=today();$('libFiles').onchange=()=>{$('libFileNote').textContent=$('libFiles').files.length?[...$('libFiles').files].map(f=>`${f.name} (${sizeText(f.size)})`).join(' • '):'Aucun fichier sélectionné.'};$('libSave').onclick=addLibraryFiles;$('libSearch').oninput=renderLibrary;$('libTypeFilter').onchange=renderLibrary;
}

async function init(){load();bind();renderHome();renderStudio();renderReports();renderTraining();loadOfficialLogo();await refreshLibrary()}
init();
})();
