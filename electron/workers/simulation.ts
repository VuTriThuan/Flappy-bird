import { parentPort, workerData, type MessagePort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { Engine, STEP, type Config, type Snapshot } from '../../shared/engine';
const engine = new Engine(workerData.config as Config);
let port: MessagePort | undefined, recording = false, recordFrames = 0, recordLimit = 0, inFlight = 0;
let last = performance.now(), accumulated = 0, lagMs = 0, pausedAt = 0, physicsTicks = 0, lagReported = false;
let pending: { id: string; cmd: string; data?: unknown; stopId?: string }[] = [];
const send = (v: unknown) => parentPort!.postMessage(v);
parentPort!.on('message', (m) => {
  if (m.type === 'writerPort') { port = m.port; port!.on('message', (ack) => { if (ack.type === 'ack') inFlight = Math.max(0, inFlight - ack.count); }); }
  else if (m.type === 'cmd') pending.push(m);
  else if (m.type === 'resumeClock') { last = performance.now(); accumulated = 0; }
});
function applyCommands() {
  if (physicsTicks % 2 !== 0) return;
  for (const m of pending.splice(0)) {
    try {
      if (m.cmd === 'start') engine.start();
      if (m.cmd === 'pause') engine.pause();
      if (m.cmd === 'mode') { engine.config.mode = m.data as Config['mode']; }
      if (m.cmd === 'recordStart') { recording = true; recordFrames = 0; recordLimit = Number((m.data as any)?.limitFrames)||0; const snap = engine.snapshot(); port?.postMessage({ type: 'frame', snapshot: snap }); inFlight++; recordFrames++; send({ type: 'snapshot', snapshot: snap }); }
      if (m.cmd === 'recordStop') { recording = false; port?.postMessage({ type: 'stop', id: m.stopId, status: (m.data as any)?.status, error: (m.data as any)?.error }); }
      send({ type: 'reply', id: m.id, result: { recordFrames, phase: engine.phase } });
    } catch (e) { send({ type: 'reply', id: m.id, error: String(e) }); }
  }
}
setInterval(() => {
  const now = performance.now(); let elapsed = Math.max(0, now - last); last = now;
  if (elapsed > 2000) { send({ type: 'severeLag', ms: elapsed }); elapsed = 0; accumulated = 0; }
  accumulated += elapsed; lagMs = accumulated;
  if (accumulated > 2000 && !lagReported) { lagReported = true; send({ type:'severeLag', ms: accumulated }); }
  if (accumulated < 200) lagReported = false;
  applyCommands();
  let ticks = 0;
  while (accumulated >= STEP * 1000 && ticks < 240 && inFlight < 120) {
    engine.step(); ticks++; physicsTicks++; accumulated -= STEP * 1000;
    if (physicsTicks % 2 === 0) {
      const snap: Snapshot = engine.snapshot();
      if (recording && port) { port.postMessage({ type: 'frame', snapshot: snap }); inFlight++; recordFrames++; if(recordLimit&&recordFrames>=recordLimit){recording=false;send({type:'recordLimit',frames:recordFrames});} }
      send({ type: 'snapshot', snapshot: snap });
    }
  }
  if (now - pausedAt > 250) { pausedAt = now; send({ type: 'metrics', phase: engine.phase, score: engine.score, best: engine.best, lagMs, writerQueue: inFlight, recordFrames }); }
}, 8).unref();
