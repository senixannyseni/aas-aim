// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";
import {discoveryFixture,discoveryAssetFixture} from "./features/discovery/discoveryFixtures.test-utils";
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
function mount(scopeKey:string|undefined="scope-alpha"){
 return render(<FutureAimApp navigationScopeKey={scopeKey} assetSnapshot={discoveryAssetFixture()} discoverySnapshot={discoveryFixture()}/>);
}
describe("Phase 18 application shell integration",()=>{
 it("keeps Universal Search discoverable from the shared sidebar",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Universal search/i}));expect(screen.getByText("Synthetic RBI assessment")).toBeTruthy();});
 it("navigates from search result to owning RBI screen",()=>{mount();fireEvent.click(screen.getByRole("button",{name:/Universal search/i}));fireEvent.click(screen.getByRole("button",{name:/Synthetic RBI assessment/}));fireEvent.click(screen.getByRole("button",{name:/Open owning screen \(SCR-RBI-002\)/}));expect(screen.getByRole("heading",{name:"RBI Assessment Workspace"})).toBeTruthy();});
 it("persists selected asset across domain navigation",()=>{mount();fireEvent.change(screen.getByRole("combobox",{name:"Select asset navigation context"}),{target:{value:"asset-1"}});fireEvent.click(within(screen.getByLabelText("Primary navigation")).getByRole("button",{name:/Risk-Based Inspection/i}));expect(screen.getByText("DEMO-V101")).toBeTruthy();});
 it("rotates navigation context synchronously on trust-scope change",()=>{const view=mount();fireEvent.change(screen.getByRole("combobox",{name:"Select asset navigation context"}),{target:{value:"asset-1"}});expect(screen.getByText("DEMO-V101")).toBeTruthy();view.rerender(<FutureAimApp navigationScopeKey="scope-beta" assetSnapshot={discoveryAssetFixture()} discoverySnapshot={discoveryFixture()}/>);expect(screen.getByText("No selected asset",{selector:"strong"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:/Universal search/i}));expect(screen.getByRole("alert").textContent).toContain("scope");});
 it("remains disconnected with default startup",()=>{render(<FutureAimApp/>);fireEvent.click(screen.getByRole("button",{name:/Universal search/i}));expect(screen.getByRole("status").textContent).toContain("disconnected");});
 it("preserves 190-function catalogue independently of records",()=>{render(<FutureAimApp/>);fireEvent.click(screen.getByRole("button",{name:/Capability catalogue/i}));expect(screen.getByText(/190 matching functions/)).toBeTruthy();});
});
