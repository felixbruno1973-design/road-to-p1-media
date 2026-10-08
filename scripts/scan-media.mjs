#!/usr/bin/env node
// Phase P1 prototype: read-only, explicit-root local indexer; not yet integrated into Tauri.
import { readdir, stat, realpath, writeFile } from 'node:fs/promises';
import { resolve, relative, join, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const extType = new Map([
  ...['.mp4','.mov','.m4v','.avi','.mkv','.webm'].map(x=>[x,'video']),
  ...['.jpg','.jpeg','.png','.webp','.heic','.tif','.tiff'].map(x=>[x,'image']),
  ...['.mp3','.wav','.m4a','.flac','.aac'].map(x=>[x,'audio'])
]);
export function categoryForFile(name) { return extType.get(extname(name).toLowerCase()) ?? null; }

/** Walk an explicitly chosen root without following symlinks or writing to it. */
export async function scanMedia(root,{maxFiles=500000}={}){
  if(!root || typeof root!=='string') throw new Error('Explicit root directory required');
  const canonicalRoot=await realpath(resolve(root));
  const rootInfo=await stat(canonicalRoot);
  if(!rootInfo.isDirectory()) throw new Error('Root must be a directory');
  const assets=[];
  const pending=[canonicalRoot];
  const errors=[];
  while(pending.length){
    const dir=pending.pop();
    let entries;
    try { entries=await readdir(dir,{withFileTypes:true}); }
    catch(err) { errors.push({directory:relative(canonicalRoot,dir),message:err.code||'read error'});continue; }
    for(const entry of entries){
      // Symlinks / junctions are not followed, even if they point inside the root.
      if(entry.isSymbolicLink()) continue;
      const filename=join(dir,entry.name);
      if(entry.isDirectory()){pending.push(filename);continue;}
      if(!entry.isFile()) continue;
      const type=categoryForFile(entry.name);
      if(!type) continue;
      let meta;
      try {meta=await stat(filename);}catch(err){errors.push({file:entry.name,message:err.code||'stat error'});continue;}
      if(assets.length>=maxFiles) throw new Error('Media scan limit exceeded');
      assets.push({
        relativePath:relative(canonicalRoot,filename).replaceAll('\\','/'),
        type,
        sizeBytes:meta.size,
        modifiedAt:meta.mtime.toISOString()
      });
    }
  }
  assets.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
  return {version:1,source:{name:basename(canonicalRoot)},assetCount:assets.length,assets,errors};
}

export async function main(argv=process.argv.slice(2)){
  const i=argv.indexOf('--root'),o=argv.indexOf('--output');
  if(i<0 || !argv[i+1] || o<0 || !argv[o+1]) throw new Error('Usage: node scripts/scan-media.mjs --root "E:\\Karting" --output "C:\\RoadToP1\\catalog.json"');
  const root=resolve(argv[i+1]), output=resolve(argv[o+1]);
  const relativeOutput=relative(root,output);
  if(relativeOutput==='' || (!relativeOutput.startsWith('..') && !/^[A-Za-z]:/.test(relativeOutput))) throw new Error('Output must be outside the media root');
  const result=await scanMedia(root);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'w'});
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().then(result=>console.log('Indexed',result.assetCount,'media files')).catch(err=>{console.error(err.message);process.exitCode=1;});
}
