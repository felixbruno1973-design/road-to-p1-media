// Experimental local MP4 renderer. Requires a separately installed FFmpeg binary.
// No network, no shell, no writes to the USB media folder.
import {readFile,writeFile,mkdtemp,rm,realpath,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function validateProject(project){
  if(project?.kind!=='road-to-p1-usb-draft'||!Array.isArray(project.clips)||!project.clips.length||project.clips.length>100)throw Error('Invalid project or clip count');
  const duration=Number(project.targetDurationMs);
  if(!Number.isSafeInteger(duration)||duration<5000||duration>600000)throw Error('Invalid target duration');
  for(const item of project.clips){
    if(item.inMs!==null&&item.inMs!==undefined&&(!Number.isSafeInteger(item.inMs)||item.inMs<0))throw Error('Invalid in point');
    if(item.outMs!==null&&item.outMs!==undefined&&(!Number.isSafeInteger(item.outMs)||item.outMs<0||item.outMs<Number(item.inMs||0)))throw Error('Invalid out point');
    if(item.durationMs!==null&&item.durationMs!==undefined&&(!Number.isSafeInteger(item.durationMs)||item.durationMs<=0||item.durationMs>600000))throw Error('Invalid clip duration');
    if(!item||typeof item.relativePath!=='string'||!item.relativePath||isAbsolute(item.relativePath)||/^[a-z]:/i.test(item.relativePath)||item.relativePath.split(/[\\/]/).some(x=>x==='..'||!x))throw Error('Invalid relative media path');
    if(!['Vidéo','Photo'].includes(item.category))throw Error('Only videos and images supported');
  }
  return project;
}
function runFFmpeg(bin,args){
  return new Promise((ok,fail)=>{
    const child=spawn(bin,args,{shell:false,windowsHide:true,stdio:['ignore','ignore','pipe']});
    let error='';
    child.stderr.on('data',data=>{error=(error+data.toString()).slice(-3000)});
    child.on('error',fail);
    child.on('close',code=>code===0?ok():fail(Error('FFmpeg failed: '+error)));
  });
}
export function clipTiming(project, clip){
  validateProject(project);
  const fallback=project.targetDurationMs/project.clips.length;
  const durationMs=clip.durationMs??fallback;
  const inMs=clip.inMs??0;
  const outMs=clip.outMs??(inMs+durationMs);
  return {inSeconds:inMs/1000,durationSeconds:Math.min(durationMs,outMs-inMs)/1000};
}
export async function render(project,{root,output,ffmpeg='ffmpeg'}){
  validateProject(project);
  const base=await realpath(resolve(root));
  if(!(await stat(base)).isDirectory())throw Error('Invalid root directory');
  const target=resolve(output);
  const relOut=relative(base,target);
  if(!relOut.startsWith('..')&&!isAbsolute(relOut))throw Error('Output must be outside USB source root');
  if(!target.toLowerCase().endsWith('.mp4'))throw Error('Output must be .mp4');
  const outputDir=await realpath(dirname(target));
  const relativeDir=relative(base,outputDir);
  if(!relativeDir.startsWith('..')&&!isAbsolute(relativeDir))throw Error('Output folder must be outside USB source root');
  const count=project.clips.length;
  const work=await mkdtemp(join(tmpdir(),'rtp1-render-'));
  try{
    const segments=[];
    for(let i=0;i<count;i++){
      const clip=project.clips[i];
      const source=await realpath(join(base,clip.relativePath));
      const rel=relative(base,source);
      if(rel.startsWith('..')||isAbsolute(rel))throw Error('Source outside authorized folder');
      if(!(await stat(source)).isFile())throw Error('Source is not a file');
      const segment=join(work,'part-'+String(i).padStart(4,'0')+'.mp4');
      const photo=clip.category==='Photo';
      const args=['-hide_banner','-loglevel','error','-y'];
      const timing=clipTiming(project,clip);
      if(timing.durationSeconds<=0)throw Error('Empty clip interval');
      if(photo)args.push('-loop','1','-framerate','30');
      else if(timing.inSeconds>0)args.push('-ss',String(timing.inSeconds));
      args.push('-i',source,'-t',String(timing.durationSeconds));
      args.push('-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30',
        '-an','-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-movflags','+faststart',segment);
      await runFFmpeg(ffmpeg,args);
      segments.push(segment);
    }
    const list=join(work,'concat.txt');
    await writeFile(list,segments.map(p=>"file '"+p.replaceAll("'","'\\''")+"'").join('\n')+'\n');
    await runFFmpeg(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',target]);
    return target;
  }finally{await rm(work,{recursive:true,force:true})}
}
export async function main(args=process.argv.slice(2)){
  const val=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
  const projectPath=val('--project'),root=val('--root'),output=val('--output');
  if(!projectPath||!root||!output)throw Error('Usage: node scripts/render-local-mp4.mjs --project project.json --root E:\\Karting --output C:\\Exports\\reel.mp4');
  const project=JSON.parse(await readFile(projectPath,'utf8'));
  return render(project,{root,output,ffmpeg:val('--ffmpeg')||'ffmpeg'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().then(path=>console.log('MP4 created:',path)).catch(e=>{console.error(e.message);process.exitCode=1});
}
