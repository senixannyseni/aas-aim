/** Phase 16 · FLD-001–009. Field projections are not inspection approvals.
 * An offline snapshot is read-only input, not evidence of local persistence.
 */
export const FIELD_COLLECTIONS=["workpacks","assets","locations","confirmations","measurements","checklists","evidence","findings","syncBatches","syncItems","conflicts"] as const;
export type FieldCollection=typeof FIELD_COLLECTIONS[number];
export type FieldRecord=Readonly<{id:string;tenantId:string} & Record<string,unknown>>;
export type FieldSnapshot=Readonly<Record<FieldCollection,readonly FieldRecord[]>>;
export type FieldResult=Readonly<{ok:true;snapshot:FieldSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_FIELD:FieldSnapshot=Object.freeze(Object.fromEntries(FIELD_COLLECTIONS.map(k=>[k,Object.freeze([])])) as unknown as Record<FieldCollection,readonly FieldRecord[]>);
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const ref=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=256&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const freeText=(v:unknown):v is string=>typeof v==="string"&&v.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const enumOf=(list:readonly string[])=>(v:unknown)=>typeof v==="string"&&list.includes(v);
const timestamp=(v:unknown):v is string=>{if(typeof v!=="string"||!/^(\d{4})-(\d\d)-(\d\d)T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v))return false;const d=new Date(v);if(!Number.isFinite(d.getTime()))return false;const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(v)!;return Number(m[1])>0&&Number(m[2])>=1&&Number(m[2])<=12&&Number(m[3])>=1&&Number(m[3])<=new Date(Date.UTC(+m[1]!,+m[2]!,0)).getUTCDate();};
const finite=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<1e12;
const refs=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(ref)&&new Set(v).size===v.length;
const choices=(v:unknown)=>Array.isArray(v)&&v.length<=150&&v.every(x=>plain(x)&&Object.keys(x).every(k=>["itemRef","answer","required"].includes(k))&&ref(x.itemRef)&&["YES","NO","NA","UNANSWERED"].includes(String(x.answer))&&typeof x.required==="boolean")&&new Set(v.map(x=>x.itemRef)).size===v.length;
const workState=["ASSIGNED","DOWNLOADED","OFFLINE","UPDATE_AVAILABLE","WITHDRAWN"];
const itemState=["QUEUED","UPLOADING","ACKNOWLEDGED","REJECTED","CONFLICT","UNKNOWN"];
const packageState=["CAPTURED","DRAFT","SYNC_PENDING","ACKNOWLEDGED","REJECTED"];
type Spec=Readonly<{required:readonly string[];optional?:readonly string[];checks:Readonly<Record<string,(v:unknown)=>boolean>>}>;
const specs:Readonly<Record<FieldCollection,Spec>>={
 workpacks:{required:["id","tenantId","assetId","siteRef","packageRevision","releaseRef","state","assignedTo","issuedAt"],optional:["expiresAt","withdrawnAt","title"],checks:{assetId:ref,siteRef:ref,packageRevision:ref,releaseRef:ref,state:enumOf(workState),assignedTo:ref,issuedAt:timestamp,expiresAt:timestamp,withdrawnAt:timestamp,title:freeText}},
 assets:{required:["id","tenantId","workpackId","assetRef","tag","contextRevision","name"],optional:["componentRef","systemRef"],checks:{workpackId:ref,assetRef:ref,tag:ref,contextRevision:ref,name:freeText,componentRef:ref,systemRef:ref}},
 locations:{required:["id","tenantId","workpackId","assetId","locationRef","label","locationRevision","unit"],optional:["componentRef"],checks:{workpackId:ref,assetId:ref,locationRef:ref,label:ref,locationRevision:ref,unit:ref,componentRef:ref}},
 confirmations:{required:["id","tenantId","workpackId","assetId","packageRevision","confirmedBy","confirmedAt","observedTag"],optional:["locationId","locationRevision"],checks:{workpackId:ref,assetId:ref,packageRevision:ref,confirmedBy:ref,confirmedAt:timestamp,observedTag:ref,locationId:ref,locationRevision:ref}},
 measurements:{required:["id","tenantId","workpackId","assetId","locationId","confirmationId","observedAt","value","unit","state","sourceRef"],optional:["remark","serverRecordRef"],checks:{workpackId:ref,assetId:ref,locationId:ref,confirmationId:ref,observedAt:timestamp,value:finite,unit:ref,state:enumOf(packageState),sourceRef:ref,remark:freeText,serverRecordRef:ref}},
 checklists:{required:["id","tenantId","workpackId","assetId","confirmationId","templateRef","templateRevision","answers","state","sourceRef"],optional:["serverRecordRef"],checks:{workpackId:ref,assetId:ref,confirmationId:ref,templateRef:ref,templateRevision:ref,answers:choices,state:enumOf(packageState),sourceRef:ref,serverRecordRef:ref}},
 evidence:{required:["id","tenantId","workpackId","assetId","confirmationId","kind","filename","capturedAt","state","sourceRef"],optional:["checksum","serverRecordRef","annotation"],checks:{workpackId:ref,assetId:ref,confirmationId:ref,kind:enumOf(["PHOTO","DOCUMENT","ANNOTATION","OTHER"]),filename:ref,capturedAt:timestamp,state:enumOf(packageState),sourceRef:ref,checksum:ref,serverRecordRef:ref,annotation:freeText}},
 findings:{required:["id","tenantId","workpackId","assetId","confirmationId","description","capturedAt","state","sourceRef"],optional:["serverRecordRef","evidenceIds"],checks:{workpackId:ref,assetId:ref,confirmationId:ref,description:freeText,capturedAt:timestamp,state:enumOf(packageState),sourceRef:ref,serverRecordRef:ref,evidenceIds:refs}},
 syncBatches:{required:["id","tenantId","workpackId","state","createdAt","sourceRef"],optional:["completedAt"],checks:{workpackId:ref,state:enumOf(["PENDING","PARTIAL","COMPLETED","FAILED","CONFLICT","UNKNOWN"]),createdAt:timestamp,sourceRef:ref,completedAt:timestamp}},
 syncItems:{required:["id","tenantId","batchId","workpackId","kind","localRecordId","state","sourceRef"],optional:["serverRecordRef","errorCode","conflictId"],checks:{batchId:ref,workpackId:ref,kind:enumOf(["MEASUREMENT","CHECKLIST","EVIDENCE","FINDING"]),localRecordId:ref,state:enumOf(itemState),sourceRef:ref,serverRecordRef:ref,errorCode:ref,conflictId:ref}},
 conflicts:{required:["id","tenantId","syncItemId","localRevision","serverRevision","state","basisRef"],optional:["decisionRef","resolvedAt","reviewerRef"],checks:{syncItemId:ref,localRevision:ref,serverRevision:ref,state:enumOf(["OPEN","UNDER_REVIEW","RESOLVED"]),basisRef:ref,decisionRef:ref,resolvedAt:timestamp,reviewerRef:ref}}
};
const issue=(issues:string[],message:string)=>{if(issues.length<60)issues.push(message);};
export function parseFieldSnapshot(value:unknown):FieldResult{
 const issues:string[]=[];
 if(!plain(value))return {ok:false,issues:["Field snapshot must be a plain object"]};
 for(const k of Object.keys(value))if(!FIELD_COLLECTIONS.includes(k as FieldCollection))issue(issues,`Unknown field collection: ${k}`);
 const output={} as Record<FieldCollection,readonly FieldRecord[]>;
 let tenant:string|undefined;
 for(const key of FIELD_COLLECTIONS){const arr=value[key];if(!Array.isArray(arr)||arr.length>5000){issue(issues,`${key}: expected bounded array`);output[key]=[];continue;}
  const seen=new Set<string>(); const accepted:FieldRecord[]=[];const spec=specs[key];
  for(let i=0;i<arr.length;i++){const raw:unknown=arr[i];if(!plain(raw)){issue(issues,`${key}[${i}]: invalid object`);continue;}
   if(!ref(raw.id)||!ref(raw.tenantId)){issue(issues,`${key}[${i}]: identity missing`);continue;}
   if(seen.has(raw.id)){issue(issues,`${key}: duplicate ${raw.id}`);continue;}seen.add(raw.id);
   if(tenant!==undefined&&tenant!==raw.tenantId)issue(issues,`${key}[${i}]: tenant mismatch`);else tenant=raw.tenantId;
   for(const req of spec.required)if(!own(raw,req))issue(issues,`${key}[${i}]: missing ${req}`);
   for(const field of Object.keys(raw)){
    if(field==="id"||field==="tenantId")continue;
    const check=spec.checks[field];if(!check){issue(issues,`${key}[${i}]: unexpected ${field}`);continue;}
    if(!check(raw[field]))issue(issues,`${key}[${i}]: invalid ${field}`);
   }
   const next:Record<string,unknown>={id:raw.id,tenantId:raw.tenantId};for(const name of [...spec.required,...(spec.optional??[])])if(name!=="id"&&name!=="tenantId"&&own(raw,name)){
    const field=raw[name];next[name]=Array.isArray(field)?Object.freeze(field.map(v=>plain(v)?Object.freeze({...v}):v)):field;
   }
   accepted.push(Object.freeze(next) as FieldRecord);
  }
  output[key]=Object.freeze(accepted);
 }
 if(issues.length)return {ok:false,issues};
 const lookup=(key:FieldCollection)=>new Map(output[key].map(r=>[r.id,r]));
 const packs=lookup("workpacks"),assets=lookup("assets"),locations=lookup("locations"),confs=lookup("confirmations"),batch=lookup("syncBatches"),syncs=lookup("syncItems"),evidence=lookup("evidence");
 const requirePack=(r:FieldRecord,kind:string)=>{const p=packs.get(r.workpackId as string);if(!p)issue(issues,`${kind} ${r.id}: unknown workpack`);return p;};
 const requireAsset=(r:FieldRecord,kind:string)=>{const a=assets.get(r.assetId as string);if(!a||a.workpackId!==r.workpackId)issue(issues,`${kind} ${r.id}: mismatched asset or workpack`);return a;};
 const confirmation=(r:FieldRecord,kind:string)=>{const c=confs.get(r.confirmationId as string);if(!c||c.workpackId!==r.workpackId||c.assetId!==r.assetId)issue(issues,`${kind} ${r.id}: missing matching identity confirmation`);return c;};
 for(const p of output.workpacks){if(p.state==="WITHDRAWN"&&!timestamp(p.withdrawnAt))issue(issues,`workpack ${p.id}: missing withdrawal time`);if(timestamp(p.withdrawnAt)&&Date.parse(p.withdrawnAt)<Date.parse(p.issuedAt as string))issue(issues,`workpack ${p.id}: withdrawn before issued`);}
 for(const a of output.assets)requirePack(a,"asset");
 for(const l of output.locations){requirePack(l,"location");requireAsset(l,"location");}
 for(const c of output.confirmations){const p=requirePack(c,"confirmation"),a=requireAsset(c,"confirmation");if(p&&p.packageRevision!==c.packageRevision)issue(issues,`confirmation ${c.id}: stale package revision`);if(a&&a.tag!==c.observedTag)issue(issues,`confirmation ${c.id}: tag does not match snapshot`);if(p&&Date.parse(c.confirmedAt as string)<Date.parse(p.issuedAt as string))issue(issues,`confirmation ${c.id}: before package issued`);if(p?.state==="WITHDRAWN")issue(issues,`confirmation ${c.id}: withdrawn workpack`);if(c.locationId){const l=locations.get(c.locationId as string);if(!l||l.assetId!==c.assetId||l.workpackId!==c.workpackId||l.locationRevision!==c.locationRevision)issue(issues,`confirmation ${c.id}: mismatched location revision`);}else if(c.locationRevision)issue(issues,`confirmation ${c.id}: revision without location`);}
 for(const m of output.measurements){requirePack(m,"measurement");requireAsset(m,"measurement");const c=confirmation(m,"measurement"),l=locations.get(m.locationId as string);if(!l||l.assetId!==m.assetId||l.workpackId!==m.workpackId||l.unit!==m.unit)issue(issues,`measurement ${m.id}: location/unit mismatch`);if(!c||c.locationId!==m.locationId)issue(issues,`measurement ${m.id}: location not identity-confirmed`);if(c&&Date.parse(m.observedAt as string)<Date.parse(c.confirmedAt as string))issue(issues,`measurement ${m.id}: before identity confirmation`);}
 for(const kind of ["measurements","checklists","evidence","findings"] as const)for(const r of output[kind]){if(r.state==="ACKNOWLEDGED"&&!ref(r.serverRecordRef))issue(issues,`${kind} ${r.id}: acknowledgement requires server identity`);}
 for(const kind of ["checklists","evidence","findings"] as const)for(const r of output[kind]){requirePack(r,kind);requireAsset(r,kind);confirmation(r,kind);if(kind==="checklists"&&r.state==="ACKNOWLEDGED"&&(r.answers as {required:boolean;answer:string}[]).some(x=>x.required&&x.answer==="UNANSWERED"))issue(issues,`checklist ${r.id}: acknowledged with unanswered required item`);if(kind==="findings")for(const evid of (r.evidenceIds as string[]|undefined)??[]){const e=evidence.get(evid);if(!e||e.workpackId!==r.workpackId||e.assetId!==r.assetId)issue(issues,`finding ${r.id}: unrelated evidence`);}}
 for(const b of output.syncBatches){requirePack(b,"batch");if(b.state==="COMPLETED"&&!timestamp(b.completedAt))issue(issues,`batch ${b.id}: completed without timestamp`);if(timestamp(b.completedAt)&&Date.parse(b.completedAt)<Date.parse(b.createdAt as string))issue(issues,`batch ${b.id}: completion before creation`);}
 const sources:Record<string,FieldCollection>={MEASUREMENT:"measurements",CHECKLIST:"checklists",EVIDENCE:"evidence",FINDING:"findings"};
 const syncByConflict=new Map<string,number>();
 for(const item of output.syncItems){const b=batch.get(item.batchId as string);if(!b||b.workpackId!==item.workpackId)issue(issues,`sync item ${item.id}: batch mismatch`);const actual=lookup(sources[item.kind as string]??"findings").get(item.localRecordId as string);if(!actual||actual.workpackId!==item.workpackId)issue(issues,`sync item ${item.id}: missing typed local record`);if(item.state==="ACKNOWLEDGED"&&(!ref(item.serverRecordRef)||actual?.state!=="ACKNOWLEDGED"||actual.serverRecordRef!==item.serverRecordRef))issue(issues,`sync item ${item.id}: inconsistent server acknowledgement`);if(item.state==="CONFLICT"&&!ref(item.conflictId))issue(issues,`sync item ${item.id}: missing conflict reference`);if(item.state!=="CONFLICT"&&item.conflictId)issue(issues,`sync item ${item.id}: conflicting conflict state`);if(ref(item.conflictId))syncByConflict.set(item.conflictId,(syncByConflict.get(item.conflictId)??0)+1);}
 const seenItems=new Set<string>();for(const s of output.syncItems){const key=`${s.kind}:${s.localRecordId}`;if(seenItems.has(key))issue(issues,`sync item ${s.id}: duplicate local payload`);seenItems.add(key);}
 for(const c of output.conflicts){const s=syncs.get(c.syncItemId as string);if(!s||s.conflictId!==c.id||syncByConflict.get(c.id)!==1)issue(issues,`conflict ${c.id}: item linkage mismatch`);if(c.state==="RESOLVED"&&(!ref(c.decisionRef)||!ref(c.reviewerRef)||!timestamp(c.resolvedAt)))issue(issues,`conflict ${c.id}: missing independent resolution basis`);if(c.state!=="RESOLVED"&&(c.decisionRef||c.resolvedAt||c.reviewerRef))issue(issues,`conflict ${c.id}: unsupported resolution`);}
 for(const s of output.syncItems)if(s.state==="CONFLICT"&&!output.conflicts.some(c=>c.id===s.conflictId))issue(issues,`sync item ${s.id}: unresolved missing conflict record`);
 for(const b of output.syncBatches){const members=output.syncItems.filter(s=>s.batchId===b.id);if(b.state==="COMPLETED"&&(!members.length||members.some(s=>s.state!=="ACKNOWLEDGED")))issue(issues,`batch ${b.id}: completion contradicts item states`);if(b.state==="PENDING"&&members.some(s=>["ACKNOWLEDGED","REJECTED","CONFLICT"].includes(s.state as string)))issue(issues,`batch ${b.id}: pending contradicts processed items`);}
 return issues.length?{ok:false,issues}: {ok:true,snapshot:Object.freeze(output)};
}
export function fieldRows(snapshot:FieldSnapshot,key:FieldCollection,query=""):readonly FieldRecord[]{const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return snapshot[key].filter(r=>terms.every(t=>Object.values(r).some(v=>typeof v==="string"&&v.toLocaleLowerCase().includes(t)))).slice().sort((a,b)=>a.id.localeCompare(b.id));}
export function workpackContext(snapshot:FieldSnapshot,id:string){return {workpack:snapshot.workpacks.find(p=>p.id===id),assets:snapshot.assets.filter(a=>a.workpackId===id),locations:snapshot.locations.filter(a=>a.workpackId===id),confirmations:snapshot.confirmations.filter(a=>a.workpackId===id),measurements:snapshot.measurements.filter(a=>a.workpackId===id),checklists:snapshot.checklists.filter(a=>a.workpackId===id),evidence:snapshot.evidence.filter(a=>a.workpackId===id),findings:snapshot.findings.filter(a=>a.workpackId===id)};}
export function syncContext(snapshot:FieldSnapshot,batchId:string){const items=snapshot.syncItems.filter(i=>i.batchId===batchId);return {batch:snapshot.syncBatches.find(b=>b.id===batchId),items,conflicts:snapshot.conflicts.filter(c=>items.some(i=>i.id===c.syncItemId))};}
