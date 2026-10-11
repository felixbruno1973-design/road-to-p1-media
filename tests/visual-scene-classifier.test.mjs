import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVisualDetections, selectEditorialTimeline, selectTaggedVideos, selectTaggedMoments} from '../scripts/visual-scene-classifier.mjs';
test('multiple visible people suggest an interaction but cannot prove conversation',()=>{
 const result=classifyVisualDetections([{label:'person',score:.9},{label:'person',score:.8}]);
 assert.equal(result.label,'briefing');
 assert.match(result.reason,/personnes/);
});
test('requires human footage rather than fabricating briefing',()=>{
 const result=selectEditorialTimeline([{label:'track',relativePath:'track.mp4'}],60);
 assert.equal(result.segments.length,0);
 assert.match(result.warning,/Aucune interaction/);
});
test('creates briefing-led visual timeline with occasional circuit cutaways',()=>{
 const result=selectEditorialTimeline([{label:'briefing',relativePath:'talk.mp4'},{label:'track',relativePath:'race.mp4'}],60);
 assert.equal(result.segments.length,12);
 assert.equal(result.segments.filter(x=>x.label==='track').length,2);
});

test('uses reviewed generic filenames and inserts circuit shots during a briefing reel',()=>{
 const files=[
  {relativePath:'GX01.MP4',category:'Vidéo'},
  {relativePath:'GX02.MP4',category:'Vidéo'},
  {relativePath:'GX03.MP4',category:'Vidéo'}
 ];
 const plan=selectTaggedVideos(files,{'GX01.MP4':'briefing','GX02.MP4':'mechanics','GX03.MP4':'track'},10);
 assert.equal(plan.items.length,10);
 assert.equal(plan.items.filter(x=>x.file.relativePath==='GX03.MP4').length,2);
 assert.equal(plan.items[0].file.relativePath,'GX01.MP4');
});

test('respects reviewed five-second scenes from generic camera names',()=>{
 const moments=[
  {file:{relativePath:'GOPR001.MP4',category:'Vidéo'},label:'briefing',startSeconds:15},
  {file:{relativePath:'GOPR001.MP4',category:'Vidéo'},label:'mechanics',startSeconds:35},
  {file:{relativePath:'GOPR002.MP4',category:'Vidéo'},label:'track',startSeconds:10}
 ];
 const result=selectTaggedMoments(moments,12);
 assert.equal(result.items.length,12);
 assert.equal(result.items.filter(x=>x.file.relativePath==='GOPR002.MP4').length,2);
 assert.equal(result.items[0].startSeconds,15);
 assert.equal(result.items[1].startSeconds,35);
});
