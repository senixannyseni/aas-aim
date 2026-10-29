// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {UniversalSearchWorkspace} from "./UniversalSearchWorkspace";
import {AssetContextPicker} from "./AssetContextPicker";
import {discoveryFixture,discoveryAssetFixture} from "./discoveryFixtures.test-utils";
afterEach(cleanup);
function mount(snapshot:unknown=discoveryFixture(),scopeKey:string|undefined="scope-alpha",assetId:string|undefined=undefined){
 const navigate=vi.fn(),select=vi.fn();
 render(<UniversalSearchWorkspace snapshot={snapshot} scopeKey={scopeKey} selectedAssetId={assetId} authorizedAssetIds={["asset-1","asset-2"]} onNavigate={navigate} onSelectAsset={select}/>);
 return {navigate,select};
}
describe("GOV-012 search empty/error/source state",()=>{
 it("does not fabricate results without a search source",()=>{mount(null);expect(screen.getByRole("status").textContent).toContain("disconnected");expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();});
 it("rejects results without matching trusted scope",()=>{mount(discoveryFixture(),"scope-beta");expect(screen.getByRole("alert").textContent).toContain("rejected");expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();});
 it("rejects results if navigation scope is missing",()=>{
  render(<UniversalSearchWorkspace snapshot={discoveryFixture()} authorizedAssetIds={["asset-1","asset-2"]} onNavigate={vi.fn()} onSelectAsset={vi.fn()}/>);
  expect(screen.getByRole("alert").textContent).toContain("rejected");
  expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();
 });
 it("rejects an invalid mixed batch wholesale",()=>{const v=discoveryFixture();(v.records as Record<string,unknown>[])[1]!.screenId="SCR-COR-001";mount(v);expect(screen.getByRole("alert")).toBeTruthy();expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();});
 it("shows valid empty source as empty, not asset-safe",()=>{mount({scopeKey:"scope-alpha",records:[]});expect(screen.getByText(/No matching authorized results/)).toBeTruthy();});
 it("shows explicitly different source states",()=>{mount();const results=screen.getByRole("region",{name:"Universal search results"});for(const state of ["APPROVED","PROJECTED","STALE"])expect(within(results).getByText(state)).toBeTruthy();});
});
describe("GOV-012 search and cross-domain record routing",()=>{
 it("selects record and inspects precise provenance",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.getByText("rbi-source-v2")).toBeTruthy();expect(screen.getByText("rev-2")).toBeTruthy();});
 it("opens canonical owning screen without mutation",()=>{const {navigate}=mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:/Open owning screen \(SCR-RBI-002\)/}));expect(navigate).toHaveBeenCalledWith("SCR-RBI-002");});
 it("filters by case-insensitive reference",()=>{mount();fireEvent.change(screen.getByRole("searchbox",{name:"Search objects"}),{target:{value:"rbi-demo-01"}});expect(screen.getByText("Synthetic RBI assessment")).toBeTruthy();expect(screen.queryByText("Synthetic thickness reading")).toBeNull();});
 it("filters by canonical domain",()=>{mount();fireEvent.change(screen.getByRole("combobox",{name:"Domain"}),{target:{value:"INS"}});expect(screen.getByText("Synthetic inspection requirement")).toBeTruthy();expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();});
 it("filters by source state",()=>{mount();fireEvent.change(screen.getByRole("combobox",{name:"Evidence state"}),{target:{value:"STALE"}});expect(screen.getByText("Synthetic thickness reading")).toBeTruthy();expect(screen.queryByText("Synthetic RBI assessment")).toBeNull();});
 it("does not silently broaden a selected asset filter",()=>{mount(discoveryFixture(),"scope-alpha","asset-1");fireEvent.click(screen.getByRole("checkbox",{name:/Restrict to selected asset/}));expect(screen.getByText("Synthetic RBI assessment")).toBeTruthy();expect(screen.queryByText("Synthetic inspection requirement")).toBeNull();});
 it("does not enable asset context without a validated option",()=>{mount(discoveryFixture(),"scope-alpha","asset-1");fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.getByRole("button",{name:/Set asset navigation context/})).toBeTruthy();});
 it("sets existing authorized asset navigation context",()=>{const {select}=mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:/Set asset navigation context/}));expect(select).toHaveBeenCalledWith("asset-1");});
 it("hides navigation context action for unlisted asset",()=>{const v=discoveryFixture();(v.records as Record<string,unknown>[])[0]!.assetId="not-in-air";mount(v);fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.queryByRole("button",{name:/Set asset navigation context/})).toBeNull();});
});
describe("shared shell selected asset context",()=>{
 it("requires a trusted navigation scope",()=>{render(<AssetContextPicker snapshot={discoveryAssetFixture()} onSelectAsset={vi.fn()}/>);expect(screen.getByText(/Unavailable until a trusted navigation scope/)).toBeTruthy();});
 it("rejects malformed AIR snapshot",()=>{render(<AssetContextPicker scopeKey="scope-alpha" snapshot={{assets:[{id:"broken"}],relationships:[],history:[]}} onSelectAsset={vi.fn()}/>);expect(screen.getByRole("alert")).toBeTruthy();});
 it("requires source data for asset names",()=>{render(<AssetContextPicker scopeKey="scope-alpha" onSelectAsset={vi.fn()}/>);expect(screen.getByText(/Asset context disconnected/)).toBeTruthy();});
 it("shows source-backed tag and selects asset",()=>{const select=vi.fn();render(<AssetContextPicker scopeKey="scope-alpha" snapshot={discoveryAssetFixture()} onSelectAsset={select}/>);fireEvent.change(screen.getByRole("combobox",{name:"Select asset navigation context"}),{target:{value:"asset-1"}});expect(select).toHaveBeenCalledWith("asset-1");});
 it("clears selected asset on demand",()=>{const select=vi.fn();render(<AssetContextPicker scopeKey="scope-alpha" snapshot={discoveryAssetFixture()} selectedAssetId="asset-1" onSelectAsset={select}/>);fireEvent.click(screen.getByRole("button",{name:"Clear selected asset"}));expect(select).toHaveBeenCalledWith(undefined);});
 it("does not display orphaned selected asset",()=>{render(<AssetContextPicker scopeKey="scope-alpha" snapshot={discoveryAssetFixture()} selectedAssetId="another-tenant-id" onSelectAsset={vi.fn()}/>);expect(screen.getByText("No selected asset",{selector:"strong"})).toBeTruthy();});
});
