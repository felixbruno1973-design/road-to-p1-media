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
 const supplementary=ranked.filter(x=>!x.humans);
 const n=Math.min(people.length,Math.max(1,Math.ceil(max*0.75)));
 return {items:[...people.slice(0,n),...supplementary.slice(0,max-n)],warning:'Priorité basée sur les noms de fichiers, pas sur une analyse visuelle.'};
}
