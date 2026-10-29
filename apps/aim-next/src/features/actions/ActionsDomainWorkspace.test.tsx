// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {ActionsDomainWorkspace} from "./ActionsDomainWorkspace";
import {actionsFixture,authorizedFixture,type Mutable} from "./actionsFixtures.test-utils";
import {EMPTY_ACTIONS} from "./actionsModel";
afterEach(cleanup);
const mutable=():Mutable<ReturnType<typeof actionsFixture>>=>structuredClone(actionsFixture()) as Mutable<ReturnType<typeof actionsFixture>>;
function mount(id:string,snapshot:unknown=actionsFixture(),onNavigate=vi.fn()){return render(<ActionsDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={onNavigate}/>);}
function chooseAction(id="act-test-1"){fireEvent.change(screen.getByRole("combobox",{name:"Action to inspect"}),{target:{value:id}});}
function chooseDeferral(id="def-test-1"){fireEvent.change(screen.getByRole("combobox",{name:"Deferral to inspect"}),{target:{value:id}});}
function panel(name:string){fireEvent.click(screen.getByRole("tab",{name}));}
describe("ACT disconnected and fail-closed states",()=>{
 it("displays disconnected warning without manufacturing records",()=>{mount("SCR-ACT-001",null);expect(screen.getByRole("status").textContent).toContain("No authorized ACT snapshot");expect(screen.getByText("No matching integrity actions")).toBeTruthy();});
 it("accepts an empty authorized snapshot without safety claims",()=>{mount("SCR-ACT-003",EMPTY_ACTIONS);expect(screen.getByText("No matching deferral requests")).toBeTruthy();});
 it("rejects malformed batches without partial rendered actions",()=>{const a=mutable();a.repairs[0]!.expiresAt="not-date";mount("SCR-ACT-001",a);expect(screen.getByRole("alert").textContent).toContain("ACT snapshot rejected");expect(screen.queryByText("TEST-ACT-001")).toBeNull();});
 it("rejects unknown canonical screens",()=>{mount("SCR-ACT-999");expect(screen.getByText("Unknown ACT screen")).toBeTruthy();});
});
describe("SCR-ACT-001 Integrity Actions Register",()=>{
 it("renders both source-backed actions",()=>{mount("SCR-ACT-001");const t=screen.getByRole("region",{name:"Integrity actions"});expect(within(t).getByText("TEST-ACT-001")).toBeTruthy();expect(within(t).getByText("TEST-ACT-002")).toBeTruthy();});
 it("filters by action state",()=>{mount("SCR-ACT-001");fireEvent.change(screen.getByRole("combobox",{name:"Action state"}),{target:{value:"PLANNED"}});expect(screen.getByText("TEST-ACT-002")).toBeTruthy();expect(screen.queryByText("TEST-ACT-001")).toBeNull();});
 it("filters by repair type",()=>{mount("SCR-ACT-001");fireEvent.change(screen.getByRole("combobox",{name:"Action type"}),{target:{value:"TEMPORARY_REPAIR"}});expect(screen.getByText("TEST-ACT-001")).toBeTruthy();expect(screen.queryByText("TEST-ACT-002")).toBeNull();});
 it("searches by asset and code",()=>{mount("SCR-ACT-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search integrity actions"}),{target:{value:"test-act-001 test-equip-1"}});expect(screen.getByText("TEST-ACT-001")).toBeTruthy();});
 it("shows empty filter rather than safe classification",()=>{mount("SCR-ACT-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search integrity actions"}),{target:{value:"not-found"}});expect(screen.getByText("No matching integrity actions")).toBeTruthy();});
 it("inspects technical action rather than CMMS work",()=>{mount("SCR-ACT-001");fireEvent.click(screen.getByRole("button",{name:"Inspect action TEST-ACT-001"}));expect(screen.getByText("test-engineering-source")).toBeTruthy();expect(screen.getByText("rev-1")).toBeTruthy();});
 it("routes to owning action workspace",()=>{const go=vi.fn();mount("SCR-ACT-001",actionsFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Inspect action TEST-ACT-001"}));fireEvent.click(screen.getByRole("button",{name:"Open action workspace ↗"}));expect(go).toHaveBeenCalledWith("SCR-ACT-002");});
});
describe("SCR-ACT-002 Integrity Action Workspace",()=>{
 it("requires deliberate selection",()=>{mount("SCR-ACT-002");expect(screen.getByText("Select an integrity action")).toBeTruthy();});
 it("shows source basis and technical timing",()=>{mount("SCR-ACT-002");chooseAction();expect(screen.getByText("test-engineering-source")).toBeTruthy();expect(screen.getByText("2026-03-01T00:00:00Z")).toBeTruthy();});
 it("never exposes enabled release or mutation",()=>{mount("SCR-ACT-002");chooseAction();expect((screen.getByRole("button",{name:"Release plan ACT-011 unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Create / update ACT-001 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows temporary repair constraints and expiry",()=>{mount("SCR-ACT-002");chooseAction();panel("REPAIRS & CONTROLS");const t=screen.getByRole("region",{name:"Action repairs"});expect(within(t).getByText("test-operating-constraints")).toBeTruthy();expect(within(t).getByText("2026-04-01T00:00:00Z")).toBeTruthy();});
 it("keeps UNKNOWN control effectiveness visible",()=>{mount("SCR-ACT-002");chooseAction("act-test-2");panel("REPAIRS & CONTROLS");const t=screen.getByRole("region",{name:"Action temporary controls"});expect(within(t).getByText("UNKNOWN")).toBeTruthy();});
 it("displays plan release separately from work execution",()=>{mount("SCR-ACT-002");chooseAction();panel("EXECUTION");expect(screen.getByText("test-plan-authority")).toBeTruthy();expect(screen.getByText("test-field-evidence")).toBeTruthy();});
 it("exposes disabled execution mutation",()=>{mount("SCR-ACT-002");chooseAction();panel("EXECUTION");expect((screen.getByRole("button",{name:"Submit execution ACT-013 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("does not treat work complete as accepted technical verification",()=>{mount("SCR-ACT-002");chooseAction();panel("VERIFICATION");expect(screen.getByText("PENDING")).toBeTruthy();expect(screen.getByText(/ACT verification does not close/)).toBeTruthy();});
 it("keeps technical verification disabled",()=>{mount("SCR-ACT-002");chooseAction();panel("VERIFICATION");expect((screen.getByRole("button",{name:"Verify action ACT-010 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows completed CMMS work independently",()=>{mount("SCR-ACT-002");chooseAction();panel("EXTERNAL WORK");expect(screen.getByText("test-work-100")).toBeTruthy();expect(screen.getByText("COMPLETED")).toBeTruthy();});
 it("stores review note only locally and clears it",()=>{mount("SCR-ACT-002");chooseAction();panel("VERIFICATION");const t=screen.getByRole("textbox",{name:/Local review note/});fireEvent.change(t,{target:{value:"test unsaved note"}});expect((t as HTMLTextAreaElement).value).toBe("test unsaved note");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((t as HTMLTextAreaElement).value).toBe("");});
 it("clears local note when selecting a new action",()=>{mount("SCR-ACT-002");chooseAction();panel("VERIFICATION");fireEvent.change(screen.getByRole("textbox",{name:/Local review note/}),{target:{value:"must not leak"}});chooseAction("act-test-2");panel("VERIFICATION");expect((screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement).value).toBe("");});
});
describe("SCR-ACT-003 Deferral Register",()=>{
 it("displays original technical due separate from requested extension",()=>{mount("SCR-ACT-003");const t=screen.getByRole("region",{name:"Deferral requests"});expect(within(t).getByText("2026-03-01T00:00:00Z")).toBeTruthy();expect(within(t).getByText("2026-04-01T00:00:00Z")).toBeTruthy();expect(within(t).getByText("Not authorized")).toBeTruthy();});
 it("filters by requested state",()=>{mount("SCR-ACT-003");fireEvent.change(screen.getByRole("combobox",{name:"Deferral state"}),{target:{value:"AUTHORIZED"}});expect(screen.getByText("No matching deferral requests")).toBeTruthy();});
 it("reveals independent authorized deadline",()=>{mount("SCR-ACT-003",authorizedFixture());const t=screen.getByRole("region",{name:"Deferral requests"});expect(within(t).getByText("2026-03-20T00:00:00Z")).toBeTruthy();expect(within(t).getByText("2026-03-01T00:00:00Z")).toBeTruthy();});
 it("inspects authorization basis",()=>{mount("SCR-ACT-003",authorizedFixture());fireEvent.click(screen.getByRole("button",{name:"Inspect deferral TEST-DEF-001"}));expect(screen.getByText("decision-test-1")).toBeTruthy();});
 it("navigates to owning deferral assessment screen",()=>{const go=vi.fn();mount("SCR-ACT-003",actionsFixture(),go);fireEvent.click(screen.getByRole("button",{name:"Inspect deferral TEST-DEF-001"}));fireEvent.click(screen.getByRole("button",{name:"Open deferral assessment ↗"}));expect(go).toHaveBeenCalledWith("SCR-ACT-004");});
});
describe("SCR-ACT-004 Deferral Assessment & Approval",()=>{
 it("requires explicit selection",()=>{mount("SCR-ACT-004");expect(screen.getByText("Select a deferral")).toBeTruthy();});
 it("never assumes pending risk assessment is approved",()=>{mount("SCR-ACT-004");chooseDeferral();expect(screen.getByText("PENDING")).toBeTruthy();expect(screen.getByText("No decision on record")).toBeTruthy();});
 it("shows exact-revision decision and compensating measures",()=>{mount("SCR-ACT-004",authorizedFixture());chooseDeferral();expect(screen.getByText("test-monitoring-measure")).toBeTruthy();expect(screen.getByText("test-deferral-authority")).toBeTruthy();expect(screen.getByText("test-authorized-risk-basis")).toBeTruthy();});
 it("keeps actual original due unchanged when authorized",()=>{mount("SCR-ACT-004",authorizedFixture());chooseDeferral();expect(screen.getByText("2026-03-01T00:00:00Z")).toBeTruthy();expect(screen.getAllByText("2026-03-20T00:00:00Z").length).toBeGreaterThan(0);});
 it("cannot authorize or reject client-side",()=>{mount("SCR-ACT-004",authorizedFixture());chooseDeferral();expect((screen.getByRole("button",{name:"Authorize deferral ACT-007 unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Reject deferral ACT-007 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("clears local-only deferral note",()=>{mount("SCR-ACT-004");chooseDeferral();const t=screen.getByRole("textbox",{name:/Assessment note/});fireEvent.change(t,{target:{value:"not approved"}});fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((t as HTMLTextAreaElement).value).toBe("");});
 it("rejects fake authorization even when a requested date is present",()=>{const a=mutable();a.deferrals[0]!.state="AUTHORIZED";mount("SCR-ACT-004",a);expect(screen.getByRole("alert").textContent).toContain("ACT snapshot rejected");});
});
