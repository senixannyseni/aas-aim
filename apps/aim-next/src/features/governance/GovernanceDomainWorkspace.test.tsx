// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {GovernanceDomainWorkspace} from "./GovernanceDomainWorkspace";
import {governanceFixture} from "./governanceFixtures.test-utils";
import {EMPTY_GOVERNANCE} from "./governanceModel";
afterEach(cleanup);
const mount=(screenId:string,snapshot:unknown=governanceFixture(),onNavigate=vi.fn())=>render(<GovernanceDomainWorkspace screenId={screenId} snapshot={snapshot} onNavigate={onNavigate}/>);
const inspect=(id:string)=>fireEvent.click(screen.getByRole("button",{name:`Inspect governance record ${id}`}));

describe("GOV disconnected and fail-closed presentation",()=>{
 it("does not imply authority from an absent backend",()=>{mount("SCR-GOV-004",null);expect(screen.getByRole("status").textContent).toContain("not proof of permission");expect(screen.getByText(/No authorities records/)).toBeTruthy();});
 it("supports an explicitly valid empty source",()=>{mount("SCR-GOV-001",EMPTY_GOVERNANCE);expect(screen.getByText(/No principals records/)).toBeTruthy();expect(screen.queryByRole("status")).toBeNull();});
 it("rejects the entire batch on malformed delegation",()=>{const v=governanceFixture();v.delegations[0]!.delegatePrincipalId="service-a";mount("SCR-GOV-004",v);expect(screen.getByRole("alert").textContent).toContain("GOV snapshot rejected");expect(screen.queryByText("Test Engineer")).toBeNull();});
 it("rejects extra token material in a principal",()=>{const v=governanceFixture();(v.principals[0] as unknown as Record<string,unknown>).accessToken="secret";mount("SCR-GOV-001",v);expect(screen.getByRole("alert")).toBeTruthy();});
 it("does not invent a canonical screen",()=>{mount("SCR-GOV-999");expect(screen.getByText("Unknown canonical GOV screen.")).toBeTruthy();});
});

describe("GOV canonical screen coverage",()=>{
 const cases:[string,string][]=[
  ["SCR-GOV-001","Users / Principals"],["SCR-GOV-002","Access Profiles & Capabilities"],
  ["SCR-GOV-003","Scope Administration"],["SCR-GOV-004","Approval Authority & Delegation"],
  ["SCR-GOV-005","Workflow / State Policy"],["SCR-GOV-006","Audit Explorer"],
  ["SCR-GOV-007","Revision History"],["SCR-GOV-008","Controlled Methodology Packages"],
  ["SCR-GOV-009","Notification / Escalation Rules"],["SCR-GOV-010","Evidence Library"],
  ["SCR-GOV-011","Retention / Legal Hold"],["SCR-GOV-012","AI Policy & Provenance"],
 ];
 for(const [id,title] of cases){it(`renders ${id} — ${title}`,()=>{mount(id);expect(screen.getByRole("heading",{name:title})).toBeTruthy();expect(screen.getByText(/Source-provided records · read-only/)).toBeTruthy();});}
});

