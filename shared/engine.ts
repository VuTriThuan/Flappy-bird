export const W = 360, H = 640, GROUND = 584, FPS = 60, STEP = 1 / 120;
export type Mode = 'long' | 'challenge';
export type Phase = 'idle' | 'running' | 'paused' | 'gameOver' | 'restarting';
export type Pipe = { id: number; x: number; center: number; scored: boolean };
export type Snapshot = {
  frame: number; time: number; phase: Phase; score: number; best: number; birdY: number;
  birdVy: number; birdAngle: number; wing: number; pipes: Pipe[]; ground: number;
  clouds: number; hills: number; deathClock: number; seed: number; mode: Mode;
};
export type Config = { mode: Mode; seed: number };
const radius = 11, pipeWidth = 58, speed = 90, gravity = 700, flapSpeed = -245, gapLong = 192;
export function rngNext(v: number): number { v ^= v << 13; v ^= v >>> 17; v ^= v << 5; return v >>> 0; }
export class Engine {
  config: Config; random: number; phase: Phase = 'idle'; frame = 0; time = 0;
  y = 320; vy = 0; flapCooldown = 0; score = 0; best = 0; deathClock = 0;
  ground = 0; clouds = 0; hills = 0; pipes: Pipe[] = []; nextId = 1; lastCenter = 315;
  private decisionTicks = 0;
  constructor(config: Config) { this.config = { ...config }; this.random = config.seed >>> 0 || 1; }
  private rand() { this.random = rngNext(this.random); return this.random / 4294967296; }
  start() { if (this.phase === 'idle') this.reset(); this.phase = 'running'; }
  pause() { if (this.phase !== 'idle' && this.phase !== 'paused') this.phase = 'paused'; }
  private reset() {
    this.y = 320; this.vy = 0; this.flapCooldown = 0; this.score = 0; this.deathClock = 0;
    this.pipes = []; this.lastCenter = 315; this.nextId = 1;
    this.addPipe(365); this.addPipe(575); this.addPipe(785);
    this.decisionTicks = 0;
  }
  private addPipe(x: number) {
    const maxShift = this.time < 30 ? 42 : this.config.mode === 'long' ? 55 : 72;
    const change = (this.rand() * 2 - 1) * maxShift;
    const center = Math.max(205, Math.min(450, this.lastCenter + change));
    this.lastCenter = center;
    this.pipes.push({ id: this.nextId++, x, center, scored: false });
  }
  private targetPipe(pipes = this.pipes): Pipe | undefined { return pipes.find(p => p.x + pipeWidth + radius >= 100); }
  private gap() { return this.config.mode === 'long' ? gapLong : Math.max(170, 190 - Math.floor(this.time / 30) * 2); }
  flap() { if (this.phase === 'running' && this.flapCooldown <= 0) { this.vy = flapSpeed; this.flapCooldown = .14; return true; } return false; }
  private control() {
    const p = this.targetPipe(); if (!p) return;
    const next = this.pipes[this.pipes.indexOf(p) + 1];
    const toEntry = Math.max(0, (p.x - 100 - radius) / speed);
    const toExit = Math.max(0, (p.x + pipeWidth - 100 + radius) / speed);
    const center = p.center;
    // Future target drifts only after the bird is fully clear of the current pipe.
    const look = next && toExit < .45 ? center + (next.center - center) * Math.max(0, (.45 - toExit) / .45) * .35 : center;
    const projected = this.y + this.vy * .19 + gravity * .19 * .19 / 2;
    const urgency = toEntry < .5 ? 4 : 0;
    const floor = Math.min(GROUND - radius - 28, look + 50 - urgency);
    let act = this.flapCooldown <= 0 && (projected > floor || this.y > GROUND - 66);
    if (this.flapCooldown <= 0 && toEntry < 1.4) {
      const chosen = this.forecast(act), other = this.forecast(!act);
      if (chosen.collides && !other.collides) act = !act;
    }
    if (act) this.flap();
  }
  private forecast(firstFlap: boolean) {
    let y=this.y, vy=this.vy, cooldown=this.flapCooldown;
    const pipes=this.pipes.map(p=>({x:p.x,center:p.center}));
    const gap=this.gap();
    let penalty=0;
    for(let tick=0;tick<180;tick++) {
      const p=pipes.find(p=>p.x+pipeWidth+radius>=100);
      if(tick%5===0 && p) {
        const following=pipes[pipes.indexOf(p)+1];
        const toEntry=Math.max(0,(p.x-100-radius)/speed);
        const toExit=Math.max(0,(p.x+pipeWidth-100+radius)/speed);
        const look=following&&toExit<.45?p.center+(following.center-p.center)*Math.max(0,(.45-toExit)/.45)*.35:p.center;
        const projected=y+vy*.19+gravity*.19*.19/2;
        const floor=Math.min(GROUND-radius-28,look+50-(toEntry<.5?4:0));
        const flap=tick===0?firstFlap:projected>floor||y>GROUND-66;
        if(flap&&cooldown<=0){vy=flapSpeed;cooldown=.14;penalty+=.03;}
      }
      cooldown=Math.max(0,cooldown-STEP);vy=Math.min(400,vy+gravity*STEP);y+=vy*STEP;
      for(const pipe of pipes)pipe.x-=speed*STEP;
      if(y-radius<0||y+radius>=GROUND)return {collides:true,penalty:10000+tick};
      for(const pipe of pipes)if(100+radius>pipe.x&&100-radius<pipe.x+pipeWidth) {
        if(y-radius<pipe.center-gap/2||y+radius>pipe.center+gap/2)return {collides:true,penalty:10000+tick};
        penalty+=Math.abs(y-pipe.center)*.001;
      }
    }
    return {collides:false,penalty};
  }
  private collision() {
    if (this.y - radius < 0 || this.y + radius >= GROUND) return true;
    const gap = this.gap();
    for (const p of this.pipes) {
      if (100 + radius > p.x && 100 - radius < p.x + pipeWidth) {
        if (this.y - radius < p.center - gap / 2 || this.y + radius > p.center + gap / 2) return true;
      }
    }
    return false;
  }
  step() {
    if (this.phase === 'paused' || this.phase === 'idle') return;
    this.time += STEP;
    if (this.phase === 'gameOver' || this.phase === 'restarting') {
      this.deathClock += STEP;
      this.phase = this.deathClock < .55 ? 'gameOver' : 'restarting';
      if (this.deathClock >= 1.5) { this.reset(); this.phase = 'running'; }
      return;
    }
    if (--this.decisionTicks <= 0) { this.control(); this.decisionTicks = 5; }
    this.flapCooldown = Math.max(0, this.flapCooldown - STEP);
    this.vy = Math.min(400, this.vy + gravity * STEP);
    this.y += this.vy * STEP;
    this.ground = (this.ground + speed * STEP) % 32;
    this.clouds = (this.clouds + 11 * STEP) % W;
    this.hills = (this.hills + 24 * STEP) % W;
    for (const p of this.pipes) {
      p.x -= speed * STEP;
      if (!p.scored && p.x + pipeWidth < 100 - radius) { p.scored = true; this.score++; this.best = Math.max(this.best, this.score); }
    }
    if (this.pipes[0]?.x < -pipeWidth - 4) this.pipes.shift();
    if (this.pipes.at(-1)!.x < W + 190) this.addPipe(this.pipes.at(-1)!.x + 210);
    if (this.collision()) { this.phase = 'gameOver'; this.deathClock = 0; }
  }
  snapshot(): Snapshot {
    return { frame: this.frame++, time: this.time, phase: this.phase, score: this.score, best: this.best,
      birdY: this.y, birdVy: this.vy, birdAngle: Math.max(-.42, Math.min(1.18, this.vy / 390)),
      wing: Math.sin(this.time * 22), pipes: this.pipes.map(p => ({ ...p })), ground: this.ground,
      clouds: this.clouds, hills: this.hills, deathClock: this.deathClock, seed: this.config.seed, mode: this.config.mode };
  }
}
