// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";
import {discoveryFixture,discoveryAssetFixture} from "./features/discovery/discoveryFixtures.test-utils";
import {recordContextFixture} from "./features/record-context/recordContextFixtures.test-utils";
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
function mount(scope="scope-alpha",recordContext:unknown=recordContextFixture()){
 return render(<FutureAimApp navigationScopeKey={scope} assetSnapshot={discoveryAssetFixture()} discoverySnapshot={discoveryFixture()} recordContextSnapshot={recordContext}/>);
}
function toSearch(){fireEvent.click(within(screen.getByRole("complementary",{name:"Primary navigation"})).getByRole("button",{name:/Universal search/i}));}
function selectRbi(){fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));}
describe("Phase 19 — shell-level record navigation context",()=>{
 it("displays exact object and source revision after owning-screen navigation",()=>{mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen \(SCR-RBI-002\)/}));expect(screen.getByText(/Record navigation reference/)).toBeTruthy();expect(screen.getByText(/RBI-DEMO-01 \/ rev-2/)).toBeTruthy();});
 it("does not claim owning record has been auto-loaded",()=>{mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));expect(screen.getByText(/exact record selection and authority still require the owning service/)).toBeTruthy();});
 it("keeps the canonical owning screen visible",()=>{mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));expect(screen.getByRole("heading",{name:"RBI Assessment Workspace"})).toBeTruthy();});
 it("clears record handoff when navigating elsewhere",()=>{mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));toSearch();expect(screen.queryByText(/Record navigation reference/)).toBeNull();});
 it("can dismiss the record navigation reference",()=>{mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));fireEvent.click(screen.getByRole("button",{name:"Dismiss record navigation reference"}));expect(screen.queryByText(/Record navigation reference/)).toBeNull();});
 it("resets the handoff synchronously on trusted navigation-scope change",()=>{const view=mount();toSearch();selectRbi();fireEvent.click(screen.getByRole("button",{name:/Open owning screen/}));view.rerender(<FutureAimApp navigationScopeKey="scope-beta" discoverySnapshot={discoveryFixture()} recordContextSnapshot={recordContextFixture()}/>);expect(screen.queryByText(/Record navigation reference/)).toBeNull();});
 it("does not present a dossier without explicitly supplied shared index",()=>{mount("scope-alpha",null);toSearch();selectRbi();expect(screen.getByText(/Shared evidence and revision index disconnected/)).toBeTruthy();});
 it("does not offer a protected approval from shared navigation",()=>{mount();toSearch();selectRbi();expect(screen.queryByRole("button",{name:"Approve engineering record"})).toBeNull();});
});
