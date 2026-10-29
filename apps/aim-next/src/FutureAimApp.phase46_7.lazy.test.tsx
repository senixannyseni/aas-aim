// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import FutureAimApp from "./FutureAimApp";

afterEach(() => {cleanup();window.history.replaceState(null, "", window.location.pathname + window.location.search);});

describe("Phase 46.7 — route-scoped workspace modules", () => {
  it.each([
    ["SCR-COR-001", "Corrosion and Thickness Management workspace"],
    ["SCR-INS-001", "Inspection Management workspace"],
  ])("loads %s on its canonical route and preserves disconnected authority", async (route, region) => {
    window.history.replaceState(null,"",window.location.pathname + window.location.search + `#/screens/${route}`);
    render(<FutureAimApp/>);
    expect(await screen.findByRole("region", {name:region})).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Loading .* workspace…/)).toBeNull());
    expect(screen.getByText("No authenticated session")).toBeTruthy();
    expect(screen.queryByText("Authoritative action completed")).toBeNull();
  });

  it("retains the AIR workspace as a synchronous first-use surface",()=>{
    window.history.replaceState(null,"",window.location.pathname + window.location.search + "#/screens/SCR-AIR-001");
    render(<FutureAimApp/>);
    expect(document.querySelector(".next-screen-preview .next-section-head h2")?.textContent).toBe("Asset Register");
  });
});
