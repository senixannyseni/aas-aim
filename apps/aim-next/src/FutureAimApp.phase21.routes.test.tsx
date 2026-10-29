// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";
import {SCREENS} from "./screenRegistry";
import {screenHref} from "./screenRouting";

const screenCases=SCREENS.map(s=>[s.id,s.title] as const);
function replaceHash(hash:string):void {
  window.history.replaceState(null,"",window.location.pathname+window.location.search+hash);
}
afterEach(()=>{cleanup();replaceHash("");});

describe("Phase 21: all canonical screen deep links",()=>{
  it.each(screenCases)("opens canonical route %s with its exact screen heading",async(id:string,title:string)=>{
    replaceHash(screenHref(id));
    const view=render(<FutureAimApp/>);
    await waitFor(()=>expect(view.container.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe(title));
    expect(view.container.querySelector(".next-screen-preview .next-eyebrow")?.textContent).toContain(id);
    expect(screen.getByText(/Backend offline/)).toBeTruthy();
  });
  it.each(["#/screens/SCR-RBI-999","#/screens/SCR-FAKE-001","#/screens/SCR-VIS-001?tenant=other"])("does not open an unregistered screen %s",async(hash:string)=>{
    replaceHash(hash);
    render(<FutureAimApp/>);
    await waitFor(()=>expect(screen.getByRole("heading",{name:/One integrity system/i})).toBeTruthy());
    expect(screen.queryByText("Authorized action completed")).toBeNull();
  });
  it("updates the mounted workspace on browser hash navigation",async()=>{
    replaceHash(screenHref("SCR-COR-001"));
    const view=render(<FutureAimApp/>);
    await waitFor(()=>expect(view.container.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe("Corrosion Loop & Circuit Workspace"));
    replaceHash(screenHref("SCR-RBI-002"));
    fireEvent(window,new Event("hashchange"));
    await waitFor(()=>expect(view.container.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe("RBI Assessment Workspace"));
  });
  it("dismisses an open function inspector when browser navigation changes",async()=>{
    render(<FutureAimApp/>);
    fireEvent.click(screen.getByRole("button",{name:/Capability catalogue/i}));
    fireEvent.click(screen.getByRole("button",{name:/AIR-001/i}));
    expect(screen.getByRole("dialog",{name:"Function detail"})).toBeTruthy();
    replaceHash(screenHref("SCR-INS-001"));
    fireEvent(window,new Event("hashchange"));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Function detail"})).toBeNull());
    expect(screen.getByText(/Backend offline/)).toBeTruthy();
  });
  it("dismisses an open mobile nav when a hash route changes",async()=>{
    render(<FutureAimApp/>);
    const menu=screen.getByRole("button",{name:"Toggle navigation"});
    fireEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    replaceHash(screenHref("SCR-AIR-001"));
    fireEvent(window,new Event("hashchange"));
    await waitFor(()=>expect(menu.getAttribute("aria-expanded")).toBe("false"));
  });
});
