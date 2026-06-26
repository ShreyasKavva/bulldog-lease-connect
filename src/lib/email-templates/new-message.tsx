import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface NewMessageProps {
  senderName?: string
  preview?: string
  listingTitle?: string
  conversationUrl?: string
}

const NewMessageEmail = ({
  senderName = 'Someone',
  preview = '',
  listingTitle,
  conversationUrl = 'https://leasup.co',
}: NewMessageProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{senderName} sent you a message on LeaseUp</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New message from {senderName}</Heading>
        {listingTitle ? (
          <Text style={meta}>Re: {listingTitle}</Text>
        ) : null}
        <Hr style={hr} />
        <Text style={quote}>{preview || 'You have a new message on LeaseUp.'}</Text>
        <Hr style={hr} />
        <Button style={button} href={conversationUrl}>
          Reply on LeaseUp
        </Button>
        <Text style={footer}>
          You're getting this because someone messaged you about a listing. Manage notifications in your profile.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewMessageEmail,
  subject: (data) => `New message${data?.senderName ? ` from ${data.senderName}` : ''} on LeaseUp`,
  displayName: 'New message',
  previewData: {
    senderName: 'Alex',
    preview: 'Hey! Is the place still available for the summer?',
    listingTitle: '2BR near North Campus',
    conversationUrl: 'https://leasup.co',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 6px' }
const meta = { fontSize: '13px', color: '#64748B', margin: '0 0 14px' }
const hr = { borderColor: '#E2E8F0', margin: '14px 0' }
const quote = { fontSize: '15px', color: '#0F172A', lineHeight: '1.55', margin: '0 0 8px', whiteSpace: 'pre-wrap' as const }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', fontSize: '15px',
  borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', fontWeight: 600, marginTop: '8px',
}
const footer = { fontSize: '12px', color: '#94A3B8', margin: '28px 0 0' }
