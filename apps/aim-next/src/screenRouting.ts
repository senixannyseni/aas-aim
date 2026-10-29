import { SCREEN_BY_ID } from "./screenRegistry";

/** Hash-based deep links work with static Vite hosting; unknown/retired routes fail closed. */
export const DEFAULT_SCREEN_ID = "SCR-HOM-001";
export function screenHref(screenId:string):string {
  if (!SCREEN_BY_ID.has(screenId))throw new Error("Unknown AIM screen");
  return `#/screens/${screenId}`;
}
export function readScreenRoute(hash:string):string|null {
  const match=/^#\/screens\/(SCR-(?:AIR|DGM|COR|INS|RBI|FND|REC|ACT|IOW|FFS|GOV|INT|ANA|FLD|VIS|HOM|GLB)-\d{3})$/.exec(hash);
  return match && SCREEN_BY_ID.has(match[1]!) ? match[1]! : null;
}
