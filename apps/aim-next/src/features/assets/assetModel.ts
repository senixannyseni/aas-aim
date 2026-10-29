/** AIR presentation boundary — objects are read-only snapshots, never authorization grants. */
export const ASSET_KINDS = ["EQUIPMENT", "COMPONENT"] as const;
export const ASSET_STATES = ["ACTIVE", "INACTIVE", "RETIRED", "UNKNOWN"] as const;
export const RELATION_KINDS = ["CONNECTED_TO", "PART_OF", "FEEDS", "PROTECTS", "RELATED_TO"] as const;
export type AssetKind = typeof ASSET_KINDS[number];
export type AssetState = typeof ASSET_STATES[number];
export type RelationKind = typeof RELATION_KINDS[number];

export type AssetRecord = Readonly<{
  id:string; tag:string; name:string; kind:AssetKind; state:AssetState;
  parentId?:string; system?:string; functionalLocation?:string;
  material?:string; designCode?:string; manufacturer?:string;
  revision?:string;
}>;
export type AssetRelation = Readonly<{id:string; sourceId:string; targetId:string; kind:RelationKind; sourceReference:string}>;
export type AssetHistory = Readonly<{id:string; assetId:string; occurredAt:string; description:string; sourceReference:string}>;
export type AssetSnapshot = Readonly<{
  assets:readonly AssetRecord[];
  relationships:readonly AssetRelation[];
  history:readonly AssetHistory[];
}>;
export type ValidationOutcome = Readonly<{ok:true; snapshot:AssetSnapshot}> | Readonly<{ok:false; issues:readonly string[]}>;

const plain=(value:unknown):value is Record<string,unknown>=> typeof value==="object" && value!==null && !Array.isArray(value) && (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const text=(value:unknown):value is string => typeof value==="string" && value.trim().length>0 && value.length<=400 && !/[\u0000-\u001f\u007f]/.test(value);
const allowed=(v:Record<string,unknown>,keys:readonly string[]):boolean=>Object.keys(v).every(k=>keys.includes(k));
const unique=<T>(records:readonly T[], getId:(r:T)=>string):boolean=>new Set(records.map(getId)).size===records.length;
const opt=(v:Record<string,unknown>,key:string):boolean=>!(key in v)||text(v[key]);
function validDateTime(value:unknown):value is string {
  if(typeof value!=="string")return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!m)return false;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const days=[31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1]!)return false;
  if(Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return false;
  const zone=m[7]!;if(zone!=="Z"&&(Number(zone.slice(1,3))>14||Number(zone.slice(4,6))>59||(Number(zone.slice(1,3))===14&&Number(zone.slice(4,6))!==0)))return false;
  return Number.isFinite(Date.parse(value));
}

