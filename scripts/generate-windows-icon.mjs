// Generates an original placeholder Windows .ico for development builds.
// Replace with the approved Road to P1 brand artwork before public release.
import {mkdir,writeFile} from 'node:fs/promises';
const n=32, header=Buffer.alloc(6),entry=Buffer.alloc(16);
header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
entry[0]=n;entry[1]=n;entry[2]=0;entry[3]=0;
entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);
const pixels=Buffer.alloc(n*n*4);
for(let y=0;y<n;y++) for(let x=0;x<n;x++){
  const p=((n-1-y)*n+x)*4;
  const center=(x>=6&&x<=25&&y>=6&&y<=25);
  const stripe=(x>=14&&x<=18);
  pixels[p]=center?38:15;
  pixels[p+1]=center?125:20;
  pixels[p+2]=center?210:28;
  if(stripe&&center){pixels[p]=210;pixels[p+1]=230;pixels[p+2]=255;}
  pixels[p+3]=255;
}
const info=Buffer.alloc(40);
info.writeUInt32LE(40,0);info.writeInt32LE(n,4);info.writeInt32LE(n*2,8);
info.writeUInt16LE(1,12);info.writeUInt16LE(32,14);
info.writeUInt32LE(pixels.length,20);
const mask=Buffer.alloc(n*4); // Fully opaque.
const dib=Buffer.concat([info,pixels,mask]);
entry.writeUInt32LE(dib.length,8);entry.writeUInt32LE(22,12);
await mkdir(new URL('../src-tauri/icons/',import.meta.url),{recursive:true});
await writeFile(new URL('../src-tauri/icons/icon.ico',import.meta.url),Buffer.concat([header,entry,dib]));
console.log('Generated temporary Tauri Windows icon');
