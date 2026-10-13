const port=Number(process.argv[2]||9226);
const hiddenSeconds=Number(process.argv[3]||3.2);
const pages=await (await fetch(`http://127.0.0.1:${port}/json`)).json();const page=pages.find(x=>x.type==='page');if(!page)throw Error('Không thấy cửa sổ Electron');
async function connection(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};return {ws,send(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}}}
const {ws,send}=await connection(page.webSocketDebuggerUrl);
async function evalApp(expr){const x=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(x.exceptionDetails)throw Error(x.exceptionDetails.text);return x.result.value}
const before=await evalApp('window.flappy.state()');if(before.recording)throw Error('Đang có phiên quay');
await evalApp('window.flappy.command("record")');await new Promise(r=>setTimeout(r,2200));
const foreground=await evalApp('window.flappy.state()');
try {
  await evalApp('window.flappy.command("minimize")');
  await new Promise(r=>setTimeout(r,hiddenSeconds*1000));
} finally {await evalApp('window.flappy.command("restore")');}
const hidden=await evalApp('window.flappy.state()');await evalApp('window.flappy.command("stopRecord")');
const after=await evalApp('window.flappy.state()');const r=after.recordings[0];
console.log(JSON.stringify({foregroundFrames:foreground.recording?.frameCount,hiddenFrames:hidden.recording?.frameCount,finalFrames:r.frameCount,duration:r.durationSeconds,chunks:r.chunks.length,status:r.status,game:after.game}));
if((hidden.recording?.frameCount||0)-(foreground.recording?.frameCount||0)<Math.floor((hiddenSeconds-.5)*60)||r.frameCount<Math.floor((hiddenSeconds+1.5)*60)||r.status!=='ready'||after.game!=='running')throw Error('Phiên quay không tiến triển khi thu nhỏ');
ws.close();
