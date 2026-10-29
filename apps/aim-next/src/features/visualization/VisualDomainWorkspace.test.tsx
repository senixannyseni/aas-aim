// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {VisualDomainWorkspace} from "./VisualDomainWorkspace";
import {EMPTY_VIS} from "./visualizationModel";
import {visualFixture} from "./visualizationFixtures.test-utils";
afterEach(cleanup);
const mount=(screenId:string,snapshot:unknown=visualFixture(),onNavigate=vi.fn())=>render(<VisualDomainWorkspace screenId={screenId} snapshot={snapshot} onNavigate={onNavigate}/>);
describe("VIS safe unconnected and rejected states",()=>{
 it("reports source disconnected without fake geometry",()=>{mount("SCR-VIS-001",null);expect(screen.getByRole("status").textContent).toContain("UNKNOWN");expect(screen.queryByRole("img")).toBeNull();});
 it("renders an explicitly empty source projection",()=>{mount("SCR-VIS-001",EMPTY_VIS);expect(screen.getByText(/No authorized records supplied/)).toBeTruthy();expect(screen.getByText("Visual geometry unavailable")).toBeTruthy();});
 it("rejects malformed snapshot without showing records",()=>{const v=visualFixture();v.mappings[0]!.sourceRevision="old-revision";mount("SCR-VIS-001",v);expect(screen.getByRole("alert")).toBeTruthy();expect(screen.queryByRole("img")).toBeNull();});
 it("rejects cross-tenant visual mapping",()=>{const v=visualFixture();v.mappings[0]!.tenantId="other";mount("SCR-VIS-001",v);expect(screen.getByRole("alert")).toBeTruthy();});
 it("rejects fake approved scenario and hides geometry",()=>{const v=visualFixture();v.overlays[2]!.approvalRef="pretend-approved";mount("SCR-VIS-003",v);expect(screen.getByRole("alert")).toBeTruthy();});
 it("rejects unknown canonical screen",()=>{mount("SCR-VIS-123");expect(screen.getByText("Unknown canonical Visualization screen.")).toBeTruthy();});
});
describe("VIS-003–008 canonical screen navigation",()=>{
 const canonical:[string,string][]=[
  ["SCR-VIS-001","P&ID Viewer"],["SCR-VIS-002","2D Drawing Viewer"],
  ["SCR-VIS-003","3D Model Viewer"],["SCR-VIS-004","GIS / Map Viewer"],
  ["SCR-VIS-005","Overlay Controls"],["SCR-VIS-006","Visual Mapping & Alignment Admin"]];
 for(const [id,title]of canonical)it(`renders ${id}`,()=>{mount(id);expect(screen.getByRole("heading",{name:title})).toBeTruthy();expect(screen.getByText(/VIS-003–008 · SOURCE-OWNED/)).toBeTruthy();});
 it("displays only P&ID sources in P&ID context",()=>{mount("SCR-VIS-001");expect(within(screen.getByRole("region",{name:"visual sources"})).getByText("Test process P&ID")).toBeTruthy();expect(within(screen.getByRole("region",{name:"visual sources"})).queryByText("Test GIS source")).toBeNull();});
 it("displays only GIS sources on GIS screen",()=>{mount("SCR-VIS-004");expect(within(screen.getByRole("region",{name:"visual sources"})).getByText("Test GIS source")).toBeTruthy();expect(within(screen.getByRole("region",{name:"visual sources"})).queryByText("Test process P&ID")).toBeNull();});
 it("displays only 3D sources in 3D context",()=>{mount("SCR-VIS-003");expect(within(screen.getByRole("region",{name:"visual sources"})).getByText("Test 3D model")).toBeTruthy();});
 it("displays only drawing sources in 2D context",()=>{mount("SCR-VIS-002");expect(within(screen.getByRole("region",{name:"visual sources"})).getByText("Test 2D drawing")).toBeTruthy();});
 it("retains canonical VIS IDs in page heading",()=>{mount("SCR-VIS-006");expect(screen.getByText(/SCR-VIS-006 · CANONICAL VIEW/)).toBeTruthy();});
 it("routes to canonical overlay controls",()=>{const next=vi.fn();mount("SCR-VIS-001",visualFixture(),next);fireEvent.click(screen.getByRole("button",{name:"Open overlay controls ↗"}));expect(next).toHaveBeenCalledWith("SCR-VIS-005");});
 it("routes to canonical mapping administration",()=>{const next=vi.fn();mount("SCR-VIS-001",visualFixture(),next);fireEvent.click(screen.getByRole("button",{name:"Mapping & alignment ↗"}));expect(next).toHaveBeenCalledWith("SCR-VIS-006");});
 it("never enables external provider without an integration",()=>{mount("SCR-VIS-003");expect((screen.getByRole("button",{name:/Open trusted drawing/}) as HTMLButtonElement).disabled).toBe(true);});
});
describe("VIS mapping and source-authored coordinate preview",()=>{
 it("shows a normalized P&ID coordinate preview, not a drawing",()=>{mount("SCR-VIS-001");expect(screen.getByRole("img",{name:"Source-provided mapped object positions"})).toBeTruthy();expect(screen.getByText(/NOT TO SCALE/)).toBeTruthy();});
 it("shows source-authored GIS mapping with verified alignment",()=>{mount("SCR-VIS-004");expect(screen.getByRole("img",{name:"Source-provided mapped object positions"})).toBeTruthy();expect(screen.getByText(/1 source-located objects/)).toBeTruthy();});
 it("does not invent 3D geometry when alignment is absent",()=>{mount("SCR-VIS-003");expect(screen.queryByRole("img")).toBeNull();expect(screen.getByText("Visual geometry unavailable")).toBeTruthy();});
 it("shows an ambiguous drawing point without declaring it verified",()=>{mount("SCR-VIS-002");expect(screen.getByText("AMBIGUOUS")).toBeTruthy();});
 it("selects mapped record to inspect exact asset identity",()=>{mount("SCR-VIS-001");fireEvent.click(screen.getByRole("button",{name:/P&ID-V-1.*EQ-TEST-001/}));expect(screen.getByRole("region",{name:"Visual record detail"}).textContent).toContain("pid-r3");});
 it("inspects engineering source and revision",()=>{mount("SCR-VIS-001");fireEvent.click(within(screen.getByRole("region",{name:"Source-backed overlays"})).getByRole("button",{name:/Approved risk basis/}));expect(screen.getByRole("region",{name:"Visual record detail"}).textContent).toContain("rbi-r2");});
 it("filters sources without synthesizing new records",()=>{mount("SCR-VIS-005");fireEvent.change(screen.getByRole("searchbox",{name:"Search visual sources"}),{target:{value:"no-matching-model"}});expect(screen.getByText("No authorized records supplied for this selection.")).toBeTruthy();});
 it("does not infer geometry when coordinates are missing",()=>{const v=visualFixture();delete v.mappings[0]!.x;delete v.mappings[0]!.y;mount("SCR-VIS-001",v);expect(screen.queryByRole("img")).toBeNull();});
});
describe("VIS controlled overlay state filters and review history",()=>{
 it("displays all five classes for the P&ID",()=>{mount("SCR-VIS-001");for(const kind of ["APPROVED","PROJECTED","SCENARIO","UNKNOWN","STALE"])expect(screen.getByRole("checkbox",{name:kind})).toBeTruthy();expect(screen.getByText("5 visible / 5 supplied")).toBeTruthy();});
 it("can exclude scenario overlays without rewriting their state",()=>{mount("SCR-VIS-001");fireEvent.click(screen.getByRole("checkbox",{name:"SCENARIO"}));expect(screen.getByText("4 visible / 5 supplied")).toBeTruthy();expect(within(screen.getByRole("region",{name:"Source-backed overlays"})).queryByText("Scenario fitness")).toBeNull();});
 it("can exclude unknown and stale overlays independently",()=>{mount("SCR-VIS-001");fireEvent.click(screen.getByRole("checkbox",{name:"UNKNOWN"}));fireEvent.click(screen.getByRole("checkbox",{name:"STALE"}));expect(screen.getByText("3 visible / 5 supplied")).toBeTruthy();});
 it("never reclassifies a stale overlay as approved",()=>{mount("SCR-VIS-001");expect(within(screen.getByRole("region",{name:"Source-backed overlays"})).getByText("Stale inspection status")).toBeTruthy();expect(screen.getByText("5 visible / 5 supplied")).toBeTruthy();});
 it("allows source-record inspection of review provenance",()=>{mount("SCR-VIS-006");fireEvent.click(within(screen.getByRole("region",{name:"Related reviews"})).getByRole("button",{name:/review-pid/}));expect(screen.getByRole("region",{name:"Visual record detail"}).textContent).toContain("engineer-test");});
 it("shows verified GIS alignment evidence",()=>{mount("SCR-VIS-006");fireEvent.click(screen.getByRole("button",{name:/Test GIS source/}));fireEvent.click(screen.getByRole("button",{name:/align-gis/}));expect(screen.getByRole("region",{name:"Visual record detail"}).textContent).toContain("gis-alignment-basis");});
 it("never permits mapping approval without backend",()=>{mount("SCR-VIS-006");expect((screen.getByRole("button",{name:"Verify / invalidate mapping unavailable"}) as HTMLButtonElement).disabled).toBe(true);});
 it("clears unsaved note without changing any records",()=>{mount("SCR-VIS-006");const note=screen.getByRole("textbox",{name:"Unsaved mapping/review note"}) as HTMLTextAreaElement;fireEvent.change(note,{target:{value:"Needs independent geometry review"}});fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect(note.value).toBe("");});
 it("refuses to turn an overlay filter into an engineering approval",()=>{mount("SCR-VIS-005");expect((screen.getByRole("button",{name:"Authorize mapping / engineering action unavailable"})as HTMLButtonElement).disabled).toBe(true);});
});
