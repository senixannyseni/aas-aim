// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

const route = "#/screens/SCR-AIR-001";
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});

describe("Phase 23: skip navigation must not corrupt hash-based screen routing",()=>{
  it("focuses main without changing a valid screen route",()=>{
    window.history.replaceState(null,"",window.location.pathname+window.location.search+route);
    const view=render(<FutureAimApp/>);
    const skip=screen.getByRole("link",{name:"Skip to main content"});
    expect(skip.getAttribute("href")).toBe("#next-main");
    fireEvent.click(skip);
    expect(window.location.hash).toBe(route);
    expect(document.activeElement).toBe(document.getElementById("next-main"));
    expect(view.container.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe("Asset Register");
  });
  it("retains the architecture overview when activated without a screen hash",()=>{
    render(<FutureAimApp/>);
    fireEvent.click(screen.getByRole("link",{name:"Skip to main content"}));
    expect(window.location.hash).toBe("");
    expect(document.activeElement).toBe(document.getElementById("next-main"));
    expect(screen.getByRole("heading",{name:/One integrity system/i})).toBeTruthy();
  });
});
