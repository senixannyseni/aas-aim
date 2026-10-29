/** VIS-003–008. Visual context is a source-backed projection, never an asset or engineering authority. */
export const VIS_COLLECTIONS = ["sources","assets","mappings","overlays","alignments","reviews"] as const;
export type VisCollection = typeof VIS_COLLECTIONS[number];
export type VisRecord = Readonly<Record<string,unknown> & {id:string;tenantId:string}>;
export type VisSnapshot = Readonly<Record<VisCollection,readonly VisRecord[]>>;
export type VisParseResult = Readonly<{ok:true;snapshot:VisSnapshot}>|Readonly<{ok:false;issues:readonly string[]}>;
export const EMPTY_VIS:VisSnapshot = Object.freeze(Object.fromEntries(VIS_COLLECTIONS.map(k=>[k,Object.freeze([])])) as unknown as Record<VisCollection,readonly VisRecord[]>);
export const VIS_STATES = ["APPROVED","PROJECTED","SCENARIO","UNKNOWN","STALE"] as const;
export type VisState = typeof VIS_STATES[number];
export const VIS_KINDS = ["PID","DRAWING_2D","MODEL_3D","GIS"] as const;
export type VisKind = typeof VIS_KINDS[number];
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const text=(v:unknown):v is string=>typeof v==="string"&&v.trim()===v&&v.length>0&&v.length<=1024&&!/[\u0000-\u001f\u007f]/.test(v);
const bounded=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
const enumerated=(choices:readonly string[])=>(v:unknown)=>typeof v==="string"&&choices.includes(v);
const stamp=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))&&(()=>{const m=/^(\d{4})-(\d{2})-(\d{2})T/.exec(v);if(!m)return false;const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);return y>0&&mo>0&&mo<=12&&d>0&&d<=new Date(Date.UTC(y,mo,0)).getUTCDate();})();
const domain=enumerated(["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","ANA"]);
type Spec=Readonly<{required:readonly string[];optional?:readonly string[];check:Readonly<Record<string,(v:unknown)=>boolean>>}>;
const schema:Record<VisCollection,Spec>={
 sources:{required:["id","tenantId","label","kind","revision","sourceRef","status","observedAt"],optional:["supersededByRef"],check:{id:text,tenantId:text,label:text,kind:enumerated(VIS_KINDS),revision:text,sourceRef:text,status:enumerated(["CURRENT","SUPERSEDED","UNAVAILABLE"]),observedAt:stamp,supersededByRef:text}},
 assets:{required:["id","tenantId","tag","assetClass"],optional:["name"],check:{id:text,tenantId:text,tag:text,assetClass:enumerated(["EQUIPMENT","COMPONENT","CML","SYSTEM","LOCATION"]),name:text}},
 mappings:{required:["id","tenantId","sourceId","sourceRevision","externalObjectRef","state"],optional:["assetId","x","y","verifiedBy","verifiedAt","reviewRef","invalidatedAt","reasonRef"],check:{id:text,tenantId:text,sourceId:text,sourceRevision:text,externalObjectRef:text,state:enumerated(["PENDING","VERIFIED","AMBIGUOUS","INVALIDATED"]),assetId:text,x:bounded,y:bounded,verifiedBy:text,verifiedAt:stamp,reviewRef:text,invalidatedAt:stamp,reasonRef:text}},
 overlays:{required:["id","tenantId","mappingId","sourceDomain","engineeringRef","engineeringRevision","kind","state","label","observedAt"],optional:["basisRef","approvalRef","approvedAt","scenarioRef","staleAt"],check:{id:text,tenantId:text,mappingId:text,sourceDomain:domain,engineeringRef:text,engineeringRevision:text,kind:enumerated(["INTEGRITY","RISK","STATUS"]),state:enumerated(VIS_STATES),label:text,observedAt:stamp,basisRef:text,approvalRef:text,approvedAt:stamp,scenarioRef:text,staleAt:stamp}},
 alignments:{required:["id","tenantId","sourceId","sourceRevision","state","basisRef"],optional:["verifiedBy","verifiedAt","reviewRef"],check:{id:text,tenantId:text,sourceId:text,sourceRevision:text,state:enumerated(["ALIGNED","MISALIGNED","UNKNOWN","STALE"]),basisRef:text,verifiedBy:text,verifiedAt:stamp,reviewRef:text}},
 reviews:{required:["id","tenantId","mappingId","mappingState","decision","reviewedBy","reviewedAt","basisRef"],check:{id:text,tenantId:text,mappingId:text,mappingState:enumerated(["PENDING","VERIFIED","AMBIGUOUS","INVALIDATED"]),decision:enumerated(["VERIFY","INVALIDATE","FLAG_AMBIGUITY","REVIEW_ONLY"]),reviewedBy:text,reviewedAt:stamp,basisRef:text}}
};
function fail(issues:readonly string[]):VisParseResult {return Object.freeze({ok:false as const,issues:Object.freeze([...issues])});}
function val(r:VisRecord,k:string):string{return String(r[k]);}
function date(r:VisRecord,k:string):number{return Date.parse(val(r,k));}
function complete(r:VisRecord,keys:readonly string[]):boolean{return keys.every(k=>own(r,k));}
function absent(r:VisRecord,keys:readonly string[]):boolean{return keys.every(k=>!own(r,k));}
const copies=(v:Record<string,unknown>):VisRecord=>Object.freeze({...v}) as VisRecord;
/** Atomic, bounded, schema-exact, tenant-consistent validation. Never silently repair an authority claim. */
export function parseVisSnapshot(value:unknown):VisParseResult{
 if(!plain(value)||Object.keys(value).length!==VIS_COLLECTIONS.length||VIS_COLLECTIONS.some(k=>!Array.isArray(value[k]))||Object.keys(value).some(k=>!VIS_COLLECTIONS.includes(k as VisCollection)))return fail(["Invalid VIS snapshot structure"]);
 const issues:string[]=[];const output={} as Record<VisCollection,readonly VisRecord[]>;const identities=new Set<string>();let tenant="";
 for(const key of VIS_COLLECTIONS){const rows=value[key] as unknown[];const accepted:VisRecord[]=[];
  if(rows.length>10000){issues.push(`${key}: collection exceeds bound`);output[key]=Object.freeze([]);continue;}
  const spec=schema[key];for(let i=0;i<rows.length;i++){
   const raw=rows[i];if(!plain(raw)||spec.required.some(k=>!own(raw,k))||Object.keys(raw).some(k=>!spec.required.includes(k)&&!(spec.optional??[]).includes(k))||Object.entries(spec.check).some(([k,fn])=>own(raw,k)&&!fn(raw[k]))){issues.push(`${key}[${i}]: invalid record`);continue;}
   const r=copies(raw);const identity=`${key}\u0000${r.id}`;if(identities.has(identity))issues.push(`${key}: duplicate identity ${r.id}`);identities.add(identity);
   if(!tenant)tenant=r.tenantId;else if(tenant!==r.tenantId)issues.push(`${key}: tenant mismatch`);
   accepted.push(r);
  }output[key]=Object.freeze(accepted);
 }
 const by=(key:VisCollection)=>new Map(output[key].map(r=>[r.id,r]));const src=by("sources"),asset=by("assets"),mapping=by("mappings"),reviews=by("reviews");
 for(const s of output.sources){if(val(s,"status")==="SUPERSEDED"&&!complete(s,["supersededByRef"]))issues.push(`source ${s.id}: supersession reference missing`);else if(val(s,"status")!=="SUPERSEDED"&&!absent(s,["supersededByRef"]))issues.push(`source ${s.id}: unexpected supersession reference`);}
 for(const m of output.mappings){const s=src.get(val(m,"sourceId"));if(!s||val(s,"revision")!==val(m,"sourceRevision"))issues.push(`mapping ${m.id}: source or revision mismatch`);
  if(complete(m,["assetId"])&&!asset.has(val(m,"assetId")))issues.push(`mapping ${m.id}: unknown asset`);
  if(complete(m,["x"])!==complete(m,["y"]))issues.push(`mapping ${m.id}: incomplete plotting coordinates`);
  if(val(m,"state")==="VERIFIED" && (!complete(m,["assetId","verifiedBy","verifiedAt","reviewRef"])||!absent(m,["invalidatedAt","reasonRef"])||s?.status!=="CURRENT"))issues.push(`mapping ${m.id}: unsupported verification`);
  if(val(m,"state")==="INVALIDATED"&&(!complete(m,["invalidatedAt","reasonRef"])||!absent(m,["verifiedAt","verifiedBy","reviewRef"])||!reviews.has(val(m,"reasonRef"))))issues.push(`mapping ${m.id}: invalidation provenance missing`);
  if(["PENDING","AMBIGUOUS"].includes(val(m,"state"))&&!absent(m,["verifiedAt","verifiedBy","reviewRef","invalidatedAt","reasonRef"]))issues.push(`mapping ${m.id}: unresolved state carries decision metadata`);
 }
 for(const a of output.alignments){const s=src.get(val(a,"sourceId"));if(!s||val(a,"sourceRevision")!==val(s,"revision")||!["MODEL_3D","GIS","DRAWING_2D","PID"].includes(val(s,"kind")))issues.push(`alignment ${a.id}: source revision mismatch`);
  if(a.state==="ALIGNED"&&(!complete(a,["verifiedBy","verifiedAt","reviewRef"])||s?.status!=="CURRENT"))issues.push(`alignment ${a.id}: unsupported verified alignment`);
  if(a.state!=="ALIGNED"&&!absent(a,["verifiedBy","verifiedAt","reviewRef"]))issues.push(`alignment ${a.id}: unverified alignment carries approval`);
 }
 const currentAligned=(sourceId:string)=>output.alignments.some(a=>a.sourceId===sourceId&&a.state==="ALIGNED");
 for(const o of output.overlays){const m=mapping.get(val(o,"mappingId")),s=m?src.get(val(m,"sourceId")):undefined;
  if(!m||m.state!=="VERIFIED"||!s||s.status!=="CURRENT")issues.push(`overlay ${o.id}: requires current verified visual mapping`);
  if(s&&["MODEL_3D","GIS"].includes(val(s,"kind"))&&!currentAligned(s.id))issues.push(`overlay ${o.id}: spatial alignment unverified`);
  if(o.state==="APPROVED" && (!complete(o,["basisRef","approvalRef","approvedAt"])||!absent(o,["scenarioRef","staleAt"])||date(o,"approvedAt")<date(o,"observedAt")))issues.push(`overlay ${o.id}: approval provenance missing`);
  if(o.state==="SCENARIO"&&(!complete(o,["scenarioRef"])||!absent(o,["approvalRef","approvedAt","staleAt"])))issues.push(`overlay ${o.id}: scenario provenance invalid`);
  if(o.state==="STALE"&&(!complete(o,["staleAt"])||!absent(o,["approvalRef","approvedAt","scenarioRef"])||date(o,"staleAt")<date(o,"observedAt")))issues.push(`overlay ${o.id}: stale provenance invalid`);
  if(["PROJECTED","UNKNOWN"].includes(val(o,"state"))&&!absent(o,["approvalRef","approvedAt","scenarioRef","staleAt"]))issues.push(`overlay ${o.id}: projection must not carry decision provenance`);
  if(o.state!=="APPROVED"&&own(o,"approvalRef"))issues.push(`overlay ${o.id}: approval attached to nonapproved result`);
 }
 for(const r of output.reviews){const m=mapping.get(val(r,"mappingId"));if(!m||val(r,"mappingState")!==val(m,"state"))issues.push(`mapping review ${r.id}: state reference mismatch`);
  if(r.decision==="VERIFY"&&m?.state!=="VERIFIED")issues.push(`mapping review ${r.id}: verification not current`);
  if(r.decision==="INVALIDATE"&&m?.state!=="INVALIDATED")issues.push(`mapping review ${r.id}: invalidation not current`);
  if(r.decision==="FLAG_AMBIGUITY"&&m?.state!=="AMBIGUOUS")issues.push(`mapping review ${r.id}: ambiguity not current`);
  if(m&&r.decision==="VERIFY"&&(m.reviewRef!==r.id||m.verifiedBy!==r.reviewedBy||m.verifiedAt!==r.reviewedAt))issues.push(`mapping review ${r.id}: mismatched verification record`);
  if(m&&r.decision==="INVALIDATE"&&m.invalidatedAt!==r.reviewedAt)issues.push(`mapping review ${r.id}: invalidation timestamp mismatch`);
 }
 for(const m of output.mappings)if(m.state==="VERIFIED"&&(reviews.get(val(m,"reviewRef"))?.decision!=="VERIFY"||reviews.get(val(m,"reviewRef"))?.mappingId!==m.id))issues.push(`mapping ${m.id}: missing independent verification review`);
 for(const m of output.mappings)if(m.state==="INVALIDATED"&&(reviews.get(val(m,"reasonRef"))?.decision!=="INVALIDATE"||reviews.get(val(m,"reasonRef"))?.mappingId!==m.id))issues.push(`mapping ${m.id}: invalidation review mismatch`);
 const alignmentKeys=new Set<string>();for(const a of output.alignments){const k=val(a,"sourceId");if(alignmentKeys.has(k))issues.push(`alignment ${a.id}: duplicate source alignment`);alignmentKeys.add(k);}
 if(issues.length)return fail(issues);
 return Object.freeze({ok:true as const,snapshot:Object.freeze(output)});
}
export function visRows(snapshot:VisSnapshot,collection:VisCollection,query=""):readonly VisRecord[]{const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return snapshot[collection].filter(r=>terms.every(t=>Object.values(r).some(v=>String(v).toLocaleLowerCase().includes(t))));}
export function sourceVisualContext(snapshot:VisSnapshot,sourceId:string){const source=snapshot.sources.find(r=>r.id===sourceId);const mappings=snapshot.mappings.filter(m=>m.sourceId===sourceId);const mappingIds=new Set(mappings.map(m=>m.id));return {source,mappings,overlays:snapshot.overlays.filter(o=>mappingIds.has(String(o.mappingId))),alignment:snapshot.alignments.find(a=>a.sourceId===sourceId)} as const;}
export function visibleOverlayReadouts(snapshot:VisSnapshot,sourceId:string,states:readonly VisState[]=VIS_STATES){const c=sourceVisualContext(snapshot,sourceId);return c.source?.status==="CURRENT"?c.overlays.filter(o=>states.includes(o.state as VisState)):[];}
