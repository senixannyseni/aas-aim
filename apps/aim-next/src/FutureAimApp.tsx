import { Component, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { CAPABILITIES, DOMAINS, DOMAIN_GROUPS, TOTAL_FUNCTIONS, TOTAL_PRIMARY_SCREENS, type Capability, type DomainCode } from "./capabilityRegistry";
import { SCREEN_BY_ID, SCREENS, type ScreenDefinition } from "./screenRegistry";
import { readScreenRoute, screenHref } from "./screenRouting";
import { WorkspaceFinder } from "./WorkspaceFinder";
import { ScreenWorkflowGuide } from "./ScreenWorkflowGuide";
import { functionWorkflowGuidance } from "./workflowGuidance";
import { recordWorkspaceVisit, recentWorkspaceTargets } from "./workspaceTrail";
import { workspaceForScreen } from "./workspaceResolver";
import { AssetDomainWorkspace } from "./features/assets/AssetDomainWorkspace";
import { UniversalSearchWorkspace } from "./features/discovery/UniversalSearchWorkspace";
import { AssetContextPicker } from "./features/discovery/AssetContextPicker";
import { parseAssetSnapshot } from "./features/assets/assetModel";
import { CrossDomainInvestigation } from "./features/investigation/CrossDomainInvestigation";
import type { DiscoveryResult } from "./features/discovery/discoveryModel";
import type { AuthSessionBoundary } from "@bandha/aim-platform/auth/authSession";
import { ASSET_INVESTIGATION_HASH, canOpenAssetInvestigationRoute } from "./shared/data/assetInvestigationNavigation";

const DegradationDomainWorkspace = lazy(() => import("./features/degradation/DegradationDomainWorkspace").then(module => ({default: module.DegradationDomainWorkspace})));
const CorrosionDomainWorkspace = lazy(() => import("./features/corrosion/CorrosionDomainWorkspace").then(module => ({default: module.CorrosionDomainWorkspace})));
const InspectionDomainWorkspace = lazy(() => import("./features/inspection/InspectionDomainWorkspace").then(module => ({default: module.InspectionDomainWorkspace})));
const RbiDomainWorkspace = lazy(() => import("./features/rbi/RbiDomainWorkspace").then(module => ({default: module.RbiDomainWorkspace})));
const FindingsDomainWorkspace = lazy(() => import("./features/findings/FindingsDomainWorkspace").then(module => ({default: module.FindingsDomainWorkspace})));
const RecommendationsDomainWorkspace = lazy(() => import("./features/recommendations/RecommendationsDomainWorkspace").then(module => ({default: module.RecommendationsDomainWorkspace})));
const ActionsDomainWorkspace = lazy(() => import("./features/actions/ActionsDomainWorkspace").then(module => ({default: module.ActionsDomainWorkspace})));
const IowDomainWorkspace = lazy(() => import("./features/iow/IowDomainWorkspace").then(module => ({default: module.IowDomainWorkspace})));
const FfsDomainWorkspace = lazy(() => import("./features/ffs/FfsDomainWorkspace").then(module => ({default: module.FfsDomainWorkspace})));
const GovernanceDomainWorkspace = lazy(() => import("./features/governance/GovernanceDomainWorkspace").then(module => ({default: module.GovernanceDomainWorkspace})));
const IntegrationsDomainWorkspace = lazy(() => import("./features/integrations/IntegrationsDomainWorkspace").then(module => ({default: module.IntegrationsDomainWorkspace})));
const AnalyticsDomainWorkspace = lazy(() => import("./features/analytics/AnalyticsDomainWorkspace").then(module => ({default: module.AnalyticsDomainWorkspace})));
const FieldDomainWorkspace = lazy(() => import("./features/field/FieldDomainWorkspace").then(module => ({default: module.FieldDomainWorkspace})));
const VisualDomainWorkspace = lazy(() => import("./features/visualization/VisualDomainWorkspace").then(module => ({default: module.VisualDomainWorkspace})));
const AuthenticatedAssetInvestigation = lazy(() => import("./shared/data/AuthenticatedAssetInvestigation").then(module => ({default: module.AuthenticatedAssetInvestigation})));

const assuranceLifecycle = ["Evidence", "Condition", "Degradation", "Risk", "Decision", "Action", "Verification", "Reassessment"] as const;
const engineeringRules: Readonly<Record<string,string>> = {
  AIR: "Asset records are master-data objects. Approved engineering evidence must retain its own revision and source.",
  DGM: "Mechanism applicability and barrier health require an evidence-backed, approved engineering basis.",
  COR: "Corrosion rate and remaining-life calculations require an approved measurement and engineering basis. Due candidates are not final dates.",
  INS: "Requirements, events, scope achievement and granted credit remain different controlled objects. INS owns the governing technical due date.",
  RBI: "RBI due dates are candidates. Approved risk models and inputs must remain traceable; INS determines the governing due date.",
  FND: "Findings, Integrity Condition Cases, recommendations and actions are not interchangeable records.",
  REC: "Recommendations must originate from approved evidence and carry verifiable acceptance criteria and independent closeout.",
  ACT: "Temporary repairs, permanent repairs, deferrals, controls and execution verification have distinct authority and lifecycles.",
  IOW: "Source availability may be UNKNOWN; an absent historian value is never assumed to be within limits.",
  FFS: "FFS assessments are engineering evaluations. A calculated remaining life is not interchangeable with a corrosion projection.",
  GOV: "Identity, access scope and administrative privileges never imply engineering approval authority.",
  INT: "Synchronization does not transfer domain ownership or permit unreviewed mutation of protected records.",
  ANA: "Analytics reads approved or appropriately labeled projected data; dashboards do not approve or mutate engineering source records.",
  FLD: "The field companion supports controlled offline capture and synchronization; engineering approval is unavailable here.",
  VIS: "P&ID, drawings, 3D, GIS and overlays are navigation contexts, not authoritative source-record editors.",
};
const screenMessages:Readonly<Record<ScreenDefinition["surface"],string>> = {
  workspace: "The record workspace will show object identity, revision, basis, evidence, state and associated downstream work.",
  register: "The register will display only authorized, tenant-scoped records with explicit loading, error, empty and unknown states.",
  review: "The review workspace will separate deterministic results from engineering judgement and protected approval transitions.",
  analysis: "The analytics workspace will distinguish historical, approved, projected and scenario values and disclose data completeness.",
  context: "The visual workspace will overlay governed engineering object references without writing into their source domains.",
  configuration: "Controlled configuration and administrative scope are enforced by backend-owned policies and audit events.",
  field: "Field execution is distinct from desktop engineering approval. Unverified offline captures cannot become approved records.",
};
const searchMatches = (c:Capability, text:string):boolean => text.split(/\s+/).every(s => `${c.id} ${c.title} ${c.domain}`.toLocaleLowerCase().includes(s));

function BrandMark():JSX.Element {
  return <div className="next-mark" aria-hidden="true"><span className="next-mark-inner">B</span></div>;
}
function Stat({label,value,note}:{label:string;value:string;note:string}):JSX.Element {
  return <div className="next-stat"><span className="next-stat-label">{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
/** Awaited on demand; this message never implies a connected engineering backend. */
function WorkspaceLoading({label}:{label:string}):JSX.Element {
  return <div className="next-workspace-loading" role="status" aria-live="polite">Loading {label} workspace…</div>;
}
/** Chunk-fetch failure is a UI loading failure, never an empty or unauthorized engineering record. */
class WorkspaceModuleBoundary extends Component<Readonly<{children:ReactNode}>,Readonly<{failed:boolean}>> {
  state={failed:false};
  static getDerivedStateFromError():Readonly<{failed:boolean}>{return {failed:true};}
  render():ReactNode {
    return this.state.failed
      ? <div className="next-workspace-load-error" role="alert"><strong>Workspace module unavailable</strong><p>The interface could not load this workspace. No engineering record state can be inferred from this error.</p><button type="button" onClick={()=>window.location.reload()}>Reload application</button></div>
      : this.props.children;
  }
}
function EngineeringNotice({children}:{children:string}):JSX.Element {
  return <div className="next-notice" role="note"><span className="next-dot" aria-hidden="true"/><p>{children}</p></div>;
}
function CapabilityRow({feature,onSelect,selected}:{feature:Capability;onSelect:(c:Capability,invoker:HTMLButtonElement)=>void;selected:boolean}):JSX.Element {
  return <button className={`next-capability ${selected?"is-selected":""}`} type="button" aria-pressed={selected} onClick={event=>onSelect(feature,event.currentTarget)}>
    <span className="next-function-id">{feature.id}</span>
    <span className="next-capability-name">{feature.title}</span>
    {feature.controlled && <span className="next-protected">Review gate</span>}
    <span className="next-row-arrow" aria-hidden="true">↗</span>
  </button>;
}
function FunctionInspector({feature,onClose,onNavigate}:{feature:Capability;onClose:()=>void;onNavigate:(s:ScreenDefinition)=>void}):JSX.Element {
  const guidance = functionWorkflowGuidance(feature);
  const targets = guidance.targetScreens;
  const domain = DOMAINS.find(d=>d.code===feature.domain);
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(()=>{
    // Dismissal focus restoration belongs to the parent: the background must
    // lose `inert` before a browser will accept focus on the invoking button.
    inspectorRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  },[]);
  function handleInspectorKeys(event:{key:string;shiftKey:boolean;preventDefault:()=>void;currentTarget:HTMLElement}):void {
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'));
    if(!controls.length)return;
    const first=controls[0]!,last=controls[controls.length-1]!;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  return <aside ref={inspectorRef} className="next-inspector" role="dialog" aria-modal="true" aria-label="Function detail" onKeyDown={handleInspectorKeys}>
    <div className="next-inspector-header"><span className="next-eyebrow">CANONICAL FUNCTION</span><button onClick={onClose} type="button" aria-label="Close function detail" className="next-icon-button">×</button></div>
    <span className="next-detail-id">{feature.id}</span>
    <h3>{feature.title}</h3>
    <p className="next-inspector-description">{domain?.name}. This is a dedicated capability identity in the frozen registry, not a generic action endpoint.</p>
    <div className="next-detail-rule"><span>Domain ownership</span><strong>{feature.domain}</strong></div>
    <div className="next-detail-rule"><span>UI action</span><strong>Preview only</strong></div>
    <div className="next-detail-rule"><span>Authoritative data</span><strong>Not connected</strong></div>
    <div className="next-detail-rule"><span>Protected transition</span><strong>{feature.controlled?"Server-controlled gate":"Not indicated in this preview"}</strong></div>
    <div className="next-inspector-note"><b>Before using this function</b><p>{guidance.reviewBoundary}</p><p>Mapped record families (not verified data): {guidance.objectFamilies.length ? guidance.objectFamilies.join(" · ") : "None specified"}.</p><p>Validate the source record revision, provenance and authorization in the owning service before relying on any result.</p></div>
    <div className="next-mapped-targets"><h4>Mapped screen surfaces</h4>{targets.map(target=><button key={target.id} type="button" onClick={()=>onNavigate(target)}><code>{target.id}</code><span>{target.title}</span><span aria-hidden="true">↗</span></button>)}</div>
    <button type="button" className="next-disabled-action" disabled>Authoritative command unavailable</button>
  </aside>;
}

export type FutureAimAppProps = Readonly<{
  /** Stage 45.8 opt-in: trusted upstream session boundary; null/absent keeps preview-only app. */
  assetInvestigationBoundary?: AuthSessionBoundary | null;
  /** Trusted upstream, tenant-authorized AIR data. Unavailable by default. */
  assetSnapshot?:unknown;
  /** Must change when the tenant, identity, or authorized data scope changes. */
  assetScopeKey?:string;
  /** Externally authorized DGM snapshot; never synthesized by the frontend. */
  degradationSnapshot?:unknown;
  /** Rotate on authenticated identity, tenant or authorized data-scope changes. */
  degradationScopeKey?:string;
  /** Externally authorized COR data. No synthetic corrosion values are created. */
  corrosionSnapshot?:unknown;
  /** Rotate with the authenticated COR data scope to clear UI selections. */
  corrosionScopeKey?:string;
  /** Externally supplied, scope-authorized INS records. No synthetic obligations. */
  inspectionSnapshot?:unknown;
  /** Changes on authenticated user, tenant, or authorized scope change. */
  inspectionScopeKey?:string;
  /** Read-only, scope-authorized RBI data; absent means disconnected. */
  rbiSnapshot?:unknown;
  /** Must rotate with the authenticated identity, tenant and authorized scope. */
  rbiScopeKey?:string;
  /** Externally authorized FND records; no frontend-generated findings or closures. */
  findingsSnapshot?:unknown;
  /** Rotate on tenant, user or authorized data-scope changes. */
  findingsScopeKey?:string;
  /** Externally authorized REC snapshot, never synthesized from actions or work orders. */
  recommendationsSnapshot?:unknown;
  /** Rotate with authenticated identity, tenant, or authorized recommendation scope. */
  recommendationsScopeKey?:string;
  /** Externally authorized ACT records, never inferred from CMMS work completion. */
  actionsSnapshot?:unknown;
  /** Rotate with authenticated identity, tenant and ACT data scope. */
  actionsScopeKey?:string;
  /** Externally authorized IOW snapshot; absence does not establish operating compliance. */
  iowSnapshot?:unknown;
  /** Rotate on identity, tenant, site and authorized monitoring scope changes. */
  iowScopeKey?:string;
  /** Externally supplied, authorized FFS records; never inferred from COR results. */
  ffsSnapshot?:unknown;
  /** Rotate when authenticated principal, tenant, asset or authorized FFS scope changes. */
  ffsScopeKey?:string;
  /** Trusted scope-filtered governance read model; not an authorization oracle. */
  governanceSnapshot?:unknown;
  /** Rotate with principal, tenant, site and authorized governance scope. */
  governanceScopeKey?:string;
  /** Trusted scope-filtered integration projection; never inferred from source connectivity. */
  integrationSnapshot?:unknown;
  /** Rotate on authenticated identity, tenant, and authorized integration scope changes. */
  integrationScopeKey?:string;
  /** Authorized, scoped analytics projection, including HOME dashboards. Never computed from absent data. */
  analyticsSnapshot?:unknown;
  /** Rotate on principal, tenant, site, or authorized analytics scope changes. */
  analyticsScopeKey?:string;
  /** Scope-authorized released field packages and recorded capture/sync references. */
  fieldSnapshot?:unknown;
  /** Rotate when user, tenant, site, workpack authorization, or identity changes. */
  fieldScopeKey?:string;
  /** Scope-authorized VIS sources, verified mappings and read-only overlays. */
  visualSnapshot?:unknown;
  /** Rotate for every identity, tenant, site or visual-source authorization change. */
  visualScopeKey?:string;
  /** Caller-supplied authenticated navigation epoch; must change on principal, tenant, site, or grants change. */
  navigationScopeKey?:string;
  /** Pre-authorized, scope-bound GOV-012 search projection; NEVER built from disparate local domain snapshots. */
  discoverySnapshot?:unknown;
  /** Independently scoped, authorized evidence/revision/relationship index; optional and disconnected by default. */
  recordContextSnapshot?:unknown;
  /** Explicit trusted attestation that AIR/COR/INS context may be navigated in this navigation epoch. */
  crossDomainScopeKey?:string;
}>;
/** Scope rotation remounts all shell navigation state synchronously; it cannot preserve a prior asset selection. */
export default function FutureAimApp(props:FutureAimAppProps):JSX.Element {
  return <ScopedFutureAimApp key={props.navigationScopeKey??"no-trusted-navigation-scope"} {...props}/>;
}
function ScopedFutureAimApp({assetInvestigationBoundary,assetSnapshot,assetScopeKey,degradationSnapshot,degradationScopeKey,corrosionSnapshot,corrosionScopeKey,inspectionSnapshot,inspectionScopeKey,rbiSnapshot,rbiScopeKey,findingsSnapshot,findingsScopeKey,recommendationsSnapshot,recommendationsScopeKey,actionsSnapshot,actionsScopeKey,iowSnapshot,iowScopeKey,ffsSnapshot,ffsScopeKey,governanceSnapshot,governanceScopeKey,integrationSnapshot,integrationScopeKey,analyticsSnapshot,analyticsScopeKey,fieldSnapshot,fieldScopeKey,visualSnapshot,visualScopeKey,navigationScopeKey,discoverySnapshot,recordContextSnapshot,crossDomainScopeKey}:FutureAimAppProps):JSX.Element {
  const [domainCode,setDomainCode] = useState<DomainCode>("AIR");
  const [screenId,setScreenId] = useState<string>("SCR-AIR-001");
  const [area,setArea] = useState<"surface"|"registry"|"architecture"|"asset-investigation">("architecture");
  const [query,setQuery] = useState("");
  const [selectedFunction,setSelectedFunction] = useState<Capability|null>(null);
  const [domainFilter,setDomainFilter] = useState<"all"|DomainCode>("all");
  const [mobileNav,setMobileNav] = useState(false);
  // The selected AIR object is tied to the exact AIR scope epoch, not just its ID.
  // A replacement snapshot with the same IDs must not silently retain selection.
  const [assetSelection,setAssetSelection] = useState<{id:string;scopeKey:string|undefined}|null>(null);
  // Canonical screen IDs only; no record references, tenant data, or browser persistence.
  const [recentScreens,setRecentScreens] = useState<readonly string[]>([]);
  const [recordHandoff,setRecordHandoff] = useState<DiscoveryResult|null>(null);
  // A session boundary alone cannot authorize a navigation scope. A real upstream
  // adapter must supply BOTH. The default public preview stays unchanged.
  const assetInvestigationEnabled = !!assetInvestigationBoundary && !!navigationScopeKey;
  const menuButtonRef=useRef<HTMLButtonElement>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  const mainRef=useRef<HTMLElement>(null);
  const focusMainOnNavigationRef=useRef(false);
  const focusMainAfterInspectorNavigationRef=useRef(false);
  const mobileNavOpenRef=useRef(false);
  const restoreMenuFocusRef=useRef(false);
  const inspectorTriggerRef=useRef<HTMLButtonElement|null>(null);
  const restoreInspectorFocusRef=useRef(false);
  // Focus must be restored AFTER React removes `inert` from .next-body.
  // Focusing synchronously in the close handler is ignored by real Chromium.
  useLayoutEffect(()=>{
    if(!mobileNav && restoreMenuFocusRef.current){
      restoreMenuFocusRef.current=false;
      menuButtonRef.current?.focus();
    }
  },[mobileNav]);
  useEffect(()=>{
    mobileNavOpenRef.current=mobileNav;
    if(mobileNav)sidebarRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  },[mobileNav]);
  useEffect(()=>{
    // An open mobile modal must not trap focus after rotating/resizing to a
    // desktop layout where the menu button and mobile backdrop are hidden.
    const onResize=()=>{
      if(window.innerWidth>800 && mobileNavOpenRef.current){
        focusMainOnNavigationRef.current=true;
        setMobileNav(false);
      }
    };
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);
  function closeMobileNavigation():void {restoreMenuFocusRef.current=true;setMobileNav(false);}
  function openFunctionInspector(feature:Capability,invoker:HTMLButtonElement):void {
    inspectorTriggerRef.current=invoker;
    restoreInspectorFocusRef.current=false;
    setSelectedFunction(feature);
  }
  function closeFunctionInspector():void {
    restoreInspectorFocusRef.current=true;
    setSelectedFunction(null);
  }
  function focusMainIfDrawerOpen():void {if(mobileNavOpenRef.current)focusMainOnNavigationRef.current=true;}
  function handleMobileNavigationKeys(event:{key:string;shiftKey:boolean;preventDefault:()=>void;currentTarget:HTMLElement}):void {
    if(!mobileNav)return;
    if(event.key==="Escape"){event.preventDefault();closeMobileNavigation();return;}
    if(event.key!=="Tab")return;
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    if(!buttons.length)return;
    const first=buttons[0]!,last=buttons[buttons.length-1]!;
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
  useEffect(()=>{
    if(focusMainOnNavigationRef.current && !mobileNav){
      focusMainOnNavigationRef.current=false;
      mainRef.current?.focus();
    }
  },[area,screenId,mobileNav]);
  useLayoutEffect(()=>{
    // React has already committed inert={false} to the body/sidebar before
    // layout effects run. Cleanup in an unmounting inspector is too early:
    // Chromium intentionally rejects focus into an inert background.
    if(selectedFunction)return;
    if(focusMainAfterInspectorNavigationRef.current){
      focusMainAfterInspectorNavigationRef.current=false;
      restoreInspectorFocusRef.current=false;
      inspectorTriggerRef.current=null;
      mainRef.current?.focus();
      return;
    }
    if(restoreInspectorFocusRef.current){
      restoreInspectorFocusRef.current=false;
      const trigger=inspectorTriggerRef.current;
      inspectorTriggerRef.current=null;
      if(trigger?.isConnected && !trigger.closest("[inert]"))trigger.focus();
      else mainRef.current?.focus();
    }
  },[area,screenId,selectedFunction]);
  useEffect(()=>{
    if(!mobileNav && !selectedFunction)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;};
  },[mobileNav,selectedFunction]);
  const authorizedAssets=useMemo(()=>{
    if(!navigationScopeKey||assetSnapshot==null)return [];
    const parsed=parseAssetSnapshot(assetSnapshot);
    return parsed.ok?parsed.snapshot.assets.map(a=>a.id):[];
  },[assetSnapshot,navigationScopeKey]);
  const currentAssetId=assetSelection && assetSelection.scopeKey===assetScopeKey && authorizedAssets.includes(assetSelection.id)
    ? assetSelection.id : undefined;
  function selectAsset(id:string|undefined):void {
    // Navigation selection must refer to a currently available authorized AIR object.
    setAssetSelection(id&&authorizedAssets.includes(id)?{id,scopeKey:assetScopeKey}:null);
  }

  const domain = DOMAINS.find(d=>d.code===domainCode)!;
  const domainScreens = SCREENS.filter(s=>s.domain===domainCode);
  const currentScreen = SCREEN_BY_ID.get(screenId) ?? domainScreens[0]!;
  const workspaceKind = workspaceForScreen(currentScreen.id);
  const sharedScreen = currentScreen.domain==="HOM" || currentScreen.domain==="GLB";
  // Record a visit only after a known canonical screen becomes the visible surface.
  // Unknown hashes, registry views and opt-in API routes never enter the trail.
  useEffect(()=>{
    if(area==="surface")setRecentScreens(previous=>recordWorkspaceVisit(previous,currentScreen.id));
  },[area,currentScreen.id]);
  const recentTargets=recentWorkspaceTargets(recentScreens,area==="surface"?currentScreen.id:null);
  useEffect(()=>{
    const synchronize=()=>{focusMainIfDrawerOpen();if(inspectorTriggerRef.current)focusMainAfterInspectorNavigationRef.current=true;const id=readScreenRoute(window.location.hash);
      if (canOpenAssetInvestigationRoute(window.location.hash, assetInvestigationEnabled)) {
        setArea("asset-investigation");setSelectedFunction(null);setRecordHandoff(null);setMobileNav(false);
        return;
      }
      if(!id){setArea("architecture");setSelectedFunction(null);setRecordHandoff(null);setMobileNav(false);return;}const screen=SCREEN_BY_ID.get(id)!;
      setScreenId(id);setArea("surface");setSelectedFunction(null);setMobileNav(false);setRecordHandoff(previous=>previous?.screenId===id?previous:null); if(screen.domain!=="HOM" && screen.domain!=="GLB")setDomainCode(screen.domain);
    };
    synchronize();window.addEventListener("hashchange",synchronize);
    return ()=>window.removeEventListener("hashchange",synchronize);
  },[assetInvestigationEnabled]);
  const matchingFunctions=useMemo(()=>CAPABILITIES.filter(c=>(domainFilter==="all"||c.domain===domainFilter) && searchMatches(c,query.trim().toLocaleLowerCase())),[domainFilter,query]);
  const displayFunctions=area==="registry" ? matchingFunctions : currentScreen.functionIds.flatMap(id=>{const f=CAPABILITIES.find(c=>c.id===id);return f?[f]:[];});
  function openDomain(code:DomainCode):void {
    const first=SCREEN_BY_ID.get(`SCR-${code}-001`)!;openScreen(first);setDomainFilter(code);
  }
  function clearScreenRoute():void {
    setRecordHandoff(null);
    if(typeof window!=="undefined" && window.location.hash)window.history.pushState(null,"",window.location.pathname+window.location.search);
  }
  function openRegistry():void {focusMainIfDrawerOpen();clearScreenRoute();setArea("registry");setDomainFilter("all");setQuery("");setSelectedFunction(null);setMobileNav(false);}
  function openAssetInvestigation():void {
    if (!assetInvestigationEnabled) return;
    focusMainIfDrawerOpen();
    if(selectedFunction)focusMainAfterInspectorNavigationRef.current=true;
    setArea("asset-investigation");setRecordHandoff(null);
    setSelectedFunction(null);setMobileNav(false);
    if(typeof window!=="undefined" && window.location.hash!==ASSET_INVESTIGATION_HASH)
      window.location.hash=ASSET_INVESTIGATION_HASH;
  }
  function openScreen(screen:ScreenDefinition):void {
    focusMainIfDrawerOpen();
    if(selectedFunction)focusMainAfterInspectorNavigationRef.current=true;
    setScreenId(screen.id);if(screen.domain!=="HOM" && screen.domain!=="GLB")setDomainCode(screen.domain);
    setArea("surface");setSelectedFunction(null);setMobileNav(false);setRecordHandoff(null);
    if(typeof window!=="undefined" && window.location.hash!==screenHref(screen.id))window.location.hash=screenHref(screen.id);
  }
  function openSearchRecord(record:DiscoveryResult):void {
    const next=SCREEN_BY_ID.get(record.screenId);
    if(!next||next.domain!==record.domain||!navigationScopeKey)return;
    openScreen(next);
    // Context is a read-only navigation handoff; the owning workspace does not auto-load this record.
    setRecordHandoff(record);
  }
  const screenForCount=SCREENS.filter(s=>s.domain==="HOM"||s.domain==="GLB").length;
  return <div className="next-app">
    <a className="next-skip" href="#next-main" inert={mobileNav||!!selectedFunction} onClick={event=>{event.preventDefault();mainRef.current?.focus();}}>Skip to main content</a>
    {mobileNav&&<button type="button" tabIndex={-1} className="next-mobile-backdrop" aria-label="Close mobile navigation" onClick={closeMobileNavigation}/>}
    <aside id="aim-primary-nav" ref={sidebarRef} inert={!!selectedFunction} className={`next-sidebar ${mobileNav?"mobile-open":""}`} aria-label="Primary navigation" role={mobileNav?"dialog":undefined} aria-modal={mobileNav?true:undefined} onKeyDown={handleMobileNavigationKeys}>
      <div className="next-brand"><BrandMark/><div><span className="next-brand-name">BANDHA <b>AIM</b></span><small>FUTURE SYSTEM · v1.0 BASELINE</small></div></div>
      <div className="next-navigation-label">WORKSPACE</div>
      <button type="button" onClick={()=>{focusMainIfDrawerOpen();clearScreenRoute();setArea("architecture");setSelectedFunction(null);setMobileNav(false);}} className={`next-nav-main ${area==="architecture"?"active":""}`}><span className="next-nav-glyph">◫</span>Architecture overview</button>
      <button type="button" onClick={openRegistry} className={`next-nav-main ${area==="registry"?"active":""}`}><span className="next-nav-glyph">▦</span>Capability catalogue <span className="next-side-count">190</span></button>
      {assetInvestigationEnabled && <button type="button" onClick={openAssetInvestigation}
        className={`next-nav-main ${area==="asset-investigation"?"active":""}`}
        aria-current={area==="asset-investigation"?"page":undefined}>
        <span className="next-nav-glyph" aria-hidden="true">⌁</span>Authorized Asset investigation
      </button>}
      <button type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-HOM-001")!)} className={`next-nav-main ${screenId==="SCR-HOM-001" && area==="surface"?"active":""}`}><span className="next-nav-glyph">◫</span>Enterprise overview</button>
      <button type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-HOM-002")!)} className={`next-nav-main ${screenId==="SCR-HOM-002" && area==="surface"?"active":""}`}><span className="next-nav-glyph">☷</span>My work</button>
      <button type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-HOM-003")!)} className={`next-nav-main ${screenId==="SCR-HOM-003" && area==="surface"?"active":""}`}><span className="next-nav-glyph">⌕</span>Universal search</button>
      <div className="next-sidebar-scroll">
        {DOMAIN_GROUPS.map(group=><section key={group} aria-label={group}>
          <h2 className="next-navigation-label">{group}</h2>
          {DOMAINS.filter(d=>d.group===group).map(d=><button type="button" className={`next-domain-nav ${domainCode===d.code && area==="surface"?"active":""}`} key={d.code} onClick={()=>openDomain(d.code)} aria-current={domainCode===d.code && area==="surface"?"page":undefined}>
            <span className="next-domain-code">{d.code}</span><span className="next-domain-nav-name">{d.name}</span><span className="next-side-count">{d.functions.length}</span>
          </button>)}
        </section>)}
      </div>
      <button type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-GLB-001")!)} className={`next-nav-main ${screenId==="SCR-GLB-001" && area==="surface"?"active":""}`}><span className="next-nav-glyph">◇</span>Application shell</button>
      <div className="next-sidebar-footer"><span className="next-pulse"/> {assetInvestigationEnabled?"Engineering domains disconnected":"Backend offline"} <small>Engineering-domain preview; Asset API is opt-in</small></div>
    </aside>

    <div className="next-body" inert={mobileNav||!!selectedFunction}>
      <header className="next-topbar"><div className="next-topbar-left"><button ref={menuButtonRef} className="next-menu" type="button" aria-label="Toggle navigation" aria-controls="aim-primary-nav" aria-expanded={mobileNav} onClick={()=>setMobileNav(v=>!v)}>☰</button><span className="next-breadcrumb">AAS / Integrity Intelligence <span>/</span> {area==="surface"?currentScreen.domain:area==="registry"?"Capability catalogue":area==="asset-investigation"?"Authorized Asset investigation":"System architecture"}</span></div><div className="next-topbar-right"><span className="next-environment">DESIGN ENVIRONMENT</span><span className="next-session">{assetInvestigationEnabled?"Session adapter configured":"No authenticated session"}</span></div></header>
      <WorkspaceFinder currentScreenId={area==="surface"?currentScreen.id:undefined} onNavigate={target=>{
        if(area==="surface" && target.id===currentScreen.id){
          mainRef.current?.focus();
          return;
        }
        focusMainOnNavigationRef.current=true;
        openScreen(target);
      }}/>
      {area==="surface" && recentTargets.length>0 && <nav className="next-workspace-trail" aria-label="Recently visited workspaces">
        <span className="next-workspace-trail-label">Recent workspaces <small>this navigation scope</small></span>
        <div className="next-workspace-trail-links">{recentTargets.map(id=>{
          const target=SCREEN_BY_ID.get(id)!;
          return <button key={id} type="button" title={target.title} onClick={()=>{
            focusMainOnNavigationRef.current=true;
            openScreen(target);
          }}><span className="next-workspace-trail-code">{target.domain}</span><span>{target.title}</span></button>;
        })}</div>
      </nav>}
      <div className="discover-global"><AssetContextPicker key={`${navigationScopeKey??"no-scope"}:${assetScopeKey??"no-air-scope"}`} snapshot={assetSnapshot} scopeKey={navigationScopeKey} selectedAssetId={currentAssetId} onSelectAsset={selectAsset}/>{currentAssetId&&<button className="discover-context-shortcut" type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-AIR-003")!)}>Open selected asset workspace ↗</button>}{area==="surface"&&recordHandoff&&currentScreen.id===recordHandoff.screenId&&<div className="dossier-handoff" role="status"><span><strong>Record navigation reference</strong> · {recordHandoff.domain} / {recordHandoff.objectRef} / {recordHandoff.revision} · {recordHandoff.state}</span><span>Owning workspace opened; exact record selection and authority still require the owning service.</span><button type="button" onClick={()=>setRecordHandoff(null)} aria-label="Dismiss record navigation reference">Dismiss</button></div>}</div>
      <main ref={mainRef} id="next-main" tabIndex={-1} className="next-main">
        {area==="architecture" ? <>
          <div className="next-eyebrow next-kicker">FROZEN ARCHITECTURE · STRUCTURAL BASELINE v1.0</div>
          <h1 className="next-page-title">One integrity system.<br/><em>Fifteen connected domains.</em></h1>
          <p className="next-page-description">AAS–AIM is an evidence-backed industrial asset integrity knowledge-and-decision system. Each function belongs to an accountable domain; screens compose functions without claiming ownership of their engineering state.</p>
          <div className="next-stats"><Stat label="ACTIVE FUNCTIONS" value={String(TOTAL_FUNCTIONS)} note="Frozen capability IDs"/><Stat label="ENGINEERING DOMAINS" value="15" note="Domain ownership boundaries"/><Stat label="PRIMARY UI SURFACES" value={String(TOTAL_PRIMARY_SCREENS)} note="74 domain + 4 shared IDs"/><Stat label="RETIRED / RESERVED" value="02" note="VIS-001 & VIS-002"/></div>
          <section className="next-panel"><div className="next-section-head"><div><span className="next-eyebrow">ASSURANCE CHAIN</span><h2>Evidence to reassessment</h2></div></div><div className="next-lifecycle">{assuranceLifecycle.map((stage,i)=><div className="next-lifecycle-item" key={stage}><span>{String(i+1).padStart(2,"0")}</span><strong>{stage}</strong></div>)}</div><EngineeringNotice>These are conceptual lifecycle labels, not live integrity states or approved engineering decisions.</EngineeringNotice></section>
          <div className="next-domain-grid">{DOMAINS.map(d=><button key={d.code} type="button" onClick={()=>openDomain(d.code)} className="next-domain-card"><span className="next-domain-card-code">{d.code}</span><strong>{d.name}</strong><small>{d.summary}</small><span className="next-card-footer">{d.functions.length} functions <span>View workspace ↗</span></span></button>)}</div>
        </> : area==="asset-investigation" && assetInvestigationEnabled ? <>
          <div className="next-eyebrow next-kicker">OPTIONAL AUTHORIZED API WORKFLOW · PHASE 45.8</div>
          <div className="next-page-heading"><div>
            <h1 className="next-page-title">Authorized Asset investigation</h1>
            <p className="next-page-description">Server-paginated Asset Register, separately authorized Asset Detail and revision-aware evidence metadata. No engineering approval or source-document access is available here.</p>
          </div></div>
          <div className="phase45-navigation-actions">
            <button type="button" onClick={()=>openScreen(SCREEN_BY_ID.get("SCR-AIR-001")!)}>Return to Asset Register screen</button>
          </div>
          <section className="next-panel phase45-investigation-panel" aria-label="Authorized Asset API workflow">
            <WorkspaceModuleBoundary key={navigationScopeKey??"untrusted"}><Suspense fallback={<WorkspaceLoading label="Authorized asset investigation" />}><AuthenticatedAssetInvestigation boundary={assetInvestigationBoundary ?? null} /></Suspense></WorkspaceModuleBoundary>
          </section>
        </> : area==="registry" ? <>
          <div className="next-eyebrow next-kicker">ARTIFACT 1 · FROZEN FUNCTION REGISTRY</div>
          <h1 className="next-page-title">Capability catalogue<span className="next-title-count">190</span></h1>
          <p className="next-page-description">Search every active function by canonical ID or name. The list is the development scope; it does not mean engineering workflows are implemented or authorized.</p>
          <div className="next-search-bar"><label className="next-search-field"><span className="next-sr-only">Search capabilities</span><span aria-hidden="true">⌕</span><input type="search" value={query} placeholder="Search function ID, capability or domain…" onChange={e=>setQuery(e.target.value)}/></label><label className="next-select-field">Domain <select aria-label="Filter by domain" value={domainFilter} onChange={e=>setDomainFilter(e.target.value as "all"|DomainCode)}><option value="all">All 15 domains</option>{DOMAINS.map(d=><option value={d.code} key={d.code}>{d.code} — {d.name}</option>)}</select></label></div>
          <div className="next-list-header"><span>{matchingFunctions.length} matching functions</span><span>Canonical ID / Capability</span></div>
          <div className="next-function-list">{matchingFunctions.map(c=><CapabilityRow key={c.id} feature={c} onSelect={openFunctionInspector} selected={selectedFunction?.id===c.id}/>)}{matchingFunctions.length===0&&<p className="next-empty">No matching capabilities. Try a function ID such as RBI-018 or a term such as inspection.</p>}</div>
          <div className="next-retired">Retired IDs: <code>VIS-001</code> and <code>VIS-002</code> are intentionally absent from the active function registry.</div>
        </> : <>
          <div className="next-eyebrow next-kicker">{sharedScreen ? "SHARED APPLICATION SURFACE" : `${domain.group.toUpperCase()} / ${domain.code} DOMAIN`}</div>
          <div className="next-page-heading"><div><h1 className="next-page-title">{sharedScreen ? currentScreen.title : domain.name}</h1><p className="next-page-description">{sharedScreen ? "A shared application surface which references owning-domain capabilities without becoming an authoritative domain." : `${domain.summary}. ${domain.functions.length} canonical functions across ${domainScreens.length} primary domain screen surfaces.`}</p></div><span className="next-domain-bigcode">{currentScreen.domain}</span></div>
          <div className="next-domain-meta"><span><span className="next-dot"/> Design preview</span><span>{currentScreen.functionIds.length} mapped functions</span><span>{sharedScreen?1:domainScreens.length} surfaces</span><span>Authoritative service required</span></div>
          <div className="next-screen-tabs" role="group" aria-label={`${domain.code} screen surfaces`}>{(sharedScreen?[currentScreen]:domainScreens).map(s=><button key={s.id} className={currentScreen.id===s.id?"active":""} type="button" aria-pressed={currentScreen.id===s.id} onClick={()=>openScreen(s)}><span>{s.id}</span>{s.title}</button>)}</div>
          <div className="next-domain-layout"><div className="next-domain-primary">
            <section className="next-panel next-screen-preview"><div className="next-section-head"><div><span className="next-eyebrow">{currentScreen.id} · {currentScreen.surface.toUpperCase()}</span><h2>{currentScreen.title}</h2></div><span className="next-preview-tag">{["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","INT","ANA","HOM","FLD","VIS"].includes(currentScreen.domain)?"INTERACTIVE FRONTEND":"DESIGN STAGE"}</span></div>
              {currentAssetId && (workspaceKind==="AIR"||workspaceKind==="COR"||workspaceKind==="INS") &&
                <CrossDomainInvestigation key={`${navigationScopeKey}:${crossDomainScopeKey}:${assetScopeKey}:${corrosionScopeKey}:${inspectionScopeKey}:${currentAssetId}`}
                  activeDomain={workspaceKind} onNavigate={id=>{const destination=SCREEN_BY_ID.get(id);if(destination)openScreen(destination);}}
                  navigationScopeKey={navigationScopeKey} crossDomainScopeKey={crossDomainScopeKey}
                  assetScopeKey={assetScopeKey} corrosionScopeKey={corrosionScopeKey} inspectionScopeKey={inspectionScopeKey}
                  selectedAssetId={currentAssetId} assetSnapshot={assetSnapshot}
                  corrosionSnapshot={corrosionSnapshot} inspectionSnapshot={inspectionSnapshot}/>}
              {workspaceKind==="AIR" && assetInvestigationEnabled && <div className="phase45-navigation-actions">
                <button type="button" onClick={openAssetInvestigation}>Open authorized Asset investigation</button>
                <span>Separate API workflow; does not change the canonical AIR records or approvals.</span>
              </div>}
              <WorkspaceModuleBoundary key={workspaceKind??"unknown"}>
              <Suspense fallback={<WorkspaceLoading label={sharedScreen ? currentScreen.title : domain.name} />}>
              {workspaceKind==="AIR" ? <AssetDomainWorkspace key={assetScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={assetSnapshot} selectedAssetId={currentAssetId} onAssetSelect={id=>selectAsset(id)} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} />  : workspaceKind==="DISCOVERY" ? <UniversalSearchWorkspace key={navigationScopeKey??"no-scope"} scopeKey={navigationScopeKey} snapshot={discoverySnapshot} recordContextSnapshot={recordContextSnapshot} onOpenRecord={openSearchRecord} selectedAssetId={currentAssetId} authorizedAssetIds={authorizedAssets} onSelectAsset={id=>selectAsset(id)} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} />: workspaceKind==="DGM" ? <DegradationDomainWorkspace key={degradationScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={degradationSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="COR" ? <CorrosionDomainWorkspace key={corrosionScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={corrosionSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="INS" ? <InspectionDomainWorkspace key={inspectionScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={inspectionSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="RBI" ? <RbiDomainWorkspace key={rbiScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={rbiSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="FND" ? <FindingsDomainWorkspace key={findingsScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={findingsSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="REC" ? <RecommendationsDomainWorkspace key={recommendationsScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={recommendationsSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="ACT" ? <ActionsDomainWorkspace key={actionsScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={actionsSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="IOW" ? <IowDomainWorkspace key={iowScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={iowSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="FFS" ? <FfsDomainWorkspace key={ffsScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={ffsSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="GOV" ? <GovernanceDomainWorkspace key={governanceScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={governanceSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="INT" ? <IntegrationsDomainWorkspace key={integrationScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={integrationSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="ANA" ? <AnalyticsDomainWorkspace key={analyticsScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={analyticsSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="FLD" ? <FieldDomainWorkspace key={fieldScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={fieldSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : workspaceKind==="VIS" ? <VisualDomainWorkspace key={visualScopeKey??"disconnected"} screenId={currentScreen.id} snapshot={visualSnapshot} onNavigate={id=>{const next=SCREEN_BY_ID.get(id);if(next)openScreen(next);}} /> : <p className="next-muted">{screenMessages[currentScreen.surface]}</p>}
              </Suspense>
              </WorkspaceModuleBoundary>
              <ScreenWorkflowGuide screen={currentScreen} onNavigate={openScreen}/>
              {currentScreen.notes && <EngineeringNotice>{currentScreen.notes}</EngineeringNotice>}
              {currentScreen.protectedFunctions.length>0 && <div className="next-protected-panel"><div><strong>Protected transitions</strong><p>Backend authorization, exact revision binding and immutable audit evidence are mandatory. No approval can execute here.</p></div><div className="next-protected-ids">{currentScreen.protectedFunctions.map(id=><code key={id}>{id}</code>)}</div></div>}
              {!["AIR","DGM","COR","INS","RBI","FND","REC","ACT","IOW","FFS","GOV","INT","ANA","HOM","FLD","VIS"].includes(currentScreen.domain) && <div className="next-empty-state"><strong>No authoritative records connected</strong><p>UI information architecture is mapped, but record data, domain commands, calculations and approvals require validated server contracts.</p><button type="button" disabled>Authoritative actions unavailable</button></div>}
            </section>
            <section className="next-panel"><div className="next-section-head"><div><span className="next-eyebrow">FUNCTIONAL BOUNDARY</span><h2>Functions on this screen</h2></div><span className="next-count">{displayFunctions.length} mapped functions</span></div>
              <div className="next-function-list">{displayFunctions.map(feature=><CapabilityRow key={feature.id} feature={feature} onSelect={openFunctionInspector} selected={selectedFunction?.id===feature.id}/>)}</div>
            </section>
          </div><aside className="next-domain-aside"><section className="next-panel next-sticky"><span className="next-eyebrow">GOVERNING RULE</span><h2>Engineering authority</h2><p>{engineeringRules[sharedScreen ? "GOV" : domainCode]}</p><div className="next-aside-divider"/><div className="next-aside-item"><span>Source records</span><strong>{(currentScreen.domain==="AIR" && assetSnapshot!=null || currentScreen.domain==="DGM" && degradationSnapshot!=null || currentScreen.domain==="COR" && corrosionSnapshot!=null || currentScreen.domain==="INS" && inspectionSnapshot!=null || currentScreen.domain==="RBI" && rbiSnapshot!=null || currentScreen.domain==="FND" && findingsSnapshot!=null || currentScreen.domain==="REC" && recommendationsSnapshot!=null || currentScreen.domain==="ACT" && actionsSnapshot!=null || currentScreen.domain==="IOW" && iowSnapshot!=null || currentScreen.domain==="FFS" && ffsSnapshot!=null || currentScreen.domain==="GOV" && governanceSnapshot!=null || currentScreen.domain==="INT" && integrationSnapshot!=null || (currentScreen.domain==="ANA" || currentScreen.id==="SCR-HOM-001" || currentScreen.id==="SCR-HOM-002") && analyticsSnapshot!=null || currentScreen.id==="SCR-HOM-003" && discoverySnapshot!=null || currentScreen.domain==="FLD" && fieldSnapshot!=null || currentScreen.domain==="VIS" && visualSnapshot!=null)?"Supplied — validate in workspace":"Unavailable"}</strong></div><div className="next-aside-item"><span>Approval state</span><strong>Not evaluated</strong></div><div className="next-aside-item"><span>Data confidence</span><strong>UNKNOWN</strong></div><div className="next-aside-divider"/><p className="next-aside-footnote">Missing, stale, invalid and unknown evidence must remain distinguishable. This preview cannot approve or change engineering state.</p></section></aside></div>
        </>}
      </main>
      <footer className="next-footer"><span>AAS–AIM · Structural Architecture Baseline v1.0</span><span>{TOTAL_FUNCTIONS} functions · {TOTAL_PRIMARY_SCREENS} primary surfaces · {screenForCount} shared surfaces</span></footer>
    </div>
    {selectedFunction&&<><button type="button" tabIndex={-1} className="next-backdrop" aria-label="Dismiss function detail backdrop" onClick={closeFunctionInspector}/><FunctionInspector feature={selectedFunction} onClose={closeFunctionInspector} onNavigate={openScreen}/></>}
  </div>;
}
