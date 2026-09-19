import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {validatePlan,limitedBody,compactElements} from '../worker/index.js';
const env={WRITE_KEY:'test-only-access-key',WP_USERNAME:'test',WP_APP_PASSWORD:'test',WP_URL:'https://road-to-p1.com',OPENAI_API_KEY:'test-only-ai-key'};
const request=(path,body,extra={})=>new Request('https://media.invalid'+path,{method:body===undefined?'GET':'POST',headers:{'X-RTP1-Key':env.WRITE_KEY,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
const json=(data,status=200)=>Response.json(data,{status});
const change={kind:'setting',elementId:'8480ea5',key:'min_height_mobile',selector:'',device:'mobile',value:'{"unit":"vh","size":55}',reason:'Réduire la hauteur.'};

test('shared control definitions preserve every element, exact key, constraint and style',()=>{
  const control={type:'slider',units:['px'],range:{px:{min:0,max:1000}}};
  const elements=[{id:'one',settings:{width:42},controls:{width:control,width_mobile:control},html:{css:'.intro{padding:120px}' }},{id:'two',controls:{height:control}}];
  const compact=compactElements(elements);
  assert.equal(Object.keys(compact.controlDefinitions).length,1);
  const expanded=compact.elements.map(({controls,...e})=>({...e,controls:Object.fromEntries(Object.entries(controls).map(([key,ref])=>[key,compact.controlDefinitions[ref]]))}));
  assert.deepEqual(expanded,elements);
});

test('every non-health route requires authentication, including AI and history',async()=>{
  const prior=globalThis.fetch; let calls=0; globalThis.fetch=async()=>{calls++;return json({});};
  try { for(const path of ['/draft','/apply','/rollback','/preview','/transcribe','/pages','/history']) {
    const result=await worker.fetch(request(path,{}, {'X-RTP1-Key':'wrong'}),env); assert.equal(result.status,401);
  } assert.equal(calls,0); } finally {globalThis.fetch=prior;}
});
test('cross-origin requests are rejected before fetching upstream',async()=>{
  assert.equal((await worker.fetch(request('/draft',{}, {Origin:'https://evil.invalid'}),env)).status,403);
});
test('configuration fails closed when access secret is absent',async()=>{
  assert.equal((await worker.fetch(request('/history'),{...env,WRITE_KEY:undefined})).status,401);
});
test('legacy direct publishing is disabled',async()=>{
  assert.equal((await worker.fetch(request('/apply-home-mobile-spacing',{}),env)).status,410);
});
test('apply and rollback demand boolean confirmation, not truthy strings',async()=>{
  for(const route of ['/apply','/rollback']) for(const confirm of [undefined,false,'true',1]) {
    const res=await worker.fetch(request(route,{draftId:'12345678-1234-1234-1234-123456789abc',confirm}),env); assert.equal(res.status,400);
  }
});
test('client patches, page ids and destinations cannot be smuggled into apply',async()=>{
  const prior=globalThis.fetch; let sent;
  globalThis.fetch=async(url,options)=>{sent={url,body:JSON.parse(options.body)};return json({ok:true});};
  try {
    const result=await worker.fetch(request('/apply',{draftId:'12345678-1234-1234-1234-123456789abc',confirm:true,reviewHash:'abc',changes:[{code:'evil'}],pageId:999,url:'https://evil.invalid'}),env);
    assert.equal(result.status,200); assert.equal(sent.url,'https://road-to-p1.com/wp-json/rtp1-media/v1/apply');
    assert.deepEqual(sent.body,{draftId:'12345678-1234-1234-1234-123456789abc',confirm:true,reviewHash:'abc'});
  } finally {globalThis.fetch=prior;}
});
test('WordPress conflict remains a visible 409 and is not retried',async()=>{
  const prior=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return json({message:'La page a changé.'},409);};
  try { const res=await worker.fetch(request('/apply',{draftId:'12345678-1234-1234-1234-123456789abc',confirm:true}),env);assert.equal(res.status,409);assert.equal(calls,1); }finally{globalThis.fetch=prior;}
});
test('draft only reads snapshot and stores a proposal; no page write',async()=>{
  const prior=globalThis.fetch; const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,body:options.body?JSON.parse(options.body):null});
    if(url.endsWith('/quota')) return json({ok:true});
    if(url.includes('/snapshot/')) return json({ok:true,revision:'revision-original',page:{id:10},elements:[]});
    if(url.includes('api.openai.com')) return json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'Hauteur mobile',clarification:'',changes:[change]})}]}]});
    if(url.endsWith('/draft')) return json({ok:true,draft:{id:'draft'}});
    throw new Error('Unexpected write');
  };
  try { const res=await worker.fetch(request('/draft',{pageId:10,instruction:'Réduire la hauteur mobile à 55 vh',device:'mobile'}),env);assert.equal(res.status,200);assert.equal(calls.at(-1).body.revision,'revision-original');assert.equal(calls[2].body.store,false);assert.equal(calls.length,4); }finally{globalThis.fetch=prior;}
});
test('ambiguous requests ask for clarification and never store an actionable draft',async()=>{
  const prior=globalThis.fetch;let stores=0;
  globalThis.fetch=async(url)=>{
    if(url.endsWith('/quota')) return json({ok:true});
    if(url.includes('/snapshot/')) return json({ok:true,page:{id:10},elements:[]});
    if(url.includes('api.openai.com')) return json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'',clarification:'Quel titre ?',changes:[change]})}]}]});
    stores++;return json({});
  };
  try {const res=await worker.fetch(request('/draft',{pageId:10,instruction:'Changer un titre'}),env);assert.equal((await res.json()).clarification,'Quel titre ?');assert.equal(stores,0);}finally{globalThis.fetch=prior;}
});
test('invalid plans fail closed',()=>{
  for(const plan of [null,{}, {summary:'',clarification:'',changes:[]},{summary:'',clarification:'',changes:[{...change,kind:'execute'}]},{summary:'',clarification:'',changes:[{...change,elementId:'<script>'}]}]) assert.throws(()=>validatePlan(plan));
});
test('request size limit applies to streamed bodies, not only headers',async()=>{
  await assert.rejects(()=>limitedBody(new Request('https://example.invalid',{method:'POST',body:'abcdef'}),3),e=>e.status===413);
});
test('WordPress credentials never follow redirects or leave the site',async()=>{
  const prior=globalThis.fetch;let config;
  globalThis.fetch=async(url,options)=>{config=options;return json({ok:true,pages:[]});};
  try {assert.equal((await worker.fetch(request('/pages'),{...env,WP_URL:'https://attacker.invalid'})).status,503);assert.equal(config,undefined);await worker.fetch(request('/pages'),env);assert.equal(config.redirect,'manual');}finally{globalThis.fetch=prior;}
});
test('WordPress redirects fail closed without a second credentialed request',async()=>{
  const prior=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://attacker.invalid'}});};
  try {const result=await worker.fetch(request('/capabilities'),env);assert.equal(result.status,502);assert.equal(calls,1);assert.match((await result.json()).message,/redirection inattendue/);}finally{globalThis.fetch=prior;}
});
test('public health leaks neither WordPress identity nor credentials',async()=>{
  const res=await worker.fetch(request('/health'),env);const body=await res.text();assert.equal(body.includes(env.WRITE_KEY),false);assert.equal(body.includes('roles'),false);assert.equal(res.headers.get('Cache-Control'),'no-store');
});
test('Cloudflare AI works without an OpenAI key and still validates the plan',async()=>{
  const prior=globalThis.fetch;let model,params,stored;
  globalThis.fetch=async(url,options)=>{
    assert.ok(!url.includes('openai.com'));
    if(url.endsWith('/quota'))return json({ok:true});
    if(url.includes('/snapshot/'))return json({ok:true,revision:'r1',page:{id:10},elements:[]});
    stored=JSON.parse(options.body);return json({ok:true,draft:{id:'test'}});
  };
  const AI={run:async(m,p)=>{model=m;params=p;return {response:{summary:'Hauteur',clarification:'',changes:[change]}};}};
  try {const res=await worker.fetch(request('/draft',{pageId:10,instruction:'Réduire la hauteur mobile',device:'mobile'}),{...env,OPENAI_API_KEY:undefined,AI});assert.equal(res.status,200);assert.equal(model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.equal(params.response_format.type,'json_schema');assert.equal(stored.revision,'r1');}finally{globalThis.fetch=prior;}
});

test('a rejected draft is corrected once using the same snapshot, never published',async()=>{
  const prior=globalThis.fetch;let plans=0,drafts=0,snapshots=0;
  const AI={run:async(_model,p)=>{plans++;if(plans===2){assert.match(p.messages.at(-1).content,/Affichage incompatible/);assert.equal(p.messages.at(-2).role,'assistant');}return {response:{summary:'Espacement',clarification:'',changes:[change]}};}};
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith('/quota'))return json({ok:true});
    if(url.includes('/snapshot/')){snapshots++;return json({revision:'initial',page:{id:10},elements:[]});}
    assert.ok(url.endsWith('/draft'));assert.equal(JSON.parse(options.body).revision,'initial');
    return ++drafts===1?json({message:'Affichage incompatible avec le réglage.'},422):json({ok:true,draft:{id:'test'}});
  };
  try {assert.equal((await worker.fetch(request('/draft',{pageId:10,instruction:'Réduire l’espace mobile',device:'mobile'}),{...env,OPENAI_API_KEY:undefined,AI})).status,200);assert.equal(plans,2);assert.equal(drafts,2);assert.equal(snapshots,1);}finally{globalThis.fetch=prior;}
});

test('draft correction stops on repeated validation errors, conflicts and uncertain failures',async()=>{
  const prior=globalThis.fetch;
  try {for(const status of [422,409,502]) {
    let plans=0,drafts=0;
    const AI={run:async()=>{plans++;return {response:{summary:'Espacement',clarification:'',changes:[change]}};}};
    globalThis.fetch=async(url)=>{
      if(url.endsWith('/quota'))return json({ok:true});
      if(url.includes('/snapshot/'))return json({revision:'initial',page:{id:10},elements:[]});
      assert.ok(url.endsWith('/draft'));drafts++;return json({message:'Refus'},status);
    };
    assert.equal((await worker.fetch(request('/draft',{pageId:10,instruction:'Réduire l’espace mobile',device:'mobile'}),{...env,OPENAI_API_KEY:undefined,AI})).status,status);
    assert.equal(plans,status===422?2:1);assert.equal(drafts,plans);
  }}finally{globalThis.fetch=prior;}
});
