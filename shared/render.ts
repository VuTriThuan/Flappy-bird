import { GROUND, H, W, type Snapshot } from './engine';
type Ctx = CanvasRenderingContext2D | import('@napi-rs/canvas').SKRSContext2D;
export function drawScene(context: Ctx, s: Snapshot, pixelWidth = 360, pixelHeight = 640) {
  const c = context as CanvasRenderingContext2D;
  c.save(); c.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, '#70d6f2'); sky.addColorStop(1, '#c6f4e7');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff5c5'; c.beginPath(); c.arc(291, 91, 36, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 5; i++) {
    const x = ((i * 106 + 35 - s.clouds) % 480 + 480) % 480 - 60; const y = 75 + i % 3 * 78;
    c.fillStyle = 'rgba(255,255,255,.78)';
    for (const [dx,dy,r] of [[0,0,18],[21,-7,24],[47,1,17]]) { c.beginPath(); c.arc(x+dx,y+dy,r,0,Math.PI*2); c.fill(); }
  }
  for (let i = -1; i < 5; i++) {
    const x = i * 118 - s.hills % 118;
    c.fillStyle = '#82d9a2'; c.beginPath(); c.moveTo(x, GROUND); c.quadraticCurveTo(x + 58, 416 + i % 2 * 25, x + 116, GROUND); c.fill();
    c.fillStyle = '#5fbd87'; c.beginPath(); c.moveTo(x + 33, GROUND); c.quadraticCurveTo(x + 92, 475, x + 146, GROUND); c.fill();
  }
  const gap = s.mode === 'long' ? 192 : Math.max(170, 190 - Math.floor(s.time / 30) * 2);
  for (const p of s.pipes) {
    const top = p.center - gap/2, bottom = p.center + gap/2;
    c.fillStyle = '#318e53'; c.fillRect(p.x+5, 0, 48, top); c.fillRect(p.x+5, bottom, 48, GROUND-bottom);
    c.fillStyle = '#52c870'; c.fillRect(p.x+9, 0, 12, top); c.fillRect(p.x+9, bottom, 12, GROUND-bottom);
    c.fillStyle = '#276f48'; c.fillRect(p.x+47, 0, 6, top); c.fillRect(p.x+47, bottom, 6, GROUND-bottom);
    c.fillStyle = '#399e5b'; c.fillRect(p.x, top-20, 58, 20); c.fillRect(p.x, bottom, 58, 20);
    c.fillStyle = '#75dc89'; c.fillRect(p.x+5, top-17, 12, 15); c.fillRect(p.x+5, bottom+3, 12, 14);
    c.strokeStyle = '#245e42'; c.lineWidth = 2; c.strokeRect(p.x, top-20, 58, 20); c.strokeRect(p.x, bottom, 58, 20);
  }
  c.fillStyle = '#7ccb65'; c.fillRect(0, GROUND, W, 8);
  c.fillStyle = '#d8ad72'; c.fillRect(0, GROUND+8, W, H-GROUND-8);
  c.fillStyle = '#b98d5d'; for (let x=-32; x<W+32; x+=32) c.fillRect(x-s.ground, GROUND+24, 18, 5);
  c.save(); c.translate(100, s.birdY); c.rotate(s.birdAngle);
  c.fillStyle = '#f0a943'; c.beginPath(); c.ellipse(0, 1, 16, 13, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#684b38'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#ffe28a'; c.beginPath(); c.ellipse(-5, 5+s.wing*3, 9, 6, -.3, 0, Math.PI*2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(7,-5,5,0,Math.PI*2); c.fill();
  c.fillStyle = '#263748'; c.beginPath(); c.arc(9,-4,2,0,Math.PI*2); c.fill();
  c.fillStyle = '#f06b4d'; c.beginPath(); c.moveTo(13,1); c.lineTo(24,4); c.lineTo(13,8); c.fill(); c.restore();
  c.textAlign='center'; c.textBaseline='middle'; c.font='bold 46px Arial, sans-serif'; c.lineWidth=5; c.strokeStyle='#466077'; c.fillStyle='#fff';
  c.strokeText(String(s.score), 180, 57); c.fillText(String(s.score), 180, 57);
  if (s.phase === 'gameOver' || s.phase === 'restarting') {
    c.fillStyle='rgba(29,55,67,.28)'; c.fillRect(0,0,W,GROUND);
    c.fillStyle='#fff'; c.font='bold 25px Arial, sans-serif'; c.fillText('Chơi lại ngay...',180,278);
  }
  c.restore();
}
