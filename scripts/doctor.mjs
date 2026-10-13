import { createCanvas } from '@napi-rs/canvas';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const c=createCanvas(1,1),ctx=c.getContext('2d');ctx.fillStyle='#ff4000';ctx.fillRect(0,0,1,1);
const p=Array.from(ctx.getImageData(0,0,1,1).data);
if(p.join(',')!=='255,64,0,255')throw Error(`Pixel RGBA không đúng: ${p}`);
for(const [name,path,args] of [['FFmpeg',ffmpeg,['-hide_banner','-encoders']],['ffprobe',ffprobe.path,['-version']]]){
  const r=spawnSync(path,args,{encoding:'utf8'});if(r.status!==0)throw Error(`${name}: ${r.stderr||r.error}`);
  if(name==='FFmpeg'&&!r.stdout.includes('libx264'))throw Error('FFmpeg thiếu encoder libx264');
  console.log(`${name}: ${path}`);
}
console.log(`Canvas native RGBA: ${p}; platform: ${process.platform}/${process.arch}; Node: ${process.version}`);
