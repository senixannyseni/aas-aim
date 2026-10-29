// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FindingsDomainWorkspace } from "./FindingsDomainWorkspace";
import { findingsFixture } from "./findingsFixtures.test-utils";
import { EMPTY_FINDINGS } from "./findingsModel";
afterEach(cleanup);
type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? {-readonly [K in keyof T]:Mutable<T[K]>} : T;
const mutableFixture=():Mutable<ReturnType<typeof findingsFixture>>=>structuredClone(findingsFixture()) as Mutable<ReturnType<typeof findingsFixture>>;
function mount(id:string, snapshot:unknown=findingsFixture(), onNavigate=vi.fn()){
 return render(<FindingsDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={onNavigate}/>);
}
function chooseFinding(code="finding-test-1"){
 fireEvent.change(screen.getByRole("combobox",{name:"Finding for review"}),{target:{value:code}});
}
function chooseCase(panel?:string){
 fireEvent.change(screen.getByRole("combobox",{name:"Integrity Condition Case"}),{target:{value:"case-test-1"}});
 if(panel)fireEvent.click(screen.getByRole("tab",{name:panel}));
}

describe("FND disconnected / malformed states",()=>{
 it("shows disconnected state without creating operational findings",()=>{mount("SCR-FND-001",null);expect(screen.getByRole("status").textContent).toContain("No authorized FND data source");expect(screen.getByText("No matching findings")).toBeTruthy();});
 it("rejects the entire malformed snapshot",()=>{mount("SCR-FND-001",{...findingsFixture(),findings:[{id:"invalid"}]});expect(screen.getByRole("alert").textContent).toContain("Findings snapshot rejected");expect(screen.queryByText("TEST-ICC-001")).toBeNull();});
 it("accepts a genuinely empty supplied dataset without declaring assets safe",()=>{mount("SCR-FND-001",EMPTY_FINDINGS);expect(screen.getByText("No matching findings")).toBeTruthy();expect(screen.getByText(/does not establish a defect-free asset/i)).toBeTruthy();});
 it("rejects a missing assessment basis in the entire batch",()=>{const f=mutableFixture();f.assessments[0]!.basisRef="";mount("SCR-FND-003",f);expect(screen.getByRole("alert").textContent).toContain("snapshot rejected");});
 it("rejects canonical ID outside the three FND screens",()=>{mount("SCR-FND-999");expect(screen.getByText("Unknown findings screen")).toBeTruthy();});
});

describe("SCR-FND-001 findings register",()=>{
 it("displays separately validated and pending observations",()=>{mount("SCR-FND-001");const region=screen.getByRole("region",{name:"Finding records"});expect(within(region).getByText("TEST-FND-001")).toBeTruthy();expect(within(region).getByText("TEST-FND-002")).toBeTruthy();});
 it("searches by finding code and asset",()=>{mount("SCR-FND-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search findings"}),{target:{value:"TEST-FND-001 TEST-ASSET-1"}});expect(screen.getByText("TEST-FND-001")).toBeTruthy();expect(screen.queryByText("TEST-FND-002")).toBeNull();});
 it("filters by validation state",()=>{mount("SCR-FND-001");fireEvent.change(screen.getByRole("combobox",{name:"Validation state"}),{target:{value:"TRIAGE_PENDING"}});expect(screen.getByText("TEST-FND-002")).toBeTruthy();expect(screen.queryByText("TEST-FND-001")).toBeNull();});
 it("does not collapse unknown severity into low",()=>{mount("SCR-FND-001");fireEvent.change(screen.getByRole("combobox",{name:"Severity"}),{target:{value:"UNKNOWN"}});expect(screen.getByText("TEST-FND-002")).toBeTruthy();expect(screen.queryByText("TEST-FND-001")).toBeNull();});
 it("shows source and validation basis when selecting a finding",()=>{mount("SCR-FND-001");fireEvent.click(screen.getByRole("button",{name:"Inspect finding TEST-FND-001"}));expect(screen.getByText("test-inspection-source")).toBeTruthy();expect(screen.getByText("test-validation-review")).toBeTruthy();});
 it("navigates from the finding to the triage screen",()=>{const nav=vi.fn();mount("SCR-FND-001",findingsFixture(),nav);fireEvent.click(screen.getByRole("button",{name:"Inspect finding TEST-FND-001"}));fireEvent.click(screen.getByRole("button",{name:"Open finding triage ↗"}));expect(nav).toHaveBeenCalledWith("SCR-FND-002");});
 it("searches into an empty matching state without modifying data",()=>{mount("SCR-FND-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search findings"}),{target:{value:"not-present"}});expect(screen.getByText("No matching findings")).toBeTruthy();});
});

