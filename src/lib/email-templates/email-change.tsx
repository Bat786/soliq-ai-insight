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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for {siteName}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>Confirm your new email</Heading>
          <Text style={s.text}>
            A request was made to change the email on your {siteName} account
            {oldEmail ? ` from ${oldEmail}` : ''}
            {newEmail ? ` to ${newEmail}` : email ? ` to ${email}` : ''}.
          </Text>
          <Button style={s.button} href={confirmationUrl}>
            Confirm change
          </Button>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            If you didn&apos;t request this change, ignore this email and your
            current address stays active.
          </Text>
        </Section>
        <Text style={s.footer}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