describe("GOV principals, grants and independent engineering authority",()=>{
 it("shows distinct user and service principals",()=>{mount("SCR-GOV-001");const table=screen.getByRole("region",{name:"principals records"});expect(within(table).getByText("Test Engineer")).toBeTruthy();expect(within(table).getByText("Test Connector")).toBeTruthy();});
 it("searches principal records without fabricating identities",()=>{mount("SCR-GOV-001");fireEvent.change(screen.getByRole("searchbox",{name:"Search principals"}),{target:{value:"delegate"}});expect(screen.getByText("Test Delegate")).toBeTruthy();expect(screen.queryByText("Test Engineer")).toBeNull();});
 it("shows full principal source fields without treating them as login",()=>{mount("SCR-GOV-001");inspect("user-a");expect(screen.getByText("test-idp-subject-a")).toBeTruthy();expect(screen.getByText(/cannot create users, authenticate sessions/)).toBeTruthy();});
 it("shows capability names without granting access",()=>{mount("SCR-GOV-002");inspect("profile-a");expect(within(document.querySelector(".gov-inspector") as HTMLElement).getByText("AIR_READ · GOV_READ")).toBeTruthy();expect(screen.getByText(/not evidence that the browser principal is permitted/)).toBeTruthy();});
 it("navigates between profile and grant screens",()=>{const next=vi.fn();mount("SCR-GOV-002",governanceFixture(),next);fireEvent.click(screen.getByRole("button",{name:"Open related GOV workspace ↗"}));expect(next).toHaveBeenCalledWith("SCR-GOV-003");});
 it("retains separate scope and profile identifiers",()=>{mount("SCR-GOV-003");inspect("grant-a");expect(screen.getAllByText("tenant-a").length).toBeGreaterThan(0);expect(screen.getAllByText("profile-a").length).toBeGreaterThan(0);});
 it("shows human authority separately from administrative access",()=>{mount("SCR-GOV-004");inspect("auth-a");expect(screen.getAllByText("RBI-018").length).toBeGreaterThan(0);expect(screen.getByText(/Authority cannot be inferred from role/)).toBeTruthy();});
 it("shows bounded delegation as a second table",()=>{mount("SCR-GOV-004");const t=screen.getByRole("region",{name:"related delegations"});expect(within(t).getByText("user-b")).toBeTruthy();});
 it("does not offer any enabled approval grant",()=>{mount("SCR-GOV-004");expect((screen.getByRole("button",{name:"Assign approval authority GOV-004 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
});

describe("GOV immutable audit, revision, package and evidence views",()=>{
 it("reveals server integrity reference but never claims verification",()=>{mount("SCR-GOV-006");inspect("audit-a");expect(screen.getByText("test-server-integrity-proof")).toBeTruthy();expect(screen.getByText(/not cryptographically attested by this browser/)).toBeTruthy();});
 it("shows a separately sourced revision predecessor",()=>{mount("SCR-GOV-007");inspect("revision-b");expect(screen.getByText("revision-a")).toBeTruthy();});
 it("shows approved methodology references",()=>{mount("SCR-GOV-008");inspect("package-a");expect(screen.getByText("test-approval")).toBeTruthy();});
 it("maintains disabled package approval",()=>{mount("SCR-GOV-008");expect((screen.getByRole("button",{name:"Approve methodology package GOV-008 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("does not mistake a notification rule for actual delivery",()=>{mount("SCR-GOV-009");expect(screen.getByText(/not proof that a notification was sent/)).toBeTruthy();});
 it("distinguishes evidence hash metadata from file validation",()=>{mount("SCR-GOV-010");inspect("evidence-a");expect(screen.getByText("a".repeat(64))).toBeTruthy();expect(screen.getByText(/browser verified file bytes/)).toBeTruthy();});
 it("retains legal hold separately from retention",()=>{mount("SCR-GOV-011");const t=screen.getByRole("region",{name:"related holds"});expect(within(t).getByText("test-legal-hold")).toBeTruthy();expect(screen.getByText(/absence of a visible hold authorizes deletion/)).toBeTruthy();});
});

describe("GOV workflow, AI governance and non-persistent notes",()=>{
 it("does not present workflow policy activation as enabled",()=>{mount("SCR-GOV-005");expect((screen.getByRole("button",{name:"Activate workflow policy GOV-005 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("shows prohibited AI transitions separate from allowed tools",()=>{mount("SCR-GOV-012");inspect("ai-policy-a");expect(screen.getByText("RBI-018 · FFS-010")).toBeTruthy();expect(screen.getByText("EXPLAIN")).toBeTruthy();});
 it("displays separate AI execution provenance",()=>{mount("SCR-GOV-012");const t=screen.getByRole("region",{name:"related aiExecutions"});expect(within(t).getByText("EXPLANATION")).toBeTruthy();});
 it("cannot approve AI policy from the browser",()=>{mount("SCR-GOV-012");expect((screen.getByRole("button",{name:"Approve AI policy GOV-014 unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("lets a user clear an unsaved note",()=>{mount("SCR-GOV-004");const el=screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement;fireEvent.change(el,{target:{value:"not persisted"}});expect(el.value).toBe("not persisted");fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect(el.value).toBe("");});
 it("searches audit events without persisting anything",()=>{mount("SCR-GOV-006");fireEvent.change(screen.getByRole("searchbox",{name:"Search auditEvents"}),{target:{value:"unknown event"}});expect(screen.getByText(/No auditevents records/i)).toBeTruthy();});
 it("does not display a live session assertion",()=>{mount("SCR-GOV-001",null);expect(screen.getByText(/no authenticated governance source/)).toBeTruthy();});
});
