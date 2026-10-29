// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
const mount=()=>render(<FutureAimApp/>);
function inspectFirstCapability(){
  fireEvent.click(screen.getByRole("button",{name:/Capability catalogue/i}));
  const opener=screen.getByRole("button",{name:/AIR-001/i});
  fireEvent.click(opener);
  return opener;
}
describe("Phase 20: accessible shared shell regression",()=>{
  it("keeps a keyboard-visible skip link",()=>{mount();expect(screen.getByRole("link",{name:"Skip to main content"}).getAttribute("href")).toBe("#next-main");});
  it("marks function inspection as a modal dialog",()=>{mount();inspectFirstCapability();const dialog=screen.getByRole("dialog",{name:"Function detail"});expect(dialog.getAttribute("aria-modal")).toBe("true");});
  it("focuses the dialog close button rather than leaving focus behind the overlay",()=>{
    let last = performance.now();

    function mark(label: string) {
      const now = performance.now();
      console.log(`[FOCUS PROFILE] ${label}: ${(now-last).toFixed(1)}ms`);
      last = now;
    }

    mount();
    mark("Mount application");

    const catalogue = screen.getByRole("button",{name:/Capability catalogue/i});
    mark("Find catalogue button");

    fireEvent.click(catalogue);
    mark("Open catalogue");

    const opener = screen.getByRole("button",{name:/AIR-001/i});
    mark("Find AIR-001");

    fireEvent.click(opener);
    mark("Open inspector");

    const close = screen.getByRole("button",{name:"Close function detail"});
    mark("Find close button");

    expect(document.activeElement).toBe(close);
    mark("Verify keyboard focus");
  },15000);
  it("closes the inspector with Escape and restores keyboard focus",()=>{mount();const opener=inspectFirstCapability();fireEvent.keyDown(screen.getByRole("dialog"),{key:"Escape"});expect(screen.queryByRole("dialog")).toBeNull();expect(document.activeElement).toBe(opener);});
  it("cycles backward from the first dialog control to the last",()=>{mount();inspectFirstCapability();const dialog=screen.getByRole("dialog");const last=dialog.querySelectorAll("button:not(:disabled)");fireEvent.keyDown(dialog,{key:"Tab",shiftKey:true});expect(document.activeElement).toBe(last[last.length-1]);});
  it("cycles forward from the last dialog control to the first",()=>{mount();inspectFirstCapability();const dialog=screen.getByRole("dialog");const buttons=dialog.querySelectorAll("button:not(:disabled)") as NodeListOf<HTMLButtonElement>;buttons[buttons.length-1]!.focus();fireEvent.keyDown(dialog,{key:"Tab"});expect(document.activeElement).toBe(buttons[0]);});
  it("opens mobile navigation with an explicitly labeled dismiss control",()=>{mount();const menu=screen.getByRole("button",{name:"Toggle navigation"});fireEvent.click(menu);expect(menu.getAttribute("aria-expanded")).toBe("true");expect(screen.getByRole("button",{name:"Close mobile navigation"})).toBeTruthy();});
  it("closes mobile navigation on backdrop activation",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));fireEvent.click(screen.getByRole("button",{name:"Close mobile navigation"}));expect(screen.getByRole("button",{name:"Toggle navigation"}).getAttribute("aria-expanded")).toBe("false");expect(screen.queryByRole("button",{name:"Close mobile navigation"})).toBeNull();});
  it("closes mobile navigation on Escape and restores the menu button",()=>{mount();const menu=screen.getByRole("button",{name:"Toggle navigation"});fireEvent.click(menu);fireEvent.keyDown(screen.getByLabelText("Primary navigation"),{key:"Escape"});expect(menu.getAttribute("aria-expanded")).toBe("false");expect(document.activeElement).toBe(menu);});
  it("does not claim backend connectivity after responsive navigation",()=>{mount();fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));expect(screen.getByText(/Backend offline/)).toBeTruthy();});
});
