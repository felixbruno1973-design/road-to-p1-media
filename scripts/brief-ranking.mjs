// Offline, filename-only editorial ranking. No claim of image understanding.
export const normalize = text => String(text||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const interaction=/brief|briefing|discussion|echange|team|paddock|stand|mecan|ingenieur|coach|reglage|preparation|pilot|interview|debrief/;
const track=/piste|circuit|course|roulage|race|kart|onboard|tour|depart|qualif/;
export function rankForBrief(files,instruction){
 const request=normalize(instruction);
 const wantsInteraction=/echange|discussion|brief|mecano|mecanicien|ingenieur|pilot|preparation|paddock/.test(request);
 const terms=request.split(/[^a-z0-9]+/).filter(w=>w.length>3&&!new Set(['video','videos','clip','montage','secondes','second','fais','montrant','entre','avec','quelques','images','photos','karting','circuit','course','pilotes','ingenieurs','mecano','mecaniciens']).has(w));
 return files.filter(f=>f.category==='Vidéo').map(file=>{
   const name=normalize(file.relativePath);
   const humans=interaction.test(name),piste=track.test(name);
   let score=terms.reduce((n,t)=>n+(name.includes(t)?2:0),0);
   if(wantsInteraction)score+=humans?15:0;
   if(wantsInteraction&&piste&&!humans)score-=4;
   return {file,score,humans,piste};
 }).sort((a,b)=>b.score-a.score||a.file.relativePath.localeCompare(b.file.relativePath,'fr'));
}
export function chooseForBrief(files,instruction,max=10){
 const ranked=rankForBrief(files,instruction);
 const wantsInteraction=/echange|discussion|brief|mecano|mecanicien|ingenieur|pilot|preparation|paddock/.test(normalize(instruction));
 if(!wantsInteraction)return {items:ranked.slice(0,max),warning:''};
 const people=ranked.filter(x=>x.humans);
 if(!people.length)return {items:ranked.slice(0,max),warning:'Aucune vidéo identifiée comme briefing ou échange dans les noms de fichiers. Le logiciel ne reconnaît pas encore ces scènes dans les images.'};
 const trackClips=ranked.filter(x=>!x.humans);
 // A 60s briefing reel should spend ~75% of its time on the named human exchanges.
 // Repeating input references is deliberate: the renderer chooses different excerpts per segment.
 const humanSlots=trackClips.length?Math.max(1,Math.ceil(max*0.75)):max;
 const trackSlots=max-humanSlots;
 const items=[];
 let humanIndex=0,trackIndex=0;
 for(let slot=0;slot<max;slot++){
   // Spread circuit inserts through the narrative, never group all track shots at the end.
   const trackExpected=Math.floor((slot+1)*trackSlots/max);
   const insertTrack=trackExpected>trackIndex && trackIndex<trackSlots;
   if(insertTrack)items.push(trackClips[(trackIndex++)%trackClips.length]);
   else items.push(people[(humanIndex++)%people.length]);
 }
 return {items,warning:'Environ 75 % du montage sont réservés aux vidéos nommées briefing ou mécanique. Les actions ne sont pas encore reconnues visuellement.'};
}
