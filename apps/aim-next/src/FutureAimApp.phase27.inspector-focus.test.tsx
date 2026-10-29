// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{
  vi.restoreAllMocks();
  cleanup();
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  document.body.style.overflow="";
});

function openInspector():{trigger:HTMLButtonElement;dialog:HTMLElement;body:HTMLElement}{
  const {container}=render(<FutureAimApp/>);
  fireEvent.click(screen.getByRole("button",{name:/Capability catalogue/i}));
  const trigger=container.querySelector<HTMLButtonElement>(".next-function-list .next-capability");
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger!);
  const dialog=screen.getByRole("dialog",{name:"Function detail"});
  const body=container.querySelector<HTMLElement>(".next-body");
  expect(body?.hasAttribute("inert")).toBe(true);
  return {trigger:trigger!,dialog,body:body!};
}

function assertDismissedFocusAfterIsolationRemoved(dismiss:(dialog:HTMLElement)=>void):void{
  const {trigger,dialog,body}=openInspector();
  const focus=trigger.focus.bind(trigger);
  const wasInert:boolean[]=[];
  vi.spyOn(trigger,"focus").mockImplementation(()=>{
    wasInert.push(body.hasAttribute("inert"));
    focus();
  });
  dismiss(dialog);
  expect(screen.queryByRole("dialog",{name:"Function detail"})).toBeNull();
  expect(body.hasAttribute("inert")).toBe(false);
  expect(wasInert).toEqual([false]);
  expect(document.activeElement).toBe(trigger);
}

describe("Phase 27: inspector focus after the inert background is removed",()=>{
  it("returns to the actual invoker after Escape, not while the invoker is inert",()=>{
    assertDismissedFocusAfterIsolationRemoved(dialog=>fireEvent.keyDown(dialog,{key:"Escape"}));
  });
  it("returns to the invoker after clicking the Close function detail button",()=>{
    assertDismissedFocusAfterIsolationRemoved(dialog=>fireEvent.click(dialog.querySelector<HTMLButtonElement>(".next-icon-button")!));
  });
  it("returns to the invoker after backdrop dismissal",()=>{
    assertDismissedFocusAfterIsolationRemoved(()=>fireEvent.click(screen.getByRole("button",{name:"Dismiss function detail backdrop"})));
  });
  it("focuses the new workspace after inspector navigation, never a still-inert main element",()=>{
    const {dialog,body,trigger}=openInspector();
    const main=document.getElementById("next-main")!;
    const focus=main.focus.bind(main);
    const wasInert:boolean[]=[];
    vi.spyOn(main,"focus").mockImplementation(()=>{
      wasInert.push(body.hasAttribute("inert"));
      focus();
    });
    fireEvent.click(dialog.querySelector<HTMLButtonElement>(".next-mapped-targets button")!);
    expect(screen.queryByRole("dialog",{name:"Function detail"})).toBeNull();
    expect(wasInert).toEqual([false]);
    expect(document.activeElement).toBe(main);
    expect(document.activeElement).not.toBe(trigger);
  });
  it("falls back to the workspace if the original invoking button was removed",()=>{
    const {dialog,trigger,body}=openInspector();
    trigger.remove();
    fireEvent.keyDown(dialog,{key:"Escape"});
    expect(body.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(document.getElementById("next-main"));
  });
});
