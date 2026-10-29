import {describe,expect,it} from "vitest";
import {assetHierarchy,filterAssetRecords,parseAssetSnapshot,previewAssetImport} from "./assetModel";

const fixture=()=>({assets:[
  {id:"eq-1",tag:"V-101",name:"Test Vessel",kind:"EQUIPMENT",state:"ACTIVE",system:"S1",material:"CS"},
  {id:"cp-1",tag:"V-101-A",name:"Test Nozzle",kind:"COMPONENT",state:"UNKNOWN",parentId:"eq-1",functionalLocation:"AREA-A"},
  {id:"eq-2",tag:"P-200",name:"Test Pump",kind:"EQUIPMENT",state:"RETIRED",system:"S2"}
],relationships:[{id:"rel-1",sourceId:"eq-1",targetId:"eq-2",kind:"FEEDS",sourceReference:"drawing-rev-1"}],
 history:[{id:"evt-1",assetId:"eq-1",occurredAt:"2026-10-12T12:30:00Z",description:"Test reference event",sourceReference:"record-1"}]});
const accepted=()=>{const r=parseAssetSnapshot(fixture());if(!r.ok)throw Error(r.issues.join("; "));return r.snapshot;};

describe("AIR runtime snapshot boundary",()=>{
  it("accepts a complete immutable reference snapshot",()=>{
    const result=parseAssetSnapshot(fixture());expect(result.ok).toBe(true);
    if(result.ok){expect(Object.isFrozen(result.snapshot)).toBe(true);expect(Object.isFrozen(result.snapshot.assets[0])).toBe(true);expect(result.snapshot.assets).toHaveLength(3);}
  });
  it("accepts an explicit empty supplied snapshot",()=>{
    const result=parseAssetSnapshot({assets:[],relationships:[],history:[]});expect(result.ok).toBe(true);
    if(result.ok)expect(result.snapshot.assets).toHaveLength(0);
  });
  it.each([undefined,null,{},[],"[]",{assets:[],relationships:[]},{assets:[],relationships:[],history:[],authorization:"admin"}])("rejects missing, malformed or extra envelope fields %#",(input:unknown)=>{
    expect(parseAssetSnapshot(input).ok).toBe(false);
  });
  it("rejects a record with an unexpected identity field",()=>{
    const f=fixture(); const result=parseAssetSnapshot({...f,assets:[{...f.assets[0],tenant:"another-tenant"}]});expect(result.ok).toBe(false);
  });
  it("rejects missing lifecycle instead of inventing ACTIVE",()=>{
    const f=fixture();const {state:_omitted,...asset}=f.assets[0]!;void _omitted;
    expect(parseAssetSnapshot({...f,assets:[asset]}).ok).toBe(false);
  });
  it("does not reinterpret UNKNOWN as absent",()=>{
    const result=accepted();expect(result.assets[1]?.state).toBe("UNKNOWN");
  });
  it("rejects duplicate record ids",()=>{const f=fixture();expect(parseAssetSnapshot({...f,assets:[f.assets[0],f.assets[0]]}).ok).toBe(false);});
  it("rejects duplicate tags regardless of case",()=>{const f=fixture();expect(parseAssetSnapshot({...f,assets:[f.assets[0],{...f.assets[1],tag:"v-101"}]}).ok).toBe(false);});
  it("rejects unknown parent references",()=>{const f=fixture();expect(parseAssetSnapshot({...f,assets:[{...f.assets[0],parentId:"missing"},...f.assets.slice(1)]}).ok).toBe(false);});
  it("rejects direct and indirect hierarchy cycles",()=>{
    const f=fixture();expect(parseAssetSnapshot({...f,assets:[{...f.assets[0],parentId:"eq-1"},...f.assets.slice(1)]}).ok).toBe(false);
    expect(parseAssetSnapshot({...f,assets:[{...f.assets[0],parentId:"cp-1"},f.assets[1],f.assets[2]]}).ok).toBe(false);
  });
  it("rejects relationships with unknown endpoint or missing provenance",()=>{
    const f=fixture();expect(parseAssetSnapshot({...f,relationships:[{...f.relationships[0],targetId:"missing"}]}).ok).toBe(false);
    expect(parseAssetSnapshot({...f,relationships:[{...f.relationships[0],sourceReference:""}]}).ok).toBe(false);
  });
  it("rejects duplicate relationship identities",()=>{const f=fixture();expect(parseAssetSnapshot({...f,relationships:[f.relationships[0],f.relationships[0]]}).ok).toBe(false);});
  it("rejects impossible calendar dates and timestamps",()=>{
    const f=fixture();for(const occurredAt of ["2026-02-30T10:00:00Z","2026-13-01T10:00:00Z","2026-01-01T24:00:00Z"]){
      expect(parseAssetSnapshot({...f,history:[{...f.history[0],occurredAt}]}).ok).toBe(false);
    }
  });

  it("rejects unreferenced or invalid history",()=>{
    const f=fixture();expect(parseAssetSnapshot({...f,history:[{...f.history[0],assetId:"ghost"}]}).ok).toBe(false);
    expect(parseAssetSnapshot({...f,history:[{...f.history[0],occurredAt:"not a timestamp"}]}).ok).toBe(false);
  });
  it("never partially accepts a corrupted batch",()=>{
    const f=fixture();const result=parseAssetSnapshot({...f,assets:[...f.assets,{id:"bad",tag:"<bad>",name:"Test",kind:"FAKE",state:"ACTIVE"}]});
    expect(result.ok).toBe(false);expect("snapshot" in result).toBe(false);
  });
  it("does not mutate its input and clones the result",()=>{
    const f=fixture();const result=parseAssetSnapshot(f);expect(result.ok).toBe(true);
    if(result.ok){expect(result.snapshot.assets[0]).not.toBe(f.assets[0]);expect(f.assets[0]?.tag).toBe("V-101");}
  });
});

