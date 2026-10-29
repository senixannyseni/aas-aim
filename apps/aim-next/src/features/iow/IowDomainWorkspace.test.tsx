// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {IowDomainWorkspace} from "./IowDomainWorkspace";
import {iowFixture,disposedFixture,type Mutable} from "./iowFixtures.test-utils";
import {EMPTY_IOW} from "./iowModel";
afterEach(cleanup);
const mutable=()=>structuredClone(iowFixture()) as Mutable<ReturnType<typeof iowFixture>>;
function mount(screenId:string,snapshot:unknown=iowFixture(),onNavigate=vi.fn()){return render(<IowDomainWorkspace screenId={screenId} snapshot={snapshot} onNavigate={onNavigate}/>);}
function chooseIow(id="iow-a"){fireEvent.change(screen.getByRole("combobox",{name:"IOW definition to inspect"}),{target:{value:id}});}
function chooseExcursion(id="exc-a"){fireEvent.change(screen.getByRole("combobox",{name:"Excursion to review"}),{target:{value:id}});}
function tab(name:string){fireEvent.click(screen.getByRole("tab",{name}));}
describe("IOW disconnected and fail-closed state",()=>{
 it("does not infer compliance from missing source",()=>{mount("SCR-IOW-001",null);expect(screen.getByRole("status").textContent).toContain("Historian silence");expect(screen.getByText("No matching IOW definitions")).toBeTruthy();});
 it("accepts authorized empty data without synthesizing excursions",()=>{mount("SCR-IOW-003",EMPTY_IOW);expect(screen.getByText("No matching excursions")).toBeTruthy();});
 it("rejects entire malformed batch without partial data",()=>{const v=mutable();v.samples[1]!.value=3;mount("SCR-IOW-001",v);expect(screen.getByRole("alert").textContent).toContain("IOW snapshot rejected");expect(screen.queryByText("TEST-IOW-A")).toBeNull();});
 it("rejects unknown canonical screen",()=>{mount("SCR-IOW-999");expect(screen.getByText("Unknown IOW screen")).toBeTruthy();});
});
describe("SCR-IOW-001 — IOW Register",()=>{
 it("shows both named definitions",()=>{mount("SCR-IOW-001");const t=screen.getByRole("region",{name:"IOW definitions"});expect(within(t).getByText("TEST-IOW-A")).toBeTruthy();expect(within(t).getByText("TEST-IOW-B")).toBeTruthy();});
 it("filters by status",()=>{mount("SCR-IOW-001");fireEvent.change(screen.getByRole("combobox",{name:"Definition state"}),{target:{value:"DRAFT"}});expect(screen.getByText("TEST-IOW-B")).toBeTruthy();expect(screen.queryByText("TEST-IOW-A")).toBeNull();});
 it("supports code plus asset search",()=>{mount("SCR-IOW-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search IOW definitions"}),{target:{value:"test-iow-a test-equipment-a"}});expect(screen.getByText("TEST-IOW-A")).toBeTruthy();});
 it("does not imply no exceedance after unmatched search",()=>{mount("SCR-IOW-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search IOW definitions"}),{target:{value:"absent"}});expect(screen.getByText("No matching IOW definitions")).toBeTruthy();});
 it("shows source-backed approval reference only",()=>{mount("SCR-IOW-001");fireEvent.click(screen.getByRole("button",{name:"Inspect IOW TEST-IOW-A"}));expect(screen.getByText("test-definition-approval")).toBeTruthy();});
 it("navigates to owning IOW definition",()=>{const go=vi.fn();mount("SCR-IOW-001",iowFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Inspect IOW TEST-IOW-A"}));fireEvent.click(screen.getByRole("button",{name:"Open definition workspace ↗"}));expect(go).toHaveBeenCalledWith("SCR-IOW-002");});
});
describe("SCR-IOW-002 — IOW Definition Workspace",()=>{
 it("requires deliberate definition selection",()=>{mount("SCR-IOW-002");expect(screen.getByText("Select an IOW definition")).toBeTruthy();});
 it("displays bounds with controlled rule",()=>{mount("SCR-IOW-002");chooseIow();const table=screen.getByRole("region",{name:"Controlled IOW limits"});expect(within(table).getByText("120")).toBeTruthy();expect(within(table).getByText("test-alarm-logic")).toBeTruthy();});
 it("reveals degraded connection independently of stale quality",()=>{mount("SCR-IOW-002");chooseIow();tab("SOURCES & QUALITY");expect(screen.getByText("DEGRADED")).toBeTruthy();expect(screen.getByText("STALE")).toBeTruthy();});
 it("shows mechanism and barrier refs without editing DGM",()=>{mount("SCR-IOW-002");chooseIow();tab("ASSET & BARRIER LINKS");expect(screen.getByText("test-barrier")).toBeTruthy();expect(screen.getByText("test-degradation")).toBeTruthy();});
 it("keeps IOW approval action disabled",()=>{mount("SCR-IOW-002");chooseIow();tab("CONTROLLED REVIEW");expect((screen.getByRole("button",{name:"Approve IOW definition IOW-009 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("stores review notes only locally and permits clearing",()=>{mount("SCR-IOW-002");chooseIow();tab("CONTROLLED REVIEW");const note=screen.getByRole("textbox",{name:/Local review note/});fireEvent.change(note,{target:{value:"not submitted"}});expect((note as HTMLTextAreaElement).value).toBe("not submitted");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("clears draft notes on switching definitions",()=>{mount("SCR-IOW-002");chooseIow();tab("CONTROLLED REVIEW");fireEvent.change(screen.getByRole("textbox",{name:/Local review note/}),{target:{value:"discard me"}});chooseIow("iow-b");tab("CONTROLLED REVIEW");expect((screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement).value).toBe("");});
});
describe("SCR-IOW-003 — Monitoring and Excursions",()=>{
 it("renders process recovered distinct from reviewed disposition",()=>{mount("SCR-IOW-003");const table=screen.getByRole("region",{name:"IOW excursion events"});expect(within(table).getByText("PROCESS RECOVERED")).toBeTruthy();});
 it("shows STALE quality and missing readings as unavailable",()=>{mount("SCR-IOW-003");expect(screen.getByText("STALE")).toBeTruthy();expect(screen.getByText("Unavailable")).toBeTruthy();});
 it("does not fake a calculated compliance result",()=>{mount("SCR-IOW-003");expect(screen.getByText(/UI never evaluates raw signal values/)).toBeTruthy();});
 it("can filter reviewed events separately",()=>{mount("SCR-IOW-003");fireEvent.change(screen.getByRole("combobox",{name:"Excursion state"}),{target:{value:"DISPOSITIONED"}});expect(screen.getByText("No matching excursions")).toBeTruthy();});
 it("routes to controlled excursion review",()=>{const go=vi.fn();mount("SCR-IOW-003",iowFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Review excursion TEST-EXC-A"}));expect(go).toHaveBeenCalledWith("SCR-IOW-004");});
});
describe("SCR-IOW-004 — Excursion Review",()=>{
 it("requires explicit excursion selection",()=>{mount("SCR-IOW-004");expect(screen.getByText("Select an excursion")).toBeTruthy();});
 it("retains recovered but unreviewed technical status",()=>{mount("SCR-IOW-004");chooseExcursion();expect(screen.getByText("No engineering disposition recorded")).toBeTruthy();});
 it("displays independently reviewed decision and follow-up",()=>{mount("SCR-IOW-004",disposedFixture());chooseExcursion();expect(screen.getByText("test-senior-engineer")).toBeTruthy();expect(screen.getByText("test-ICC-link")).toBeTruthy();});
 it("keeps review and reassessment actions disabled",()=>{mount("SCR-IOW-004",disposedFixture());chooseExcursion();expect((screen.getByRole("button",{name:"Record disposition IOW-007 unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Initiate reassessment IOW-011 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("clears local review note without persisting",()=>{mount("SCR-IOW-004");chooseExcursion();const note=screen.getByRole("textbox",{name:/Technical review note/});fireEvent.change(note,{target:{value:"preview only"}});fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("rejects unsupported disposition when review evidence is absent",()=>{const v=mutable();v.excursions[0]!.state="DISPOSITIONED";v.excursions[0]!.dispositionRef="fake";mount("SCR-IOW-004",v);expect(screen.getByRole("alert").textContent).toContain("IOW snapshot rejected");});
});
