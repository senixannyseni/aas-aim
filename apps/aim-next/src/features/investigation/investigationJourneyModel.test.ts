import {describe,expect,it} from 'vitest';
import {investigationJourney} from './investigationJourneyModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const source:EngineeringEvidence={key:'C-1',domain:'COR',kind:'Calculation trace',ownerRecordId:'C-100',sourceRecordId:'S-1',reference:'CALC-100',status:'DRAFT',revision:'r1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const ins:EngineeringEvidence={...source,key:'I-1',domain:'INS',ownerRecordId:'I-100',reference:'INSP-100'};
describe('Phase 46.26 bounded source-to-case journey',()=>{
 it('requires a current indexed selection',()=>{expect(investigationJourney([source],null).pointer).toBeNull();expect(investigationJourney([ins],'C-1').status).toBe('NO_SELECTION');});
 it('uses only the currently supplied record, never a guessed source',()=>{const p=investigationJourney([source],'C-1');expect(p.status).toBe('CURRENT_INDEX');expect(p.pointer).toEqual({key:'C-1',domain:'COR',reference:'CALC-100',ownerRecordId:'C-100',kind:'Calculation trace'});});
 it('honors removal and independent INS authorization',()=>{expect(investigationJourney([ins],'I-1').pointer?.domain).toBe('INS');expect(investigationJourney([],'I-1').pointer).toBeNull();});
});
