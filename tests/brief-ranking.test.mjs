import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseForBrief} from '../scripts/brief-ranking.mjs';
const files=[
 {relativePath:'01_course_piste.mp4',category:'Vidéo'},
 {relativePath:'02_mecanique_reglage.mp4',category:'Vidéo'},
 {relativePath:'03_briefing_pilote.mp4',category:'Vidéo'},
 {relativePath:'04_piste.mp4',category:'Vidéo'},
 {relativePath:'05_photo.jpg',category:'Photo'}
];
test('briefing dominates track when named and requested',()=>{
 const picked=chooseForBrief(files,'60 secondes échanges pilotes ingénieurs mécaniciens avec quelques images piste',4);
 assert.equal(picked.items.length,4);
 assert.ok(picked.items[0].humans);
 assert.ok(picked.items[1].humans);
 assert.ok(picked.items.every(x=>x.file.category==='Vidéo'));
});
test('warns when no filename identifies the requested exchanges',()=>{
 const picked=chooseForBrief([{relativePath:'GX01000.MP4',category:'Vidéo'}],'échanges mécaniciens');
 assert.match(picked.warning,/Aucune vidéo identifiée/);
});

test('maintains at least three quarters briefing references for 60-second edit',()=>{
 const selected=chooseForBrief(files,'60 secondes échanges pilotes et mécanos avec quelques plans piste',10);
 assert.equal(selected.items.length,10);
 assert.equal(selected.items.filter(x=>x.humans).length,8);
 assert.equal(selected.items.filter(x=>!x.humans).length,2);
});

test('interleaves circuit footage instead of appending it all at the end',()=>{
 const clips=chooseForBrief(files,'60 secondes échanges pilotes et mécanos avec quelques plans piste',10).items;
 const circuitPositions=clips.map((x,i)=>x.humans?-1:i).filter(i=>i>=0);
 assert.equal(circuitPositions.length,2);
 assert.ok(circuitPositions[0]<8);
 assert.ok(clips[0].humans);
});
