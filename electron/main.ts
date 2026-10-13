import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, powerMonitor } from 'electron';
import { Worker, MessageChannel } from 'node:worker_threads';
import { join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { gunzipSync, gzipSync, constants } from 'node:zlib';
import type { AppState, Recording, Schedule, ExportStatus } from '../shared/contracts';
import type { Config, Snapshot } from '../shared/engine';
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let win: BrowserWindow | null = null, sim: Worker, writer: Worker, exportWorker: Worker | undefined;
let dataDir = '', recordings: Recording[] = [], schedules: Schedule[] = [], active: Recording | undefined;
let game: AppState['game'] = 'idle', score=0, best=0, lagMs=0, writerQueue=0, latest: Snapshot | undefined;
let exportStatus: ExportStatus = { state:'idle' }, message = '', doctorResult = '', blocker = -1, runStart = 0;
let seed = Math.floor(Date.now() % 2147483647), mode: Config['mode']='long';
let peakMemoryMb=0;
let requestId=0, quitting=false, ready=false;
const pending = new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
const ffmpegPath = app.isPackaged ? join(process.resourcesPath,'bin',process.platform==='win32'?'ffmpeg.exe':'ffmpeg') : require('ffmpeg-static') as string;
const ffprobePath = app.isPackaged ? join(process.resourcesPath,'bin',process.platform==='win32'?'ffprobe.exe':'ffprobe') : (require('ffprobe-static') as {path:string}).path;
const state = (): AppState => {const memoryMb=Math.round(process.memoryUsage().rss/1048576);peakMemoryMb=Math.max(peakMemoryMb,memoryMb);return ({ game, score, best, recording:active, recordings:[...recordings].reverse(), schedules:[...schedules].reverse(), export:exportStatus,
  lagMs,writerQueue,memoryMb,peakMemoryMb,doctorResult,message,timezone:zone,seed,mode });};
function broadcast() { if (win && !win.isDestroyed()) win.webContents.send('state',state()); power(); }
function power() {
  const needed = game==='running' || !!active || schedules.some(s=>s.status==='pending'||s.status==='running') || !['idle','completed','cancelled','error'].includes(exportStatus.state);
  if (needed && blocker<0) blocker=powerSaveBlocker.start('prevent-app-suspension');
  if (!needed && blocker>=0) { powerSaveBlocker.stop(blocker); blocker=-1; }
}
function replyWorker(m:any) { if (m.type==='reply') { const p=pending.get(m.id); if (!p) return; pending.delete(m.id); m.error?p.reject(Error(m.error)):p.resolve(m.result); } }
function rpc(worker:Worker, cmd:string, data?:unknown):Promise<any> {
  const id=String(++requestId); return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); worker.postMessage({type:'cmd',id,cmd,data}); setTimeout(()=>{ if(pending.has(id)){pending.delete(id);reject(Error(`Worker không phản hồi: ${cmd}`));}},30000).unref(); });
}
function writerStart(recording:Recording):Promise<void> {
  const id=String(++requestId); return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});writer.postMessage({type:'start',id,recording,dir:join(dataDir,'recordings',recording.id)});});
}
async function atomic(path:string,value:unknown) { await fs.mkdir(dirname(path),{recursive:true}); await fs.writeFile(path+'.tmp',JSON.stringify(value,null,2)); await fs.rename(path+'.tmp',path); }
async function saveSchedules() { await atomic(join(dataDir,'schedules.json'),schedules); broadcast(); }
async function recover() {
  await fs.mkdir(join(dataDir,'recordings'),{recursive:true});
  const dirs=await fs.readdir(join(dataDir,'recordings'),{withFileTypes:true});
  for (const d of dirs.filter(d=>d.isDirectory())) {
    try {
      const r=JSON.parse(await fs.readFile(join(dataDir,'recordings',d.name,'metadata.json'),'utf8')) as Recording;
      if (r.schemaVersion!==1) continue;
      if (r.status==='recording') {
        const folder=join(dataDir,'recordings',d.name);
        const files=new Set(await fs.readdir(folder));
        for (;;) {
          const completed=`chunk-${String(r.chunks.length).padStart(5,'0')}.ndjson.gz`;
          if(!files.has(completed))break;
          r.chunks.push(completed);
        }
        const part=`chunk-${String(r.chunks.length).padStart(5,'0')}.ndjson.gz.part`;
        let recovered=0;
        try {
          const decoded=gunzipSync(await fs.readFile(join(folder,part)),{finishFlush:constants.Z_SYNC_FLUSH}).toString('utf8');
          const lines=decoded.split('\n').slice(0,-1).filter(line=>{try{JSON.parse(line);return true;}catch{return false;}});
          if(lines.length){const name=part.slice(0,-5);await fs.writeFile(join(folder,name),gzipSync(lines.join('\n')+'\n'));r.chunks.push(name);recovered=lines.length;}
        } catch { /* Preserve the .part file for manual recovery. */ }
        r.status='interrupted'; r.frameCount=(r.chunks.length-(recovered?1:0))*360+recovered; r.durationSeconds=r.frameCount/60;
        r.error=`Ứng dụng đã tắt bất ngờ. Đã cứu ${recovered} frame từ chunk cuối; file .part gốc vẫn được giữ.`;
        await atomic(join(folder,'metadata.json'),r);
      }
      recordings.push(r);
    } catch { /* Keep unrecognized user data untouched. */ }
  }
  recordings.sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
  try { schedules=JSON.parse(await fs.readFile(join(dataDir,'schedules.json'),'utf8')); } catch { schedules=[]; }
  let changed=false;
  for (const s of schedules) {
    if(s.status==='running') {s.status='interrupted';s.message='Ứng dụng đã đóng khi lịch đang quay.';changed=true;}
    if(s.status==='pending' && Date.parse(s.startAt)<=Date.now()) {s.status='missed';s.message='Ứng dụng không chạy khi tới giờ bắt đầu.';changed=true;}
  }
  if(changed) await saveSchedules();
}
async function startRecording(source:'manual'|'schedule',scheduleId?:string) {
  if(active) throw Error('Đã có phiên quay đang hoạt động.');
  if(game!=='running') { await rpc(sim,'start'); game='running'; }
  const r:Recording={schemaVersion:1,engineVersion:'1',renderVersion:'1',assetVersion:'canvas-1',id:randomUUID(),startedAt:new Date().toISOString(),timezone:zone,
    seed,config:{mode,seed},width:1080,height:1920,fps:60,logicWidth:360,logicHeight:640,source,scheduleId,status:'recording',frameCount:0,durationSeconds:0,chunks:[]};
  await writerStart(r); active=r;
  const limitFrames=source==='schedule'?schedules.find(s=>s.id===scheduleId)!.durationSeconds*60:0;
  await rpc(sim,'recordStart',{limitFrames}); recordings.push(r); broadcast(); return r;
}
async function stopRecording(status:Recording['status']='ready',error?:string) {
  if(!active) return;
  const r=active; const id=String(++requestId);
  const writerDone=new Promise<Recording>((resolve,reject)=>{pending.set(id,{resolve,reject});setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('Writer không chốt được phiên quay'));}},30000).unref();});
  const simDone=new Promise<void>((resolve,reject)=>{const cmdId=String(++requestId);pending.set(cmdId,{resolve,reject});sim.postMessage({type:'cmd',id:cmdId,cmd:'recordStop',data:{status,error},stopId:id});});
  // The writer receives its stop marker on the same MessagePort as snapshots.
  await simDone;
  const done=await writerDone; Object.assign(r,done); active=undefined;
  if(r.scheduleId){const s=schedules.find(s=>s.id===r.scheduleId);if(s){s.status=status==='ready'?'completed':'interrupted';s.actualDurationSeconds=r.durationSeconds;s.message=status==='ready'?'Đã quay xong':'Phiên quay bị gián đoạn';await saveSchedules();}}
  broadcast(); return r;
}
async function launchExport(r:Recording,destination:string) {
  if(exportWorker) throw Error('Đang xuất một video khác.');
  if(r.frameCount<1 || r.chunks.length<1) throw Error('Phiên quay chưa có frame hoàn chỉnh để xuất.');
  exportStatus={state:'preparing',recordingId:r.id,frame:0,total:r.frameCount}; broadcast();
  exportWorker=new Worker(join(__dirname,'export.cjs'),{workerData:{recording:r,recordingDir:join(dataDir,'recordings',r.id),destination,ffmpegPath,ffprobePath}});
  exportWorker.on('message',(m:any)=>{
    if(m.type==='progress'){exportStatus={state:m.state,recordingId:r.id,frame:m.frame,total:m.total,error:m.error,path:m.state==='completed'?destination:undefined};broadcast();}
    if(m.type==='done'){exportWorker=undefined;if(m.error)message=`Xuất video lỗi: ${m.error}`;else message=`Đã xuất video: ${destination}`;broadcast();}
  });
  exportWorker.on('error',e=>{exportWorker=undefined;exportStatus={state:'error',recordingId:r.id,error:String(e)};message=`Worker xuất lỗi: ${e}`;broadcast();});
}
async function scheduleTick() {
  if(!ready || quitting) return;
  const running=schedules.find(s=>s.status==='running');
  if(running && performance.now()-runStart>=running.durationSeconds*1000+500){await stopRecording();return;}
  const due=schedules.find(s=>s.status==='pending'&&Date.parse(s.startAt)<=Date.now());
  if(!due)return;
  if(active){due.status='missed';due.message='Trùng với phiên quay thủ công hoặc lịch khác.';message=`Lịch ${due.localInput} bị bỏ lỡ vì đang quay phiên khác.`;await saveSchedules();return;}
  try {const r=await startRecording('schedule',due.id);due.status='running';due.recordingId=r.id;due.actualStartedAt=r.startedAt;runStart=performance.now();await saveSchedules();}
  catch(e){due.status='failed';due.message=String(e);message=`Không thể bắt đầu lịch: ${e}`;await saveSchedules();}
}
let actionChain=Promise.resolve<any>(undefined);
function serialize<T>(fn:()=>Promise<T>):Promise<T>{const p=actionChain.then(fn,fn);actionChain=p.catch(()=>{});return p;}
async function command(name:string,data:any) {
  if(name==='start'){await rpc(sim,'start');game='running';}
  else if(name==='pause'){if(active)await stopRecording();await rpc(sim,'pause');game='paused';}
  else if(name==='record'){await startRecording('manual');}
  else if(name==='stopRecord'){await stopRecording();}
  else if(name==='mode'){if(data!=='long'&&data!=='challenge')throw Error('Chế độ không hợp lệ');if(active)throw Error('Hãy dừng quay trước khi đổi chế độ');mode=data;await rpc(sim,'mode',mode);}
  else if(name==='schedule'){
    if(schedules.some(s=>s.status==='pending'||s.status==='running'))throw Error('Chỉ được có một lịch chờ hoặc đang quay.');
    if(!data || typeof data.localInput!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(data.localInput)||!Number.isInteger(data.durationSeconds)||data.durationSeconds<1||data.durationSeconds>86400)throw Error('Ngày giờ hoặc thời lượng không hợp lệ.');
    const date=new Date(data.localInput);if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()+1000)throw Error('Hãy chọn thời điểm ở tương lai.');
    const local=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    if(local!==data.localInput)throw Error('Ngày giờ địa phương không tồn tại hoặc không hợp lệ.');
    schedules.push({id:randomUUID(),startAt:date.toISOString(),timezone:zone,localInput:data.localInput,durationSeconds:data.durationSeconds,status:'pending'});await saveSchedules();
  }
  else if(name==='cancelSchedule'){if(typeof data!=='string')throw Error('ID lịch không hợp lệ');const s=schedules.find(s=>s.id===data&&s.status==='pending');if(!s)throw Error('Không thể hủy lịch này');s.status='cancelled';await saveSchedules();}
  else if(name==='export'){
    if(exportWorker)throw Error('Đang xuất một video khác.');
    if(typeof data!=='string')throw Error('ID phiên không hợp lệ');
    let r=recordings.find(r=>r.id===data);if(!r)throw Error('Không tìm thấy phiên quay');
    if(active?.id===r.id)r=(await stopRecording())!;
    const options={title:'Xuất video MP4',defaultPath:`Flappy-${r.id.slice(0,8)}.mp4`,filters:[{name:'Video MP4',extensions:['mp4']}]};
    const chosen=win?await dialog.showSaveDialog(win,options):await dialog.showSaveDialog(options);
    if(!chosen.canceled&&chosen.filePath)await launchExport(r,chosen.filePath);
  }
  else if(name==='cancelExport'){exportWorker?.postMessage({type:'cancel'});}
  else if(name==='doctor'){
    const {createCanvas}=require('@napi-rs/canvas') as typeof import('@napi-rs/canvas');
    const c=createCanvas(1,1),ctx=c.getContext('2d');ctx.fillStyle='#ff4000';ctx.fillRect(0,0,1,1);
    const pixel=Array.from(ctx.getImageData(0,0,1,1).data).join(',');if(pixel!=='255,64,0,255')throw Error(`Canvas native trả pixel sai: ${pixel}`);
    const enc=spawnSync(ffmpegPath,['-hide_banner','-encoders'],{encoding:'utf8'});if(enc.status!==0||!enc.stdout.includes('libx264'))throw Error(`FFmpeg không chạy được hoặc thiếu libx264: ${enc.stderr||enc.error}`);
    const probe=spawnSync(ffprobePath,['-version'],{encoding:'utf8'});if(probe.status!==0)throw Error(`ffprobe không chạy được: ${probe.stderr||probe.error}`);
    doctorResult=`Đạt · ${process.platform}/${process.arch} · Canvas RGBA ${pixel}\nFFmpeg: ${ffmpegPath}\nffprobe: ${ffprobePath}\nEncoder: libx264`;
  }
  else if(name==='minimize'){win?.minimize();}
  else if(name==='restore'){win?.restore();}
  else throw Error('Lệnh không hợp lệ');
  broadcast();return state();
}
function createWindow(){
  win=new BrowserWindow({width:1060,height:790,minWidth:420,minHeight:640,backgroundColor:'#eaf5f3',title:'Flappy Auto Recorder',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  if(process.argv.includes('--dev'))win.loadURL('http://127.0.0.1:5180');else win.loadFile(join(__dirname,'../dist/index.html'));
  win.on('closed',()=>{win=null;});
}
app.whenReady().then(async()=>{
  dataDir=process.env.FLAPPY_DATA_DIR || app.getPath('userData');await recover();
  sim=new Worker(join(__dirname,'simulation.cjs'),{workerData:{config:{seed,mode}}});
  writer=new Worker(join(__dirname,'writer.cjs'));
  const channel=new MessageChannel();sim.postMessage({type:'writerPort',port:channel.port1},[channel.port1]);writer.postMessage({type:'port',port:channel.port2},[channel.port2]);
  sim.on('message',(m:any)=>{
    replyWorker(m);
    if(m.type==='snapshot'){latest=m.snapshot;if(win&&!win.isDestroyed())win.webContents.send('snapshot',latest);}
    if(m.type==='metrics'){game=m.phase;score=m.score;best=m.best;lagMs=m.lagMs;writerQueue=m.writerQueue;if(active){active.frameCount=m.recordFrames;active.durationSeconds=m.recordFrames/60;}broadcast();}
    if(m.type==='severeLag'){message=`Mô phỏng bị gián đoạn ${Math.round(m.ms)} ms. Phiên quay sẽ được chốt để tránh sai thời gian.`;serialize(()=>stopRecording('interrupted',message));}
    if(m.type==='recordLimit'){serialize(async()=>{if(active?.scheduleId)await stopRecording();}).catch(e=>{message=`Không thể chốt lịch: ${e}`;broadcast();});}
  });
  writer.on('message',(m:any)=>{replyWorker(m);if(m.type==='error'){message=`Lỗi ghi dữ liệu: ${m.error}`;serialize(()=>stopRecording('error',message)).catch(()=>{});broadcast();}});
  sim.on('error',e=>{message=`Lỗi mô phỏng: ${e}`;broadcast();});writer.on('error',e=>{message=`Lỗi writer: ${e}`;broadcast();});
  ipcMain.handle('state',()=>state());
  ipcMain.handle('command',(_event,name,data)=>serialize(()=>command(name,data)));
  createWindow();ready=true;setInterval(()=>serialize(scheduleTick).catch(e=>{message=String(e);broadcast();}),50).unref();broadcast();
  powerMonitor.on('suspend',()=>serialize(async()=>{if(active)await stopRecording('interrupted','Máy ngủ: phiên quay bị gián đoạn.');const s=schedules.find(s=>s.status==='running');if(s){s.status='interrupted';await saveSchedules();}}));
  powerMonitor.on('resume',()=>{sim.postMessage({type:'resumeClock'});broadcast();});
});
app.on('activate',()=>{if(!win&&ready)createWindow();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',e=>{if(quitting)return;e.preventDefault();quitting=true;serialize(async()=>{if(active)await stopRecording('interrupted','Người dùng đã thoát ứng dụng.');}).finally(()=>{if(blocker>=0)powerSaveBlocker.stop(blocker);app.quit();});});
