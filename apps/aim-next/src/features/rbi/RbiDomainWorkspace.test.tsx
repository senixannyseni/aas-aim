// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RbiDomainWorkspace } from "./RbiDomainWorkspace";
import { rbiFixture } from "./rbiFixtures.test-utils";
import type { RbiSnapshot } from "./rbiModel";

afterEach(cleanup);
function mount(id:string,snapshot:unknown=rbiFixture(),onNavigate=vi.fn()){
 return render(<RbiDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={onNavigate}/>);
}
function assessmentTab(tab:string){fireEvent.change(screen.getByRole("combobox",{name:"Assessment revision"}),{target:{value:"rbi-test-1"}});fireEvent.click(screen.getByRole("tab",{name:tab}));}
function selectScenario(){fireEvent.click(screen.getByRole("button",{name:/Test inspection sensitivity/}));}

describe("RBI frontend — disconnected and fail-closed",()=>{
 it("shows no authorized records when disconnected",()=>{mount("SCR-RBI-001",null);expect(screen.getByRole("status").textContent).toContain("No authorized RBI data source");expect(screen.getByText("No matching RBI assessments")).toBeTruthy();});
 it("rejects entire invalid response",()=>{mount("SCR-RBI-001",{...rbiFixture(),results:[{id:"invalid"}]});expect(screen.getByRole("alert").textContent).toContain("RBI snapshot rejected");expect(screen.queryByText("TEST-RBI-001")).toBeNull();});
 it("does not imply acceptable risk for valid empty snapshot",()=>{const f=rbiFixture();mount("SCR-RBI-001",{...f,assessments:[],inputSets:[],results:[],strategies:[],scenarios:[]});expect(screen.getByText("No matching RBI assessments")).toBeTruthy();expect(screen.getByText(/not a low-risk assessment/i)).toBeTruthy();});
 it("rejects unknown screen without presenting fabricated results",()=>{mount("SCR-RBI-999");expect(screen.getByText("Unknown RBI screen")).toBeTruthy();});
});
describe("RBI assessment register",()=>{
 it("shows assessment revision and state",()=>{mount("SCR-RBI-001");const r=screen.getByRole("region",{name:"RBI assessment records"});expect(within(r).getByText("TEST-RBI-001")).toBeTruthy();expect(within(r).getByText("TEST-EQUIPMENT-1")).toBeTruthy();});
 it("searches by methodology and asset",()=>{mount("SCR-RBI-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search assessments"}),{target:{value:"UNKNOWN"}});expect(screen.getByText("No matching RBI assessments")).toBeTruthy();});
 it("filters by revision status",()=>{mount("SCR-RBI-001");fireEvent.change(screen.getByRole("combobox",{name:"Assessment status"}),{target:{value:"DRAFT"}});expect(screen.getByText("No matching RBI assessments")).toBeTruthy();});
 it("shows RBI candidate separately from INS governing due",()=>{mount("SCR-RBI-001");fireEvent.click(screen.getByRole("button",{name:"Inspect RBI assessment TEST-RBI-001"}));expect(screen.getByText("test-review-basis")).toBeTruthy();expect(screen.getByText("2027-01-01T00:00:00Z")).toBeTruthy();expect(screen.getByText(/Only INS-016 determines the governing/i)).toBeTruthy();});
 it("navigates to canonical assessment workspace",()=>{const fn=vi.fn();mount("SCR-RBI-001",rbiFixture(),fn);fireEvent.click(screen.getByRole("button",{name:"Inspect RBI assessment TEST-RBI-001"}));fireEvent.click(screen.getByRole("button",{name:"Open assessment workspace ↗"}));expect(fn).toHaveBeenCalledWith("SCR-RBI-002");});
});
describe("RBI assessment workspace",()=>{
 it("requires explicit assessment selection",()=>{mount("SCR-RBI-002");expect(screen.getByText("Select a controlled assessment")).toBeTruthy();});
 it("shows frozen input source references",()=>{mount("SCR-RBI-002");assessmentTab("FROZEN INPUTS");const r=screen.getByRole("region",{name:"RBI source inputs"});expect(within(r).getByText("test-dgm-reference")).toBeTruthy();expect(within(r).getByText("test-ins-credit-reference")).toBeTruthy();});
 it("keeps stale input quality visible",()=>{mount("SCR-RBI-002");assessmentTab("DATA QUALITY");expect(screen.getByText("STALE")).toBeTruthy();expect(screen.getByText(/complete input count does not prove/i)).toBeTruthy();});
 it("shows PoF without calculating it",()=>{mount("SCR-RBI-002");assessmentTab("PROBABILITY");expect(screen.getByText(/0.0012/)).toBeTruthy();expect(screen.queryByText("800000")).toBeNull();});
 it("shows CoF independently from PoF",()=>{mount("SCR-RBI-002");assessmentTab("CONSEQUENCE");expect(screen.getByText(/800000/)).toBeTruthy();expect(screen.queryByText("0.0012")).toBeNull();});
 it("keeps future projected risk independent of approved current risk",()=>{mount("SCR-RBI-002");assessmentTab("CURRENT / FUTURE RISK");expect(screen.getByText("HIGH")).toBeTruthy();expect(screen.getByText("CRITICAL")).toBeTruthy();expect(screen.getByText(/Projected values do not overwrite/i)).toBeTruthy();});
 it("shows RBI candidate and target coverage without changing INS",()=>{mount("SCR-RBI-002");assessmentTab("INSPECTION STRATEGY");expect(screen.getByText("85%")).toBeTruthy();expect(screen.getByText(/must be reconciled by INS-016/i)).toBeTruthy();});
 it("navigates to scenario workspace",()=>{const fn=vi.fn();mount("SCR-RBI-002",rbiFixture(),fn);assessmentTab("INSPECTION STRATEGY");fireEvent.click(screen.getByRole("button",{name:"Open what-if scenarios ↗"}));expect(fn).toHaveBeenCalledWith("SCR-RBI-003");});
 it("renders trace references of calculated results",()=>{mount("SCR-RBI-002");assessmentTab("TRACE");expect(within(screen.getByRole("region",{name:"RBI result calculation trace"})).getByText("test-pof-trace")).toBeTruthy();});
 it("does not invent missing PoF results",()=>{const f=rbiFixture();const scenario={...f,results:f.results.filter(x=>x.kind!=="POF")};mount("SCR-RBI-002",scenario);assessmentTab("PROBABILITY");expect(screen.getByText("No calculation result supplied")).toBeTruthy();});
 it("keeps review notes unsaved with approvals disabled",()=>{mount("SCR-RBI-002");assessmentTab("REVIEW");const note=screen.getByRole("textbox",{name:/Technical review note/i});fireEvent.change(note,{target:{value:"Synthetic draft only"}});expect((note as HTMLTextAreaElement).value).toBe("Synthetic draft only");expect((screen.getByRole("button",{name:"Approve RBI-018 unavailable"}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("rejects non-authoritative results that claim approval for a draft assessment",()=>{const f=structuredClone(rbiFixture()) as unknown as {assessments:Record<string,unknown>[];results:Record<string,unknown>[]};f.assessments[0]!.status="DRAFT";mount("SCR-RBI-002",f);expect(screen.getByRole("alert").textContent).toContain("RBI snapshot rejected");});
});
describe("RBI scenario and sensitivity",()=>{
 it("shows explicitly non-authoritative scenario results",()=>{mount("SCR-RBI-003");selectScenario();expect(screen.getByText("SCENARIO / NO RELEASE")).toBeTruthy();expect(screen.getByText("LOW")).toBeTruthy();expect(screen.getByText(/All scenario results are non-authoritative/i)).toBeTruthy();});
 it("filters the scenario list",()=>{mount("SCR-RBI-003");fireEvent.change(screen.getByRole("searchbox",{name:"Search scenarios"}),{target:{value:"not-present"}});expect(screen.getByText("No scenarios supplied")).toBeTruthy();});
 it("keeps scenario drafts local",()=>{mount("SCR-RBI-003");selectScenario();const note=screen.getByRole("textbox",{name:/Scenario observation/i});fireEvent.change(note,{target:{value:"Synthetic local only"}});expect((note as HTMLTextAreaElement).value).toBe("Synthetic local only");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect((note as HTMLTextAreaElement).value).toBe("");});
 it("disables promotion and navigates to the controlled assessment",()=>{const nav=vi.fn();mount("SCR-RBI-003",rbiFixture(),nav);selectScenario();expect((screen.getByRole("button",{name:"Promote scenario unavailable"}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole("button",{name:"Open controlled assessment ↗"}));expect(nav).toHaveBeenCalledWith("SCR-RBI-002");});
 it("rejects a scenario with a mismatched base revision",()=>{const f=rbiFixture();const bad:RbiSnapshot={...f,scenarios:[{...f.scenarios[0]!,basedOnRevision:"0"}]};mount("SCR-RBI-003",bad);expect(screen.getByRole("alert").textContent).toContain("RBI snapshot rejected");});
});
