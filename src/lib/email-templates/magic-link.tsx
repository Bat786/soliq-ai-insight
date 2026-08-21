import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import * as s from './soliq-theme'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your secure sign-in link for {siteName}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>Sign in to {siteName}</Heading>
          <Text style={s.text}>
            Use the button below to sign in. The link is single-use and expires
            shortly for your security.
          </Text>
          <Button style={s.button} href={confirmationUrl}>
            Sign in
          </Button>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            Didn&apos;t request this link? No action is needed — it expires on
            its own.
          </Text>
        </Section>
        <Text style={s.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
