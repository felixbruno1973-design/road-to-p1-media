import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,symlink,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanMedia,categoryForFile,main } from '../scripts/scan-media.mjs';

test('recognizes supported media extensions',()=>{
  assert.equal(categoryForFile('race.MP4'),'video');
  assert.equal(categoryForFile('photo.JPEG'),'image');
  assert.equal(categoryForFile('notes.txt'),null);
});

test('indexes recursively without modifying originals or following symlinks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rtp1-index-'));
  try{
    const root=join(dir,'source'), nested=join(root,'2026','Soucy');
    await mkdir(nested,{recursive:true});
    await writeFile(join(root,'photo.JPG'),'photo');
    await writeFile(join(nested,'video.mp4'),'video');
    await writeFile(join(nested,'ignore.txt'),'other');
    try{await symlink(nested,join(root,'linked'),'junction');}catch{} // Windows requires privilege in some environments
    const result=await scanMedia(root);
    assert.equal(result.assetCount,2);
    assert.deepEqual(result.assets.map(x=>x.relativePath),['2026/Soucy/video.mp4','photo.JPG']);
    assert.equal(await readFile(join(nested,'video.mp4'),'utf8'),'video');
    const output=join(dir,'index.json');
    const cli=await main(['--root',root,'--output',output]);
    assert.equal(cli.assetCount,2);
    assert.equal(JSON.parse(await readFile(output,'utf8')).assetCount,2);
    await assert.rejects(()=>main(['--root',root,'--output',join(root,'bad.json')]),/outside/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
