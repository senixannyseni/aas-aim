/**
 * Phase 46.12: guidance derived exclusively from frozen architecture metadata.
 * This is NOT a readiness verdict, requirement specification, evidence fetch,
 * user permission, or assessment of engineering approval.
 */
import { CAPABILITY_BY_ID, type Capability } from "./capabilityRegistry";
import { SCREENS, SCREENS_BY_FUNCTION, type ScreenDefinition } from "./screenRegistry";

export const MAX_GUIDANCE_OBJECTS = 5;
export const MAX_GUIDANCE_TARGETS = 3;

export type ScreenWorkflowGuidance = Readonly<{
  screenId: string;
  objectFamilies: readonly string[];
  objectTotal: number;
  mappedFunctions: readonly string[];
  protectedFunctionIds: readonly string[];
  relatedScreens: readonly ScreenDefinition[];
  note: string | null;
  reviewBoundary: string;
}>;

/** Related screen links must share a frozen function ID and the same domain.
 * Never infer a cross-domain relation from a similar object name.
 */
export function screenWorkflowGuidance(screen: ScreenDefinition): ScreenWorkflowGuidance {
  const mapped = new Set(screen.functionIds);
  const related = SCREENS.filter(candidate =>
    candidate.id !== screen.id && candidate.domain === screen.domain &&
    candidate.functionIds.some(id => mapped.has(id)))
    .map(candidate => ({
      candidate,
      overlap: candidate.functionIds.filter(id => mapped.has(id)).length,
    }))
    .sort((a,b) => b.overlap-a.overlap || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, MAX_GUIDANCE_TARGETS)
    .map(item => item.candidate);
  return {
    screenId: screen.id,
    objectFamilies: screen.objects.slice(0, MAX_GUIDANCE_OBJECTS),
    objectTotal: screen.objects.length,
    mappedFunctions: screen.functionIds.filter(id => CAPABILITY_BY_ID.has(id)),
    protectedFunctionIds: screen.protectedFunctions.filter(id => mapped.has(id)),
    relatedScreens: related,
    note: screen.notes?.trim() || null,
    reviewBoundary: screen.protectedFunctions.length > 0
      ? "The architecture marks protected functions on this screen. Real authorization, revision checks and approval must be verified in the owning service."
      : "No protected functions are marked on this screen. That does not establish authorization or approval readiness.",
  };
}

export type FunctionWorkflowGuidance = Readonly<{
  functionId: string;
  targetScreens: readonly ScreenDefinition[];
  objectFamilies: readonly string[];
  reviewBoundary: string;
}>;

export function functionWorkflowGuidance(capability: Capability): FunctionWorkflowGuidance {
  const targets = SCREENS_BY_FUNCTION.get(capability.id) ?? [];
  const objects = [...new Set(targets.flatMap(target => target.objects))];
  return {
    functionId: capability.id,
    targetScreens: targets,
    objectFamilies: objects.slice(0, MAX_GUIDANCE_OBJECTS),
    reviewBoundary: capability.controlled
      ? "Protected transition in the canonical capability registry; this frontend cannot execute or approve it."
      : "Not marked as a protected transition in the canonical registry; permissions and data authority still require backend verification.",
  };
}
