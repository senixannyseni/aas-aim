// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {SharedRecordDossier} from "./SharedRecordDossier";
import {recordContextFixture} from "./recordContextFixtures.test-utils";
import {discoveryFixture} from "../discovery/discoveryFixtures.test-utils";
import {parseDiscoverySnapshot} from "../discovery/discoveryModel";
afterEach(cleanup);
function discovery(){const r=parseDiscoverySnapshot(discoveryFixture(),"scope-alpha");if(!r.ok)throw Error("invalid discovery test fixture");return r.snapshot.records;}
function mount(snapshot:unknown=recordContextFixture(),scopeKey:string|undefined="scope-alpha",recordIndex=0,visible=discovery()){
 const select=vi.fn();render(<SharedRecordDossier record={discovery()[recordIndex]!} snapshot={snapshot} scopeKey={scopeKey} visibleResults={visible} onSelectRelated={select}/>);return {select};
}
function records(v:Record<string,unknown>,name:string){return v[name] as Record<string,unknown>[];}
describe("Phase 19 shared evidence and revision viewer",()=>{
 it("shows disconnected state, not zero-evidence claim",()=>{mount(null);expect(screen.getByText(/Shared evidence and revision index disconnected/)).toBeTruthy();});
 it("does not reveal records when scope key absent",()=>{
  render(<SharedRecordDossier record={discovery()[0]!} snapshot={recordContextFixture()} visibleResults={discovery()} onSelectRelated={vi.fn()}/>);
  expect(screen.getByRole("alert").textContent).toContain("rejected");
  expect(screen.queryByText("EDMS-RBI-01")).toBeNull();
 });
 it("does not reveal records when source scope differs",()=>{mount(recordContextFixture(),"scope-beta");expect(screen.getByRole("alert")).toBeTruthy();});
 it("rejects invalid context atomically",()=>{const v=recordContextFixture();records(v,"evidence")[1]!.kind="ENGINEERING_COMPLETE";mount(v);expect(screen.getByRole("alert").textContent).toContain("No partial dossier");});
 it("shows clear identity and source revision",()=>{mount();expect(screen.getByText(/SOURCE-BACKED · READ-ONLY · RBI · rev-2/)).toBeTruthy();});
 it("renders source-backed evidence references",()=>{mount();expect(screen.getByText("EDMS-RBI-01")).toBeTruthy();expect(screen.getByText("edms-source-01")).toBeTruthy();});
 it("displays evidence state from source rather than inference",()=>{mount();expect(within(screen.getByLabelText("Evidence references")).getByText("APPROVED")).toBeTruthy();});
 it("discloses claimed digest without claiming content verification",()=>{mount();expect(screen.getByText("a".repeat(64))).toBeTruthy();expect(screen.getByText(/cannot retrieve files, validate file bytes/)).toBeTruthy();});
 it("does not offer download or approval actions",()=>{mount();expect(screen.queryByRole("button",{name:/Download|Approve/i})).toBeNull();});
 it("shows only evidence for selected object",()=>{mount();expect(screen.queryByText("EDMS-COR-07")).toBeNull();});
 it("shows stale evidence as stale",()=>{mount(recordContextFixture(),"scope-alpha",2);expect(screen.getByText("EDMS-COR-07")).toBeTruthy();expect(within(screen.getByLabelText("Evidence references")).getByText("STALE")).toBeTruthy();});
 it("does not manufacture evidence for objects with none supplied",()=>{mount(recordContextFixture(),"scope-alpha",1);expect(screen.getByText(/No evidence references were supplied/)).toBeTruthy();});
 it("navigates to revision history",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByLabelText("Revision history entries")).toBeTruthy();});
 it("marks only source-designated current revision",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText(/rev-2 · Current source revision/)).toBeTruthy();expect(screen.getAllByText("rev-1").length).toBeGreaterThan(0);});
 it("displays predecessor lineage and review information",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText("engineer-new")).toBeTruthy();expect(screen.getByText("change-old")).toBeTruthy();});
 it("never labels revision review as engineering approval",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText(/not an approval credential/)).toBeTruthy();});
 it("shows pending review without implying acceptance",()=>{mount(recordContextFixture(),"scope-alpha",1);fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText("PENDING")).toBeTruthy();});
 it("shows authorized related links",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.getByText(/Synthetic inspection requirement/)).toBeTruthy();expect(screen.getByText(/Synthetic thickness reading/)).toBeTruthy();});
 it("selects an authorized related inspection",()=>{const {select}=mount();fireEvent.click(screen.getByRole("button",{name:"Related records"}));fireEvent.click(screen.getByRole("button",{name:"Inspect related record (INS)"}));expect(select).toHaveBeenCalledWith("ins-search-1");});
 it("withholds relationships for a filtered-out domain",()=>{mount(recordContextFixture(),"scope-alpha",0,discovery().filter(r=>r.domain==="RBI"));fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.getByText(/No related record is available/)).toBeTruthy();});
 it("does not navigate to related records not in the authorized list",()=>{const {select}=mount(recordContextFixture(),"scope-alpha",0,[]);fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.queryByRole("button",{name:/Inspect related record/})).toBeNull();expect(select).not.toHaveBeenCalled();});
 it("re-checks exact source revision before showing related records",()=>{const visible=discovery().map(r=>r.domain==="INS"?{...r,revision:"rev-new"}:r);mount(recordContextFixture(),"scope-alpha",0,visible);fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.queryByRole("button",{name:"Inspect related record (INS)"})).toBeNull();expect(screen.getByRole("button",{name:"Inspect related record (COR)"})).toBeTruthy();});
 it("displays source relationship basis",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.getByText(/basis-001/)).toBeTruthy();});
 it("displays mismatch as withheld, not empty",()=>{const v=recordContextFixture();records(v,"records")[0]!.title="Changed title";mount(v);expect(screen.getByRole("alert").textContent).toContain("mismatched");});
 it("does not fabricate a dossier for source-missing records",()=>{const v=recordContextFixture();records(v,"relations").splice(0,2);records(v,"evidence").splice(0,1);records(v,"revisions").splice(0,2);records(v,"records").splice(0,1);mount(v);expect(screen.getByText(/No shared record dossier supplied/)).toBeTruthy();});
 it("uses pressed-state tabs for keyboard accessible controls",()=>{mount();expect(screen.getByRole("button",{name:"Evidence"}).getAttribute("aria-pressed")).toBe("true");fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.getByRole("button",{name:"Related records"}).getAttribute("aria-pressed")).toBe("true");});
});
