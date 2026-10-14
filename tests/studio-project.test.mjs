import test from 'node:test';
import assert from 'node:assert/strict';
import {montageRequest,renderRequest,draftProject} from '../scripts/studio-project.mjs';
import {selectTaggedMoments} from '../scripts/visual-scene-classifier.mjs';

test('Soucy defaults to 60 seconds and keeps the requested aspect ratio',()=>{
  assert.equal(montageRequest('Soucy').targetSeconds,60);
  assert.deepEqual(montageRequest('Soucy 60 secondes horizontal'),{instruction:'Soucy 60 secondes horizontal',targetSeconds:60,format:'16:9'});
});
test('reviewed repeated sources retain each in/out through Studio and JSON export',()=>{
  const file={relativePath:'SOUCY 2/caméra.mp4',category:'Vidéo'};
  const planned=selectTaggedMoments([{file,label:'briefing',startSeconds:15},{file,label:'mechanics',startSeconds:35}],12);
  const items=planned.items.map(x=>({...x.file,startSeconds:x.startSeconds,endSeconds:x.endSeconds}));
  const native=renderRequest(items,montageRequest('Soucy 60 secondes'));
  const draft=draftProject({source:'Soucy',items},60);
  assert.equal(native.relativePaths.length,12);
  assert.deepEqual(native.startSeconds.slice(0,2),[15,35]);
  assert.deepEqual(native.endSeconds.slice(0,2),[20,40]);
  assert.equal(draft.clips.length,12);
  assert.deepEqual(draft.clips.slice(0,2).map(x=>[x.inMs,x.outMs]),[[15000,20000],[35000,40000]]);
  assert.equal(draft.targetDurationMs,60000);
});
test('export rejects invalid durations and excludes standalone audio and unsupported photos',()=>{
  const items=[{relativePath:'a.mp4',category:'Vidéo'},{relativePath:'a.mp3',category:'Audio'},{relativePath:'a.heic',category:'Photo'}];
  assert.equal(draftProject({items},60).clips.length,1);
  assert.throws(()=>draftProject({items},5.2),/Durée/);
  assert.throws(()=>draftProject({items:[]},60),/Sélection/);
});
