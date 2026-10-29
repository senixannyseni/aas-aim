// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {useState} from "react";
import {CorrosionDomainWorkspace} from "./CorrosionDomainWorkspace";

const AT="2026-01-15T09:00:00Z",LATER="2026-09-15T09:00:00Z";
const fixture=()=>({
  loops:[{id:"loop-1",name:"Test process loop",systemReference:"system-1",assetId:"asset-1",basisReference:"source-loop"}],
  circuits:[{id:"c-1",loopId:"loop-1",code:"TEST-C01",name:"Test circuit",assetId:"asset-1",revision:"1",state:"ACTIVE"}],
  locations:[{id:"loc-1",circuitId:"c-1",tag:"TML-TEST",componentReference:"component-1",kind:"TML",sourceReference:"location-source"}],
  points:[{id:"point-1",locationId:"loc-1",tag:"Point top",orientation:"TOP"}],
  sets:[{id:"set-1",circuitId:"c-1",reference:"test-workpack",measuredAt:AT,state:"VALIDATED"}],
  readings:[{id:"reading-1",setId:"set-1",pointId:"point-1",measuredAt:AT,thicknessMm:9.5,quality:"SUSPECT",sourceReference:"test-reading-source"}],
  anomalies:[{id:"anom-1",readingId:"reading-1",description:"Suspected measurement issue",disposition:"OPEN"}],
  tmins:[{id:"tmin-1",circuitId:"c-1",revision:"2",thicknessMm:6.4,status:"ACTIVE",basisReference:"test-tmin-basis",effectiveAt:AT}],
  calculations:[{id:"calc-1",circuitId:"c-1",revision:"2",status:"APPROVED",basisReference:"test-calculation-basis",inputReadingIds:["reading-1"],traceReference:"test-trace",calculatedAt:AT,approvedAt:LATER,remainingLifeYears:8.5,dueCandidateAt:LATER}],
  rates:[{id:"rate-1",calculationId:"calc-1",method:"LONG_TERM",rateMmPerYear:0.12,basisReference:"rate-source"}],
});
function Harness({snapshot=fixture(),initial="SCR-COR-001"}:{snapshot?:unknown;initial?:string}){
  const [id,setId]=useState(initial);
  return <><output data-testid="active-cor-screen">{id}</output><CorrosionDomainWorkspace screenId={id} snapshot={snapshot} onNavigate={setId}/></>;
}
afterEach(cleanup);
describe("Future AAS–AIM COR engineering frontend",()=>{
  it("shows the disconnected state without fake measurements",()=>{render(<CorrosionDomainWorkspace screenId="SCR-COR-001" onNavigate={()=>{}}/>);expect(screen.getByText(/No trusted corrosion source is connected/)).toBeTruthy();expect(screen.getByText("No loops supplied")).toBeTruthy();expect(screen.queryByText("9.5")).toBeNull();});
  it("rejects invalid input as a whole",()=>{render(<Harness snapshot={{...fixture(),readings:[{...fixture().readings[0],quality:"UNVERIFIED"}]}}/>);expect(screen.getByRole("alert")).toBeTruthy();expect(screen.queryByText("TEST-C01")).toBeNull();});
  it("shows loops and circuits without inventing calculations",()=>{render(<Harness/>);expect(screen.getByText("Test process loop")).toBeTruthy();expect(screen.getByText("TEST-C01")).toBeTruthy();expect(screen.getByText("Select a corrosion circuit")).toBeTruthy();});
  it("selects the circuit and reveals source details",()=>{render(<Harness/>);fireEvent.click(screen.getByRole("button",{name:"Inspect circuit TEST-C01"}));expect(screen.getByText("source-loop")).toBeTruthy();expect(screen.getByText("system-1")).toBeTruthy();});
  it("filters circuits by state without changing the source",()=>{render(<Harness/>);fireEvent.change(screen.getByRole("combobox",{name:"Circuit lifecycle"}),{target:{value:"RETIRED"}});expect(screen.getByText("No matching circuits")).toBeTruthy();expect(screen.queryByText("TEST-C01")).toBeNull();});
  it("navigates from circuit to CML/TML",()=>{render(<Harness/>);fireEvent.click(screen.getByRole("button",{name:"Inspect circuit TEST-C01"}));fireEvent.click(screen.getByRole("button",{name:/Open CML/}));expect(screen.getByTestId("active-cor-screen").textContent).toBe("SCR-COR-002");expect(screen.getByText("TML-TEST")).toBeTruthy();});
  it("inspects a source-backed location and point",()=>{render(<Harness initial="SCR-COR-002"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect location TML-TEST"}));expect(screen.getByText("Point top")).toBeTruthy();expect(screen.getByText("location-source")).toBeTruthy();});
  it("lists actual thickness readings and explicitly suspect quality",()=>{render(<Harness initial="SCR-COR-003"/>);const region=screen.getByRole("region",{name:"Thickness reading history"});expect(within(region).getByText("9.5")).toBeTruthy();expect(within(region).getByText("SUSPECT")).toBeTruthy();});
  it("inspects an anomaly without silently validating a suspect reading",()=>{render(<Harness initial="SCR-COR-003"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect point point-1"}));expect(screen.getByText("Suspected measurement issue")).toBeTruthy();expect(screen.getByText("OPEN")).toBeTruthy();});
  it("shows only supplied calculation rates",()=>{render(<Harness initial="SCR-COR-004"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect calculation calc-1"}));fireEvent.click(screen.getByRole("tab",{name:"RATES"}));expect(screen.getByText("0.12 mm/year")).toBeTruthy();expect(screen.getByText("Basis: rate-source")).toBeTruthy();});
  it("distinguishes COR remaining life from FFS",()=>{render(<Harness initial="SCR-COR-004"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect calculation calc-1"}));fireEvent.click(screen.getByRole("tab",{name:"REMAINING LIFE"}));expect(screen.getByText("8.5")).toBeTruthy();expect(screen.getByText(/COR remaining life is not interchangeable/)).toBeTruthy();});
  it("makes COR's due candidate distinct from the final INS due date",()=>{render(<Harness initial="SCR-COR-004"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect calculation calc-1"}));fireEvent.click(screen.getByRole("tab",{name:"DUE CANDIDATE"}));expect(screen.getByText("Not provided by COR")).toBeTruthy();expect(screen.getByText(/INS-016 determines the governing technical inspection due date/)).toBeTruthy();});
  it("shows the original calculation trace reference",()=>{render(<Harness initial="SCR-COR-004"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect calculation calc-1"}));fireEvent.click(screen.getByRole("tab",{name:"TRACE"}));expect(screen.getByText("test-trace")).toBeTruthy();expect(screen.getByText("reading-1")).toBeTruthy();});
  it("keeps a local review note unsaved and COR approval disabled",()=>{render(<Harness initial="SCR-COR-004"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect calculation calc-1"}));fireEvent.click(screen.getByRole("tab",{name:"REVIEW"}));const input=screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:"Unsaved working note"}});expect(input.value).toBe("Unsaved working note");expect(screen.getByRole("button",{name:"Approve COR-018 unavailable"}).hasAttribute("disabled")).toBe(true);fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect(input.value).toBe("");});
  it("can inspect effective Tmin records and never activate them locally",()=>{render(<Harness initial="SCR-COR-005"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect Tmin tmin-1"}));expect(screen.getByText("test-tmin-basis")).toBeTruthy();expect(screen.getByText("6.4 mm")).toBeTruthy();expect(screen.getByRole("button",{name:"Activate Tmin unavailable"}).hasAttribute("disabled")).toBe(true);});
  it("does not import staged CSV records",()=>{render(<Harness initial="SCR-COR-006"/>);const csv=screen.getByRole("textbox",{name:/CSV input/});fireEvent.change(csv,{target:{value:`pointId,setId,measuredAt,thicknessMm,sourceReference\npoint-1,set-1,${AT},9.5,test-csv`}});expect(screen.getByRole("region",{name:"Staged thickness measurements"})).toBeTruthy();expect(screen.getByRole("button",{name:"Promote to controlled readings unavailable"}).hasAttribute("disabled")).toBe(true);});
  it("rejects a malformed CSV batch without partial import preview",()=>{render(<Harness initial="SCR-COR-006"/>);fireEvent.change(screen.getByRole("textbox",{name:/CSV input/}),{target:{value:`pointId,setId,measuredAt,thicknessMm,sourceReference\npoint-1,set-1,${AT},9.5,test-csv\nmissing,set-1,${AT},8,test-csv`}});expect(screen.getByRole("alert")).toBeTruthy();expect(screen.queryByRole("region",{name:"Staged thickness measurements"})).toBeNull();});
});
