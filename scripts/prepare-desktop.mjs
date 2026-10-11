import { mkdir, copyFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { join } from 'node:path';
const output = new URL('../desktop-dist/', import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['index.html','style.css','culture-v24.js','app.js','desktop-usb.js','studio-usb-bridge.js','studio-assistant.js']){
  await copyFile(new URL('../'+name,import.meta.url),new URL(name,output));
}
await copyFile(new URL('./brief-ranking.mjs',import.meta.url),new URL('brief-ranking.mjs',output));
await copyFile(new URL('./visual-scene-classifier.mjs',import.meta.url),new URL('visual-scene-classifier.mjs',output));
await mkdir(new URL('models/ssdlite_mobilenet_v2/',output),{recursive:true});
for(const name of ['model.json',...Array.from({length:5},(_,i)=>'group1-shard'+(i+1)+'of5')]){
  await copyFile(new URL('../model-assets/ssdlite_mobilenet_v2/'+name,import.meta.url),
    new URL('models/ssdlite_mobilenet_v2/'+name,output));
}
await build({
  entryPoints:[new URL('./local-object-detector-entry.mjs',import.meta.url).pathname],
  outfile:new URL('local-object-detector.mjs',output).pathname,
  bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,logLevel:'warning'
});
await import('./generate-windows-icon.mjs');
console.log('Desktop assets prepared: 9 files');
