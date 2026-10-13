import { parentPort, type MessagePort } from 'node:worker_threads';
import { createWriteStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createGzip, type Gzip } from 'node:zlib';
import type { Recording } from '../../shared/contracts';
let port: MessagePort, current: Recording | undefined, dir = '', gzip: Gzip | undefined;
let stream: ReturnType<typeof createWriteStream> | undefined, chunkFrames = 0, pending = 0, failed = false;
const atomic = async (r: Recording) => { const path = join(dir, 'metadata.json'); await fs.writeFile(path + '.tmp', JSON.stringify(r)); await fs.rename(path + '.tmp', path); };
async function openChunk() {
  const name = `chunk-${String(current!.chunks.length).padStart(5,'0')}.ndjson.gz`;
  stream = createWriteStream(join(dir, name + '.part'));
  gzip = createGzip({ level: 3 }); gzip.pipe(stream); chunkFrames = 0;
  stream.on('error', err => fail(err)); gzip.on('error', err => fail(err));
}
async function closeChunk() {
  if (!gzip || !stream || !current) return;
  const output = stream, gz = gzip; gzip = undefined; stream = undefined;
  await new Promise<void>((resolve, reject) => { output.once('finish', resolve); output.once('error', reject); gz.end(); });
  const name = `chunk-${String(current.chunks.length).padStart(5,'0')}.ndjson.gz`;
  await fs.rename(join(dir,name+'.part'), join(dir,name)); current.chunks.push(name); await atomic(current);
}
function fail(err: unknown) { if (failed) return; failed = true; parentPort!.postMessage({ type:'error', error:String(err) }); }
async function frame(snapshot: unknown) {
  if (!current || failed) return;
  try {
    if (!gzip) await openChunk();
    if (!gzip!.write(JSON.stringify(snapshot)+'\n')) await new Promise<void>(resolve => gzip!.once('drain', resolve));
    current.frameCount++; current.durationSeconds = current.frameCount / 60; chunkFrames++;
    if (chunkFrames >= 360) await closeChunk();
    port.postMessage({ type:'ack', count:1 });
  } catch (e) { fail(e); }
}
let chain = Promise.resolve();
parentPort!.on('message', m => {
  if (m.type === 'port') { port = m.port; port.on('message', item => {
    if (item.type === 'frame') chain = chain.then(() => frame(item.snapshot));
    if (item.type === 'stop') chain = chain.then(async () => {
      await closeChunk(); if (current) { current.status = item.status || 'ready'; if (item.error) current.error=item.error; await atomic(current); }
      parentPort!.postMessage({ type:'reply', id:item.id, result:current }); current = undefined;
    }).catch(fail);
  }); }
  if (m.type === 'start') chain = chain.then(async () => {
    current = m.recording; dir = m.dir; failed = false; await fs.mkdir(dir,{recursive:true}); await atomic(current!);
    parentPort!.postMessage({ type:'reply', id:m.id, result:true });
  }).catch(fail);
  if (m.type === 'stop') chain = chain.then(async () => {
    await closeChunk(); if (current) { current.status = m.status || 'ready'; if (m.error) current.error=m.error; await atomic(current); }
    parentPort!.postMessage({ type:'reply', id:m.id, result:current }); current = undefined;
  }).catch(fail);
});
