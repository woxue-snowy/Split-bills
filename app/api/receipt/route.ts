import { NextResponse } from 'next/server';

import { mockReceiptProvider } from '@/lib/receipt';

type ReceiptParseMode = 'image' | 'text';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const memberIds = parseMemberIds(formData.get('memberIds'));
    const text = readTextField(formData.get('text'));
    const file = formData.get('file');

    const mode: ReceiptParseMode = file instanceof File ? 'image' : 'text';

    if (mode === 'text' && !text) {
      return NextResponse.json(
        { error: 'Missing input: provide a file or receipt text.' },
        { status: 400 },
      );
    }

    const realOcrResult = await parseWithRealOcrPlaceholder({
      mode,
      text,
      file: file instanceof File ? file : null,
      memberIds,
    });

    if (realOcrResult) {
      return NextResponse.json({
        provider: 'real-ocr-placeholder',
        receipt: realOcrResult,
      });
    }

    const receipt =
      mode === 'image' && file instanceof File
        ? await mockReceiptProvider.parseImage(file, memberIds)
        : await mockReceiptProvider.parseText(text, memberIds);

    return NextResponse.json({
      provider: mockReceiptProvider.name,
      receipt,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to parse receipt.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    route: '/api/receipt',
    status: 'ready',
    message:
      'Server OCR placeholder route is live. Connect a real OCR provider in parseWithRealOcrPlaceholder().',
  });
}

async function parseWithRealOcrPlaceholder({
  mode,
  text,
  file,
}: {
  mode: ReceiptParseMode;
  text: string;
  file: File | null;
  memberIds: string[];
}) {
  const preferredProvider = process.env.RECEIPT_OCR_PROVIDER ?? 'mock';
  if (preferredProvider === 'mock') return null;

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const externalApiKey = process.env.RECEIPT_OCR_API_KEY;
  if (!openAiApiKey && !externalApiKey) return null;

  void mode;
  void text;
  void file;

  return null;
}

function parseMemberIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim());
  } catch {
    return [];
  }
}

function readTextField(raw: FormDataEntryValue | null): string {
  return typeof raw === 'string' ? raw : '';
}
