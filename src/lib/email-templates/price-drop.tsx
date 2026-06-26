import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface PriceDropProps {
  listingTitle?: string
  oldPrice?: number
  newPrice?: number
  campusName?: string
  listingUrl?: string
}

const fmt = (n?: number) => (typeof n === 'number' ? `$${n.toLocaleString()}` : '$—')

const PriceDropEmail = ({
  listingTitle = 'A listing you saved',
  oldPrice,
  newPrice,
  campusName,
  listingUrl = 'https://leasup.co',
}: PriceDropProps) => {
  const pctOff =
    oldPrice && newPrice && oldPrice > 0
      ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
      : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Price drop: {listingTitle} is now {fmt(newPrice)}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={badge}>
            <Text style={badgeText}>📉 Price drop{pctOff ? ` · ${pctOff}% off` : ''}</Text>
          </Section>
          <Heading style={h1}>{listingTitle}</Heading>
          {campusName ? <Text style={meta}>Near {campusName}</Text> : null}
          <Hr style={hr} />
          <Text style={priceRow}>
            <span style={oldP}>{fmt(oldPrice)}</span>{' '}
            <span style={newP}>{fmt(newPrice)}/mo</span>
          </Text>
          <Text style={body}>
            A sublease you saved just dropped its price. These move fast — message the poster before someone else does.
          </Text>
          <Button style={button} href={listingUrl}>View listing</Button>
          <Text style={footer}>
            You're getting this because you saved this listing. Manage alerts in your profile.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PriceDropEmail,
  subject: (data) =>
    `📉 Price drop${data?.listingTitle ? `: ${data.listingTitle}` : ''} on LeaseUp`,
  displayName: 'Price drop',
  previewData: {
    listingTitle: '2BR near North Campus',
    oldPrice: 1200,
    newPrice: 950,
    campusName: 'University of Georgia',
    listingUrl: 'https://leasup.co',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const badge = { display: 'inline-block', backgroundColor: '#DCFCE7', borderRadius: '999px', padding: '4px 10px', marginBottom: '10px' }
const badgeText = { fontSize: '12px', color: '#166534', fontWeight: 'bold' as const, margin: 0 }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 6px' }
const meta = { fontSize: '13px', color: '#64748B', margin: '0 0 8px' }
const hr = { borderColor: '#E2E8F0', margin: '14px 0' }
const priceRow = { fontSize: '20px', margin: '6px 0 14px' }
const oldP = { color: '#94A3B8', textDecoration: 'line-through', marginRight: '6px' }
const newP = { color: '#2563EB', fontWeight: 'bold' as const }
const body = { fontSize: '15px', color: '#0F172A', lineHeight: '1.55', margin: '0 0 18px' }
const button = { backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold' as const, fontSize: '14px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94A3B8', marginTop: '20px' }
