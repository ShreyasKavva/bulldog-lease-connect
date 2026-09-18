import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface AmbassadorApplicationProps {
  name?: string
  school?: string
  email?: string
  reason?: string
  committedToPost?: boolean
}

/** Internal notification — fixed recipient, never mailed to applicants. */
const AmbassadorApplicationEmail = ({
  name = '—',
  school = '—',
  email = '—',
  reason = '—',
  committedToPost = false,
}: AmbassadorApplicationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New ambassador application from {name} ({school})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New ambassador application</Heading>
        <Text style={label}>Name</Text>
        <Text style={text}>{name}</Text>
        <Text style={label}>School</Text>
        <Text style={text}>{school}</Text>
        <Text style={label}>Email</Text>
        <Text style={text}>{email}</Text>
        <Text style={label}>Why they want to be an ambassador</Text>
        <Text style={text}>{reason}</Text>
        <Text style={label}>Committed to posting a sublease</Text>
        <Text style={text}>{committedToPost ? 'Yes' : 'No'}</Text>
        <Text style={sign}>— LeaseUp</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AmbassadorApplicationEmail,
  subject: (data) =>
    `New ambassador application — ${data?.name ?? 'Unknown'} (${data?.school ?? 'Unknown school'})`,
  displayName: 'Ambassador application',
  previewData: {
    name: 'Jordan Smith',
    school: 'University of Georgia',
    email: 'jordan@uga.edu',
    reason: 'I run two GroupMe chats with 800+ students moving in August.',
    committedToPost: true,
  },
  /** Locked recipient — overrides any caller-provided recipientEmail. */
  to: 'shreykavva@gmail.com',
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 20px' }
const label = { fontSize: '12px', fontWeight: 700 as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', margin: '14px 0 2px' }
const text = { fontSize: '15px', color: '#0F172A', lineHeight: '1.55', margin: '0 0 6px' }
const sign = { fontSize: '15px', color: '#334155', margin: '22px 0 0' }
