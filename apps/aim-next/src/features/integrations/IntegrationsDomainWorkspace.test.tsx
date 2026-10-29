// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {IntegrationsDomainWorkspace} from "./IntegrationsDomainWorkspace";
import {integrationFixture} from "./integrationsFixtures.test-utils";
import {EMPTY_INTEGRATIONS} from "./integrationsModel";
afterEach(cleanup);
const mount=(id:string,snapshot:unknown=integrationFixture(),onNavigate=vi.fn())=>render(<IntegrationsDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={onNavigate}/>);
const inspect=(id:string)=>fireEvent.click(screen.getByRole("button",{name:`Inspect integration record ${id}`}));
describe("INT source and safe disconnected states",()=>{
 it("shows UNKNOWN instead of successful integration when disconnected",()=>{mount("SCR-INT-006",null);expect(screen.getByRole("status").textContent).toContain("UNKNOWN");expect(screen.queryByText("Synthetic historian")).toBeNull();});
 it("accepts explicit validated empty snapshot",()=>{mount("SCR-INT-001",EMPTY_INTEGRATIONS);expect(screen.queryByRole("status")).toBeNull();expect(screen.getByText(/No systems records/)).toBeTruthy();});
 it("rejects malformed batch entirely",()=>{const v=integrationFixture();v.mappings[0]!.targetField="approvedAt";mount("SCR-INT-004",v);expect(screen.getByRole("alert").textContent).toContain("snapshot rejected");expect(screen.queryByText("COR")).toBeNull();});
 it("rejects credentials accidentally included in source",()=>{const v=integrationFixture();v.connectors[0]!.secret="unsafe";mount("SCR-INT-001",v);expect(screen.getByRole("alert")).toBeTruthy();});
 it("rejects unknown INT screen",()=>{mount("SCR-INT-999");expect(screen.getByText("Unknown canonical INT screen.")).toBeTruthy();});
});
describe("INT canonical six screen integration",()=>{
 const cases:[[string,string],...[string,string][]]=[
  ["SCR-INT-001","Systems & Connectors"],["SCR-INT-002","API & Event Integration"],
  ["SCR-INT-003","Bulk Exchange / Migration"],["SCR-INT-004","Integration Contracts & Mapping"],
  ["SCR-INT-005","Sync / Reconciliation"],["SCR-INT-006","Integration Health & Lineage"]
 ];
 for(const [id,title] of cases)it(`shows ${id}: ${title}`,()=>{mount(id);expect(screen.getByRole("heading",{name:title})).toBeTruthy();expect(screen.getByText(/SOURCE-BACKED INTEGRATION PROJECTION/)).toBeTruthy();});
});
describe("INT systems and versioned integration contracts",()=>{
 it("displays source-defined historian connector context",()=>{mount("SCR-INT-001");expect(screen.getByText("Synthetic historian")).toBeTruthy();expect(within(screen.getByRole("region",{name:"related connectors records"})).getByText("Test historian connector")).toBeTruthy();});
 it("inspects exact system source record",()=>{mount("SCR-INT-001");inspect("system-a");expect(screen.getAllByText("system-a").length).toBeGreaterThan(0);});
 it("searches without generating new records",()=>{mount("SCR-INT-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search systems"}),{target:{value:"missing"}});expect(screen.getByText(/No systems records/)).toBeTruthy();});
 it("opens next canonical INT screen",()=>{const navigate=vi.fn();mount("SCR-INT-001",integrationFixture(),navigate);fireEvent.click(screen.getByRole("button",{name:"Open related INT workspace ↗"}));expect(navigate).toHaveBeenCalledWith("SCR-INT-002");});
 it("separates APIs from subscribed events",()=>{mount("SCR-INT-002");expect(screen.getByText("Test readings API")).toBeTruthy();expect(screen.getByText("ExternalReadingReceived")).toBeTruthy();});
 it("inspects secondary connectors instead of showing a dead button",()=>{mount("SCR-INT-001");inspect("connector-a");expect(screen.getAllByText("rev-1").length).toBeGreaterThan(1);});
 it("retains controlled API schema reference",()=>{mount("SCR-INT-002");inspect("api-a");expect(screen.getByText("test-schema-1")).toBeTruthy();});
 it("does not enable an event publication command",()=>{mount("SCR-INT-002");expect((screen.getByRole("button",{name:"Publish API/event configuration unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
});
describe("INT import staging and owned mapping",()=>{
 it("shows exact staging totals separately",()=>{mount("SCR-INT-003");expect(screen.getAllByText("12").length).toBeGreaterThan(1);expect(screen.getByText("VALIDATED")).toBeTruthy();});
 it("shows dead letters separately from imported results",()=>{mount("SCR-INT-003");expect(screen.getByText("VALIDATION_REJECTED")).toBeTruthy();});
 it("does not enable import promotion",()=>{mount("SCR-INT-003");expect((screen.getByRole("button",{name:"Promote imported batch unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows owning domain without transferring authority",()=>{mount("SCR-INT-004");expect(screen.getByText("COR")).toBeTruthy();expect(screen.getByText(/Inbound mappings to approvals/)).toBeTruthy();});
 it("distinguishes staged from verified mapping",()=>{mount("SCR-INT-004");expect(within(screen.getByRole("region",{name:"related mappings records"})).getByText("VERIFIED")).toBeTruthy();});
 it("keeps mapping activation unavailable",()=>{mount("SCR-INT-004");expect((screen.getByRole("button",{name:"Activate mapping contract unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
});
describe("INT reconciliation, freshness and lineage",()=>{
 it("shows PARTIAL rather than complete reconciliation",()=>{mount("SCR-INT-005");expect(screen.getByText("PARTIAL")).toBeTruthy();});
 it("keeps open conflicts visible",()=>{mount("SCR-INT-005");expect(screen.getByText("REVISION")).toBeTruthy();expect(screen.getByText("OPEN")).toBeTruthy();});
 it("shows source checkpoints and dead letters independently",()=>{mount("SCR-INT-005");expect(screen.getByRole("heading",{name:"Synchronization checkpoints and dead-letter queue"})).toBeTruthy();expect(screen.getByText("VALIDATION_REJECTED")).toBeTruthy();});
 it("inspects conflicts and checkpoint provenance",()=>{mount("SCR-INT-005");inspect("conflict-a");expect(screen.getAllByText("source-a").length).toBeGreaterThan(0);inspect("checkpoint-a");expect(screen.getByText("cursor-a")).toBeTruthy();});
 it("disables conflict resolution",()=>{mount("SCR-INT-005");expect((screen.getByRole("button",{name:"Resolve synchronization conflict unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("does not conflate healthy connection with unknown freshness",()=>{mount("SCR-INT-006");const table=screen.getByRole("region",{name:"health records"});expect(within(table).getByText("CONNECTION")).toBeTruthy();expect(within(table).getByText("FRESHNESS")).toBeTruthy();expect(within(table).getByText("UNKNOWN")).toBeTruthy();});
 it("keeps staging lineage separate from approved domain command",()=>{mount("SCR-INT-006");expect(within(screen.getByRole("region",{name:"related lineage records"})).getByText("STAGED")).toBeTruthy();expect(screen.getByText(/does not establish fresh data/)).toBeTruthy();});
 it("allows clearing a note that was never saved",()=>{mount("SCR-INT-006");const note=screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement;fireEvent.change(note,{target:{value:"do not save"}});expect(note.value).toBe("do not save");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect(note.value).toBe("");});
});
