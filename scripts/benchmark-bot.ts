import { Engine, STEP } from '../shared/engine';
let survived=0;const losses:{seed:number;time:number}[]=[];
const start=Date.now();
for(let seed=1;seed<=100;seed++){
  const e=new Engine({seed,mode:'long'});e.start();let deadAt=-1;
  for(let i=0;i<180/STEP;i++){e.step();if(e.phase==='gameOver'){deadAt=i*STEP;break;}}
  if(deadAt<0)survived++;else losses.push({seed,time:deadAt});
}
console.log(JSON.stringify({seeds:'1..100',mode:'long',seconds:180,survived,losses,wallSeconds:(Date.now()-start)/1000},null,2));
if(survived<95)process.exitCode=1;