/** Rejects malformed, unscoped or partially invalid batches wholesale. Callers must enforce authorization upstream. */
export function parseAssetSnapshot(input:unknown):ValidationOutcome {
  const issues:string[]=[];
  if(!plain(input)||!allowed(input,["assets","relationships","history"])||!Array.isArray(input.assets)||!Array.isArray(input.relationships)||!Array.isArray(input.history))
    return {ok:false,issues:Object.freeze(["Invalid asset snapshot structure"])};
  if(input.assets.length>50000||input.relationships.length>100000||input.history.length>100000)
    return {ok:false,issues:Object.freeze(["Snapshot exceeds presentation limits"])};
  const assets:AssetRecord[]=[];
  input.assets.forEach((entry:unknown,i:number)=>{
    if(!plain(entry)||!allowed(entry,["id","tag","name","kind","state","parentId","system","functionalLocation","material","designCode","manufacturer","revision"]) ||
       !text(entry.id)||!text(entry.tag)||!text(entry.name)||!ASSET_KINDS.includes(entry.kind as AssetKind)||!ASSET_STATES.includes(entry.state as AssetState)||
       !["parentId","system","functionalLocation","material","designCode","manufacturer","revision"].every(k=>opt(entry,k))){issues.push(`assets[${i}]: invalid record`);return;}
    const asset:AssetRecord={id:entry.id,tag:entry.tag,name:entry.name,kind:entry.kind as AssetKind,state:entry.state as AssetState,
      ...Object.fromEntries(["parentId","system","functionalLocation","material","designCode","manufacturer","revision"].filter(k=>k in entry).map(k=>[k,entry[k]]))};
    assets.push(Object.freeze(asset));
  });
  const ids=new Set(assets.map(a=>a.id));
  if(!unique(assets,a=>a.id))issues.push("assets: duplicate identity");
  if(new Set(assets.map(a=>a.tag.toLocaleLowerCase())).size!==assets.length)issues.push("assets: duplicate tag");
  for(const asset of assets){
    if(asset.parentId!==undefined && (!ids.has(asset.parentId)||asset.parentId===asset.id))issues.push("assets: unresolved or self-referential parent");
  }
  const byId=new Map(assets.map(a=>[a.id,a]));
  // O(n) iterative cycle detection; avoids stack overflow on deep industrial hierarchies.
  const resolved=new Set<string>();
  for(const asset of assets){
    const visiting=new Set<string>();let cursor:AssetRecord|undefined=asset;
    while(cursor&&!resolved.has(cursor.id)){
      if(visiting.has(cursor.id)){issues.push("assets: cyclic hierarchy");break;}
      visiting.add(cursor.id);cursor=cursor.parentId?byId.get(cursor.parentId):undefined;
    }
    for(const id of visiting)resolved.add(id);
  }
  const relationships:AssetRelation[]=[];
  input.relationships.forEach((entry:unknown,i:number)=>{
    if(!plain(entry)||!allowed(entry,["id","sourceId","targetId","kind","sourceReference"])||
      !text(entry.id)||!text(entry.sourceId)||!text(entry.targetId)||!text(entry.sourceReference)||!RELATION_KINDS.includes(entry.kind as RelationKind)||
      !ids.has(entry.sourceId)||!ids.has(entry.targetId)||entry.sourceId===entry.targetId){issues.push(`relationships[${i}]: invalid relationship`);return;}
    relationships.push(Object.freeze({id:entry.id,sourceId:entry.sourceId,targetId:entry.targetId,kind:entry.kind as RelationKind,sourceReference:entry.sourceReference}));
  });
  if(!unique(relationships,r=>r.id))issues.push("relationships: duplicate identity");
  const history:AssetHistory[]=[];
  input.history.forEach((entry:unknown,i:number)=>{
    if(!plain(entry)||!allowed(entry,["id","assetId","occurredAt","description","sourceReference"])||
      !text(entry.id)||!text(entry.assetId)||!ids.has(entry.assetId)||!text(entry.description)||!text(entry.sourceReference)||
      !validDateTime(entry.occurredAt)){issues.push(`history[${i}]: invalid event`);return;}
    history.push(Object.freeze({id:entry.id,assetId:entry.assetId,occurredAt:entry.occurredAt,description:entry.description,sourceReference:entry.sourceReference}));
  });
  if(!unique(history,h=>h.id))issues.push("history: duplicate identity");
  if(issues.length)return Object.freeze({ok:false as const,issues:Object.freeze(issues)});
  return Object.freeze({ok:true as const,snapshot:Object.freeze({assets:Object.freeze(assets),relationships:Object.freeze(relationships),history:Object.freeze(history)})});
}

export type AssetFilter = Readonly<{search:string; kind:AssetKind|"ALL"; state:AssetState|"ALL"; sort:"TAG_ASC"|"TAG_DESC"|"NAME_ASC"}>;
export function filterAssetRecords(assets:readonly AssetRecord[],filter:AssetFilter):readonly AssetRecord[]{
  const terms=filter.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=assets.filter(a=>(filter.kind==="ALL"||a.kind===filter.kind)&&(filter.state==="ALL"||a.state===filter.state)&&
    terms.every(t=>[a.id,a.tag,a.name,a.system??"",a.functionalLocation??"",a.material??""].join(" ").toLocaleLowerCase().includes(t)));
  return matches.sort((a,b)=>filter.sort==="NAME_ASC"?a.name.localeCompare(b.name)||a.tag.localeCompare(b.tag):
    filter.sort==="TAG_DESC"?b.tag.localeCompare(a.tag):a.tag.localeCompare(b.tag));
}
export type AssetTreeRow=Readonly<{asset:AssetRecord; depth:number}>;
export function assetHierarchy(assets:readonly AssetRecord[]):readonly AssetTreeRow[]{
  const byParent=new Map<string,AssetRecord[]>();
  for(const a of assets){const parent= a.parentId??"";const siblings=byParent.get(parent)??[];siblings.push(a);byParent.set(parent,siblings);}
  for(const group of byParent.values())group.sort((a,b)=>a.tag.localeCompare(b.tag));
  const result:AssetTreeRow[]=[];const visited=new Set<string>();
  const stack:AssetTreeRow[]=(byParent.get("")??[]).slice().reverse().map(asset=>({asset,depth:0}));
  while(stack.length){
    const row=stack.pop()!;
    if(visited.has(row.asset.id))continue;
    visited.add(row.asset.id);result.push(row);
    const children=byParent.get(row.asset.id)??[];
    for(let i=children.length-1;i>=0;i--)stack.push({asset:children[i]!,depth:row.depth+1});
  }
  return result;
}

