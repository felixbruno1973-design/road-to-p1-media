// Local scene classifier MVP using FFmpeg extracted frames and a browser-native ONNX model.
// Runs only if the user installs a local model; never uploads media.
export const SCENE_LABELS=['briefing','mechanics','track','unknown'];
export function classifyVisualDetections(detections){
  const people=detections.filter(x=>x.label==='person'&&x.score>=0.35);
  const vehicles=detections.filter(x=>['car','truck','motorcycle','sports car'].includes(x.label)&&x.score>=0.35);
  if(people.length>=2 && vehicles.length===0)return {label:'briefing',confidence:'medium',reason:'Plusieurs personnes visibles'};
  if(people.length>=1 && vehicles.length>=1)return {label:'mechanics',confidence:'low',reason:'Personne et véhicule visibles : intervention possible'};
  if(vehicles.length>=1)return {label:'track',confidence:'low',reason:'Véhicule visible'};
  return {label:'unknown',confidence:'low',reason:'Aucun indice visuel suffisant'};
}
export function selectEditorialTimeline(scenes,totalSeconds=60){
  const filtered=scenes.filter(x=>x.label!=='unknown');
  const humans=filtered.filter(x=>x.label==='briefing'||x.label==='mechanics');
  const track=filtered.filter(x=>x.label==='track');
  if(!humans.length)return {segments:[],warning:'Aucune interaction humaine détectée avec assez de confiance : vérification manuelle nécessaire.'};
  const count=Math.ceil(totalSeconds/5);
  const segments=[];
  for(let i=0;i<count;i++){
    const useTrack=track.length>0 && (i+1)%5===0;
    const group=useTrack?track:humans;
    const item=group[(useTrack?Math.floor(i/5):i)%group.length];
    segments.push({...item,seconds:totalSeconds/count});
  }
  return {segments,warning:'Classement visuel indicatif : plusieurs personnes ne prouvent pas une discussion.'};
}

export function selectTaggedVideos(files, tags, slots=10) {
  const humans=files.filter(f=>f.category==='Vidéo'&&['briefing','mechanics'].includes(tags[f.relativePath]));
  const track=files.filter(f=>f.category==='Vidéo'&&tags[f.relativePath]==='track');
  if(!humans.length)return {items:[],warning:'Aucune vidéo d’échanges ou de mécanique classée.'};
  const items=[];
  for(let i=0;i<slots;i++){
    const cutaway=track.length>0&&(i+1)%5===0;
    const chosen=cutaway?track[Math.floor(i/5)%track.length]:humans[i%humans.length];
    items.push({file:chosen});
  }
  return {items,warning:'Sélection fondée sur les scènes vérifiées dans Library.'};
}

export function selectTaggedMoments(moments,slots=12) {
  const humans=moments.filter(x=>x.label==='briefing'||x.label==='mechanics');
  const track=moments.filter(x=>x.label==='track');
  if(!humans.length)return {items:[],warning:'Aucun moment d’échange ou de mécanique identifié.'};
  const items=[];
  let peopleIndex=0,trackIndex=0;
  for(let i=0;i<slots;i++){
    const cutaway=track.length>0&&(i+1)%5===0;
    const selected=cutaway?track[(trackIndex++)%track.length]:humans[(peopleIndex++)%humans.length];
    items.push({file:selected.file,startSeconds:selected.startSeconds});
  }
  return {items,warning:'Montage préparé à partir des moments vérifiés dans les aperçus de Library.'};
}
