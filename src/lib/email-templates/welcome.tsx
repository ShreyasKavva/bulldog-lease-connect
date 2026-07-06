import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface WelcomeProps {
  firstName?: string
  campusName?: string
  campusUrl?: string
  postUrl?: string
  roommatesUrl?: string
}

const WelcomeEmail = ({
  firstName,
  campusName = 'your campus',
  campusUrl = 'https://leasup.co',
  postUrl = 'https://leasup.co/post',
  roommatesUrl = 'https://leasup.co/roommates',
}: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to LeaseUp — the easiest way to find or post a student sublease.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          Welcome to LeaseUp{firstName ? `, ${firstName}` : ''} 👋
        </Heading>
        <Text style={text}>
          You&rsquo;re on LeaseUp — the easiest place to find or post a student sublease at {campusName}.
        </Text>
        <Text style={text}>Here&rsquo;s how to get started:</Text>
        <Text style={linkLine}>
          → <Link style={linkStyle} href={campusUrl}>Browse listings at {campusName}</Link>
        </Text>
        <Text style={linkLine}>
          → <Link style={linkStyle} href={postUrl}>Post your sublease</Link>
        </Text>
        <Text style={linkLine}>
          → <Link style={linkStyle} href={roommatesUrl}>Find a roommate</Link>
        </Text>
        <Text style={sign}>See you around campus.</Text>
        <Text style={sign}>— The LeaseUp team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: (data) => `Welcome to LeaseUp${data?.firstName ? `, ${data.firstName}` : ''} 👋`,
  displayName: 'Welcome',
  previewData: {
    firstName: 'Jordan',
    campusName: 'UGA',
    campusUrl: 'https://leasup.co/sublease/uga',
    postUrl: 'https://leasup.co/post',
    roommatesUrl: 'https://leasup.co/roommates',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 14px' }
const linkLine = { fontSize: '15px', color: '#0F172A', lineHeight: '1.6', margin: '0 0 8px' }
const linkStyle = { color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }
const sign = { fontSize: '15px', color: '#334155', margin: '18px 0 0' }
