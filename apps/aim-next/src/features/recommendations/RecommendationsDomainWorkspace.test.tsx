// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {RecommendationsDomainWorkspace} from "./RecommendationsDomainWorkspace";
import {recommendationsFixture,closedRecommendationsFixture} from "./recommendationsFixtures.test-utils";
import {EMPTY_RECOMMENDATIONS} from "./recommendationsModel";
afterEach(cleanup);
type Mutable<T>=T extends readonly (infer U)[]?Mutable<U>[]:T extends object?{-readonly [K in keyof T]:Mutable<T[K]>}:T;
const mutableFixture=():Mutable<ReturnType<typeof recommendationsFixture>>=>structuredClone(recommendationsFixture()) as Mutable<ReturnType<typeof recommendationsFixture>>;
function mount(id:string,snapshot:unknown=recommendationsFixture(),onNavigate=vi.fn()){
 return render(<RecommendationsDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={onNavigate}/>);
}
function chooseRecommendation(id="rec-test-1"){
 fireEvent.change(screen.getByRole("combobox",{name:"Recommendation to inspect"}),{target:{value:id}});
}
function panel(name:string){fireEvent.click(screen.getByRole("tab",{name}));}

describe("REC disconnected and invalid data states",()=>{
 it("starts disconnected with no claims of completed obligations",()=>{mount("SCR-REC-001",null);expect(screen.getByRole("status").textContent).toContain("No authorized REC data source");expect(screen.getByText("No matching recommendations")).toBeTruthy();});
 it("accepts an empty source without inventing obligations",()=>{mount("SCR-REC-001",EMPTY_RECOMMENDATIONS);expect(screen.getByText(/does not indicate satisfactory integrity/i)).toBeTruthy();});
 it("rejects all records on invalid supplied batch",()=>{const f=mutableFixture();f.requirements[0]!.acceptanceCriterion="";mount("SCR-REC-001",f);expect(screen.getByRole("alert").textContent).toContain("snapshot rejected");expect(screen.queryByText("TEST-REC-001")).toBeNull();});
 it("rejects unknown canonical screen ID",()=>{mount("SCR-REC-999");expect(screen.getByText("Unknown recommendation screen")).toBeTruthy();});
});

describe("SCR-REC-001 recommendation register",()=>{
 it("shows approved and draft recommendations without changing their status",()=>{mount("SCR-REC-001");const table=screen.getByRole("region",{name:"Recommendation records"});expect(within(table).getByText("TEST-REC-001")).toBeTruthy();expect(within(table).getByText("TEST-REC-002")).toBeTruthy();});
 it("filters by canonical recommendation state",()=>{mount("SCR-REC-001");fireEvent.change(screen.getByRole("combobox",{name:"Recommendation state"}),{target:{value:"DRAFT"}});expect(screen.queryByText("TEST-REC-001")).toBeNull();expect(screen.getByText("TEST-REC-002")).toBeTruthy();});
 it("filters by unknown priority without treating it as low",()=>{mount("SCR-REC-001");fireEvent.change(screen.getByRole("combobox",{name:"Priority"}),{target:{value:"UNKNOWN"}});expect(screen.getByText("TEST-REC-002")).toBeTruthy();expect(screen.queryByText("TEST-REC-001")).toBeNull();});
 it("searches across code, asset and technical source",()=>{mount("SCR-REC-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search recommendations"}),{target:{value:"TEST-REC-001 test-asset-1"}});expect(screen.getByText("TEST-REC-001")).toBeTruthy();expect(screen.queryByText("TEST-REC-002")).toBeNull();});
 it("shows an empty search result with no safety implication",()=>{mount("SCR-REC-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search recommendations"}),{target:{value:"not-present"}});expect(screen.getByText("No matching recommendations")).toBeTruthy();});
 it("inspects technical obligation rather than work status",()=>{mount("SCR-REC-001");fireEvent.click(screen.getByRole("button",{name:"Inspect recommendation TEST-REC-001"}));expect(screen.getByText(/FND · test-approved-condition-assessment/)).toBeTruthy();expect(screen.getByText("test-integrity-authority")).toBeTruthy();});
 it("routes to the owning recommendation workspace",()=>{const navigate=vi.fn();mount("SCR-REC-001",recommendationsFixture(),navigate);fireEvent.click(screen.getByRole("button",{name:"Inspect recommendation TEST-REC-001"}));fireEvent.click(screen.getByRole("button",{name:"Open recommendation workspace ↗"}));expect(navigate).toHaveBeenCalledWith("SCR-REC-002");});
});

