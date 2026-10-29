import {useMemo,useState,type JSX} from "react";
import {parseAssetSnapshot,type AssetRecord} from "../assets/assetModel";
export type AssetContextPickerProps=Readonly<{
  snapshot?:unknown;
  scopeKey?:string|undefined;
  selectedAssetId?:string|undefined;
  onSelectAsset:(id:string|undefined)=>void;
}>;
/** Global navigation context only. Selecting an asset does NOT confer authorization or filter APIs. */
export function AssetContextPicker({snapshot,scopeKey,selectedAssetId,onSelectAsset}:AssetContextPickerProps):JSX.Element{
  const parsed=useMemo(()=>scopeKey&&snapshot!=null?parseAssetSnapshot(snapshot):null,[snapshot,scopeKey]);
  const [query,setQuery]=useState("");
  const assets:readonly AssetRecord[]=parsed?.ok?parsed.snapshot.assets:[];
  const selected=assets.find(r=>r.id===selectedAssetId);
  const visible=useMemo(()=>assets.filter(a=>`${a.tag} ${a.name} ${a.id}`.toLowerCase().includes(query.toLowerCase())).slice(0,25),[assets,query]);
  return <section className="discover-context" aria-label="Persistent asset navigation context"><div className="discover-context-heading"><span>ASSET NAVIGATION CONTEXT</span><strong>{selected?selected.tag:"No selected asset"}</strong></div>
    {!scopeKey?<p>Unavailable until a trusted navigation scope is supplied.</p>:parsed&&!parsed.ok?<p role="alert">Asset context source rejected; no asset can be selected.</p>:!parsed?<p>Asset context disconnected. No equipment identities supplied.</p>:<>
      <label>Find supplied asset<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search authorized tag"/></label>
      <label>Select navigation context<select aria-label="Select asset navigation context" value={selected?.id??""} onChange={e=>onSelectAsset(e.target.value||undefined)}><option value="">No selected asset</option>{selected&&!visible.some(a=>a.id===selected.id)&&<option value={selected.id}>{selected.tag} · {selected.name}</option>}{visible.map(a=><option key={a.id} value={a.id}>{a.tag} · {a.name}</option>)}</select></label>
      <small>{assets.length} source-backed asset records available for navigation. This is not a permission selector.</small>
      {selected&&<button type="button" onClick={()=>onSelectAsset(undefined)}>Clear selected asset</button>}
    </>}
  </section>;
}
