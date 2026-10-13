import { writeFile } from 'node:fs/promises';
const port=Number(process.argv[2]||9226);
const pages=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page=pages.find(x=>x.type==='page');if(!page)throw Error('Không thấy cửa sổ ứng dụng');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let next=0;const waiting=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
function send(method,params={}){const id=++next;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value}
const text=await evaluate('document.body.innerText');const initial=await evaluate('window.flappy.state()');
const viewport=await evaluate('(()=>{const r=document.querySelector("canvas.game").getBoundingClientRect();return {width:r.width,height:r.height,ratio:r.width/r.height,backingWidth:document.querySelector("canvas.game").width,backingHeight:document.querySelector("canvas.game").height}})()');
const diagnostics=await evaluate('document.querySelector("details.diagnostics").textContent');
console.log(JSON.stringify({title:page.title,text:text.slice(0,500),initial:{game:initial.game,recordings:initial.recordings.length,timezone:initial.timezone,memoryMb:initial.memoryMb,peakMemoryMb:initial.peakMemoryMb},viewport,diagnostics}));
const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/private/tmp/flappy-app-ui.png',Buffer.from(shot.data,'base64'));
ws.close();
