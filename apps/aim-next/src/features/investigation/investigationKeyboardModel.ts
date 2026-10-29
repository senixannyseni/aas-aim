/** Phase 46.27. Arrow-key focus movement is local to the currently visible evidence page.
 * It never selects a reference or crosses an authorized page/source boundary.
 */
export type EvidenceListKey='ArrowDown'|'ArrowUp'|'Home'|'End';
export function nextEvidenceFocusIndex(key:string,index:number,count:number):number|null{
  if(!Number.isSafeInteger(index)||!Number.isSafeInteger(count)||count<1||index<0||index>=count)return null;
  switch(key){
    case 'ArrowDown':return Math.min(index+1,count-1);
    case 'ArrowUp':return Math.max(index-1,0);
    case 'Home':return 0;
    case 'End':return count-1;
    default:return null;
  }
}
/** Escape only returns keyboard focus; it must not dismiss or clear evidence. */
export function shouldReturnToEvidenceRow(key:string):boolean{return key==='Escape';}
