import { describe, expect, it, vi } from 'vitest'
import Page from '../app/page'

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

describe('home page', () => {
  it('redirects home to the dashboard', () => {
    Page()
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })
})
