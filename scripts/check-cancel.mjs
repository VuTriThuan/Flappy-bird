import { Worker } from 'node:worker_threads';
import { readFile, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import ffmpeg from 'ffmpeg-static';import ffprobe from 'ffprobe-static';
const dir=process.argv[2];if(!dir)throw Error('Cần thư mục bản ghi');
const recording=JSON.parse(await readFile(join(dir,'metadata.json'),'utf8'));
const destination=join(dirname(dirname(dir)),'cancel-export-test.mp4');
const temp=join(dirname(destination),`.${basename(destination)}.${recording.id}.part.mp4`);
const worker=new Worker(join(process.cwd(),'dist-electron/export.cjs'),{workerData:{recording,recordingDir:dir,destination,ffmpegPath:ffmpeg,ffprobePath:ffprobe.path}});
let cancelled=false,finalState='';
const done=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='progress'){finalState=m.state;if(m.state==='rendering'&&!cancelled){cancelled=true;worker.postMessage({type:'cancel'});}}if(m.type==='done')resolve(m)})});
await worker.terminate();
async function exists(path){try{await access(path);return true}catch{return false}}
const after=JSON.parse(await readFile(join(dir,'metadata.json'),'utf8'));
const report={cancelled,finalState,error:done.error,destinationExists:await exists(destination),tempExists:await exists(temp),recordingFrames:after.frameCount};
console.log(JSON.stringify(report));
if(!cancelled||finalState!=='cancelled'||report.destinationExists||report.tempExists||after.frameCount!==recording.frameCount)process.exitCode=1;
