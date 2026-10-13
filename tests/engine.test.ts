import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Engine, STEP } from '../shared/engine';
test('fixed physics, collision and automatic restart',()=>{
  const e=new Engine({seed:1,mode:'long'});e.start();e.y=580;e.step();assert.equal(e.phase,'gameOver');
  for(let i=0;i<Math.ceil(1.5/STEP)+1;i++)e.step();assert.equal(e.phase,'running');assert.equal(e.score,0);
});
test('pause freezes position and timeline',()=>{
  const e=new Engine({seed:2,mode:'long'});e.start();e.step();e.pause();const a=e.snapshot();for(let i=0;i<1000;i++)e.step();const b=e.snapshot();assert.equal(a.birdY,b.birdY);assert.equal(a.time,b.time);
});
