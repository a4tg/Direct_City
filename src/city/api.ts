export class ApiError extends Error {
 constructor(message:string,public status:number) { super(message); }
}
export async function api<T>(path:string, method='GET', body?:unknown):Promise<T> {
 const response=await fetch('/api'+path,{method,credentials:'same-origin',
  headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json().catch(()=>({error:'Ответ сервера недоступен.'}));
 if(!response.ok) throw new ApiError(value.error??'Ошибка запроса.',response.status);
 return value as T;
}