// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import FutureAimApp from "../../FutureAimApp";
import {EMPTY_CORROSION} from "../corrosion/corrosionModel";
import {inspectionFixture} from "../inspection/inspectionFixtures.test-utils";
const at="2026-03-01T00:00:00Z";
const source=()=>({navigationScopeKey:"NAV-1",crossDomainScopeKey:"NAV-1",assetScopeKey:"AIR-1",corrosionScopeKey:"COR-1",inspectionScopeKey:"INS-1",
  assetSnapshot:{assets:[{id:"TEST-ASSET-1",tag:"V-101",name:"Synthetic vessel",kind:"EQUIPMENT",state:"ACTIVE"}],relationships:[],history:[]},
  corrosionSnapshot:{...EMPTY_CORROSION,loops:[{id:"L1",assetId:"TEST-ASSET-1",name:"Loop",systemReference:"S",basisReference:"SOURCE-LOOP"}],
    circuits:[{id:"C1",loopId:"L1",code:"COR-TEST",name:"Shell",assetId:"TEST-ASSET-1",revision:"C-1",state:"ACTIVE"}],
    calculations:[{id:"CAL1",circuitId:"C1",revision:"v1",status:"DRAFT",basisReference:"BASIS-CAL",inputReadingIds:[],traceReference:"TRACE-123",calculatedAt:at}]},
  inspectionSnapshot:inspectionFixture(),
});
function navigate(hash:string){window.history.replaceState(null,"",window.location.pathname+window.location.search+hash);fireEvent(window,new Event("hashchange"));}
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
function open(){navigate("#/screens/SCR-AIR-001");render(<FutureAimApp {...source()}/>);fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
  const rail=screen.getByRole("region",{name:"Asset to Corrosion to Inspection investigation"});
  const ledger=within(rail).getByText("Engineering evidence navigator").closest("details")!;
  fireEvent.click(within(ledger).getByText("Engineering evidence navigator"));
  return {rail,ledger};
}
describe("Phase 46.5: owning-domain evidence journey",()=>{
  it("displays inert source references and navigates to the owning COR circuit",()=>{
    const {rail,ledger}=open();
    const b=within(ledger).getByRole("button",{name:/COR · Calculation trace TRACE-123/});
    fireEvent.click(b);
    expect(within(ledger).getByText("BASIS-CAL")).toBeTruthy();
    fireEvent.click(within(ledger).getByRole("button",{name:"View owning COR record context"}));
    expect(window.location.hash).toBe("#/screens/SCR-COR-001");
    expect(within(rail).getAllByText("SOURCE-LOOP").length).toBeGreaterThan(0);
  });
  it("does not conflate candidate with governing INS decision",()=>{
    const {ledger}=open();
    fireEvent.click(within(ledger).getByRole("button",{name:/INS · Due candidate test-cor-basis/}));
    expect(within(ledger).getByText(/not the governing technical due date/i)).toBeTruthy();
  });
  it("removes evidence on cross-domain scope withdrawal",()=>{
    navigate("#/screens/SCR-AIR-001");const mounted=render(<FutureAimApp {...source()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    expect(screen.getByText("Engineering evidence navigator")).toBeTruthy();
    mounted.rerender(<FutureAimApp {...source()} crossDomainScopeKey="DIFFERENT"/>);
    expect(screen.queryByText("Engineering evidence navigator")).toBeNull();
  });
  it("hides COR references when independently scoped COR source is withdrawn",()=>{
    navigate("#/screens/SCR-AIR-001");
    const mounted=render(<FutureAimApp {...source()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    const rail=screen.getByRole("region",{name:"Asset to Corrosion to Inspection investigation"});
    fireEvent.click(within(rail).getByText("Engineering evidence navigator"));
    expect(within(rail).getByText("TRACE-123")).toBeTruthy();
    const {corrosionScopeKey: _removedCorrosionScopeKey, ...withdrawnCorrosionScope} = source();
    void _removedCorrosionScopeKey;
    mounted.rerender(<FutureAimApp {...withdrawnCorrosionScope}/>);
    const next=screen.getByRole("region",{name:"Asset to Corrosion to Inspection investigation"});
    fireEvent.click(within(next).getByText("Engineering evidence navigator"));
    expect(within(next).queryByText("TRACE-123")).toBeNull();
    expect(within(next).getByText(/COR source not connected/)).toBeTruthy();
  });
});
