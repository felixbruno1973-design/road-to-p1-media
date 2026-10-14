// Local, deterministic editorial selection for reviewed scene moments.
// Does not claim to understand unreviewed footage.
const human = new Set(['briefing', 'mechanics']);
const valid = new Set(['briefing', 'mechanics', 'track']);
export function selectUniqueMoments(moments, max = 18) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 100) throw Error('Invalid clip count');
  const seen = new Set();
  const groups = {briefing: [], mechanics: [], track: []};
  for (const m of moments) {
    if (!m || !valid.has(m.label) || !m.file || m.file.category !== 'Vidéo' || typeof m.file.relativePath !== 'string') continue;
    if (!Number.isFinite(m.startSeconds) || m.startSeconds < 0) continue;
    const end = m.endSeconds ?? (m.startSeconds + 5);
    if (!Number.isFinite(end) || end <= m.startSeconds) continue;
    const key = `${m.file.relativePath}\0${m.startSeconds}\0${end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups[m.label].push({...m, endSeconds: end});
  }
  if (!groups.briefing.length && !groups.mechanics.length) return {items: [], warning:'Aucun moment humain vérifié : impossible de garantir un film centré sur les échanges.'};
  // Narrative: interactions -> preparation -> track inserts; no duplicate intervals.
  const used = new Set(), output=[];
  const sequence=['briefing','mechanics','briefing','track','mechanics','briefing','track'];
  const key=m=>`${m.file.relativePath}\0${m.startSeconds}\0${m.endSeconds}`;
  let i=0;
  while (output.length < max) {
    let pick=null;
    for(let offset=0; offset<sequence.length;offset++) {
      const cat=sequence[(i+offset)%sequence.length];
      pick=groups[cat].find(m=>!used.has(key(m)));
      if (pick) break;
    }
    if (!pick) break;
    used.add(key(pick)); output.push({file:pick.file,startSeconds:pick.startSeconds,endSeconds:pick.endSeconds,label:pick.label}); i++;
  }
  const coverage=Math.round(output.filter(x=>human.has(x.label)).length/Math.max(1,output.length)*100);
  return {items:output,warning:`${output.length} scènes distinctes vérifiées ; ${coverage}% de scènes humaines. Si la durée cible manque, demander davantage de scènes plutôt que répéter.`};
}
export function insertUniquePhotos(items,photos,maxPhotos=3) {
  const chosen=[];
  const seen=new Set(items.map(x=>x.file.relativePath));
  for(const f of photos) {
    if (chosen.length>=maxPhotos) break;
    if(f.category==='Photo' && /\.(jpe?g|png|webp)$/i.test(f.relativePath) && !seen.has(f.relativePath)) {
      seen.add(f.relativePath); chosen.push({file:f});
    }
  }
  const out=[...items];
  for(let j=0;j<chosen.length;j++) out.splice(Math.min(out.length,Math.floor((j+1)*(items.length+chosen.length)/(chosen.length+1))),0,chosen[j]);
  return out;
}
