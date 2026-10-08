// Offline FFprobe metadata inspection, without media uploads or modifications.
// Usage: node scripts/probe-local-media.mjs --root E:\\Karting --relative "Anneville 2026/race.mp4"
import {realpath,stat} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function validateRelativePath(value){
  if(typeof value!=='string'||!value||isAbsolute(value)||/^[a-z]:/i.test(value)||
    value.split(/[\\/]/).some(part=>!part||part==='..'||part==='.'))throw Error('Invalid media path');
  if(!/\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(value))throw Error('Unsupported video format');
  return value;
}
export function parseProbe(json){
  const data=typeof json==='string'?JSON.parse(json):json;
  const video=data.streams?.find(s=>s.codec_type==='video');
  if(!video)throw Error('No video stream');
  const duration=Number(data.format?.duration??video.duration);
  return {
    durationSeconds:Number.isFinite(duration)&&duration>0?duration:null,
    width:Number(video.width)||null,height:Number(video.height)||null,
    codec:String(video.codec_name||'unknown'),
    framesPerSecond:String(video.avg_frame_rate||'0/0'),
    hasAudio:Boolean(data.streams?.some(s=>s.codec_type==='audio'))
  };
}
export async function probeLocalMedia({root,relativePath,ffprobe='ffprobe'}){
  validateRelativePath(relativePath);
  const base=await realpath(resolve(root));
  if(!(await stat(base)).isDirectory())throw Error('Invalid folder');
  const file=await realpath(join(base,relativePath));
  const rel=relative(base,file);
  if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel))throw Error('Outside selected folder');
  if(!(await stat(file)).isFile())throw Error('Not a file');
  return new Promise((ok,fail)=>{
    const child=spawn(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,duration','-of','json',file],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',error='';
    child.stdout.on('data',d=>{output+=d.toString();if(output.length>2_000_000)child.kill()});
    child.stderr.on('data',d=>{error+=d.toString();if(error.length>2000)error=error.slice(-2000)});
    child.on('error',fail);
    child.on('close',code=>{if(code!==0)return fail(Error('FFprobe failed: '+error));try{ok(parseProbe(output))}catch(e){fail(e)}});
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  const arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
  probeLocalMedia({root:arg('--root'),relativePath:arg('--relative'),ffprobe:arg('--ffprobe')||'ffprobe'})
    .then(data=>console.log(JSON.stringify(data,null,2)))
    .catch(e=>{console.error(e.message);process.exitCode=1});
}
