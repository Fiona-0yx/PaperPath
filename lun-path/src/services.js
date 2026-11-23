// Every screen uses the same HTTP contract as the future provider adapters.
// The server currently answers with deterministic teaching fixtures.
async function post(url,body){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error?.message||'Request failed');
  return result;
}
export const learning={
  introduce(text,lang){return post('/api/profile/update',{text,lang});},
  next(profile,history,lang){return post('/api/planner/next',{profile,history,lang});},
  assess(input){return post('/api/assessment',input);},
  tutor(input){return post('/api/tutor',input);}
};
