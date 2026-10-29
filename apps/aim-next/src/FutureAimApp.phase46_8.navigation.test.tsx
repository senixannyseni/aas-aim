// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import FutureAimApp from "./FutureAimApp";
import {SCREEN_BY_ID} from "./screenRegistry";
import {discoveryAssetFixture} from "./features/discovery/discoveryFixtures.test-utils";

function route(id:string):void {
  window.history.replaceState(null,"",window.location.pathname+window.location.search+`#/screens/${id}`);
  act(()=>window.dispatchEvent(new Event("hashchange")));
}
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});

describe("Phase 46.8 — navigation context continuity",()=>{
  it("keeps bounded recent canonical screens and returns without fabricating domain records",async()=>{
    render(<FutureAimApp navigationScopeKey="review-a"/>);
    route("SCR-AIR-001");
    route("SCR-COR-001");
    route("SCR-INS-001");
    const trail=await screen.findByRole("navigation",{name:"Recently visited workspaces"});
    expect(within(trail).getByRole("button",{name:/Corrosion Loop & Circuit Workspace/i})).toBeTruthy();
    expect(within(trail).getByRole("button",{name:/Asset Register/i})).toBeTruthy();
    fireEvent.click(within(trail).getByRole("button",{name:/Corrosion Loop & Circuit Workspace/i}));
    await waitFor(()=>expect(window.location.hash).toBe("#/screens/SCR-COR-001"));
    expect(screen.getByText("No authenticated session")).toBeTruthy();
    expect(screen.queryByText("Authoritative action completed")).toBeNull();
    expect(SCREEN_BY_ID.size).toBe(78);
  });
  it("does not expose previous scope history after navigation scope rotation",async()=>{
    const view=render(<FutureAimApp navigationScopeKey="review-a"/>);
    route("SCR-COR-001");route("SCR-INS-001");
    await screen.findByRole("navigation",{name:"Recently visited workspaces"});
    view.rerender(<FutureAimApp navigationScopeKey="review-b"/>);
    expect(screen.queryByRole("navigation",{name:"Recently visited workspaces"})).toBeNull();
  });
  it("clears selected asset synchronously on AIR-scope rotation even for an unchanged asset ID",()=>{
    const snapshot=discoveryAssetFixture();
    const view=render(<FutureAimApp navigationScopeKey="review-a" assetScopeKey="air-scope-1" assetSnapshot={snapshot}/>);
    fireEvent.change(screen.getByRole("combobox",{name:"Select asset navigation context"}),{target:{value:"asset-1"}});
    expect(screen.getByText("DEMO-V101")).toBeTruthy();
    view.rerender(<FutureAimApp navigationScopeKey="review-a" assetScopeKey="air-scope-2" assetSnapshot={snapshot}/>);
    expect(screen.getByText("No selected asset",{selector:"strong"})).toBeTruthy();
  });
  it("does not display record identifiers in the recent screen trail",async()=>{
    render(<FutureAimApp navigationScopeKey="review-a"/>);
    route("SCR-AIR-001");route("SCR-COR-001");
    const trail=await screen.findByRole("navigation",{name:"Recently visited workspaces"});
    expect(trail.textContent).toContain("Asset Register");
    expect(trail.textContent).not.toContain("V-101");
    expect(trail.textContent).not.toContain("tenant");
  });
});
