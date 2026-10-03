import {mkdirSync,writeFileSync} from 'node:fs';
import {createCity,advance} from '../packages/simulation/src/index';
import {checkInvariants} from '../packages/simulation/src/invariants';
import {stateHash} from '../packages/shared/src/canonical';
const results=[];
for(let i=0;i<100;i++){
  const seed=`CIVITAS-STABILITY-${i}`;try{const s=createCity({population:250,seed});const errors:string[]=[];for(let y=0;y<5;y++){advance(s,365);errors.push(...checkInvariants(s));}
    results.push({seed,days:s.day,population:s.metrics.population,companies:s.metrics.companies,events:s.events.length,violations:errors.length,collapse:s.metrics.population<25||s.metrics.companies===0,hash:await stateHash(s),errors:errors.slice(0,10)});
  }catch(e){results.push({seed,crash:String(e),violations:1});}if(i%10===9)console.log(`Completed ${i+1}/100 seeds`);
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/stability.json',JSON.stringify(results,null,2));const failures=results.filter(r=>r.violations>0);writeFileSync('artifacts/stability.md',`100 seeds × 250 citizens × 5 years.\n\nTechnical failures: ${failures.length}. Economic/demographic collapse flags: ${results.filter(r=>'collapse' in r&&r.collapse).length}.\n`);console.log(`Technical failures: ${failures.length}/100`);if(failures.length)process.exitCode=1;
