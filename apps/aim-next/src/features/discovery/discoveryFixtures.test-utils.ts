/** Synthetic fixtures for tests only. Never used by the runtime entry point. */
export function discoveryFixture():Record<string,unknown>{
 return {scopeKey:"scope-alpha",records:[
  {id:"rbi-search-1",objectRef:"RBI-DEMO-01",objectType:"RBIAssessment",title:"Synthetic RBI assessment",domain:"RBI",screenId:"SCR-RBI-002",state:"APPROVED",revision:"rev-2",sourceRef:"rbi-source-v2",assetId:"asset-1",occurredAt:"2026-10-01T09:00:00Z"},
  {id:"ins-search-1",objectRef:"INS-DEMO-01",objectType:"InspectionRequirement",title:"Synthetic inspection requirement",domain:"INS",screenId:"SCR-INS-002",state:"PROJECTED",revision:"rev-1",sourceRef:"ins-source-v1",assetId:"asset-2"},
  {id:"cor-search-1",objectRef:"CML-DEMO-01",objectType:"ThicknessReading",title:"Synthetic thickness reading",domain:"COR",screenId:"SCR-COR-003",state:"STALE",revision:"rev-7",sourceRef:"cor-reading-v7",assetId:"asset-1"}
 ]};
}
export function discoveryAssetFixture():Record<string,unknown>{return {assets:[
 {id:"asset-1",tag:"DEMO-V101",name:"Synthetic vessel",kind:"EQUIPMENT",state:"ACTIVE",revision:"rev-3"},
 {id:"asset-2",tag:"DEMO-P201",name:"Synthetic pump",kind:"EQUIPMENT",state:"UNKNOWN",revision:"rev-2"}
],relationships:[],history:[]};}
