import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Page from '../app/page'

describe('home page', () => {
  it('renders successfully', () => {
    const result = render(<Page />)

    expect(result).toBeDefined()
  })
})
