import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProject,clipTiming} from '../scripts/render-local-mp4.mjs';
const draft={kind:'road-to-p1-usb-draft',targetDurationMs:45000,clips:[{relativePath:'2026/Soucy/lara.mp4',category:'Vidéo'}]};
test('validates local MP4 draft without FFmpeg dependency',()=>{
  assert.equal(validateProject(draft),draft);
  assert.throws(()=>validateProject({...draft,targetDurationMs:-5}),/duration/);
  assert.throws(()=>validateProject({...draft,clips:[]}),/clip count/);
  assert.throws(()=>validateProject({...draft,clips:[{relativePath:'../secret.mp4',category:'Vidéo'}]}),/path/);
  assert.throws(()=>validateProject({...draft,clips:[{relativePath:'C:\\hidden.mp4',category:'Vidéo'}]}),/path/);
  assert.throws(()=>validateProject({...draft,clips:[{relativePath:'clip.exe',category:'Exécutable'}]}),/Only videos/);
});

test('rejects malformed paths and unsupported media categories',()=>{
  for(const path of ['../outside.mp4','nested/../outside.mp4','/absolute.mp4','C:\\absolute.mp4','nested//video.mp4']){
    assert.throws(()=>validateProject({...draft,clips:[{relativePath:path,category:'Vidéo'}]}),/path/);
  }
  assert.throws(()=>validateProject({...draft,clips:[{relativePath:'video.mp4',category:'Audio'}]}),/Only videos/);
});

test('uses explicit edit in/out and clip duration when present',()=>{
  const clip={relativePath:'race.mp4',category:'Vidéo',inMs:2500,outMs:9500,durationMs:5000};
  const project={...draft,clips:[clip]};
  assert.deepEqual(clipTiming(project,clip),{inSeconds:2.5,durationSeconds:5});
  assert.deepEqual(clipTiming(draft,draft.clips[0]),{inSeconds:0,durationSeconds:45});
  assert.throws(()=>validateProject({...draft,clips:[{...clip,inMs:-1}]}),/in point/);
  assert.throws(()=>validateProject({...draft,clips:[{...clip,outMs:1000}]}),/out point/);
  assert.throws(()=>validateProject({...draft,clips:[{...clip,durationMs:0}]}),/clip duration/);
});
