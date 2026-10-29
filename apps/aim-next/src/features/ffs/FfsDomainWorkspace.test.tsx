// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {FfsDomainWorkspace} from "./FfsDomainWorkspace";
import {EMPTY_FFS} from "./ffsModel";
import {ffsFixture,reassessmentFixture} from "./ffsFixtures.test-utils";
afterEach(cleanup);
function mount(screenId:string,snapshot:unknown=ffsFixture(),onNavigate=vi.fn()){return render(<FfsDomainWorkspace screenId={screenId} snapshot={snapshot} onNavigate={onNavigate}/>);}
function choose(id="ffs-1"){fireEvent.change(screen.getByRole("combobox",{name:"Select assessment"}),{target:{value:id}});}
function tab(name:string){fireEvent.click(screen.getByRole("tab",{name}));}
describe("FFS disconnected and fail-closed boundary",()=>{
 it("starts without any implied fitness or remaining life",()=>{mount("SCR-FFS-001",null);expect(screen.getByRole("status").textContent).toContain("Missing records do not establish asset fitness");expect(screen.getByText("No matching assessments")).toBeTruthy();});
 it("displays authorized empty data without invented assessment",()=>{mount("SCR-FFS-002",EMPTY_FFS);expect(screen.getByText("Select an FFS assessment")).toBeTruthy();});
 it("rejects entire malformed snapshot and hides its good records",()=>{const d=ffsFixture();d.results[0]!.traceRef="";mount("SCR-FFS-001",d);expect(screen.getByRole("alert").textContent).toContain("FFS snapshot rejected");expect(screen.queryByText("TEST-FFS-001")).toBeNull();});
 it("does not assume unknown screen is an authorized workflow",()=>{mount("SCR-FFS-999");expect(screen.getByText("Unknown FFS screen")).toBeTruthy();});
});
describe("SCR-FFS-001 — assessment register",()=>{
 it("shows controlled records and revisions",()=>{mount("SCR-FFS-001");const t=screen.getByRole("region",{name:"FFS assessment register"});expect(within(t).getByText("TEST-FFS-001")).toBeTruthy();expect(within(t).getByText("TEST-FFS-002")).toBeTruthy();});
 it("filters by status",()=>{mount("SCR-FFS-001");fireEvent.change(screen.getByRole("combobox",{name:"Assessment state"}),{target:{value:"DRAFT"}});expect(screen.getByText("TEST-FFS-002")).toBeTruthy();expect(screen.queryByText("TEST-FFS-001")).toBeNull();});
 it("filters by code and assessment title",()=>{mount("SCR-FFS-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search assessments"}),{target:{value:"test-ffs-001 shell"}});expect(screen.getByText("TEST-FFS-001")).toBeTruthy();});
 it("displays no fitness inference for no matching results",()=>{mount("SCR-FFS-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search assessments"}),{target:{value:"absent"}});expect(screen.getByText("No matching assessments")).toBeTruthy();});
 it("inspects source-backed method and approval",()=>{mount("SCR-FFS-001");fireEvent.click(screen.getByRole("button",{name:"Inspect TEST-FFS-001"}));expect(screen.getByText("method-1")).toBeTruthy();});
 it("opens assessment workspace",()=>{const go=vi.fn();mount("SCR-FFS-001",ffsFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Inspect TEST-FFS-001"}));fireEvent.click(screen.getByRole("button",{name:"Open FFS assessment ↗"}));expect(go).toHaveBeenCalledWith("SCR-FFS-002");});
});
describe("SCR-FFS-002 — assessment workspace",()=>{
 it("requires explicit assessment selection",()=>{mount("SCR-FFS-002");expect(screen.getByText("Select an FFS assessment")).toBeTruthy();});
 it("shows independent method, procedure and basis",()=>{mount("SCR-FFS-002");choose();expect(screen.getByText("method-1")).toBeTruthy();expect(screen.getByText("procedure-1")).toBeTruthy();});
 it("shows frozen input source and quality",()=>{mount("SCR-FFS-002");choose();tab("FROZEN INPUTS");const t=screen.getByRole("region",{name:"FFS source inputs"});expect(within(t).getByText("nde-1")).toBeTruthy();expect(within(t).getAllByText("VALID").length).toBeGreaterThan(0);});
 it("preserves invalid quality as unknown for draft source",()=>{mount("SCR-FFS-002");choose("ffs-2");tab("FROZEN INPUTS");expect(screen.getByText("UNKNOWN")).toBeTruthy();});
 it("shows flaw characterization with source identity",()=>{mount("SCR-FFS-002");choose();tab("FLAW CHARACTERIZATION");expect(screen.getByText("LOCAL_METAL_LOSS")).toBeTruthy();expect(screen.getByText("flaw-basis-1")).toBeTruthy();});
 it("shows conditional fitness decision, not inferred safety",()=>{mount("SCR-FFS-002");choose();tab("CALCULATION & FITNESS");expect(screen.getByText("CONDITIONAL")).toBeTruthy();expect(screen.getByText(/FIT, CONDITIONAL, NOT FIT/)).toBeTruthy();});
 it("keeps FFS remaining life distinct from COR life",()=>{mount("SCR-FFS-002");choose();tab("REMAINING LIFE & ENVELOPE");expect(screen.getByText(/FFS remaining life is an FFS engineering conclusion/)).toBeTruthy();expect(screen.getByText("ffs-life-1")).toBeTruthy();});
 it("exposes independent conditions and due candidate, not INS date",()=>{mount("SCR-FFS-002");choose();tab("CONDITIONS & INSPECTION");expect(screen.getByText("ffs-due-candidate")).toBeTruthy();expect(screen.getByText(/INS-016 remains responsible/)).toBeTruthy();});
 it("shows no fitness result for incomplete draft",()=>{mount("SCR-FFS-002");choose("ffs-2");tab("CALCULATION & FITNESS");expect(screen.getByText("No source-backed result")).toBeTruthy();});
 it("preserves historical approval label on reassessment",()=>{mount("SCR-FFS-002",reassessmentFixture());choose();expect(screen.getByText(/Reassessment required/)).toBeTruthy();tab("CALCULATION & FITNESS");expect(screen.getByText("HISTORICAL APPROVED")).toBeTruthy();});
 it("keeps approval and calculation unavailable",()=>{mount("SCR-FFS-002");choose();tab("TRACE & APPROVAL");expect((screen.getByRole("button",{name:"Approve FFS-010 unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Run FFS-005 evaluation unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("allows clearing local notes without submission",()=>{mount("SCR-FFS-002");choose();tab("TRACE & APPROVAL");const note=screen.getByRole("textbox",{name:/Engineering review note/});fireEvent.change(note,{target:{value:"unsaved only"}});fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("clears local notes on switching controlled record",()=>{mount("SCR-FFS-002");choose();tab("TRACE & APPROVAL");fireEvent.change(screen.getByRole("textbox",{name:/Engineering review note/}),{target:{value:"do not transfer"}});choose("ffs-2");tab("TRACE & APPROVAL");expect((screen.getByRole("textbox",{name:/Engineering review note/}) as HTMLTextAreaElement).value).toBe("");});
 it("routes to scenario without approving",()=>{const go=vi.fn();mount("SCR-FFS-002",ffsFixture(),go);choose();fireEvent.click(screen.getByRole("button",{name:"Open scenario analysis ↗"}));expect(go).toHaveBeenCalledWith("SCR-FFS-003");});
});
describe("SCR-FFS-003 — non-authoritative scenarios",()=>{
 it("shows scenarios but not as approved evaluations",()=>{mount("SCR-FFS-003");expect(screen.getByText("Higher operating load")).toBeTruthy();expect(screen.getAllByText("SCENARIO").length).toBeGreaterThan(0);});
 it("requires deliberate selection",()=>{mount("SCR-FFS-003");expect(screen.getByText("Select a scenario")).toBeTruthy();});
 it("shows source basis and scenario-only results",()=>{mount("SCR-FFS-003");fireEvent.click(screen.getByRole("button",{name:"Inspect scenario Higher operating load"}));expect(screen.getByText("scenario-input-1")).toBeTruthy();expect(screen.getByText("Scenario only")).toBeTruthy();});
 it("keeps scenario promotion disabled",()=>{mount("SCR-FFS-003");fireEvent.click(screen.getByRole("button",{name:"Inspect scenario Higher operating load"}));expect((screen.getByRole("button",{name:"Promote scenario unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("allows unsaved notes to clear",()=>{mount("SCR-FFS-003");fireEvent.click(screen.getByRole("button",{name:"Inspect scenario Higher operating load"}));const n=screen.getByRole("textbox",{name:/Scenario observation/});fireEvent.change(n,{target:{value:"what-if"}});fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((n as HTMLTextAreaElement).value).toBe("");});
 it("can navigate back to controlled assessment",()=>{const go=vi.fn();mount("SCR-FFS-003",ffsFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Inspect scenario Higher operating load"}));fireEvent.click(screen.getByRole("button",{name:"Open controlled assessment ↗"}));expect(go).toHaveBeenCalledWith("SCR-FFS-002");});
 it("does not infer safe outcome when no scenarios",()=>{mount("SCR-FFS-003",EMPTY_FFS);expect(screen.getByText("No scenarios supplied")).toBeTruthy();});
});
