export function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function stateHash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(canonical(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');}
