import type { ComponentType } from 'react'
import { template as welcomeTemplate } from './welcome'
import { template as newMessageTemplate } from './new-message'
import { template as priceDropTemplate } from './price-drop'
import { template as matchAlertTemplate } from './match-alert'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  'new-message': newMessageTemplate,
  'price-drop': priceDropTemplate,
  'match-alert': matchAlertTemplate,
}