/** Safe display-only CSV preview. Import promotion remains an authoritative backend transaction. */
export type AssetImportPreview=Readonly<{rows:readonly AssetRecord[]; issues:readonly string[]; totalRows:number}>;
const CSV_COLUMNS=["id","tag","name","kind","state","parentId","system","functionalLocation"] as const;
function parseCsvCells(csv:string):string[][]|null{
  const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;let closed=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i]!;
    if(quoted){if(ch==='"'&&csv[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;closed=true;}else field+=ch;}
    else if(ch==='"'){if(field!==""||closed)return null;quoted=true;}
    else if(ch===","){row.push(field);field="";closed=false;}
    else if(ch==="\r"||ch==="\n"){
      if(ch==="\r"&&csv[i+1]==="\n")i++;
      row.push(field);rows.push(row);row=[];field="";closed=false;
    }else{if(closed)return null;field+=ch;}
  }
  if(quoted)return null;
  if(row.length||field!==""||closed){row.push(field);rows.push(row);}
  return rows;
}
export function previewAssetImport(csv:string,existing:readonly AssetRecord[]=[]):AssetImportPreview{
  if(csv.length>1024*1024)return {rows:[],issues:["CSV exceeds 1 MiB preview limit"],totalRows:0};
  const rows=parseCsvCells(csv.replace(/^\uFEFF/,""));
  if(!rows||!rows.length)return {rows:[],issues:["CSV is empty or malformed"],totalRows:0};
  const header=rows[0]!.map(h=>h.trim());
  if(header.length!==CSV_COLUMNS.length||header.some((h,i)=>h!==CSV_COLUMNS[i]))return {rows:[],issues:[`Expected columns: ${CSV_COLUMNS.join(", ")}`],totalRows:Math.max(0,rows.length-1)};
  if(rows.length>2001)return {rows:[],issues:["CSV preview limited to 2,000 data rows"],totalRows:rows.length-1};
  const candidate:AssetRecord[]=[];const issues:string[]=[];
  for(let i=1;i<rows.length;i++){
    const parts=rows[i]!;
    if(parts.length===1&&parts[0]?.trim()==="")continue;
    if(parts.length!==CSV_COLUMNS.length){issues.push(`Row ${i+1}: unexpected number of columns`);continue;}
    const [id,tag,name,kind,state,parentId,system,functionalLocation]=parts.map(p=>p.trim());
    if(!text(id)||!text(tag)||!text(name)||!ASSET_KINDS.includes(kind as AssetKind)||!ASSET_STATES.includes(state as AssetState)||
      ![parentId,system,functionalLocation].every(v=>v===""||text(v))){issues.push(`Row ${i+1}: invalid asset fields`);continue;}
    candidate.push({id:id!,tag:tag!,name:name!,kind:kind as AssetKind,state:state as AssetState,
      ...(parentId?{parentId}:{}),...(system?{system}:{}),...(functionalLocation?{functionalLocation}:{})});
  }
  const all=[...existing,...candidate];
  if(new Set(all.map(a=>a.id)).size!==all.length)issues.push("Duplicate asset identity in preview or existing register");
  if(new Set(all.map(a=>a.tag.toLocaleLowerCase())).size!==all.length)issues.push("Duplicate asset tag in preview or existing register");
  const ids=new Set(all.map(a=>a.id));
  if(candidate.some(a=>a.parentId!==undefined&&!ids.has(a.parentId)))issues.push("Preview references an unknown parent asset");
  const validated=parseAssetSnapshot({assets:all,relationships:[],history:[]});
  if(!validated.ok)issues.push(...validated.issues.filter(e=>!issues.includes(e)));
  return Object.freeze({rows:Object.freeze(issues.length?[]:candidate.map(a=>Object.freeze(a))),issues:Object.freeze(issues),totalRows:rows.length-1});
}
