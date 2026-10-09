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
