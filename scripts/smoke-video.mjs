import { Worker } from 'node:worker_threads';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
// Import TS through tsx in a child process to preserve the regular Node smoke command.
const dir=process.argv[2]||join(tmpdir(),`flappy-smoke-${process.pid}`);await mkdir(dir,{recursive:true});
if(!process.argv[2]){const generator=spawnSync(process.execPath,['--import','tsx','scripts/generate-smoke.ts',dir],{encoding:'utf8'});if(generator.status!==0)throw Error(generator.stderr||generator.stdout);}
const recording=JSON.parse(await readFile(join(dir,'metadata.json'),'utf8'));
const destination=process.argv[3]||join(dir,'video tiếng Việt 1080p.mp4');
const worker=new Worker(join(process.cwd(),'dist-electron/export.cjs'),{workerData:{recording,recordingDir:dir,destination,ffmpegPath:ffmpeg,ffprobePath:ffprobe.path}});
const result=await new Promise((resolve,reject)=>{worker.on('message',m=>{if(m.type==='progress'&&m.frame%30===0)console.log(m.state,m.frame);if(m.type==='done')m.error?reject(Error(m.error)):resolve(m.path)});worker.on('error',reject)});
await worker.terminate();
const probe=spawnSync(ffprobe.path,['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,sample_aspect_ratio','-show_entries','format=duration','-of','json',result],{encoding:'utf8'});
if(probe.status!==0)throw Error(probe.stderr);
const md5=spawnSync(ffmpeg,['-v','error','-i',result,'-f','framemd5','-'],{encoding:'utf8'});
if(md5.status!==0)throw Error(md5.stderr);
const hashes=md5.stdout.split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1)?.trim());
const uniqueFrames=new Set(hashes).size;
if(uniqueFrames<Math.floor(recording.frameCount*.9))throw Error(`Video có quá nhiều frame trùng nhau: ${uniqueFrames}/${recording.frameCount}`);
console.log(JSON.stringify({path:result,recordingFrames:recording.frameCount,uniqueFrames,probe:JSON.parse(probe.stdout)},null,2));
