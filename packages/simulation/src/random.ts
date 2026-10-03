// FNV-1a seed derivation and scoped xorshift32, persisted as unsigned integers.
export function seedHash(seed:string):number {let h=2166136261; for(let i=0;i<seed.length;i++) h=Math.imul(h^seed.charCodeAt(i),16777619); return (h>>>0)||1;}
export function randomInt(streams:Record<string,number>, scope:string, seed:string, min:number, max:number):number {
  let x=streams[scope]??seedHash(`${seed}:${scope}`); x^=x<<13; x^=x>>>17; x^=x<<5;
  streams[scope]=x>>>0;
  return min+Math.floor((x>>>0)/4294967296*(max-min+1));
}
