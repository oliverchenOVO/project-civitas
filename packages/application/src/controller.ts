import {type CityState,type Command,type Config} from '../../domain/src/index';
import {createCity,advance,applyCommand} from '../../simulation/src/index';
import {saveCity,loadCity,replayCity} from '../../simulation/src/persistence';
import {stateHash} from '../../shared/src/canonical';
export class CityController {
  state:CityState=createCity(); revision=0; speed=0; processingMs=0; private listeners=new Set<()=>void>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  private publish(){this.revision++;for(const listener of this.listeners)listener();}
  newCity(config:Config){this.speed=0;this.state=createCity(config);this.publish();}
  step(days=1){const start=performance.now();advance(this.state,days);this.processingMs=performance.now()-start;this.publish();}
  setSpeed(speed:number){this.speed=speed;this.publish();}
  command(command:Command){applyCommand(this.state,command);this.publish();}
  save(){return saveCity(this.state);}
  async load(text:string){const state=await loadCity(text);this.speed=0;this.state=state;this.publish();}
  async verifyReplay(){this.setSpeed(0);const source=structuredClone(this.state);const replay=replayCity(source);const [expected,actual]=await Promise.all([stateHash(source),stateHash(replay)]);return {ok:expected===actual,expected,actual};}
}
export const controller=new CityController();
