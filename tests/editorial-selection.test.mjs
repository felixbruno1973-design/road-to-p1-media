import test from 'node:test';
import assert from 'node:assert/strict';
import {selectUniqueMoments,insertUniquePhotos} from '../editorial-selection.mjs';
const f=(p,category='Vidéo')=>({relativePath:p,category});
test('never repeats same timestamp even when duplicate metadata',()=>{
 const scenes=[{file:f('a.mp4'),label:'briefing',startSeconds:0},{file:f('a.mp4'),label:'briefing',startSeconds:0},{file:f('b.mp4'),label:'track',startSeconds:10}];
 const p=selectUniqueMoments(scenes,18);assert.equal(p.items.length,2);assert.equal(new Set(p.items.map(x=>x.file.relativePath+x.startSeconds)).size,2);
});
test('does not invent human interaction',()=>assert.equal(selectUniqueMoments([{file:f('a.mp4'),label:'track',startSeconds:0}]).items.length,0));
test('preserves reviewed scene endpoints',()=>{
 const p=selectUniqueMoments([{file:f('a.mp4'),label:'mechanics',startSeconds:3,endSeconds:9}]);
 assert.deepEqual([p.items[0].startSeconds,p.items[0].endSeconds],[3,9]);
});
test('photos are unique and limited',()=>{
 const a=insertUniquePhotos([{file:f('a.mp4')}],[f('x.jpg','Photo'),f('x.jpg','Photo'),f('y.png','Photo'),f('z.pdf','Photo')]);
 assert.equal(a.filter(x=>x.file.category==='Photo').length,2);
});
