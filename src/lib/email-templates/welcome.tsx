import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface WelcomeProps {
  name?: string
  siteUrl?: string
}

const WelcomeEmail = ({ name, siteUrl = 'https://leasup.co' }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to LeaseUp — find your next place.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to LeaseUp{name ? `, ${name}` : ''} 👋</Heading>
        <Text style={text}>
          You're in. LeaseUp is where students find subleases and lease transfers near every major US campus —
          verified posters, SafeScore on every listing, and real students on the other end.
        </Text>
        <Text style={text}>
          Browse the map, save searches, and message hosts directly. Posting takes about a minute.
        </Text>
        <Button style={button} href={siteUrl}>
          Open LeaseUp
        </Button>
        <Text style={footer}>
          Questions? Just reply to this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to LeaseUp',
  displayName: 'Welcome',
  previewData: { name: 'Jordan', siteUrl: 'https://leasup.co' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.55', margin: '0 0 18px' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', fontSize: '15px',
  borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', fontWeight: 600,
}
const footer = { fontSize: '12px', color: '#94A3B8', margin: '32px 0 0' }
