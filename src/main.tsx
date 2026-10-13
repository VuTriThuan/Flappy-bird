import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { drawScene } from '../shared/render';
import type { Snapshot } from '../shared/engine';
import type { AppState, Bridge } from '../shared/contracts';
import './style.css';
declare global { interface Window { flappy: Bridge } }
function pad(n:number){return String(n).padStart(2,'0')}
function duration(n=0){const s=Math.floor(n);return `${pad(Math.floor(s/60))}:${pad(s%60)}`}
function localDate(d:string){return new Date(d).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'medium'})}
function GameViewport({onPerf}:{onPerf:(v:{fps:number;p95:number})=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),snap=useRef<Snapshot|undefined>(undefined);
  useEffect(()=>{
    const off=window.flappy.onSnapshot(s=>snap.current=s);let handle=0,last=0;const samples:number[]=[];
    const draw=(now:number)=>{const el=canvas.current;if(el&&snap.current){const dpr=Math.min(2,window.devicePixelRatio||1);const width=Math.round(el.clientWidth*dpr),height=Math.round(el.clientHeight*dpr);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}const ctx=el.getContext('2d');if(ctx)drawScene(ctx,snap.current,width,height);if(last){samples.push(now-last);if(samples.length>=120){const sorted=[...samples].sort((a,b)=>a-b);onPerf({fps:Math.round(1000/(samples.reduce((a,b)=>a+b,0)/samples.length)),p95:Math.round(sorted[Math.floor(sorted.length*.95)])});samples.length=0;}}last=now;}handle=requestAnimationFrame(draw)};
    handle=requestAnimationFrame(draw);return()=>{off();cancelAnimationFrame(handle)};
  },[]);
  return <div className="screen-wrap"><div className="screen-label">MÀN HÌNH A · 9:16</div><canvas ref={canvas} className="game" aria-label="Máy đang tự chơi Flappy Bird"/></div>;
}
function App(){
  const [s,setS]=useState<AppState>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState(false);
  const [previewPerf,setPreviewPerf]=useState({fps:0,p95:0});
  const [date,setDate]=useState(()=>{const d=new Date();d.setMinutes(d.getMinutes()+2);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`});
  const [mins,setMins]=useState(10),[secs,setSecs]=useState(0);
  useEffect(()=>{window.flappy.state().then(setS).catch(e=>setError(String(e)));return window.flappy.onState(setS)},[]);
  async function action(name:string,data?:unknown){setBusy(true);setError('');try{setS(await window.flappy.command(name,data));}catch(e){setError(String(e).replace(/^Error: /,''));}finally{setBusy(false)}}
  const rec=s?.recording, pending=s?.schedules.find(x=>x.status==='pending'), exp=s?.export;
  const isPlaying=s?.game==='running';
  return <div className="app"><header><div className="brand"><span className="brand-icon">●</span><div><h1>Flappy Auto Recorder</h1><p>Máy tự chơi · Quay màn hình dọc</p></div></div><div className="header-status"><span className={isPlaying?'pulse':''}>●</span> {isPlaying?'Đang chơi':s?.game==='paused'?'Đã dừng':'Sẵn sàng'}</div></header>
  <main><GameViewport onPerf={setPreviewPerf}/><aside>
    <section className="card hero"><span className="eyebrow">BẢNG ĐIỀU KHIỂN</span><h2>Cứ để chim bay.</h2><p>Bot tự chơi. Bản ghi chỉ chứa màn hình A, kể cả khi cửa sổ bị thu nhỏ.</p><div className="stats"><div><strong>{s?.score??0}</strong><small>ĐIỂM</small></div><div><strong>{s?.best??0}</strong><small>KỶ LỤC</small></div><div><strong>{rec?duration(rec.durationSeconds):'—'}</strong><small>ĐÃ QUAY</small></div></div></section>
    <section className="card"><div className="section-title"><h3>Chơi & quay</h3><span className={rec?'badge red':'badge'}>{rec?'● ĐANG QUAY':'CHƯA QUAY'}</span></div>
      <div className="buttons"><button onClick={()=>action('start')} disabled={busy||isPlaying} className="primary">▶ Bắt đầu chơi game</button><button onClick={()=>action('pause')} disabled={busy||!isPlaying}>Ⅱ Dừng chơi</button><button onClick={()=>action(rec?'stopRecord':'record')} disabled={busy} className={rec?'danger':'accent'}>{rec?'■ Dừng quay':'● Quay màn hình'}</button></div>
      <label className="mode">Chế độ <select disabled={busy||!!rec} value={s?.mode||'long'} onChange={e=>action('mode',e.target.value)}><option value="long">Chơi lâu</option><option value="challenge">Thử thách</option></select></label>
    </section>
    <section className="card"><div className="section-title"><h3>Phiên đã ghi</h3><span className="count">{s?.recordings.length||0}</span></div>
      {!s?.recordings.length?<p className="muted">Chưa có phiên quay. Nhấn “Quay màn hình” để bắt đầu.</p>:<div className="record-list">{s.recordings.map(r=><div className="record" key={r.id}><div><strong>{localDate(r.startedAt)}</strong><small>{r.source==='schedule'?'Theo lịch':'Thủ công'} · {duration(r.durationSeconds)} · {r.frameCount} frame</small><small>{r.status==='interrupted'?'Gián đoạn':r.status==='error'?'Lỗi ghi':r.status==='recording'?'Đang quay':'Sẵn sàng xuất'}</small></div><button disabled={busy||!!exp&&!['idle','completed','cancelled','error'].includes(exp.state)} onClick={()=>action('export',r.id)}>Xuất video</button></div>)}</div>}
      <p className="hint">MP4 · 1080 × 1920 · 60 fps · không tiếng</p>
    </section>
    <section className="card"><div className="section-title"><h3>Đặt lịch quay màn hình</h3><button className="link" onClick={()=>setForm(!form)}>{form?'Đóng':'Tạo lịch +'}</button></div>
      {form&&<div className="schedule-form"><label>Bắt đầu (giờ địa phương)<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="two"><label>Phút<input type="number" min="0" max="1440" value={mins} onChange={e=>setMins(Number(e.target.value))}/></label><label>Giây<input type="number" min="0" max="59" value={secs} onChange={e=>setSecs(Number(e.target.value))}/></label></div><p className="muted">Múi giờ: {s?.timezone}. Dự kiến kết thúc: {date&&Number.isFinite(new Date(date).getTime())?localDate(new Date(new Date(date).getTime()+(mins*60+secs)*1000).toISOString()):'—'}</p><button className="primary" disabled={busy||mins*60+secs<=0} onClick={async()=>{await action('schedule',{localInput:date,durationSeconds:mins*60+secs});setForm(false)}}>Lưu lịch</button></div>}
      {pending&&<div className="schedule-item"><div><strong>{localDate(pending.startAt)}</strong><small>{duration(pending.durationSeconds)} · Chờ bắt đầu</small></div><button onClick={()=>action('cancelSchedule',pending.id)} disabled={busy}>Hủy lịch</button></div>}
      {s?.schedules.filter(x=>x.status!=='pending').slice(0,4).map(x=><div className="schedule-item" key={x.id}><div><strong>{localDate(x.startAt)}</strong><small>{x.status==='completed'?'Đã quay xong':x.status==='running'?'Đang quay':x.status==='missed'?'Bỏ lỡ':x.status==='cancelled'?'Đã hủy':x.status==='interrupted'?'Gián đoạn':'Lỗi'} · {x.message||duration(x.actualDurationSeconds||x.durationSeconds)}</small></div></div>)}
      <p className="hint">Ứng dụng phải đang chạy và máy không ngủ, gập nắp hay tắt nguồn.</p>
    </section>
    {exp&&exp.state!=='idle'&&<section className="card"><div className="section-title"><h3>Xuất video</h3><span>{exp.state==='completed'?'Hoàn tất':exp.state==='error'?'Lỗi':exp.state==='cancelled'?'Đã hủy':'Đang xử lý'}</span></div><progress max={exp.total||1} value={Math.min(exp.frame||0,exp.total||1)}/><p className="hint">{exp.frame||0} / {exp.total||0} frame · {exp.state}</p>{!['completed','error','cancelled'].includes(exp.state)&&<button onClick={()=>action('cancelExport')}>Hủy xuất</button>}{exp.error&&<p className="error">{exp.error}</p>}</section>}
    {(error||s?.message)&&<div className="error" role="alert">{error||s?.message}</div>}
    <details className="diagnostics"><summary>Chẩn đoán</summary><p>Preview: {previewPerf.fps} fps, p95 {previewPerf.p95} ms · Độ trễ mô phỏng: {Math.round(s?.lagMs||0)} ms · Hàng đợi writer: {s?.writerQueue||0} · Main/worker RSS: {s?.memoryMb||0} MB (cao nhất {s?.peakMemoryMb||0} MB)</p><button disabled={busy} onClick={()=>action('doctor')}>Kiểm tra Canvas & FFmpeg</button>{s?.doctorResult&&<pre>{s.doctorResult}</pre>}</details>
  </aside></main><footer>Flappy Auto Recorder · Video chỉ ghi cảnh game trong A</footer></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
