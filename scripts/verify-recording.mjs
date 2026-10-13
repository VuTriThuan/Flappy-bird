import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
const dir=process.argv[2];if(!dir)throw Error('Cần đường dẫn thư mục phiên quay');
const r=JSON.parse(await readFile(join(dir,'metadata.json'),'utf8'));
let count=0,first,last,frameGaps=0,timeGaps=0,maxTimeGap=0,changes=0;
for(const name of r.chunks){for await(const line of createInterface({input:createReadStream(join(dir,name)).pipe(createGunzip())})){
  const s=JSON.parse(line);if(!first)first=s;
  if(last){if(s.frame!==last.frame+1)frameGaps++;const dt=s.time-last.time;maxTimeGap=Math.max(maxTimeGap,dt);if(Math.abs(dt-1/60)>1e-6)timeGaps++;if(s.birdY!==last.birdY||s.pipes[0]?.x!==last.pipes[0]?.x)changes++;}
  last=s;count++;
}}
const report={frames:count,metadataFrames:r.frameCount,duration:r.durationSeconds,firstTime:first?.time,lastTime:last?.time,frameGaps,timeGaps,maxTimeGap,changedPairs:changes,chunks:r.chunks.length,status:r.status};
console.log(JSON.stringify(report));if(count!==r.frameCount||frameGaps||timeGaps||changes<count-2)process.exitCode=1;
