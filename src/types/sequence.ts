export interface SequenceStep {
  id: number
  step_number: number
  delay_days: number
  template_id?: number
  template_name?: string
  subject?: string
  body_template?: string
}
