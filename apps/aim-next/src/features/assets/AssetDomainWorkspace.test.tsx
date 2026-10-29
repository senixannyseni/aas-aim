// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {useState} from "react";
import {AssetDomainWorkspace} from "./AssetDomainWorkspace";

const dataset={
  assets:[
    {id:"e1",tag:"V-101",name:"Test pressure vessel",kind:"EQUIPMENT",state:"ACTIVE",material:"CS",system:"PROCESS-A",functionalLocation:"PLANT-1"},
    {id:"c1",tag:"V-101-N1",name:"Test nozzle",kind:"COMPONENT",state:"UNKNOWN",parentId:"e1",functionalLocation:"PLANT-1"},
    {id:"e2",tag:"P-200",name:"Test circulation pump",kind:"EQUIPMENT",state:"RETIRED",system:"PROCESS-B"}
  ],
  relationships:[{id:"r1",sourceId:"e1",targetId:"e2",kind:"FEEDS",sourceReference:"Test drawing revision"}],
  history:[{id:"h1",assetId:"e1",occurredAt:"2026-09-08T13:00:00Z",description:"Test event",sourceReference:"Test record"}]
};
function Harness({snapshot=dataset,initialScreen="SCR-AIR-001"}:{snapshot?:unknown;initialScreen?:string}){
  const [id,setId]=useState(initialScreen);
  return <><div data-testid="screen-id">{id}</div><AssetDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={setId}/></>;
}
afterEach(cleanup);
describe("future AIR frontend presentation boundary",()=>{
  it("is explicitly disconnected by default",()=>{
    render(<AssetDomainWorkspace screenId="SCR-AIR-001" onNavigate={()=>{}}/>);
    expect(screen.getByText(/AIR data source not connected/)).toBeTruthy();
    expect(screen.getByText("No assets supplied")).toBeTruthy();
  });
  it("rejects an invalid snapshot instead of showing partial equipment",()=>{
    render(<AssetDomainWorkspace screenId="SCR-AIR-001" snapshot={{...dataset,assets:[...dataset.assets,{id:"bad",name:"Bad",tag:"BAD",kind:"INVALID",state:"ACTIVE"}]}} onNavigate={()=>{}}/>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("V-101")).toBeNull();
  });
  it("paginates the supplied snapshot and resets on search changes",()=>{
    const bulk={assets:Array.from({length:13},(_,i)=>({id:`asset-${i+1}`,tag:`TAG-${String(i+1).padStart(3,"0")}`,name:`Test asset ${i+1}`,kind:"EQUIPMENT",state:"ACTIVE"})),relationships:[],history:[]};
    render(<Harness snapshot={bulk}/>);
    expect(screen.queryByText("TAG-013")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Next"}));
    expect(screen.getByText("TAG-013")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox",{name:"Find asset"}),{target:{value:"TAG-001"}});
    expect(screen.getByText("TAG-001")).toBeTruthy();
    expect(screen.queryByText("TAG-013")).toBeNull();
    expect(screen.getByText("Page 1 / 1")).toBeTruthy();
  });
  it("filters without losing the difference between UNKNOWN and RETIRED",()=>{
    render(<Harness/>);
    fireEvent.change(screen.getByRole("combobox",{name:"Lifecycle"}),{target:{value:"UNKNOWN"}});
    expect(screen.getByText("V-101-N1")).toBeTruthy();
    expect(screen.queryByText("P-200")).toBeNull();
  });
  it("searches and resets the visible results",()=>{
    render(<Harness/>);
    const search=screen.getByRole("searchbox",{name:"Find asset"});
    fireEvent.change(search,{target:{value:"Test nozzle"}});
    expect(screen.getByText("V-101-N1")).toBeTruthy();
    expect(screen.queryByText("P-200")).toBeNull();
    fireEvent.change(search,{target:{value:""}});
    expect(screen.getByText("P-200")).toBeTruthy();
  });
  it("opens a selected asset and its source-backed history",()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    expect(screen.getByTestId("screen-id").textContent).toBe("SCR-AIR-003");
    expect(screen.getByText("CS")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab",{name:"History (1)"}));
    expect(screen.getByText("Test event")).toBeTruthy();
    expect(screen.getByText(/Source: Test record/)).toBeTruthy();
  });
  it("expands physical hierarchy from explicit parent links",()=>{
    render(<Harness initialScreen="SCR-AIR-002"/>);
    expect(screen.queryByText("Test nozzle")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Expand V-101"}));
    expect(screen.getByText("Test nozzle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Collapse V-101"}));
    expect(screen.queryByText("Test nozzle")).toBeNull();
  });
  it("switches hierarchy between physical, system and functional-location views",()=>{
    render(<Harness initialScreen="SCR-AIR-002"/>);
    fireEvent.click(screen.getByRole("button",{name:"Systems"}));
    expect(screen.getByText(/PROCESS-A/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Functional locations"}));
    expect(screen.getByText(/PLANT-1/)).toBeTruthy();
  });
  it("does not enable persistence for the local master-data draft",()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Open V-101 workspace"}));
    fireEvent.click(screen.getByRole("button",{name:/Prepare master-data draft/}));
    expect(screen.getByTestId("screen-id").textContent).toBe("SCR-AIR-004");
    const name=screen.getByRole("textbox",{name:"Asset name"}) as HTMLInputElement;
    fireEvent.change(name,{target:{value:"Draft change"}});
    expect(name.value).toBe("Draft change");
    expect(screen.getByRole("button",{name:"Save to authoritative register unavailable"}).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"Reset draft"}));
    expect(name.value).toBe("Test pressure vessel");
  });
  it("previews CSV without promoting invalid batches",()=>{
    render(<Harness initialScreen="SCR-AIR-005"/>);
    const input=screen.getByRole("textbox",{name:"CSV staging input"});
    fireEvent.change(input,{target:{value:"id,tag,name,kind,state,parentId,system,functionalLocation\ne3,P-300,Test part,EQUIPMENT,ACTIVE,,,"}});
    expect(within(screen.getByRole("region",{name:"Import staging preview"})).getByText("P-300")).toBeTruthy();
    expect(screen.getByRole("button",{name:"Authorize and commit import unavailable"}).hasAttribute("disabled")).toBe(true);
    fireEvent.change(input,{target:{value:"id,tag,name,kind,state,parentId,system,functionalLocation\ne3,P-300,Test part,INVALID,ACTIVE,,,"}});
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("P-300")).toBeNull();
  });
  it("only renders explicit, provenance-backed relationship links",()=>{
    render(<Harness initialScreen="SCR-AIR-006"/>);
    expect(screen.getByText(/Source reference: Test drawing revision/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"P-200"}));
    expect(screen.getByTestId("screen-id").textContent).toBe("SCR-AIR-003");
  });
  it("works with an authorized but empty snapshot",()=>{
    render(<Harness snapshot={{assets:[],relationships:[],history:[]}}/>);
    expect(screen.getByText("No assets supplied")).toBeTruthy();
    expect(screen.queryByText(/AIR data source not connected/)).toBeNull();
  });
});
