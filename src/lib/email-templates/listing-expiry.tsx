import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface ListingExpiryProps {
  title?: string
  expiresOn?: string // formatted date, e.g. "Aug 10, 2025"
  markRentedUrl?: string
  editUrl?: string
}

const ListingExpiryEmail = ({
  title = 'Your listing',
  expiresOn = 'soon',
  markRentedUrl = 'https://leasup.co/my-listings',
  editUrl = 'https://leasup.co/my-listings',
}: ListingExpiryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your listing &ldquo;{title}&rdquo; expires in 3 days.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your listing expires in 3 days</Heading>
        <Text style={text}>
          Your sublease listing &ldquo;{title}&rdquo; on LeaseUp is set to expire on {expiresOn}.
        </Text>
        <Text style={text}>
          If you&rsquo;ve already found someone, great! Mark it as rented so other students know it&rsquo;s taken:
        </Text>
        <Button style={button} href={markRentedUrl}>
          Mark as rented →
        </Button>
        <Text style={text}>
          If you&rsquo;re still looking, consider reposting with updated dates:
        </Text>
        <Text style={text}>
          → <Link style={linkStyle} href={editUrl}>Edit your listing</Link>
        </Text>
        <Text style={footer}>
          Automated reminder from LeaseUp. Manage notification preferences in your profile settings.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ListingExpiryEmail,
  subject: (data) =>
    `Your listing "${data?.title || 'on LeaseUp'}" expires in 3 days — did you find someone?`,
  displayName: 'Listing expiry reminder',
  previewData: {
    title: '1BR near North Campus',
    expiresOn: 'Aug 10, 2025',
    markRentedUrl: 'https://leasup.co/my-listings',
    editUrl: 'https://leasup.co/my-listings',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 14px' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', fontSize: '15px',
  borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', fontWeight: 600, margin: '4px 0 20px',
}
const linkStyle = { color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }
const footer = { fontSize: '12px', color: '#94A3B8', margin: '28px 0 0' }
