const port=Number(process.argv[2]||9227);const pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const page=pages.find(x=>x.type==='page');if(!page)throw Error('Không thấy app');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
function send(expr){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}))})}
const d=new Date();d.setSeconds(0,0);d.setMinutes(d.getMinutes()+(60000-(Date.now()%60000)<20000?2:1));
const pad=n=>String(n).padStart(2,'0');const localInput=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const result=await send(`window.flappy.command('schedule',${JSON.stringify({localInput,durationSeconds:5})})`);
if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
console.log(JSON.stringify(result.result.value.schedules[0]));ws.close();
