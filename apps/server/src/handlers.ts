import Anthropic from '@anthropic-ai/sdk'
import { DETECT_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from './prompts.js'

// Lazy singleton — created on first request
let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic() // reads ANTHROPIC_API_KEY from process.env
  }
  return client
}

const VALID_FIELD_TYPES = new Set(['text', 'signature', 'initials', 'date', 'checkbox', 'dropdown'])

// ── Detection ──────────────────────────────────────────────

export interface DetectRequest {
  imageBase64: string
  pageIndex: number
}

export interface DetectedField {
  type: string
  label: string
  x: number
  y: number
  w: number
  h: number
  required: boolean
}

export interface DetectResponse {
  fields: DetectedField[]
}

export async function handleDetect(body: DetectRequest): Promise<DetectResponse> {
  const { imageBase64, pageIndex } = body

  if (!imageBase64) {
    throw new Error('imageBase64 is required')
  }

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: DETECT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this PDF page (page ${pageIndex + 1}) and detect all blank form fields. Return JSON only.`,
          },
        ],
      },
    ],
  })

  // Extract text from response
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { fields: [] }
  }

  // Parse JSON — strip markdown fences if model includes them despite instructions
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: { fields?: unknown[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[handleDetect] Failed to parse AI response as JSON:', jsonStr.slice(0, 200))
    return { fields: [] }
  }

  if (!Array.isArray(parsed.fields)) {
    return { fields: [] }
  }

  // Validate and sanitize each field
  const fields: DetectedField[] = parsed.fields
    .filter((f: any) => {
      return (
        typeof f.x === 'number' && typeof f.y === 'number' &&
        typeof f.w === 'number' && typeof f.h === 'number' &&
        f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1 &&
        f.w > 0 && f.w <= 1 && f.h > 0 && f.h <= 1
      )
    })
    .map((f: any) => ({
      type: VALID_FIELD_TYPES.has(f.type) ? f.type : 'text',
      label: typeof f.label === 'string' ? f.label : 'field',
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      required: typeof f.required === 'boolean' ? f.required : false,
    }))

  console.log(`[handleDetect] Page ${pageIndex}: detected ${fields.length} fields`)
  return { fields }
}

// ── Chat ───────────────────────────────────────────────────

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  reply: string
}

export async function handleChat(body: ChatRequest): Promise<ChatResponse> {
  const { message } = body

  if (!message?.trim()) {
    throw new Error('message is required')
  }

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: message },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const reply = textBlock?.type === 'text' ? textBlock.text : 'No response generated.'

  return { reply }
}
