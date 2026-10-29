// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {UniversalSearchWorkspace} from "./UniversalSearchWorkspace";
import {discoveryFixture} from "./discoveryFixtures.test-utils";
import {recordContextFixture} from "../record-context/recordContextFixtures.test-utils";
afterEach(cleanup);
function mount(scope="scope-alpha",context:unknown=recordContextFixture()){
 const openRecord=vi.fn(),navigate=vi.fn();render(<UniversalSearchWorkspace snapshot={discoveryFixture()} recordContextSnapshot={context} scopeKey={scope} authorizedAssetIds={["asset-1","asset-2"]} onSelectAsset={vi.fn()} onNavigate={navigate} onOpenRecord={openRecord}/>);return {openRecord,navigate};
}
describe("Phase 19 — shared dossier inside Universal Search",()=>{
 it("shows evidence after selecting an authorized search object",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.getByText("EDMS-RBI-01")).toBeTruthy();});
 it("switches source-backed revision history within the search inspector",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText("engineer-new")).toBeTruthy();});
 it("opens related record inspector without changing owning domain state",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:"Related records"}));fireEvent.click(screen.getByRole("button",{name:"Inspect related record (COR)"}));expect(screen.getByText("EDMS-COR-07")).toBeTruthy();});
 it("routes through explicit identity-aware handoff",()=>{const {openRecord,navigate}=mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));expect(openRecord).toHaveBeenCalledWith(expect.objectContaining({id:"rbi-search-1",revision:"rev-2",screenId:"SCR-RBI-002"}));expect(navigate).not.toHaveBeenCalled();});
 it("withholds related records outside active domain filter",()=>{mount();fireEvent.change(screen.getByRole("combobox",{name:"Domain"}),{target:{value:"RBI"}});fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.queryByRole("button",{name:"Inspect related record (COR)"})).toBeNull();});
 it("does not expose unlisted records when asset filter is active",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:"Related records"}));expect(screen.getByRole("button",{name:"Inspect related record (INS)"})).toBeTruthy();});
 it("rejects mismatched shared-record scope without partial dossier",()=>{mount("scope-beta");expect(screen.getByRole("alert").textContent).toContain("Search snapshot rejected");});
 it("does not treat missing dossier as no evidence exists",()=>{mount("scope-alpha",null);fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.getByText(/Shared evidence and revision index disconnected/)).toBeTruthy();});
 it("withholds shared records when only context snapshot is invalid",()=>{const broken=recordContextFixture();(broken.revisions as Record<string,unknown>[])[0]!.reviewState="IMPLIED_APPROVED";mount("scope-alpha",broken);fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));expect(screen.getByRole("alert").textContent).toContain("Shared evidence/revision dataset rejected");expect(screen.queryByText("EDMS-RBI-01")).toBeNull();});
 it("still shows approved result state separately from dossier presence",()=>{mount("scope-alpha",null);const results=screen.getByRole("region",{name:"Universal search results"});expect(within(results).getByText("APPROVED")).toBeTruthy();});
 it("does not claim approval when selected result is projected",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Synthetic inspection requirement/}));fireEvent.click(screen.getByRole("button",{name:"Revision history"}));expect(screen.getByText("PENDING")).toBeTruthy();});
});
