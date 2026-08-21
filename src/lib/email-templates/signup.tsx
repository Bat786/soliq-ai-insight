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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to activate {siteName}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>Confirm your email</Heading>
          <Text style={s.text}>
            Welcome to{' '}
            <Link href={siteUrl} style={s.link}>
              {siteName}
            </Link>
            . Confirm {recipient} to unlock live market scanners, AI scores and
            alerts.
          </Text>
          <Button style={s.button} href={confirmationUrl}>
            Verify email
          </Button>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            If you didn&apos;t create an account, you can safely ignore this
            email.
          </Text>
        </Section>
        <Text style={s.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
