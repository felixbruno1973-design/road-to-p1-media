import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function library(){
 const fields={libSearch:{value:''},libTypeFilter:{value:''},libSort:{value:'date-desc'}};
 const context=vm.createContext({console,Blob,document:{getElementById:id=>fields[id]},window:{},setTimeout,clearTimeout});
 vm.runInContext(source.replace('init();\n})();','globalThis.lib={mediaType,visibleLibrary,dbRemoveMany,setItems:x=>libraryCache=x,setFolder:x=>libraryFolder=x};\n})();'),context);
 return {lib:context.lib,context,fields};
}
test('legacy files with empty or generic MIME types are detected by extension',()=>{
 const {lib}=library();
 assert.equal(lib.mediaType({name:'Course.MP4',type:'application/octet-stream'}),'video/mp4');
 assert.equal(lib.mediaType({name:'Course.mov',type:''}),'video/quicktime');
 assert.equal(lib.mediaType({name:'photo.jpg',type:''}),'image/jpeg');
});
test('folder and type filters restrict bulk-selection candidates; dates and sizes sort numerically',()=>{
 const {lib,fields}=library();
 lib.setItems([{id:'1',name:'Tour 10',event:'Course',category:'Vidéo',date:'2026-09-02',size:20},{id:'2',name:'Tour 2',event:'Course',category:'Photo',date:'2026-09-01',size:100},{id:'3',name:'Autre',event:'',category:'Vidéo',date:'2026-08-30',size:5}]);
 const ids=()=>Array.from(lib.visibleLibrary(),x=>x.id);
 assert.deepEqual(ids(),['1','2','3']);
 lib.setFolder('Course');fields.libSort.value='name';assert.deepEqual(ids(),['2','1']);
 fields.libTypeFilter.value='Vidéo';assert.deepEqual(ids(),['1']);
 lib.setFolder(null);fields.libSort.value='date-asc';assert.deepEqual(ids(),['3','1']);
 fields.libTypeFilter.value='';fields.libSort.value='size';assert.deepEqual(ids(),['2','1','3']);
 fields.libSearch.value='tour 2';assert.deepEqual(ids(),['2']);
});
test('bulk deletion waits for the transaction and rejects an abort',async()=>{
 const {lib,context}=library();let tx;const removed=[];
 context.indexedDB={open(){const req={result:{transaction(){tx={objectStore:()=>({delete:id=>removed.push(id)})};return tx},close(){}}};queueMicrotask(()=>req.onsuccess());return req}};
 let completed=false;const success=lib.dbRemoveMany(['a','b']).then(()=>completed=true);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);assert.deepEqual(removed,['a','b']);
 tx.oncomplete();await success;assert.equal(completed,true);
 const failure=lib.dbRemoveMany(['c']);await new Promise(resolve=>setImmediate(resolve));tx.onabort();await assert.rejects(failure);
});
