const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
function cors(env){return {'access-control-allow-origin':env.ALLOWED_ORIGIN||'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','vary':'Origin'}}
function auth(request,env){const h=request.headers.get('authorization')||'';return h===`Bearer ${env.AUTH_SECRET}`}
function safePart(v,fallback='unknown'){return String(v||fallback).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||fallback}
function objectKey(meta,id){const year=(meta.date||meta.created||new Date().toISOString()).slice(0,4);return [year,safePart(meta.event,'sans-evenement'),safePart(meta.pilot,'commun'),safePart(meta.category,'document'),id+'-'+safePart(meta.name,'fichier')].join('/')}
export default{
 async fetch(request,env){
  const headers=cors(env);if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({ok:true,service:'road-to-p1-media-cloud',storage:'R2+D1'},200,headers);
  if(!auth(request,env))return json({error:'unauthorized'},401,headers);
  try{
   if(request.method==='GET'&&url.pathname==='/library'){
    const {results=[]}=await env.DB.prepare('SELECT id,name,type,size,last_modified AS lastModified,pilot,category,event,event_date AS date,tags,created,object_key AS objectKey FROM media ORDER BY created DESC').all();
    return json({items:results},200,headers);
   }
   if(request.method==='POST'&&url.pathname==='/library/multipart/start'){
    const meta=await request.json();if(!meta?.name||!Number(meta?.size))return json({error:'invalid file'},400,headers);
    const id=crypto.randomUUID(),key=objectKey(meta,id);
    const upload=await env.MEDIA.createMultipartUpload(key,{httpMetadata:{contentType:meta.type||'application/octet-stream'}});
    return json({id,key,uploadId:upload.uploadId},200,headers);
   }
   if(request.method==='PUT'&&url.pathname==='/library/multipart/part'){
    const key=url.searchParams.get('key'),uploadId=url.searchParams.get('uploadId'),partNumber=Number(url.searchParams.get('partNumber'));
    if(!key||!uploadId||!Number.isInteger(partNumber)||partNumber<1||!request.body)return json({error:'invalid multipart part'},400,headers);
    const upload=env.MEDIA.resumeMultipartUpload(key,uploadId);const part=await upload.uploadPart(partNumber,request.body);
    return json({partNumber:part.partNumber,etag:part.etag},200,headers);
   }
   if(request.method==='POST'&&url.pathname==='/library/multipart/complete'){
    const body=await request.json(),{key,uploadId,parts,meta}=body||{};
    if(!key||!uploadId||!Array.isArray(parts)||!parts.length||!meta?.id)return json({error:'invalid completion'},400,headers);
    const upload=env.MEDIA.resumeMultipartUpload(key,uploadId);await upload.complete(parts);
    await env.DB.prepare(`INSERT INTO media (id,name,type,size,last_modified,pilot,category,event,event_date,tags,created,object_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(meta.id,meta.name,meta.type||'application/octet-stream',Number(meta.size)||0,Number(meta.lastModified)||0,meta.pilot||'',meta.category||'Document',meta.event||'',meta.date||'',meta.tags||'',meta.created||new Date().toISOString(),key).run();
    return json({ok:true,id:meta.id},200,headers);
   }
   const match=url.pathname.match(/^\/library\/([^/]+)(?:\/content)?$/);
   if(match){
    const id=decodeURIComponent(match[1]);const row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
    if(!row)return json({error:'not found'},404,headers);
    if(request.method==='GET'&&url.pathname.endsWith('/content')){
     const obj=await env.MEDIA.get(row.object_key);if(!obj)return json({error:'object not found'},404,headers);
     const h=new Headers(headers);h.set('content-type',row.type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('cache-control','private, max-age=60');h.set('content-length',String(row.size||obj.size||0));
     return new Response(obj.body,{status:200,headers:h});
    }
    if(request.method==='DELETE'){
     await env.MEDIA.delete(row.object_key);await env.DB.prepare('DELETE FROM media WHERE id=?').bind(id).run();return json({ok:true},200,headers);
    }
   }
   return json({error:'not found'},404,headers);
  }catch(error){console.error(error);return json({error:'server_error',message:String(error?.message||error)},500,headers)}
 }
};
