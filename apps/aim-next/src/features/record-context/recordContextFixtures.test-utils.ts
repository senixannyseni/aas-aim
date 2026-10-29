/** Synthetic-only fixtures, never imported by production application files. */
export function recordContextFixture():Record<string,unknown>{return {
 scopeKey:"scope-alpha",
 records:[
  {id:"rbi-search-1",objectRef:"RBI-DEMO-01",domain:"RBI",screenId:"SCR-RBI-002",title:"Synthetic RBI assessment",revision:"rev-2",state:"APPROVED",sourceRef:"rbi-source-v2",assetId:"asset-1"},
  {id:"ins-search-1",objectRef:"INS-DEMO-01",domain:"INS",screenId:"SCR-INS-002",title:"Synthetic inspection requirement",revision:"rev-1",state:"PROJECTED",sourceRef:"ins-source-v1",assetId:"asset-2"},
  {id:"cor-search-1",objectRef:"CML-DEMO-01",domain:"COR",screenId:"SCR-COR-003",title:"Synthetic thickness reading",revision:"rev-7",state:"STALE",sourceRef:"cor-reading-v7",assetId:"asset-1"}
 ],
 revisions:[
  {id:"revision-rbi-1",recordId:"rbi-search-1",revision:"rev-1",changedAt:"2026-08-01T10:00:00Z",changeRef:"change-old",sourceRef:"rbi-source-v1",reviewState:"CONFIRMED",reviewerRef:"engineer-old",reviewedAt:"2026-08-03T10:00:00Z"},
  {id:"revision-rbi-2",recordId:"rbi-search-1",revision:"rev-2",changedAt:"2026-09-01T10:00:00Z",changeRef:"change-new",sourceRef:"rbi-source-v2",reviewState:"CONFIRMED",reviewerRef:"engineer-new",reviewedAt:"2026-09-03T10:00:00Z",priorRevisionId:"revision-rbi-1"},
  {id:"revision-ins-1",recordId:"ins-search-1",revision:"rev-1",changedAt:"2026-09-02T10:00:00Z",changeRef:"inspection-baseline",sourceRef:"ins-source-v1",reviewState:"PENDING"},
  {id:"revision-cor-7",recordId:"cor-search-1",revision:"rev-7",changedAt:"2026-09-15T10:00:00Z",changeRef:"cor-measurement",sourceRef:"cor-reading-v7",reviewState:"UNKNOWN"}
 ],
 evidence:[
  {id:"evidence-rbi-1",recordId:"rbi-search-1",revisionId:"revision-rbi-2",evidenceRef:"EDMS-RBI-01",sourceRef:"edms-source-01",kind:"SOURCE",state:"APPROVED",recordedAt:"2026-09-02T12:00:00Z",sha256:"a".repeat(64)},
  {id:"evidence-cor-1",recordId:"cor-search-1",revisionId:"revision-cor-7",evidenceRef:"EDMS-COR-07",sourceRef:"edms-source-07",kind:"FIELD",state:"STALE",recordedAt:"2026-09-15T12:00:00Z"}
 ],
 relations:[
  {id:"relation-rbi-ins",fromRecordId:"rbi-search-1",toRecordId:"ins-search-1",kind:"RESULTS_IN",basisRef:"basis-001",recordedAt:"2026-09-04T10:00:00Z"},
  {id:"relation-rbi-cor",fromRecordId:"rbi-search-1",toRecordId:"cor-search-1",kind:"DERIVES_FROM",basisRef:"basis-002",recordedAt:"2026-09-16T10:00:00Z"}
 ]
};}
