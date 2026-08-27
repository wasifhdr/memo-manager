import type { Metadata } from 'next'
import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Register organization' }

export default function RegisterOrganizationPage() {
  return <RegisterForm />
}
