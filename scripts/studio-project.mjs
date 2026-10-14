// Shared desktop contract: keep duplicate source references and reviewed cut points.
export function montageRequest(instruction) {
  const match=/\b(\d{1,3})\s*(?:secondes?|sec|s)\b/i.exec(instruction);
  return {instruction,targetSeconds:match?Math.min(600,Math.max(5,Number(match[1]))):60,
    format:/youtube|horizontal|paysage/i.test(instruction)?'16:9':'9:16'};
}
export function renderRequest(items, request) {
  const clips=items.filter(x=>x.category==='Vidéo'||(x.category==='Photo'&&/\.(jpe?g|png|webp)$/i.test(x.relativePath))).slice(0,30);
  return {relativePaths:clips.map(x=>x.relativePath),
    startSeconds:clips.map(x=>x.startSeconds??(x.inMs==null?null:x.inMs/1000)),
    endSeconds:clips.map(x=>x.endSeconds??(x.outMs==null?null:x.outMs/1000)),
    targetSeconds:request.targetSeconds,format:request.format||'9:16'};
}
export function draftProject(selection, seconds=60, format='9:16') {
  if (!Number.isInteger(seconds)||seconds<5||seconds>600) throw Error('Durée invalide (5 à 600 secondes entières).');
  const items=selection.items.filter(x=>x.category==='Vidéo'||(x.category==='Photo'&&/\.(jpe?g|png|webp)$/i.test(x.relativePath)));
  if(!items.length||items.length>100)throw Error('Sélection invalide (1 à 100 médias).');
  return {schemaVersion:1,kind:'road-to-p1-usb-draft',createdAt:new Date().toISOString(),
    sourceLabel:selection.source,targetDurationMs:seconds*1000,
    output:{width:format==='16:9'?1920:1080,height:format==='16:9'?1080:1920,fps:30},
    clips:items.map((item,i)=>({assetId:'usb-'+i,relativePath:item.relativePath,category:item.category,order:i,
      inMs:item.inMs??(item.startSeconds==null?null:Math.round(item.startSeconds*1000)),
      outMs:item.outMs??(item.endSeconds==null?null:Math.round(item.endSeconds*1000)),
      durationMs:item.durationMs??null}))};
}
