// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
const mount=()=>render(<FutureAimApp/>);
function openDrawer():HTMLElement {
  fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));
  return screen.getByRole("dialog",{name:"Primary navigation"});
}
describe("Phase 22: mobile navigation accessible modal and focus safety",()=>{
  it("has an explicitly named modal while open",()=>{
    mount();const drawer=openDrawer();
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    expect(document.querySelector(".next-menu")?.getAttribute("aria-expanded")).toBe("true");
  });
  it("starts keyboard focus inside the drawer",()=>{
    mount();const drawer=openDrawer();
    expect(document.activeElement).toBe(drawer.querySelector("button:not(:disabled)"));
  });
  it("wraps Tab from last button back to first",()=>{
    mount();const drawer=openDrawer();
    const buttons=drawer.querySelectorAll("button:not(:disabled)") as NodeListOf<HTMLButtonElement>;
    buttons[buttons.length-1]!.focus();fireEvent.keyDown(drawer,{key:"Tab"});
    expect(document.activeElement).toBe(buttons[0]);
  });
  it("wraps Shift+Tab from first button back to last",()=>{
    mount();const drawer=openDrawer();
    const buttons=drawer.querySelectorAll("button:not(:disabled)") as NodeListOf<HTMLButtonElement>;
    buttons[0]!.focus();fireEvent.keyDown(drawer,{key:"Tab",shiftKey:true});
    expect(document.activeElement).toBe(buttons[buttons.length-1]);
  });
  it("dismisses on Escape and restores focus to the menu button",()=>{
    mount();const drawer=openDrawer();fireEvent.keyDown(drawer,{key:"Escape"});
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Toggle navigation"}));
  });
  it("dismisses on backdrop and restores focus to the menu button",()=>{
    mount();openDrawer();fireEvent.click(screen.getByRole("button",{name:"Close mobile navigation"}));
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Toggle navigation"}));
  });
  it("moves focus to the newly selected main workspace after drawer navigation",()=>{
    mount();const drawer=openDrawer();
    fireEvent.click(Array.from(drawer.querySelectorAll("button")).find(b=>b.textContent?.includes("Degradation Mechanisms"))!);
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
  it("moves focus to the capability catalogue after mobile navigation",()=>{
    mount();const drawer=openDrawer();
    fireEvent.click(Array.from(drawer.querySelectorAll("button")).find(b=>b.textContent?.includes("Capability catalogue"))!);
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
  it("moves focus to the architecture overview after mobile navigation",()=>{
    mount();const drawer=openDrawer();
    fireEvent.click(Array.from(drawer.querySelectorAll("button")).find(b=>b.textContent?.includes("Architecture overview"))!);
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
  it("moves focus to the main region when a browser hash route changes during an open drawer",()=>{
    mount();openDrawer();
    window.history.replaceState(null,"",window.location.pathname+window.location.search+"#/screens/SCR-RBI-001");
    fireEvent(window,new Event("hashchange"));
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
  it("fails closed and focuses main if an invalid hash route arrives while the drawer is open",()=>{
    mount();openDrawer();
    window.history.replaceState(null,"",window.location.pathname+window.location.search+"#/screens/SCR-FAKE-001");
    fireEvent(window,new Event("hashchange"));
    expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("next-main"));
    expect(screen.getByRole("heading",{name:/One integrity system/i})).toBeTruthy();
  });
  it("leaves desktop navigation as a non-modal primary landmark",()=>{
    mount();expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
    expect(screen.getByLabelText("Primary navigation").getAttribute("aria-modal")).toBeNull();
  });
});
