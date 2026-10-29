// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);vi.restoreAllMocks();});
function openFinder():void {fireEvent.click(screen.getByText("Find a workspace"));}

describe("Phase 46.11 — workspace finder shell integration",()=>{
  it("opens a canonical COR screen from a mapped capability ID without an API call",async()=>{
    const fetchSpy=vi.spyOn(globalThis,"fetch");
    render(<FutureAimApp/>);
    openFinder();
    fireEvent.change(screen.getByRole("searchbox",{name:"Search canonical screens"}),{target:{value:"COR-015"}});
    const resultList=screen.getByRole("group",{name:"Matching canonical screens"});
    fireEvent.click(within(resultList).getByRole("button",{name:/Corrosion Calculation Workspace/i}));
    await waitFor(()=>expect(window.location.hash).toBe("#/screens/SCR-COR-004"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("No authenticated session")).toBeTruthy();
  });
  it("shows an explicit limited result count rather than silently hiding screens",()=>{
    render(<FutureAimApp/>);
    openFinder();
    fireEvent.change(screen.getByRole("searchbox",{name:"Search canonical screens"}),{target:{value:"SCR"}});
    expect(screen.getByText(/78 matching canonical screens/).textContent).toContain("78 matching canonical screens");
    expect(screen.getByText(/first 8 shown; refine your search/)).toBeTruthy();
    expect(within(screen.getByRole("group",{name:"Matching canonical screens"})).getAllByRole("button")).toHaveLength(8);
  });
  it("does not carry search text across trusted navigation-scope changes",()=>{
    const view=render(<FutureAimApp navigationScopeKey="scope-a"/>);
    openFinder();
    fireEvent.change(screen.getByRole("searchbox",{name:"Search canonical screens"}),{target:{value:"Asset"}});
    view.rerender(<FutureAimApp navigationScopeKey="scope-b"/>);
    openFinder();
    expect((screen.getByRole("searchbox",{name:"Search canonical screens"}) as HTMLInputElement).value).toBe("");
  });
  it("navigation keeps the canonical target after a hash synchronization event",async()=>{
    render(<FutureAimApp/>);
    openFinder();
    fireEvent.change(screen.getByRole("searchbox",{name:"Search canonical screens"}),{target:{value:"SCR-INS-001"}});
    fireEvent.click(within(screen.getByRole("group",{name:"Matching canonical screens"})).getByRole("button",{name:/Inspection Requirements List/i}));
    act(()=>window.dispatchEvent(new Event("hashchange")));
    await waitFor(()=>expect(screen.getAllByRole("heading",{name:"Inspection Requirements List"})[0]).toBeTruthy());
  });
});
