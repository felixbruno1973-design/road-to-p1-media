import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {render,runMedia,probeMedia} from '../scripts/render-local-mp4.mjs';
const ffmpeg=process.env.RTP1_FFMPEG,ffprobe=process.env.RTP1_FFPROBE;
test('real FFmpeg preserves sound, reviewed cuts, mixed silent footage and originals',{skip:!ffmpeg||!ffprobe},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'soucy-test-'));const root=join(dir,'SOUCY été');await mkdir(root);
  try{
    await runMedia(ffmpeg,['-v','error','-f','lavfi','-i','color=blue:s=320x180:r=30000/1001','-f','lavfi','-i','sine=frequency=880:sample_rate=44100','-t','4','-c:v','libx264','-c:a','aac','-color_primaries','bt709',join(root,'son.mp4')]);
    await runMedia(ffmpeg,['-v','error','-f','lavfi','-i','color=red:s=320x180:r=30','-t','1','-an','-c:v','libx264',join(root,'muet.mp4')]);
    const before=await readFile(join(root,'son.mp4'));
    const project={kind:'road-to-p1-usb-draft',targetDurationMs:6000,clips:[
      {relativePath:'son.mp4',category:'Vidéo',inMs:2500,outMs:3500,durationMs:3000},
      {relativePath:'muet.mp4',category:'Vidéo',inMs:0,outMs:1000,durationMs:3000}]};
    const output=join(dir,'test.mp4');await render(project,{root,output,ffmpeg,ffprobe});
    const metadata=await probeMedia(ffprobe,output);assert.ok(metadata.hasAudio);assert.ok(Math.abs(metadata.duration-6)<0.15);
    const video=JSON.parse(await runMedia(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,avg_frame_rate,color_space','-of','json',output])).streams[0];
    assert.equal(video.nb_frames,'180');assert.equal(video.avg_frame_rate,'30/1');assert.equal(video.color_space,'bt709');
    const saved=JSON.parse(await readFile(join(dir,'test.project.json')));assert.equal(saved.clips[0].inMs,2500);assert.equal(saved.clips[0].outMs,3500);
    for(const [at,audible] of [[0.1,true],[1.5,false],[4,false]]){
      const pcm=await runMedia(ffmpeg,['-v','error','-ss',String(at),'-i',output,'-t','0.3','-map','0:a:0','-ac','1','-f','s16le','-']);
      let peak=0;for(let i=0;i<pcm.length;i+=2)peak=Math.max(peak,Math.abs(pcm.readInt16LE(i)));
      assert.equal(peak>100,audible);
    }
    assert.deepEqual(await readFile(join(root,'son.mp4')),before);
    await assert.rejects(render(project,{root,output,ffmpeg,ffprobe}),/already exists/);
    await assert.rejects(render(project,{root,output:join(root,'bad.mp4'),ffmpeg,ffprobe}),/outside USB/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
