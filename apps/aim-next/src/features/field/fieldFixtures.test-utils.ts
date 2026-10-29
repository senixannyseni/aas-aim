/** Synthetic FLD fixtures for tests ONLY. No real assets, photos or persisted offline cache. */
import {FIELD_COLLECTIONS} from "./fieldModel";
export const F0="2026-01-01T00:00:00Z",F1="2026-01-02T00:00:00Z",F2="2026-01-03T00:00:00Z";
export function fieldFixture():Record<(typeof FIELD_COLLECTIONS)[number],Record<string,any>[]> {
 const t="test-tenant",r=(id:string,fields:Record<string,unknown>)=>({id,tenantId:t,...fields});
 const v=Object.fromEntries(FIELD_COLLECTIONS.map(k=>[k,[]])) as unknown as Record<(typeof FIELD_COLLECTIONS)[number],Record<string,any>[]>;
 v.workpacks=[r("wp-a",{assetId:"test-asset",siteRef:"test-site",packageRevision:"rev-a",releaseRef:"ins-workpack-release",state:"OFFLINE",assignedTo:"test-inspector",issuedAt:F0,title:"Synthetic field job"})];
 v.assets=[r("asset-a",{workpackId:"wp-a",assetRef:"test-asset",tag:"EQ-TST-001",contextRevision:"rev-context-a",name:"Synthetic equipment"})];
 v.locations=[r("loc-a",{workpackId:"wp-a",assetId:"asset-a",locationRef:"CML-TST-1",label:"Test location",locationRevision:"loc-r1",unit:"mm"})];
 v.confirmations=[r("confirm-a",{workpackId:"wp-a",assetId:"asset-a",locationId:"loc-a",locationRevision:"loc-r1",packageRevision:"rev-a",confirmedBy:"test-inspector",confirmedAt:F1,observedTag:"EQ-TST-001"})];
 v.measurements=[r("measure-a",{workpackId:"wp-a",assetId:"asset-a",locationId:"loc-a",confirmationId:"confirm-a",observedAt:F2,value:6.3,unit:"mm",state:"ACKNOWLEDGED",sourceRef:"capture-source",serverRecordRef:"server-measure-a"})];
 v.checklists=[r("check-a",{workpackId:"wp-a",assetId:"asset-a",confirmationId:"confirm-a",templateRef:"inspection-template",templateRevision:"rev1",answers:[{itemRef:"check-1",answer:"YES",required:true}],state:"DRAFT",sourceRef:"checklist-source"})];
 v.evidence=[r("evidence-a",{workpackId:"wp-a",assetId:"asset-a",confirmationId:"confirm-a",kind:"PHOTO",filename:"test-surface.jpg",capturedAt:F2,state:"CAPTURED",sourceRef:"camera-ref",checksum:"test-checksum"})];
 v.findings=[r("finding-a",{workpackId:"wp-a",assetId:"asset-a",confirmationId:"confirm-a",description:"Synthetic field observation",capturedAt:F2,state:"SYNC_PENDING",sourceRef:"finding-capture",evidenceIds:["evidence-a"]})];
 v.syncBatches=[r("batch-a",{workpackId:"wp-a",state:"PARTIAL",createdAt:F2,sourceRef:"sync-service"})];
 v.syncItems=[r("sync-a",{batchId:"batch-a",workpackId:"wp-a",kind:"MEASUREMENT",localRecordId:"measure-a",state:"ACKNOWLEDGED",sourceRef:"sync-response",serverRecordRef:"server-measure-a"}),r("sync-b",{batchId:"batch-a",workpackId:"wp-a",kind:"FINDING",localRecordId:"finding-a",state:"CONFLICT",sourceRef:"sync-response",conflictId:"conflict-a"})];
 v.conflicts=[r("conflict-a",{syncItemId:"sync-b",localRevision:"capture-r1",serverRevision:"server-r2",state:"OPEN",basisRef:"conflict-comparison"})];
 return v;
}
