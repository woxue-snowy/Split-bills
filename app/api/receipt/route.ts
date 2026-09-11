import { normalizeReceiptCandidate } from '@/lib/receipt';

const receiptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['merchant', 'date', 'currency', 'items', 'tax', 'serviceFee', 'tip', 'total'],
  properties: {
    merchant: { type: 'string' },
    date: { type: 'string', description: 'ISO-like date if visible, otherwise empty string.' },
    currency: { type: 'string', description: 'Currency symbol such as £, $, €, ¥.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unitPrice', 'total', 'category'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          total: { type: 'number' },
          category: {
            type: 'string',
            enum: ['food', 'delivery', 'drink', 'transport', 'lodging', 'entertainment', 'shopping', 'other'],
          },
        },
      },
    },
    tax: { type: 'number' },
    serviceFee: { type: 'number' },
    tip: { type: 'number' },
    total: { type: 'number' },
  },
} as const;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError('OPENAI_API_KEY is not set. Add it to .env.local to enable real receipt OCR.', 503);
  }

  const form = await request.formData();
  const image = form.get('image');
  const memberIds = parseMemberIds(form.get('memberIds'));

  if (!(image instanceof File)) {
    return jsonError('Upload an image file in the "image" form field.', 400);
  }

  if (!image.type.startsWith('image/')) {
    return jsonError('The uploaded file must be an image.', 400);
  }

  const imageUrl = await fileToDataUrl(image);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Extract this receipt or payment screenshot into JSON for a bill splitting app. ' +
                'Return line items only once. Put VAT/tax, service charge, tip, and grand total in their own fields when visible. ' +
                'Use 0 for missing tax/serviceFee/tip. Choose the closest category. Do not invent charges.',
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'receipt_ocr',
          strict: true,
          schema: receiptSchema,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return jsonError(readOpenAiError(data), response.status);
  }

  const parsed = parseOpenAiJson(data);
  const receipt = normalizeReceiptCandidate(parsed, memberIds);
  return Response.json({ receipt, provider: 'OpenAI Vision' });
}

function parseMemberIds(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function fileToDataUrl(file: File) {
  const buffer = await file.arrayBuffer();
  const base64 = base64FromArrayBuffer(buffer);
  return `data:${file.type};base64,${base64}`;
}

function base64FromArrayBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function parseOpenAiJson(data: unknown): unknown {
  if (isRecord(data) && typeof data.output_text === 'string') {
    return JSON.parse(data.output_text);
  }

  if (isRecord(data) && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (isRecord(content) && typeof content.text === 'string') {
          return JSON.parse(content.text);
        }
      }
    }
  }

  throw new Error('OpenAI response did not include JSON receipt output.');
}

function readOpenAiError(data: unknown) {
  if (isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string') {
    return data.error.message;
  }
  return 'OpenAI receipt OCR request failed.';
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
