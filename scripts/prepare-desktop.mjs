import { mkdir, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
const output = new URL('../desktop-dist/', import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['index.html','style.css','culture-v24.js','app.js','desktop-usb.js','studio-usb-bridge.js','studio-assistant.js']){
  await copyFile(new URL('../'+name,import.meta.url),new URL(name,output));
}
await copyFile(new URL('./brief-ranking.mjs',import.meta.url),new URL('brief-ranking.mjs',output));
await import('./generate-windows-icon.mjs');
console.log('Desktop assets prepared: 8 files');
