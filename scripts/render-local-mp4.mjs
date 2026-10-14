// Offline CLI renderer. Originals are read-only; destinations must be new files outside the source folder.
import {readFile,writeFile,mkdtemp,rm,realpath,stat,lstat,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function validateProject(project){
  if(project?.kind!=='road-to-p1-usb-draft'||!Array.isArray(project.clips)||!project.clips.length||project.clips.length>100)throw Error('Invalid project or clip count');
  const duration=Number(project.targetDurationMs);
  if(!Number.isSafeInteger(duration)||duration<5000||duration>600000)throw Error('Invalid target duration');
  for(const item of project.clips){
    if(!item||typeof item.relativePath!=='string'||!item.relativePath||isAbsolute(item.relativePath)||/^[a-z]:/i.test(item.relativePath)||item.relativePath.split(/[\\/]/).some(x=>x==='..'||x==='.'||!x))throw Error('Invalid relative media path');
    if(item.inMs!=null&&(!Number.isSafeInteger(item.inMs)||item.inMs<0))throw Error('Invalid in point');
    if(item.outMs!=null&&(!Number.isSafeInteger(item.outMs)||item.outMs<=Number(item.inMs||0)))throw Error('Invalid out point');
    if(item.durationMs!=null&&(!Number.isSafeInteger(item.durationMs)||item.durationMs<=0||item.durationMs>600000))throw Error('Invalid clip duration');
    if(!['Vidéo','Photo'].includes(item.category))throw Error('Only videos and images supported');
  }
  return project;
}
export function runMedia(bin,args){
  return new Promise((ok,fail)=>{
    const child=spawn(bin,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const chunks=[];let error='';
    child.stdout.on('data',data=>chunks.push(data));
    child.stderr.on('data',data=>{error=(error+data.toString()).slice(-5000)});
    child.on('error',fail);
    child.on('close',code=>code===0?ok(Buffer.concat(chunks)):fail(Error('Media engine failed: '+error)));
  });
}
export async function probeMedia(ffprobe,path){
  const data=JSON.parse(await runMedia(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',path]));
  const duration=Number(data.format?.duration);
  if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid source duration');
  return {duration,hasAudio:data.streams.some(s=>s.codec_type==='audio'),streams:data.streams};
}
export function clipTiming(project, clip){
  validateProject(project);
  const durationMs=clip.durationMs??project.targetDurationMs/project.clips.length;
  const inMs=clip.inMs??0;
  return {inSeconds:inMs/1000,durationSeconds:Math.min(durationMs,(clip.outMs??(inMs+durationMs))-inMs)/1000};
}
const inside=(base,target)=>{const rel=relative(base,target);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/')))};
async function mustBeNew(path){
  try {await lstat(path);}catch(e){if(e.code==='ENOENT')return;throw e;}
  throw Error('Output already exists: '+path);
}
export async function render(project,{root,output,ffmpeg='ffmpeg',ffprobe='ffprobe'}){
  validateProject(project);
  const base=await realpath(resolve(root));
  if(!(await stat(base)).isDirectory())throw Error('Invalid root directory');
  const target=resolve(output),projectOutput=target.replace(/\.mp4$/i,'.project.json');
  if(!target.toLowerCase().endsWith('.mp4'))throw Error('Output must be .mp4');
  const outputDir=await realpath(dirname(target));
  if(inside(base,target)||inside(base,outputDir))throw Error('Output must be outside USB source root');
  await mustBeNew(target);await mustBeNew(projectOutput);
  const work=await mkdtemp(join(tmpdir(),'rtp1-render-'));
  let createdOutput=false;
  try{
    const segments=[],clips=[];
    const landscape=project.output?.width===1920&&project.output?.height===1080;
    const [width,height]=landscape?[1920,1080]:[1080,1920];
    for(let i=0;i<project.clips.length;i++){
      const clip=project.clips[i];
      const source=await realpath(join(base,clip.relativePath));
      if(!inside(base,source))throw Error('Source outside authorized folder');
      if(!(await stat(source)).isFile())throw Error('Source is not a file');
      const photo=clip.category==='Photo';
      const metadata=photo?null:await probeMedia(ffprobe,source);
      const timing=clipTiming(project,clip);
      const slot=(clip.durationMs??project.targetDurationMs/project.clips.length)/1000;
      if(!photo&&(timing.inSeconds>=metadata.duration||(clip.outMs!=null&&clip.outMs/1000>metadata.duration+0.05)))throw Error('Cut point outside source');
      const available=photo?slot:Math.min(timing.durationSeconds,metadata.duration-timing.inSeconds);
      if(available<=0)throw Error('Empty clip interval');
      const segment=join(work,'part-'+String(i).padStart(4,'0')+'.mov');
      const args=['-hide_banner','-nostdin','-loglevel','error','-y'];
      if(photo)args.push('-loop','1','-framerate','30');
      else args.push('-ss',String(timing.inSeconds),'-t',String(available));
      args.push('-i',source);
      if(!metadata?.hasAudio)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
      args.push('-map','0:v:0','-map',metadata?.hasAudio?'0:a:0':'1:a:0','-t',String(slot),
        '-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease:out_color_matrix=bt709:out_range=tv,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30:start_time=0,tpad=stop_mode=clone:stop_duration=${slot}`,
        '-af','aresample=48000,apad','-ar','48000','-ac','2','-c:a','pcm_s16le',
        '-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-video_track_timescale','90000',
        '-map_metadata','-1','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv',segment);
      await runMedia(ffmpeg,args);
      segments.push(segment);
      clips.push({...clip,inMs:Math.round(timing.inSeconds*1000),outMs:Math.round((timing.inSeconds+available)*1000),durationMs:Math.round(slot*1000),hasAudio:!!metadata?.hasAudio,holdLastFrameMs:Math.round((slot-available)*1000)});
    }
    const list=join(work,'concat.txt');
    await writeFile(list,segments.map(p=>"file '"+p.replaceAll('\\','/').replaceAll("'","'\\''")+"'").join('\n')+'\n');
    const assembled=join(work,'montage.mp4');
    await runMedia(ffmpeg,['-hide_banner','-nostdin','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
      '-map','0:v:0','-map','0:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(project.targetDurationMs/1000),'-movflags','+faststart',assembled]);
    const verified=await probeMedia(ffprobe,assembled);
    if(!verified.hasAudio||Math.abs(verified.duration-project.targetDurationMs/1000)>0.15)throw Error('Incomplete montage; output not saved');
    await copyFile(assembled,target,constants.COPYFILE_EXCL);createdOutput=true;
    await writeFile(projectOutput,JSON.stringify({...project,clips},null,2),{flag:'wx'});
    return target;
  }catch(error){if(createdOutput)await rm(target,{force:true});throw error;}
  finally{await rm(work,{recursive:true,force:true})}
}
export async function main(args=process.argv.slice(2)){
  const val=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
  const projectPath=val('--project'),root=val('--root'),output=val('--output');
  if(!projectPath||!root||!output)throw Error('Usage: --project project.json --root USB_FOLDER --output NEW_MP4 [--ffmpeg PATH --ffprobe PATH]');
  return render(JSON.parse(await readFile(projectPath,'utf8')),{root,output,ffmpeg:val('--ffmpeg')||'ffmpeg',ffprobe:val('--ffprobe')||'ffprobe'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().then(path=>console.log('MP4 created:',path)).catch(e=>{console.error(e.message);process.exitCode=1});
}
