// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,describe,expect,it} from "vitest";
import FutureAimApp from "../../FutureAimApp";
import {inspectionFixture} from "../inspection/inspectionFixtures.test-utils";
import {EMPTY_CORROSION} from "../corrosion/corrosionModel";

const asset=()=>({assets:[{id:"TEST-ASSET-1",tag:"V-101",name:"Test Vessel",kind:"EQUIPMENT",state:"ACTIVE",revision:"2"}],relationships:[],history:[]});
const corrosion=()=>({...EMPTY_CORROSION,
  loops:[{id:"loop-1",name:"Loop",assetId:"TEST-ASSET-1",systemReference:"S",basisReference:"cor-source"}],
  circuits:[{id:"c-1",loopId:"loop-1",code:"COR-TEST",name:"Circuit",assetId:"TEST-ASSET-1",revision:"1",state:"ACTIVE"}],
});
function props(){return {navigationScopeKey:"site-1-epoch-1",crossDomainScopeKey:"site-1-epoch-1",assetScopeKey:"air-1",corrosionScopeKey:"cor-1",inspectionScopeKey:"ins-1",assetSnapshot:asset(),corrosionSnapshot:corrosion(),inspectionSnapshot:inspectionFixture()};}
function navigate(hash:string){window.history.replaceState(null,"",window.location.pathname+window.location.search+hash);fireEvent(window,new Event("hashchange"));}
afterEach(()=>{cleanup();window.history.replaceState(null,"",window.location.pathname+window.location.search);});
describe("Phase 46.4: three-domain canonical journey",()=>{
  it("hides the rail when cross-domain navigation is not explicitly authorized",()=>{
    navigate("#/screens/SCR-AIR-001");
    const {crossDomainScopeKey: withheld,...withoutAttestation}=props();
    expect(withheld).toBeTruthy();
    render(<FutureAimApp {...withoutAttestation}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    expect(screen.queryByRole("region",{name:"Asset to Corrosion to Inspection investigation"})).toBeNull();
  });
  it("navigates AIR → COR → INS → AIR without losing the authorized asset selection",()=>{
    navigate("#/screens/SCR-AIR-001");
    render(<FutureAimApp {...props()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    const rail=()=>screen.getByRole("region",{name:"Asset to Corrosion to Inspection investigation"});
    expect(within(rail()).getByText(/Selected asset:/)).toBeTruthy();
    fireEvent.click(within(rail()).getByRole("button",{name:/02 Corrosion/i}));
    expect(window.location.hash).toBe("#/screens/SCR-COR-001");
    fireEvent.click(within(rail()).getByRole("button",{name:/COR-TEST/}));
    expect(within(rail()).getByText("Loop basis").nextElementSibling?.textContent).toBe("cor-source");
    fireEvent.click(within(rail()).getByRole("button",{name:/03 Inspection/i}));
    expect(window.location.hash).toBe("#/screens/SCR-INS-001");
    fireEvent.click(within(rail()).getByRole("button",{name:/TEST-REQ-001/}));
    expect(within(rail()).getByText("Due-decision basis").nextElementSibling?.textContent).toBe("test-ins016-decision");
    fireEvent.click(within(rail()).getByRole("button",{name:/01 Asset/i}));
    expect(window.location.hash).toBe("#/screens/SCR-AIR-003");
    expect(within(rail()).getByText(/Selected asset:/)).toBeTruthy();
  });
  it("removes all cross-domain context when trusted navigation scope is withdrawn",()=>{
    navigate("#/screens/SCR-AIR-001");
    const view=render(<FutureAimApp {...props()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    expect(screen.getByRole("region",{name:"Asset to Corrosion to Inspection investigation"})).toBeTruthy();
    const {navigationScopeKey: withdrawn,...withoutNavigation}=props();
    expect(withdrawn).toBeTruthy();
    view.rerender(<FutureAimApp {...withoutNavigation}/>);
    expect(screen.queryByRole("region",{name:"Asset to Corrosion to Inspection investigation"})).toBeNull();
  });
  it("rejects changed cross-domain attestation rather than disclosing stale details",()=>{
    navigate("#/screens/SCR-AIR-001");
    const view=render(<FutureAimApp {...props()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    view.rerender(<FutureAimApp {...props()} crossDomainScopeKey="different-epoch"/>);
    expect(screen.queryByRole("region",{name:"Asset to Corrosion to Inspection investigation"})).toBeNull();
  });
});
