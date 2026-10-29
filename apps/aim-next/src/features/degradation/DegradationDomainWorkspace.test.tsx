// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {useState} from "react";
import {DegradationDomainWorkspace} from "./DegradationDomainWorkspace";

const fixture=()=>({
  mechanisms:[
    {id:"m1",code:"DGM-T01",name:"Test general corrosion",category:"Metal loss",revision:"3",state:"ACTIVE",basisReference:"test-lib-r3"},
    {id:"m2",code:"DGM-T02",name:"Test cracking",category:"Cracking",revision:"1",state:"DRAFT",basisReference:"test-lib-r1"},
  ],
  assessments:[{id:"assess-test",assetId:"asset-test",revision:"1",state:"IN_REVIEW"}],
  evidence:[{id:"e1",assessmentId:"assess-test",mechanismId:"m1",description:"Test reading evidence",sourceReference:"test-record",quality:"STALE"}],
  factors:[{id:"f1",mechanismId:"m1",label:"Test pressure factor",basisReference:"test-factors"}],
  applicability:[
    {id:"ap1",assessmentId:"assess-test",mechanismId:"m1",applicability:"POTENTIAL",susceptibility:"UNKNOWN",evidenceIds:["e1"],factorIds:["f1"],basisReference:"test-assessment-basis"},
    {id:"ap2",assessmentId:"assess-test",mechanismId:"m2",applicability:"NOT_APPLICABLE",susceptibility:"LOW",evidenceIds:[],factorIds:[],basisReference:"test-exclusion-basis"},
  ],
  techniques:[{id:"t1",mechanismId:"m1",technique:"Test ultrasonic examination",capability:"LIMITED",basisReference:"test-technique-reference"}],
  barrierDefinitions:[{id:"b1",name:"Test coating",purpose:"PREVENTIVE",designBasisReference:"test-design",mechanismIds:["m1"]}],
  barrierCriteria:[{id:"c1",definitionId:"b1",indicator:"Test coating condition",acceptanceCriterion:"Test acceptance",basisReference:"test-criterion"}],
  barrierInstances:[{id:"bi1",assessmentId:"assess-test",definitionId:"b1",health:"UNKNOWN"}],
  monitoringLinks:[{id:"ml1",assessmentId:"assess-test",mechanismId:"m1",sourceDomain:"IOW",sourceObjectId:"IOW-TEST",sourceReference:"test-IOW-ref"}],
});
function Harness({snapshot=fixture(),initialScreen="SCR-DGM-001"}:{snapshot?:unknown;initialScreen?:string}){
  const [current,setCurrent]=useState(initialScreen);
  return <><output data-testid="dgm-current-screen">{current}</output><DegradationDomainWorkspace screenId={current} snapshot={snapshot} onNavigate={setCurrent}/></>;
}
const inspect=()=>fireEvent.click(screen.getByRole("button",{name:"Inspect assessment assess-test"}));
afterEach(cleanup);
describe("future DGM assessment and library frontend",()=>{
  it("is disconnected and never manufactures an assessment",()=>{render(<DegradationDomainWorkspace screenId="SCR-DGM-001" onNavigate={()=>{}}/>);expect(screen.getByText(/No trusted DGM data source/)).toBeTruthy();expect(screen.getByText("No assessments found")).toBeTruthy();});
  it("rejects an invalid snapshot as a whole",()=>{const f=fixture();render(<Harness snapshot={{...f,mechanisms:[...f.mechanisms,{id:"bad",name:"Injected record"}]}}/>);expect(screen.getByRole("alert")).toBeTruthy();expect(screen.queryByText("DGM-T01")).toBeNull();});
  it("shows the supplied assessment register but not its detail until selected",()=>{render(<Harness/>);expect(screen.getByText("assess-test")).toBeTruthy();expect(screen.getByText("Select an assessment")).toBeTruthy();});
  it("selects a review and differentiates applicability from susceptibility",()=>{render(<Harness/>);inspect();expect(screen.getByRole("tabpanel",{name:"Applicability"})).toBeTruthy();const table=screen.getByRole("region",{name:"Mechanism applicability"});expect(within(table).getByText("POTENTIAL")).toBeTruthy();expect(within(table).getByText("UNKNOWN")).toBeTruthy();expect(within(table).getByText("NOT_APPLICABLE")).toBeTruthy();});
  it("filters applicability without relabeling unknowns",()=>{render(<Harness/>);inspect();fireEvent.change(screen.getByRole("combobox",{name:"Filter applicability"}),{target:{value:"NOT_APPLICABLE"}});const table=screen.getByRole("region",{name:"Mechanism applicability"});expect(within(table).getByText("NOT_APPLICABLE")).toBeTruthy();expect(within(table).queryByText("POTENTIAL")).toBeNull();});
  it("shows evidence quality independently of assessment state",()=>{render(<Harness/>);inspect();fireEvent.click(screen.getByRole("tab",{name:"Evidence (1)"}));expect(screen.getByText("Test reading evidence")).toBeTruthy();expect(screen.getByText("STALE")).toBeTruthy();expect(screen.getByText("test-record")).toBeTruthy();});
  it("displays barrier health and documented verification criteria",()=>{render(<Harness/>);inspect();fireEvent.click(screen.getByRole("tab",{name:"Barriers (1)"}));expect(screen.getByText("Test coating")).toBeTruthy();expect(screen.getByText("UNKNOWN")).toBeTruthy();expect(screen.getByText("Test coating condition")).toBeTruthy();});
  it("shows IOW monitoring as a reference, not process compliance",()=>{render(<Harness/>);inspect();fireEvent.click(screen.getByRole("tab",{name:"Monitoring & IOW"}));expect(screen.getByText("IOW-TEST")).toBeTruthy();expect(screen.getByText(/not proof of process compliance/)).toBeTruthy();});
  it("keeps approval disabled and a review note explicitly unsaved",()=>{render(<Harness/>);inspect();fireEvent.click(screen.getByRole("tab",{name:"Review basis"}));const note=screen.getByRole("textbox",{name:/Local review note/}) as HTMLTextAreaElement;fireEvent.change(note,{target:{value:"Unsaved test note"}});expect(note.value).toBe("Unsaved test note");expect(screen.getByRole("button",{name:"Approve assessment unavailable"}).hasAttribute("disabled")).toBe(true);fireEvent.click(screen.getByRole("button",{name:"Clear local note"}));expect(note.value).toBe("");});
  it("navigates to the real mechanism library from a linked assessment",()=>{render(<Harness/>);inspect();fireEvent.click(screen.getByRole("button",{name:"View mechanism m1 in library"}));expect(screen.getByTestId("dgm-current-screen").textContent).toBe("SCR-DGM-002");expect(screen.getByText("Test ultrasonic examination")).toBeTruthy();});
  it("filters the mechanism library by category and state",()=>{render(<Harness initialScreen="SCR-DGM-002"/>);const region=screen.getByRole("region",{name:"Mechanism catalogue"});expect(within(region).getByText("DGM-T01")).toBeTruthy();fireEvent.change(screen.getByRole("combobox",{name:"Library state"}),{target:{value:"DRAFT"}});expect(screen.queryByText("DGM-T01")).toBeNull();expect(screen.getByText("DGM-T02")).toBeTruthy();fireEvent.change(screen.getByRole("combobox",{name:"Category"}),{target:{value:"Metal loss"}});expect(screen.getByText("No matching mechanisms")).toBeTruthy();});
  it("shows mechanism-specific factors and technique capability on selection",()=>{render(<Harness initialScreen="SCR-DGM-002"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect mechanism DGM-T01"}));expect(screen.getByText("Test pressure factor")).toBeTruthy();expect(screen.getByText("Test ultrasonic examination")).toBeTruthy();expect(screen.getByText("LIMITED")).toBeTruthy();expect(screen.getByRole("button",{name:"Edit controlled mechanism unavailable"}).hasAttribute("disabled")).toBe(true);});
  it("navigates from the mechanism library back to the assessment",()=>{render(<Harness initialScreen="SCR-DGM-002"/>);fireEvent.click(screen.getByRole("button",{name:"Inspect mechanism DGM-T01"}));fireEvent.click(screen.getByRole("button",{name:"Return to assessment workspace"}));expect(screen.getByTestId("dgm-current-screen").textContent).toBe("SCR-DGM-001");});
  it("does not expose unrelated data when assessments are absent",()=>{const f=fixture();render(<Harness snapshot={{...f,assessments:[],applicability:[],evidence:[],barrierInstances:[],monitoringLinks:[]}}/>);expect(screen.getByText("No assessments found")).toBeTruthy();expect(screen.queryByText("Test reading evidence")).toBeNull();});
  it("handles an empty but supplied library without creating records",()=>{render(<Harness initialScreen="SCR-DGM-002" snapshot={{mechanisms:[],assessments:[],evidence:[],factors:[],applicability:[],techniques:[],barrierDefinitions:[],barrierCriteria:[],barrierInstances:[],monitoringLinks:[]}}/>);expect(screen.getByText("No matching mechanisms")).toBeTruthy();});
});