describe("SCR-REC-002 recommendation workspace",()=>{
 it("requires deliberate selection and does not guess a technical obligation",()=>{mount("SCR-REC-002");expect(screen.getByText("Select a recommendation")).toBeTruthy();});
 it("shows approved source, record revision and technical due separately",()=>{mount("SCR-REC-002");chooseRecommendation();expect(screen.getByText("test-approved-condition-assessment")).toBeTruthy();expect(screen.getByText("Revision").parentElement?.querySelector("strong")?.textContent).toBe("rev-test-1");expect(screen.getByText("2027-06-01T00:00:00Z")).toBeTruthy();});
 it("protects recommendation approval and revision commands",()=>{mount("SCR-REC-002");chooseRecommendation();expect((screen.getByRole("button",{name:"Approve REC-005 unavailable"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Revise / withdraw REC-008 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("displays independent acceptance criteria and provenance",()=>{mount("SCR-REC-002");chooseRecommendation();panel("REQUIREMENTS");const t=screen.getByRole("region",{name:"Technical acceptance requirements"});expect(within(t).getByText("Document approved NDT and applicable repair standard")).toBeTruthy();expect(within(t).getByText("test-criterion-basis-2")).toBeTruthy();});
 it("separates account holder and accountable authority",()=>{mount("SCR-REC-002");chooseRecommendation();panel("ACCOUNTABILITY");expect(screen.getByText("test-repair-lead")).toBeTruthy();expect(screen.getByText("test-integrity-authority")).toBeTruthy();});
 it("disables frontend assignment",()=>{mount("SCR-REC-002");chooseRecommendation();panel("ACCOUNTABILITY");expect((screen.getByRole("button",{name:"Assign owner REC-004 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("displays completed external work but not recommendation fulfillment",()=>{mount("SCR-REC-002");chooseRecommendation();panel("EXECUTION");const t=screen.getByRole("region",{name:"Linked execution paths"});expect(within(t).getByText("test-cmms-work-1")).toBeTruthy();expect(within(t).getByText("COMPLETED")).toBeTruthy();expect(screen.getByText(/cannot independently verify a recommendation/i)).toBeTruthy();});
 it("shows partial technical verification independently from completed work",()=>{mount("SCR-REC-002");chooseRecommendation();panel("FULFILLMENT");const t=screen.getByRole("region",{name:"Technical fulfillment decisions"});expect(within(t).getByText("PENDING")).toBeTruthy();expect(within(t).getByText("VERIFIED")).toBeTruthy();expect(screen.getByText("1 / 2")).toBeTruthy();});
 it("cannot grant REC-009 technical fulfillment",()=>{mount("SCR-REC-002");chooseRecommendation();panel("FULFILLMENT");expect((screen.getByRole("button",{name:"Verify REC-009 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("does not treat completed CMMS work as a closeout",()=>{mount("SCR-REC-002");chooseRecommendation();panel("CLOSEOUT");expect(screen.getByText("No independent closeout decision")).toBeTruthy();expect((screen.getByRole("button",{name:"Close / reopen REC-010 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows independent closeout basis and authority from an authorized snapshot",()=>{mount("SCR-REC-002",closedRecommendationsFixture());chooseRecommendation();panel("CLOSEOUT");const t=screen.getByRole("region",{name:"Recommendation closeout history"});expect(within(t).getByText(/test-independent-closeout-basis/)).toBeTruthy();expect(within(t).getByText(/test-independent-closer/)).toBeTruthy();});
 it("keeps closeout notes locally and resets them",()=>{mount("SCR-REC-002");chooseRecommendation();panel("CLOSEOUT");const textarea=screen.getByRole("textbox",{name:/Closeout review note/});fireEvent.change(textarea,{target:{value:"unsaved reviewer thought"}});expect((textarea as HTMLTextAreaElement).value).toBe("unsaved reviewer thought");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((textarea as HTMLTextAreaElement).value).toBe("");});
 it("clears local notes on switching recommendation",()=>{mount("SCR-REC-002");chooseRecommendation();panel("CLOSEOUT");fireEvent.change(screen.getByRole("textbox",{name:/Closeout review note/}),{target:{value:"not another recommendation"}});chooseRecommendation("rec-test-2");panel("CLOSEOUT");expect((screen.getByRole("textbox",{name:/Closeout review note/}) as HTMLTextAreaElement).value).toBe("");});
 it("rejects invalid CLOSED without evidence instead of showing unapproved closure",()=>{const f=mutableFixture();f.recommendations[0]!.status="CLOSED";mount("SCR-REC-002",f);expect(screen.getByRole("alert").textContent).toContain("snapshot rejected");});
});
