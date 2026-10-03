import {type CityState,type Command} from '../../domain/src/index';
import {PIPELINE,metricsSystem} from './systems';
import {addHousing} from './world';
import {emit,id} from './events';
export {createCity} from './world';
export {PIPELINE} from './systems';
export function advance(s:CityState,days=1){if(!Number.isInteger(days)||days<0||days>100000)throw new Error('Invalid day count');for(let i=0;i<days;i++)for(const system of PIPELINE)system(s);return s;}
export function applyCommand(s:CityState,command:Command){
  if(command.type==='SET_POLICY'){
    const limits={incomeTax:[0,6000],corporateTax:[0,6000],welfare:[0,300000],minimumWage:[0,600000]} as const;
    if(!Object.hasOwn(limits,command.key))throw new Error('Unknown policy');const [min,max]=limits[command.key];
    if(!Number.isInteger(command.value)||command.value<min||command.value>max)throw new Error('Policy is outside permitted limits');
    const old=s.government.policies[command.key];s.government.policies[command.key]=command.value;
    emit(s,'POLICY_CHANGED',[],{policy:command.key,oldValue:old,value:command.value});
  }else if(command.type==='BUILD_HOUSING'){
    if(!s.districts.some(d=>d.id===command.districtId)||!Number.isInteger(command.units)||command.units<1||command.units>50)throw new Error('Invalid housing order');
    const cost=command.units*800000;if(s.government.cash<cost)throw new Error('Insufficient treasury: construction costs $8,000 per unit.');
    s.government.cash-=cost;s.government.constructionSpending+=cost;s.economy.imports+=cost;const units=addHousing(s,command.districtId,command.units);
    emit(s,'HOUSING_BUILT',[{kind:'district',id:command.districtId},...units.map(uid=>({kind:'unit' as const,id:uid}))],{units:command.units,cost});
  }else throw new Error('Unknown command');
  s.commands.push({id:id(s,'command'),day:s.day,command:structuredClone(command)});metricsSystem(s);
}
