import { parentPort, workerData } from 'node:worker_threads';
import { createReadStream, promises as fs } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '@napi-rs/canvas';
import { drawScene } from '../../shared/render';
import type { Recording } from '../../shared/contracts';
import type { Snapshot } from '../../shared/engine';
const { recording, recordingDir, destination, ffmpegPath, ffprobePath } = workerData as { recording: Recording; recordingDir: string; destination: string; ffmpegPath: string; ffprobePath: string };
let cancelled = false, child: ChildProcessWithoutNullStreams | undefined;
parentPort!.on('message', m => { if (m.type === 'cancel') { cancelled = true; child?.kill('SIGTERM'); } });
const report = (state:string, frame?:number, error?:string) => parentPort!.postMessage({ type:'progress', state, frame, total:recording.frameCount, error });
function waitForDrain(proc:ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{proc.stdin.off('drain',drain);proc.stdin.off('error',error);proc.off('close',close)};
    const drain=()=>{cleanup();resolve()};const error=(e:Error)=>{cleanup();reject(e)};
    const close=()=>{cleanup();reject(Error('FFmpeg đã đóng trước khi nhận hết frame'))};
    proc.stdin.once('drain',drain);proc.stdin.once('error',error);proc.once('close',close);
  });
}
async function probe(path:string) {
  const p = spawn(ffprobePath, ['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,sample_aspect_ratio','-of','json',path]);
  let stdout='', stderr=''; p.stdout.on('data', d=>stdout+=d); p.stderr.on('data',d=>stderr+=d);
  const [code] = await once(p,'close') as [number]; if (code!==0) throw Error(`ffprobe: ${stderr}`);
  return JSON.parse(stdout).streams?.[0];
}
async function main() {
  const temp = join(dirname(destination), `.${basename(destination)}.${recording.id}.part.mp4`);
  report('preparing',0);
  const canvas = createCanvas(1080,1920), ctx = canvas.getContext('2d');
  // ImageData uses RGBA in canvas API; verify a known pixel before streaming.
  ctx.fillStyle='#ff4000'; ctx.fillRect(0,0,1,1);
  const pixel=ctx.getImageData(0,0,1,1).data;
  if (pixel[0]!==255 || pixel[1]!==64 || pixel[2]!==0 || pixel[3]!==255) throw Error('Canvas native không trả pixel RGBA đúng');
  child = spawn(ffmpegPath, ['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','1080x1920','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-threads','2','-pix_fmt','yuv420p','-vf','setsar=1','-movflags','+faststart','-progress','pipe:3',temp], { stdio:['pipe','ignore','pipe','pipe'] }) as ChildProcessWithoutNullStreams;
  let stderr='', encoded=0; child.stderr.on('data', d=>stderr+=String(d).slice(-5000));
  (child.stdio[3] as NodeJS.ReadableStream).on('data', d=> { const found=String(d).match(/frame=\s*(\d+)/g); if (found) {encoded=Math.min(recording.frameCount,Number(found.at(-1)!.split('=')[1]));report('encoding',encoded);} });
  let count=0;
  try {
    for (const name of recording.chunks) {
      const lines=createInterface({input:createReadStream(join(recordingDir,name)).pipe(createGunzip()),crlfDelay:Infinity});
      for await (const line of lines) {
        if (cancelled) throw Error('Đã hủy xuất video');
        const s=JSON.parse(line) as Snapshot;
        drawScene(ctx,s,1080,1920);
        const data=ctx.getImageData(0,0,1080,1920).data;
        if (!child!.stdin.write(Buffer.from(data.buffer,data.byteOffset,data.byteLength))) await waitForDrain(child!);
        count++; if (count % 30===0) report('rendering',encoded);
      }
    }
    child.stdin.end();
    const [code] = await once(child,'close') as [number];
    if (code!==0) throw Error(`FFmpeg lỗi (${code}): ${stderr.slice(-1500)}`);
    if (count!==recording.frameCount) throw Error(`Thiếu frame: ${count}/${recording.frameCount}`);
    report('verifying',count);
    const info=await probe(temp);
    if (!info || info.codec_name!=='h264' || info.width!==1080 || info.height!==1920 || info.pix_fmt!=='yuv420p' || info.r_frame_rate!=='60/1' || info.avg_frame_rate!=='60/1' || Number(info.nb_frames)!==count || info.sample_aspect_ratio!=='1:1') throw Error(`ffprobe không khớp: ${JSON.stringify(info)}`);
    await fs.rename(temp,destination);
    report('completed',count); parentPort!.postMessage({type:'done',path:destination});
  } catch(e) {
    child?.kill('SIGTERM'); await fs.rm(temp,{force:true}).catch(()=>{});
    report(cancelled?'cancelled':'error',count,String(e)); parentPort!.postMessage({type:'done',error:String(e)});
  }
}
main().catch(e=>{ report('error',0,String(e)); parentPort!.postMessage({type:'done',error:String(e)}); });
