// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{
  vi.restoreAllMocks();
  cleanup();
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  document.body.style.overflow="";
});

function assertFocusAfterInertRemoval(dismiss:(drawer:HTMLElement)=>void):void {
  const {container}=render(<FutureAimApp/>);
  const menu=screen.getByRole("button",{name:"Toggle navigation"});
  fireEvent.click(menu);
  const drawer=screen.getByRole("dialog",{name:"Primary navigation"});
  const body=container.querySelector<HTMLElement>(".next-body");
  expect(body?.hasAttribute("inert")).toBe(true);
  const originalFocus=menu.focus.bind(menu);
  const inertAtFocus:boolean[]=[];
  vi.spyOn(menu,"focus").mockImplementation(()=>{
    inertAtFocus.push(Boolean(body?.hasAttribute("inert")));
    originalFocus();
  });
  dismiss(drawer);
  expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
  expect(inertAtFocus).toEqual([false]);
  expect(document.activeElement).toBe(menu);
}

describe("Phase 26: restore mobile-menu focus only after removing inert",()=>{
  it("restores keyboard focus after Escape without targeting inert content",()=>{
    assertFocusAfterInertRemoval(drawer=>fireEvent.keyDown(drawer,{key:"Escape"}));
  });
  it("restores keyboard focus after backdrop dismissal without targeting inert content",()=>{
    assertFocusAfterInertRemoval(()=>fireEvent.click(screen.getByRole("button",{name:"Close mobile navigation"})));
  });
  it("untraps the desktop workspace when viewport expands while mobile navigation is open",()=>{
    const before=Object.getOwnPropertyDescriptor(window,"innerWidth");
    try {
      Object.defineProperty(window,"innerWidth",{value:375, configurable:true});
      const {container}=render(<FutureAimApp/>);
      fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));
      expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(true);
      Object.defineProperty(window,"innerWidth",{value:1280, configurable:true});
      fireEvent(window,new Event("resize"));
      expect(screen.queryByRole("dialog",{name:"Primary navigation"})).toBeNull();
      expect(container.querySelector(".next-body")?.hasAttribute("inert")).toBe(false);
      expect(document.activeElement).toBe(document.getElementById("next-main"));
    } finally {
      if(before)Object.defineProperty(window,"innerWidth",before);
    }
  });
});
