/** Synthetic test-only read model; never used by application startup. */
import {ANALYTICS_KEYS} from "./analyticsModel";
export function analyticsFixture():Record<string,Record<string,unknown>[]> {
 const stamp="2026-10-01T10:00:00Z",tenantId="test-tenant";
 const r=(id:string,fields:Record<string,unknown>)=>({id,tenantId,...fields});
 const values:Record<string,Record<string,unknown>[]>=Object.fromEntries(ANALYTICS_KEYS.map(k=>[k,[]]));
 values.quality=[r("q-1",{domain:"RBI",scopeRef:"test-unit",status:"AVAILABLE",asOf:stamp,evidenceRef:"q-evidence",completenessPct:100,missingCount:0}),r("q-2",{domain:"COR",scopeRef:"test-unit",status:"STALE",asOf:stamp,evidenceRef:"stale-data"})];
 values.metrics=[r("metric-1",{name:"Synthetic risk burden",metricType:"RISK",dataState:"APPROVED",quality:"AVAILABLE",asOf:stamp,sourceRef:"metric-basis",methodRevision:"test-1",value:4,unit:"count",qualityId:"q-1"}),r("metric-2",{name:"Synthetic corrosion coverage",metricType:"DATA_CONFIDENCE",dataState:"UNKNOWN",quality:"MISSING",asOf:stamp,sourceRef:"missing-evidence",methodRevision:"test-1"})];
 values.workItems=[r("work-1",{ownerDomain:"INS",objectRef:"test-ins-requirement",kind:"REVIEW",state:"PENDING",sourceRef:"review-queue",asOf:stamp,dueAt:"2026-10-15T10:00:00Z"})];
 values.risks=[r("risk-1",{assetRef:"test-asset",assessmentRef:"assessment-1",methodRevision:"api-rbi-test",asOf:stamp,period:"CURRENT",dataState:"APPROVED",riskBand:"HIGH",quality:"AVAILABLE",sourceRef:"approved-assessment"}),r("risk-2",{assetRef:"test-asset",assessmentRef:"assessment-1",methodRevision:"api-rbi-test",asOf:stamp,period:"FUTURE",dataState:"PROJECTED",riskBand:"VERY_HIGH",quality:"AVAILABLE",sourceRef:"projection"})];
 values.corrosion=[r("cor-1",{circuitRef:"test-circuit",readingSetRef:"test-reading-set",asOf:stamp,dataState:"APPROVED",quality:"AVAILABLE",sourceRef:"cor-approval",methodRevision:"cor-test-1",rateMmPerYear:0.2})];
 values.remainingLife=[r("life-cor",{assetRef:"test-asset",sourceDomain:"COR",sourceRecordRef:"corrosion-set",asOf:stamp,dataState:"APPROVED",quality:"AVAILABLE",sourceRef:"cor-eval",methodRevision:"cor-test",years:6.5}),r("life-ffs",{assetRef:"test-asset",sourceDomain:"FFS",sourceRecordRef:"ffs-assessment",asOf:stamp,dataState:"APPROVED",quality:"AVAILABLE",sourceRef:"ffs-eval",methodRevision:"ffs-test",years:4})];
 values.obligations=[r("obligation-1",{ownerDomain:"INS",objectRef:"inspection-1",assetRef:"test-asset",technicalDueAt:"2026-11-01T00:00:00Z",asOf:stamp,state:"UPCOMING",sourceRef:"ins-governing",authorizedExecutionDeadline:"2026-12-01T00:00:00Z",authorizationRef:"act-authorization"})];
 values.badActors=[r("bad-1",{assetRef:"test-asset",rank:1,scoreBasisRef:"score-trace",methodRevision:"bad-test",windowStart:"2026-01-01T00:00:00Z",windowEnd:stamp,contributingSources:["finding-1"],dataState:"APPROVED",quality:"AVAILABLE"})];
 values.forecasts=[r("forecast-1",{horizonStart:stamp,horizonEnd:"2027-01-01T00:00:00Z",workloadType:"INSPECTION",projectedCount:12,sourceRef:"forecast-data",methodRevision:"model-test",dataState:"PROJECTED",confidence:"LOW"})];
 values.reports=[r("report-1",{title:"Synthetic quality report",semanticModelRef:"semantic-model-v1",definitionRevision:"rev-test",state:"ACTIVE",ownerRef:"test-principal",sourceRef:"report-definition"})];
 values.executions=[r("execution-1",{reportId:"report-1",executedAt:stamp,state:"COMPLETED",sourceRef:"execution-audit",rowCount:4,resultRef:"execution-result"})];
 return values;
}
