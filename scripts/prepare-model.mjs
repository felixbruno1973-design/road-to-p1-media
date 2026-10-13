import {mkdir,writeFile,readFile} from 'node:fs/promises';
const base='https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/';
const dir=new URL('../model-assets/ssdlite_mobilenet_v2/',import.meta.url);
await mkdir(dir,{recursive:true});
async function asset(name){
  if(!/^[\w.-]+$/.test(name))throw Error('Invalid model asset name');
  const path=new URL(name,dir);
  try {const existing=await readFile(path);if(existing.length>0)return existing;} catch(e){if(e.code!=='ENOENT')throw e;}
  const response=await fetch(base+name);
  if(!response.ok)throw Error(`Model download failed: ${name} (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length)throw Error('Empty model asset');
  await writeFile(path,bytes);return bytes;
}
const manifest=JSON.parse(await asset('model.json'));
for(const name of manifest.weightsManifest.flatMap(x=>x.paths))await asset(name);
console.log('Offline model ready.');
