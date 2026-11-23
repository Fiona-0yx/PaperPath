const KEY='lunjing-journal-v1';
export const blankState=()=>({version:1,language:'zh',profile:{goal:'',direction:'',experience:'',deadline:'',output:''},intro:'',history:[],onboarded:false,diagnosed:false,evidence:[],attempts:[],notes:{},completed:[],bookmarks:[],lastPaper:null,lastSection:{},readSections:{},chat:{},visited:[],activity:[]});
export function restore(){
  try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return validate(value)?{...blankState(),...value,profile:{...blankState().profile,...value.profile}}:blankState();}catch{return blankState();}
}
export function validate(s){
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(!object(s)||s.version!==1||!['zh','en'].includes(s.language)||!object(s.profile))return false;
  if(!Object.values(s.profile).every(v=>typeof v==='string'))return false;
  for(const key of ['history','evidence','attempts','completed','bookmarks','visited','activity'])if(!Array.isArray(s[key]))return false;
  if(!['completed','bookmarks','visited'].every(k=>s[k].every(x=>typeof x==='string')))return false;
  if(!s.history.every(x=>object(x)&&typeof x.field==='string'&&typeof x.value==='string'))return false;
  if(!s.evidence.every(x=>object(x)&&typeof x.paperId==='string'&&typeof x.status==='string'))return false;
  if(!s.attempts.every(object)||!s.activity.every(x=>object(x)&&typeof x.at==='string'&&object(x.text)))return false;
  if(!['notes','lastSection','readSections','chat'].every(k=>object(s[k])))return false;
  if(!Object.values(s.notes).every(x=>typeof x==='string')||!Object.values(s.lastSection).every(x=>typeof x==='string'))return false;
  if(!Object.values(s.readSections).every(x=>Array.isArray(x)&&x.every(y=>typeof y==='string')))return false;
  if(!Object.values(s.chat).every(x=>Array.isArray(x)&&x.every(m=>object(m)&&typeof m.question==='string'&&typeof m.reply==='string')))return false;
  return true;
}
export function persist(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
export function clearSaved(){localStorage.removeItem(KEY);}
export function importState(text){if(text.length>2_000_000)throw Error('File is too large');const v=JSON.parse(text);if(!validate(v))throw Error('Invalid journal format');return {...blankState(),...v,profile:{...blankState().profile,...v.profile}};}
export function download(s){const data={...s,exportedAt:new Date().toISOString(),format:'lunjing-portable-journal',dataMode:'demo'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lunjing-learning-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
