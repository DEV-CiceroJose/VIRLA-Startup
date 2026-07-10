import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmojiPicker from './EmojiPicker'

describe('EmojiPicker', () => {
  it('abre o grid ao clicar e emite o emoji escolhido', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EmojiPicker onSelect={onSelect} />)

    // O grid começa fechado.
    expect(screen.queryByRole('button', { name: '😀' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /emojis/i }))
    const emojiBtn = await screen.findByRole('button', { name: '😀' })
    await user.click(emojiBtn)

    expect(onSelect).toHaveBeenCalledWith('😀')
    // Fecha após escolher.
    expect(screen.queryByRole('button', { name: '😀' })).not.toBeInTheDocument()
  })
})
