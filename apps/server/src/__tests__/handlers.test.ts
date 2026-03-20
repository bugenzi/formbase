import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Anthropic SDK before importing handlers
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: class Anthropic {
      messages = { create: mockCreate }
    },
    __mockCreate: mockCreate,
  }
})

import { handleDetect, handleChat } from '../handlers.js'

// Get access to the mock
async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk') as any
  return mod.__mockCreate as ReturnType<typeof vi.fn>
}

describe('handleDetect', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('returns detected fields from valid AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          fields: [
            { type: 'text', label: 'Full Name', x: 0.1, y: 0.2, w: 0.3, h: 0.03, required: true },
            { type: 'signature', label: 'Sign Here', x: 0.1, y: 0.8, w: 0.4, h: 0.06, required: true },
          ],
        }),
      }],
    })

    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields).toHaveLength(2)
    expect(result.fields[0].type).toBe('text')
    expect(result.fields[0].label).toBe('Full Name')
    expect(result.fields[1].type).toBe('signature')
  })

  it('strips markdown fences from response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n{"fields": [{"type": "checkbox", "label": "Agree", "x": 0.05, "y": 0.5, "w": 0.02, "h": 0.02, "required": false}]}\n```',
      }],
    })

    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields).toHaveLength(1)
    expect(result.fields[0].type).toBe('checkbox')
  })

  it('sanitizes invalid field types to "text"', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          fields: [{ type: 'radio', label: 'Option', x: 0.1, y: 0.1, w: 0.1, h: 0.02, required: false }],
        }),
      }],
    })

    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields[0].type).toBe('text') // sanitized from 'radio'
  })

  it('filters out fields with out-of-range coordinates', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          fields: [
            { type: 'text', label: 'Valid', x: 0.1, y: 0.2, w: 0.3, h: 0.03, required: false },
            { type: 'text', label: 'Bad X', x: 1.5, y: 0.2, w: 0.3, h: 0.03, required: false },
            { type: 'text', label: 'Negative', x: -0.1, y: 0.2, w: 0.3, h: 0.03, required: false },
            { type: 'text', label: 'Zero size', x: 0.1, y: 0.2, w: 0, h: 0.03, required: false },
          ],
        }),
      }],
    })

    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields).toHaveLength(1)
    expect(result.fields[0].label).toBe('Valid')
  })

  it('returns empty fields for malformed JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields).toEqual([])
  })

  it('returns empty fields when no text block in response', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const result = await handleDetect({ imageBase64: 'abc123', pageIndex: 0 })
    expect(result.fields).toEqual([])
  })

  it('throws on missing imageBase64', async () => {
    await expect(handleDetect({ imageBase64: '', pageIndex: 0 })).rejects.toThrow('imageBase64 is required')
  })
})

describe('handleChat', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('returns reply from AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I can help with that!' }],
    })

    const result = await handleChat({ message: 'How do I add a signature?' })
    expect(result.reply).toBe('I can help with that!')
  })

  it('throws on empty message', async () => {
    await expect(handleChat({ message: '' })).rejects.toThrow('message is required')
    await expect(handleChat({ message: '   ' })).rejects.toThrow('message is required')
  })

  it('returns fallback for empty AI response', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const result = await handleChat({ message: 'Hello' })
    expect(result.reply).toBe('No response generated.')
  })
})
