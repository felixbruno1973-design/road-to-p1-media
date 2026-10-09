import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelativePath,parseProbe} from '../scripts/probe-local-media.mjs';
test('local probe accepts videos and rejects unsafe paths',()=>{
  assert.equal(validateRelativePath('Anneville 2026/race.MP4'),'Anneville 2026/race.MP4');
  for(const value of ['../race.mp4','C:\\race.mp4','folder/../race.mov','/tmp/race.mp4','notes.txt'])
    assert.throws(()=>validateRelativePath(value));
});
test('FFprobe response produces offline technical metadata',()=>{
  assert.deepEqual(parseProbe({
    streams:[{codec_type:'video',codec_name:'h264',width:1920,height:1080,avg_frame_rate:'60/1'},{codec_type:'audio',codec_name:'aac'}],
    format:{duration:'42.5'}
  }),{durationSeconds:42.5,width:1920,height:1080,codec:'h264',framesPerSecond:'60/1',hasAudio:true});
  assert.throws(()=>parseProbe({streams:[],format:{duration:'4'}}),/No video/);
});
