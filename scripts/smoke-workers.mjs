import { Worker, MessageChannel } from 'node:worker_threads';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
const dir=join(tmpdir(),`flappy-workers-${process.pid}`);await mkdir(dir,{recursive:true});
const sim=new Worker(join(process.cwd(),'dist-electron/simulation.cjs'),{workerData:{config:{seed:7,mode:'long'}}});
const writer=new Worker(join(process.cwd(),'dist-electron/writer.cjs'));
const channel=new MessageChannel();sim.postMessage({type:'writerPort',port:channel.port1},[channel.port1]);writer.postMessage({type:'port',port:channel.port2},[channel.port2]);
let id=0;const pending=new Map();
for(const worker of [sim,writer])worker.on('message',m=>{if(m.type==='reply'){const p=pending.get(m.id);if(p){pending.delete(m.id);p(m.result);}}if(m.type==='error')throw Error(m.error)});
function ask(worker,msg){const mid=String(++id);return new Promise(resolve=>{pending.set(mid,resolve);worker.postMessage({...msg,id:mid})});}
const recording={schemaVersion:1,engineVersion:'1',renderVersion:'1',assetVersion:'canvas-1',id:randomUUID(),startedAt:new Date().toISOString(),timezone:'Asia/Ho_Chi_Minh',seed:7,config:{seed:7,mode:'long'},width:1080,height:1920,fps:60,logicWidth:360,logicHeight:640,source:'manual',status:'recording',frameCount:0,durationSeconds:0,chunks:[]};
await ask(writer,{type:'start',recording,dir});await ask(sim,{type:'cmd',cmd:'start'});await ask(sim,{type:'cmd',cmd:'recordStart'});
await new Promise(resolve=>setTimeout(resolve,2200));
const stopId=String(++id),done=new Promise(resolve=>pending.set(stopId,resolve));
await ask(sim,{type:'cmd',cmd:'recordStop',stopId});const result=await done;
let count=0;for(const name of result.chunks){const lines=createInterface({input:createReadStream(join(dir,name)).pipe(createGunzip())});for await(const line of lines){JSON.parse(line);count++;}}
if(count!==result.frameCount||count<120||count>138)throw Error(`Frame count sai: ${count}/${result.frameCount}`);
console.log(JSON.stringify({directory:dir,frameCount:count,duration:result.durationSeconds,chunks:result.chunks,status:result.status}));
await sim.terminate();await writer.terminate();
