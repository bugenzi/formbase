import type { Field } from '../store/types'

export type SyncEventPayload =
  | { type: 'field:move';     positionPt: { x: number; y: number; w: number; h: number } }
  | { type: 'field:resize';   positionPt: { x: number; y: number; w: number; h: number } }
  | { type: 'field:label';    label: string }
  | { type: 'field:required'; required: boolean }
  | { type: 'field:add';      field: Field }
  | { type: 'field:delete' }
  | { type: 'text:edit';      textId: string; content: string }

export interface SyncEvent {
  docId:     string
  fieldId:   string
  origin:    'figma' | 'web'
  timestamp: number
  payload:   SyncEventPayload
}
