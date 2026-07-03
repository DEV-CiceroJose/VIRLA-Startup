import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProfileImageUpload from './index'

function selectFile(input, { type, size, name = 'f' }) {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ProfileImageUpload', () => {
  it('rejeita GIF (fora da whitelist)', () => {
    render(<ProfileImageUpload value="" onChange={vi.fn()} />)
    const input = screen.getByLabelText('Selecionar foto de perfil')
    selectFile(input, { type: 'image/gif', size: 1000 })
    expect(screen.getByText(/JPG, PNG ou WEBP/i)).toBeInTheDocument()
  })

  it('rejeita arquivo maior que 5 MB', () => {
    render(<ProfileImageUpload value="" onChange={vi.fn()} />)
    const input = screen.getByLabelText('Selecionar foto de perfil')
    selectFile(input, { type: 'image/png', size: 6 * 1024 * 1024 })
    expect(screen.getByText(/5 MB/i)).toBeInTheDocument()
  })
})