describe("AIR search, hierarchy and local preview",()=>{
  it("sorts the supplied records by tag",()=>expect(filterAssetRecords(accepted().assets,{search:"",kind:"ALL",state:"ALL",sort:"TAG_ASC"}).map(a=>a.tag)).toEqual(["P-200","V-101","V-101-A"]));
  it("handles trimmed, case-insensitive multi-term matching",()=>expect(filterAssetRecords(accepted().assets,{search:"  v-101   nozzle ",kind:"ALL",state:"ALL",sort:"TAG_ASC"}).map(a=>a.id)).toEqual(["cp-1"]));
  it("keeps lifecycle UNKNOWN separate from other classifications",()=>expect(filterAssetRecords(accepted().assets,{search:"",kind:"ALL",state:"UNKNOWN",sort:"TAG_ASC"}).map(a=>a.id)).toEqual(["cp-1"]));
  it("filters by equipment type",()=>expect(filterAssetRecords(accepted().assets,{search:"",kind:"EQUIPMENT",state:"ALL",sort:"NAME_ASC"}).map(a=>a.id)).toEqual(["eq-2","eq-1"]));
  it("constructs a physical hierarchy using explicit parent IDs",()=>expect(assetHierarchy(accepted().assets).map(r=>[r.asset.id,r.depth])).toEqual([["eq-2",0],["eq-1",0],["cp-1",1]]));
  it("never invents missing hierarchy rows",()=>expect(assetHierarchy([])).toEqual([]));
});

describe("non-authoritative CSV import preview",()=>{
  const header="id,tag,name,kind,state,parentId,system,functionalLocation\n";
  it("accepts quoted CSV and escaped quotes as staged text",()=>{
    const p=previewAssetImport(header+'eq-3,P-300,"Test ""Pump""",EQUIPMENT,ACTIVE,,S1,AREA-C');
    expect(p.issues).toHaveLength(0);expect(p.rows[0]?.name).toBe('Test "Pump"');
  });
  it("accepts existing parents but returns only staged candidates",()=>{
    const p=previewAssetImport(header+"cp-3,V-101-C,Test flange,COMPONENT,ACTIVE,eq-1,,",accepted().assets);
    expect(p.issues).toHaveLength(0);expect(p.rows).toHaveLength(1);
  });
  it("rejects unrecognized column order",()=>expect(previewAssetImport("tag,id,name,kind,state,parentId,system,functionalLocation\na,b,c,EQUIPMENT,ACTIVE,,,").issues.length).toBeGreaterThan(0));
  it("rejects duplicate ids across existing and new assets",()=>expect(previewAssetImport(header+"eq-1,V-200,Test,EQUIPMENT,ACTIVE,,,",accepted().assets).rows).toHaveLength(0));
  it("rejects duplicate tags across existing and new assets",()=>expect(previewAssetImport(header+"eq-99,v-101,Test,EQUIPMENT,ACTIVE,,,",accepted().assets).rows).toHaveLength(0));
  it("rejects missing referenced parents",()=>expect(previewAssetImport(header+"cp-3,V-101-C,Test,COMPONENT,ACTIVE,ghost,,").rows).toHaveLength(0));
  it("rejects malformed quotes instead of guessing",()=>expect(previewAssetImport(header+'eq-3,P-300,"Broken,EQUIPMENT,ACTIVE,,,').rows).toHaveLength(0));
  it("rejects malformed rows without partially promoting valid rows",()=>expect(previewAssetImport(header+"eq-3,P-300,Test,EQUIPMENT,ACTIVE,,,\ninvalid,line").rows).toHaveLength(0));
  it("treats a header-only file as no candidates",()=>expect(previewAssetImport(header).rows).toHaveLength(0));
  it("limits preview size",()=>expect(previewAssetImport("x".repeat(1024*1024+1)).issues).toHaveLength(1));
  it("does not create a production AssetRecord when staging fails",()=>{
    const result=previewAssetImport(header+"eq-3,P-300,Test,FABRICATED,ACTIVE,,,");expect(result.rows).toHaveLength(0);
  });
});
