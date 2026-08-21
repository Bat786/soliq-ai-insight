import * as React from 'react'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your SOLIQ verification code</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Text style={s.brand}>SOLIQ INTELLIGENCE</Text>
        <Section style={s.card}>
          <Heading style={s.h1}>Verification code</Heading>
          <Text style={s.text}>
            Enter this code to confirm the action you started in SOLIQ.
          </Text>
          <Text style={s.code}>{token}</Text>
          <Hr style={s.divider} />
          <Text style={s.muted}>
            The code expires shortly. If you didn&apos;t request it, do not
            share it with anyone.
          </Text>
        </Section>
        <Text style={s.footer}>SOLIQ Intelligence Engine</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
