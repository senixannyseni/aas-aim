// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {ScreenWorkflowGuide} from "./ScreenWorkflowGuide";
import {SCREEN_BY_ID} from "./screenRegistry";
import FutureAimApp from "./FutureAimApp";

afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
const mapped=(id:string)=>SCREEN_BY_ID.get(id)!;

describe("Phase 46.12 — workflow guidance UI",()=>{
  it("starts collapsed and reveals only canonical metadata when expanded",()=>{
    const navigate=vi.fn();
    render(<ScreenWorkflowGuide screen={mapped("SCR-COR-004")} onNavigate={navigate}/>);
    const summary=screen.getByText(/Workflow guidance/);
    expect(summary.closest("details")?.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
    expect(screen.getByText(/No records, permissions or engineering completeness are verified here/)).toBeTruthy();
    expect(screen.getByText(/INS-016 determines the governing technical due date/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("offers only canonical same-domain navigation",()=>{
    const navigate=vi.fn();
    render(<ScreenWorkflowGuide screen={mapped("SCR-COR-004")} onNavigate={navigate}/>);
    fireEvent.click(screen.getByText(/Workflow guidance/));
    const group=screen.getByRole("region",{name:"Related canonical workspaces"});
    const buttons=within(group).queryAllByRole("button");
    if (buttons.length) {
      fireEvent.click(buttons[0]!);
      expect(navigate.mock.calls[0]?.[0]?.domain).toBe("COR");
    }
  });
  it("shows no request/approval button in the guide",()=>{
    render(<ScreenWorkflowGuide screen={mapped("SCR-AIR-001")} onNavigate={()=>{}}/>);
    fireEvent.click(screen.getByText(/Workflow guidance/));
    expect(screen.queryByRole("button",{name:/approve|save|submit/i})).toBeNull();
  });
  it("renders the guide only on canonical workspace screens",()=>{
    window.history.replaceState(null,"",window.location.pathname+window.location.search+"#/screens/SCR-INS-006");
    render(<FutureAimApp/>);
    expect(screen.getByText(/Workflow guidance · SCR-INS-006/)).toBeTruthy();
  });
});
