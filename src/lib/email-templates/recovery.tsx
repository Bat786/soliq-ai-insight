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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>Reset your password</Heading>
          <Text style={s.text}>
            We received a request to reset the password on your {siteName}
            {' '}account. Choose a new password using the button below.
          </Text>
          <Button style={s.button} href={confirmationUrl}>
            Choose new password
          </Button>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            If you didn&apos;t request a reset, your password is unchanged and
            no further action is needed.
          </Text>
        </Section>
        <Text style={s.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
