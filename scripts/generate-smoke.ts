import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Engine } from '../shared/engine';
import type { Recording } from '../shared/contracts';
async function main(){
  const dir=process.argv[2];await mkdir(dir,{recursive:true});
  const e=new Engine({seed:42,mode:'long'});e.start();const frames=[];
  for(let i=0;i<60;i++){e.step();e.step();frames.push(e.snapshot());}
  const recording:Recording={schemaVersion:1,engineVersion:'1',renderVersion:'1',assetVersion:'canvas-1',id:'smoke',startedAt:new Date().toISOString(),timezone:'Asia/Ho_Chi_Minh',seed:42,config:{seed:42,mode:'long'},width:1080,height:1920,fps:60,logicWidth:360,logicHeight:640,source:'manual',status:'ready',frameCount:60,durationSeconds:1,chunks:['chunk-00000.ndjson.gz']};
  await writeFile(join(dir,recording.chunks[0]),gzipSync(frames.map(x=>JSON.stringify(x)).join('\n')+'\n'));
  await writeFile(join(dir,'metadata.json'),JSON.stringify(recording));
}
main().catch(e=>{console.error(e);process.exitCode=1});
