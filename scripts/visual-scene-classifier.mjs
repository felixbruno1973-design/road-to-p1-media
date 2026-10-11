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
