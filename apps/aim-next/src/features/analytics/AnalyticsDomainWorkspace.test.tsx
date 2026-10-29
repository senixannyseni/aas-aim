// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {AnalyticsDomainWorkspace} from "./AnalyticsDomainWorkspace";
import {analyticsFixture} from "./analyticsFixtures.test-utils";
import {EMPTY_ANALYTICS} from "./analyticsModel";
afterEach(cleanup);
const mount=(screenId:string,snapshot:unknown=analyticsFixture(),onNavigate=vi.fn())=>render(<AnalyticsDomainWorkspace screenId={screenId} snapshot={snapshot} onNavigate={onNavigate}/>);
const inspect=(id:string)=>fireEvent.click(screen.getByRole("button",{name:`Inspect analytics record ${id}`}));
describe("ANA fail-closed projection boundaries",()=>{
 it("shows UNKNOWN when analytics data is disconnected",()=>{mount("SCR-HOM-001",null);expect(screen.getByRole("status").textContent).toContain("UNKNOWN");expect(screen.queryByText("Synthetic risk burden")).toBeNull();});
 it("does not confuse authorized empty snapshot with a disconnected one",()=>{mount("SCR-ANA-001",EMPTY_ANALYTICS);expect(screen.queryByRole("status")).toBeNull();expect(screen.getByText(/No risks records/)).toBeTruthy();});
 it("rejects an invalid record as a whole snapshot",()=>{const data=analyticsFixture();data.metrics![0]!.quality="STALE";mount("SCR-HOM-001",data);expect(screen.getByRole("alert").textContent).toContain("rejected");expect(screen.queryByText("Synthetic risk burden")).toBeNull();});
 it("rejects mixed-tenant records",()=>{const data=analyticsFixture();data.risks![0]!.tenantId="other";mount("SCR-ANA-001",data);expect(screen.getByRole("alert")).toBeTruthy();});
 it("does not expose an unknown navigation target as a valid screen",()=>{mount("SCR-ANA-999");expect(screen.getByText("Unknown canonical ANA/HOM analytics screen.")).toBeTruthy();});
});
describe("ANA canonical screens and HOME read-model integration",()=>{
 const cases:[string,string][]=[
  ["SCR-HOM-001","Enterprise Overview"],["SCR-HOM-002","My Work / Team Attention"],
  ["SCR-ANA-001","Risk Analytics"],["SCR-ANA-002","Corrosion & Remaining-Life Analytics"],
  ["SCR-ANA-003","Obligation / Performance Analytics"],["SCR-ANA-004","Data Confidence"],
  ["SCR-ANA-005","Forward Exposure & Workload"],["SCR-ANA-006","Reports / Query Builder"]
 ];
 for(const [id,title] of cases)it(`shows ${id} ${title}`,()=>{mount(id);expect(screen.getByRole("heading",{name:title})).toBeTruthy();expect(screen.getByText(/GOVERNED ANALYTICS READ MODEL/)).toBeTruthy();});
 it("HOME enterprise shows metric provenance and unknown metrics separately",()=>{mount("SCR-HOM-001");expect(screen.getByText("Synthetic risk burden")).toBeTruthy();expect(screen.getByText("Synthetic corrosion coverage")).toBeTruthy();expect(screen.getAllByText("MISSING").length).toBeGreaterThan(0);});
 it("HOME work queue remains a reference, not an approval",()=>{mount("SCR-HOM-002");expect(screen.getByText("test-ins-requirement")).toBeTruthy();expect((screen.getByRole("button",{name:"Complete engineering review unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("HOME selected work opens owning-domain screen rather than approving from a queue",()=>{const onNavigate=vi.fn();mount("SCR-HOM-002",analyticsFixture(),onNavigate);inspect("work-1");fireEvent.click(screen.getByRole("button",{name:"Open owning domain record context ↗"}));expect(onNavigate).toHaveBeenCalledWith("SCR-INS-001");});
 it("HOME routing opens related owning-domain analysis without approving",()=>{const onNavigate=vi.fn();mount("SCR-HOM-002",analyticsFixture(),onNavigate);fireEvent.click(screen.getByRole("button",{name:"Open related workspace ↗"}));expect(onNavigate).toHaveBeenCalledWith("SCR-ANA-003");});
 it("HOME can filter approved metrics",()=>{mount("SCR-HOM-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search metrics"}),{target:{value:"synthetic risk"}});expect(screen.getByText("Synthetic risk burden")).toBeTruthy();expect(within(screen.getByRole("region",{name:"metrics records"})).queryByText("Synthetic corrosion coverage")).toBeNull();});
});
describe("ANA engineering comparability and safe analytics interactions",()=>{
 it("keeps current/future RBI categories separate",()=>{mount("SCR-ANA-001");expect(screen.getByText("CURRENT")).toBeTruthy();expect(screen.getByText("FUTURE")).toBeTruthy();expect(screen.getByText(/Risk methodology boundaries/)).toBeTruthy();});
 it("inspects risk methodological lineage",()=>{mount("SCR-ANA-001");inspect("risk-1");expect(screen.getAllByText("api-rbi-test").length).toBeGreaterThan(0);});
 it("preserves COR and FFS remaining life as different sources",()=>{mount("SCR-ANA-002");expect(screen.getByText("COR remaining life")).toBeTruthy();expect(screen.getByText("FFS remaining life")).toBeTruthy();inspect("life-cor");expect(screen.getByText("corrosion-set")).toBeTruthy();});
 it("displays independent corrosion history records",()=>{mount("SCR-ANA-002");expect(within(screen.getByRole("region",{name:"related corrosion records"})).getByText("test-circuit")).toBeTruthy();});
 it("keeps technical and authorized execution dates distinct",()=>{mount("SCR-ANA-003");expect(screen.getByText("2026-11-01T00:00:00Z")).toBeTruthy();expect(screen.getByText("2026-12-01T00:00:00Z")).toBeTruthy();});
 it("shows method-backed bad actor ranking",()=>{mount("SCR-ANA-003");inspect("bad-1");expect(screen.getByText("score-trace")).toBeTruthy();});
 it("displays stale quality, never labels it acceptable",()=>{mount("SCR-ANA-004");expect(screen.getByText("STALE")).toBeTruthy();inspect("q-2");expect(screen.getByText("stale-data")).toBeTruthy();});
 it("does not let a user certify data quality",()=>{mount("SCR-ANA-004");expect((screen.getByRole("button",{name:"Certify data quality unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("labels forecast as PROJECTED and shows LOW confidence",()=>{mount("SCR-ANA-005");expect(screen.getByText("PROJECTED")).toBeTruthy();expect(screen.getByText("LOW")).toBeTruthy();});
 it("never turns workload projection into an approved plan",()=>{mount("SCR-ANA-005");expect((screen.getByRole("button",{name:"Commit forecast as work plan unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("uses governed report definitions rather than unrestricted SQL",()=>{mount("SCR-ANA-006");expect(screen.getByText("Synthetic quality report")).toBeTruthy();expect(screen.getByText("semantic-model-v1")).toBeTruthy();});
 it("shows report execution separately from definition",()=>{mount("SCR-ANA-006");expect(within(screen.getByRole("region",{name:"related executions records"})).getByText("COMPLETED")).toBeTruthy();});
 it("prevents report execution without backend authorization",()=>{mount("SCR-ANA-006");expect((screen.getByRole("button",{name:"Run or export authoritative report unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("clears unsaved review notes",()=>{mount("SCR-ANA-001");const textbox=screen.getByRole("textbox",{name:"Unsaved local review note"}) as HTMLTextAreaElement;fireEvent.change(textbox,{target:{value:"Only local"}});expect(textbox.value).toBe("Only local");fireEvent.click(screen.getByRole("button",{name:"Clear note"}));expect(textbox.value).toBe("");});
 it("inspects source record and keeps search local",()=>{mount("SCR-ANA-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search risks"}),{target:{value:"nonexistent"}});expect(screen.getByText(/No risks records/)).toBeTruthy();});
});
