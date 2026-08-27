import { describe, it, expect } from 'vitest'
import { directionFor, setDirection, consumeDirection } from '@/components/motion/route-direction'

/**
 * Sidebar order is: dashboard, inbox, memos, completed, search, notifications,
 * delegations, then the admin group. +1 means "moving down the sidebar", which
 * drives the outgoing page up and brings the incoming page in from below.
 */
describe('directionFor', () => {
  it('returns +1 when moving down the sidebar', () => {
    expect(directionFor('/dashboard', '/inbox')).toBe(1)
    expect(directionFor('/inbox', '/search')).toBe(1)
    expect(directionFor('/dashboard', '/delegations')).toBe(1)
  })

  it('returns -1 when moving up the sidebar', () => {
    expect(directionFor('/inbox', '/dashboard')).toBe(-1)
    expect(directionFor('/search', '/memos')).toBe(-1)
    expect(directionFor('/delegations', '/dashboard')).toBe(-1)
  })

  it('treats the admin group as below the main nav', () => {
    expect(directionFor('/dashboard', '/admin')).toBe(1)
    expect(directionFor('/admin/users', '/inbox')).toBe(-1)
    expect(directionFor('/admin', '/admin/audit')).toBe(1)
    expect(directionFor('/admin/audit', '/admin/users')).toBe(-1)
  })

  it('resolves nested routes to their parent nav entry', () => {
    // /memos/<id> must behave like /memos, not fall through to unknown
    expect(directionFor('/dashboard', '/memos/abc-123')).toBe(1)
    expect(directionFor('/memos/abc-123', '/dashboard')).toBe(-1)
  })

  it('prefers the longest matching prefix', () => {
    // /admin/users must not match the shorter /admin entry
    expect(directionFor('/admin/users', '/admin')).toBe(-1)
  })

  it('defaults to +1 for same route or unknown routes', () => {
    expect(directionFor('/dashboard', '/dashboard')).toBe(1)
    expect(directionFor('/profile', '/nowhere')).toBe(1)
  })
})

describe('direction hand-off', () => {
  it('consume returns what was set, then resets to the default', () => {
    setDirection(-1)
    expect(consumeDirection()).toBe(-1)
    // a direct URL load has no preceding click, so it should fall back to +1
    expect(consumeDirection()).toBe(1)
  })
})
