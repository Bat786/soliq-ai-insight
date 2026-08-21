import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import * as s from './soliq-theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You&apos;ve been invited to {siteName}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>You&apos;re invited</Heading>
          <Text style={s.text}>
            You&apos;ve been invited to join{' '}
            <Link href={siteUrl} style={s.link}>
              {siteName}
            </Link>
            . Accept the invitation to set up your account and start tracking
            markets.
          </Text>
          <Button style={s.button} href={confirmationUrl}>
            Accept invitation
          </Button>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            If you weren&apos;t expecting this invitation, you can ignore this
            email.
          </Text>
        </Section>
        <Text style={s.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