describe("SCR-FND-002 finding triage and validation",()=>{
 it("requires an explicit observation selection",()=>{mount("SCR-FND-002");expect(screen.getByText("Select an observation")).toBeTruthy();});
 it("shows source evidence and precise validation state",()=>{mount("SCR-FND-002");chooseFinding();expect(screen.getByText("test-evidence-1")).toBeTruthy();expect(screen.getByText("test-validation-review")).toBeTruthy();});
 it("does not imply that pending observation has evidence",()=>{mount("SCR-FND-002");chooseFinding("finding-test-2");expect(screen.getByText("No evidence linked")).toBeTruthy();expect(screen.getByText(/Missing evidence is not proof/)).toBeTruthy();});
 it("shows source-backed case links and navigation",()=>{const nav=vi.fn();mount("SCR-FND-002",findingsFixture(),nav);chooseFinding();fireEvent.click(screen.getByRole("button",{name:/TEST-ICC-001.*Open condition cases/i}));expect(nav).toHaveBeenCalledWith("SCR-FND-003");});
 it("keeps triage notes local and clearable",()=>{mount("SCR-FND-002");chooseFinding();const note=screen.getByRole("textbox",{name:/Review observation/});fireEvent.change(note,{target:{value:"Synthetic draft only"}});expect((note as HTMLTextAreaElement).value).toBe("Synthetic draft only");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("disables protected validation and case creation",()=>{mount("SCR-FND-002");chooseFinding();expect((screen.getByRole("button",{name:"Validate finding unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Create condition case unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
});

describe("SCR-FND-003 condition case",()=>{
 it("requires case selection without inventing technical status",()=>{mount("SCR-FND-003");expect(screen.getByText("Select a condition case")).toBeTruthy();});
 it("displays the source-backed assessment basis",()=>{mount("SCR-FND-003");chooseCase();expect(screen.getByText("test-condition-basis")).toBeTruthy();expect(screen.getByText("test-engineering-approval")).toBeTruthy();});
 it("keeps FND-009 approval unavailable",()=>{mount("SCR-FND-003");chooseCase();expect((screen.getByRole("button",{name:"Approve FND-009 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows linked finding and evidence provenance",()=>{mount("SCR-FND-003");chooseCase("EVIDENCE");const region=screen.getByRole("region",{name:"Case finding evidence"});expect(within(region).getByText("TEST-FND-001")).toBeTruthy();expect(within(region).getByText("test-inspection-source")).toBeTruthy();});
 it("separates authorized disposition from assessment state",()=>{mount("SCR-FND-003");chooseCase("DISPOSITION");expect(screen.getByText("test-disposition-basis")).toBeTruthy();expect(screen.getByText("AUTHORIZED")).toBeTruthy();expect((screen.getByRole("button",{name:"Authorize disposition unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows monitoring with evidence reference and status",()=>{mount("SCR-FND-003");chooseCase("MONITORING");const region=screen.getByRole("region",{name:"Condition monitoring records"});expect(within(region).getByText("test-monitor-evidence")).toBeTruthy();expect(within(region).getByText("Synthetic monitored condition")).toBeTruthy();});
 it("does not treat work completion as case closure",()=>{mount("SCR-FND-003");chooseCase("LINKED WORK");expect(screen.getByText("test-action-1")).toBeTruthy();expect(screen.getByText("test-recommendation-1")).toBeTruthy();expect(screen.getByText(/can never automatically close an FND case/i)).toBeTruthy();});
 it("explicitly displays a missing independent closure",()=>{mount("SCR-FND-003");chooseCase("CLOSURE");expect(screen.getByText("No closure decision recorded")).toBeTruthy();expect((screen.getByRole("button",{name:"Close / reopen FND-011 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("displays separately recorded closure evidence",()=>{const f=mutableFixture();f.cases[0]!.status="CLOSED";f.cases[0]!.closure={decisionAt:"2026-06-01T00:00:00Z",basisRef:"test-independent-closure",authorizedByRef:"test-closure-reviewer",verificationRef:"test-verification-evidence"};mount("SCR-FND-003",f);chooseCase("CLOSURE");expect(screen.getByText("test-independent-closure")).toBeTruthy();expect(screen.getByText("test-verification-evidence")).toBeTruthy();});
 it("keeps closure review notes locally only",()=>{mount("SCR-FND-003");chooseCase("CLOSURE");const note=screen.getByRole("textbox",{name:/Closure review observation/});fireEvent.change(note,{target:{value:"Synthetic local observation"}});expect((note as HTMLTextAreaElement).value).toBe("Synthetic local observation");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("rejects inconsistent closed cases without displaying them",()=>{const f=mutableFixture();f.cases[0]!.status="CLOSED";mount("SCR-FND-003",f);expect(screen.getByRole("alert").textContent).toContain("snapshot rejected");});
});
