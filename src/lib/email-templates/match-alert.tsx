import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface MatchAlertProps {
  searchName?: string
  matchCount?: number
  topTitle?: string
  topPrice?: number
  topNeighborhood?: string
  browseUrl?: string
}

const MatchAlertEmail = ({
  searchName = 'your saved search',
  matchCount = 1,
  topTitle,
  topPrice,
  topNeighborhood,
  browseUrl = 'https://leasup.co/browse',
}: MatchAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${matchCount} new match${matchCount === 1 ? '' : 'es'} for ${searchName}`}</Preview>

    <Body style={main}>
      <Container style={container}>
        <Section style={badge}>
          <Text style={badgeText}>🎯 New match{matchCount === 1 ? '' : 'es'}</Text>
        </Section>
        <Heading style={h1}>
          {matchCount} new sublease{matchCount === 1 ? '' : 's'} matched “{searchName}”
        </Heading>
        {topTitle ? (
          <>
            <Hr style={hr} />
            <Text style={meta}>Top pick</Text>
            <Text style={pick}>
              {topTitle}
              {topPrice ? ` · $${topPrice.toLocaleString()}/mo` : ''}
              {topNeighborhood ? ` · ${topNeighborhood}` : ''}
            </Text>
          </>
        ) : null}
        <Hr style={hr} />
        <Text style={body}>
          Subleases at your campus get claimed fast. Tap below to see them before anyone else.
        </Text>
        <Button style={button} href={browseUrl}>See matches</Button>
        <Text style={footer}>
          You're getting this because you saved a search. Manage alerts in your profile.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MatchAlertEmail,
  subject: (data) => {
    const n = data?.matchCount ?? 1
    return `🎯 ${n} new match${n === 1 ? '' : 'es'} on LeaseUp`
  },
  displayName: 'Match alert',
  previewData: {
    searchName: 'Under $900 near North Campus',
    matchCount: 3,
    topTitle: 'Cozy studio, 5 min walk',
    topPrice: 825,
    topNeighborhood: 'Five Points',
    browseUrl: 'https://leasup.co/browse',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const badge = { display: 'inline-block', backgroundColor: '#DBEAFE', borderRadius: '999px', padding: '4px 10px', marginBottom: '10px' }
const badgeText = { fontSize: '12px', color: '#1E40AF', fontWeight: 'bold' as const, margin: 0 }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 6px' }
const meta = { fontSize: '12px', color: '#64748B', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const pick = { fontSize: '16px', color: '#0F172A', fontWeight: 'bold' as const, margin: '0 0 8px' }
const hr = { borderColor: '#E2E8F0', margin: '14px 0' }
const body = { fontSize: '15px', color: '#0F172A', lineHeight: '1.55', margin: '0 0 18px' }
const button = { backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold' as const, fontSize: '14px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94A3B8', marginTop: '20px' }
