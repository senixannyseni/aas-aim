// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{
  cleanup();
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  document.body.style.overflow="";
});

function mount():ReturnType<typeof render>{return render(<FutureAimApp/>);}
function openInspector(container:HTMLElement):HTMLButtonElement {
  fireEvent.click(screen.getByRole("button",{name:/Capability catalogue/i}));
  const trigger=container.querySelector<HTMLButtonElement>(".next-function-list .next-capability");
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger!);
  expect(screen.getByRole("dialog",{name:"Function detail"})).toBeTruthy();
  return trigger!;
}

describe("Phase 24: modal background isolation and focus lifecycle",()=>{
  it("makes background regions inert and locks body scrolling while mobile navigation is open",()=>{
    const {container}=mount();
    fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));
    const drawer=screen.getByRole("dialog",{name:"Primary navigation"});
    expect(drawer.hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector(".next-skip")?.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("button",{name:"Close mobile navigation"}).tabIndex).toBe(-1);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(drawer,{key:"Escape"});
    expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".next-skip")?.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
  it("isolates both the sidebar and application body when the function inspector opens",()=>{
    const {container}=mount();
    openInspector(container);
    expect(container.querySelector(".next-sidebar")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector(".next-skip")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector(".next-backdrop")?.getAttribute("tabindex")).toBe("-1");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("dialog",{name:"Function detail"}).querySelector<HTMLButtonElement>(".next-icon-button")!);
    expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector(".next-sidebar")?.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
  it("keeps focus in the inspector and restores the invoking capability on Escape",()=>{
    const {container}=mount();
    const trigger=openInspector(container);
    const inspector=screen.getByRole("dialog",{name:"Function detail"});
    const buttons=inspector.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    expect(document.activeElement).toBe(buttons[0]);
    buttons[buttons.length-1]!.focus();
    fireEvent.keyDown(inspector,{key:"Tab"});
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(inspector,{key:"Escape"});
    expect(document.activeElement).toBe(trigger);
  });
  it("moves focus to the destination workspace when navigating from an inspector target",()=>{
    const {container}=mount();
    openInspector(container);
    const dialog=screen.getByRole("dialog",{name:"Function detail"});
    const target=dialog.querySelector<HTMLButtonElement>(".next-mapped-targets button");
    expect(target).not.toBeNull();
    const screenId=target?.querySelector("code")?.textContent;
    expect(screenId).toMatch(/^SCR-/);
    fireEvent.click(target!);
    expect(screen.queryByRole("dialog",{name:"Function detail"})).toBeNull();
    expect(window.location.hash).toBe(`#/screens/${screenId}`);
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
});
