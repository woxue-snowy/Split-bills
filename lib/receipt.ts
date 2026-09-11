export const categoryOptions = [
  { value: 'food', label: '餐饮' },
  { value: 'drink', label: '饮料' },
  { value: 'transport', label: '交通' },
  { value: 'lodging', label: '住宿' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'shopping', label: '购物' },
  { value: 'other', label: '其他' },
] as const;

export type Category = (typeof categoryOptions)[number]['value'];

export type ReceiptItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: Category;
  assignedTo: string[];
};

export type Receipt = {
  merchant: string;
  date: string;
  currency: string;
  items: ReceiptItem[];
  tax: number;
  serviceFee: number;
  tip: number;
  total: number;
};

export type ReceiptProvider = {
  name: string;
  parseImage(file: File, memberIds: string[]): Promise<Receipt>;
  parseText(text: string, memberIds: string[]): Promise<Receipt>;
};

const keywordCategories: Array<[Category, string[]]> = [
  ['drink', ['coffee', 'tea', 'beer', 'wine', 'juice', 'latte', 'mocha', '可乐', '咖啡', '茶', '酒', '饮料']],
  ['transport', ['taxi', 'uber', 'lyft', 'train', 'bus', 'metro', 'parking', '地铁', '公交', '打车', '停车']],
  ['lodging', ['hotel', 'inn', 'airbnb', 'room', '住宿', '酒店', '民宿', '房费']],
  ['entertainment', ['ticket', 'movie', 'cinema', 'karaoke', 'game', '门票', '电影', '娱乐', '游戏']],
  ['shopping', ['market', 'shop', 'store', 'gift', 'clothes', '超市', '商店', '购物', '衣服', '礼物']],
  ['food', ['burger', 'noodle', 'rice', 'salad', 'pizza', 'steak', 'taco', 'pasta', 'soup', 'meal', '餐', '饭', '面', '菜', '披萨', '汉堡']],
];

export function categorizeItem(name: string): Category {
  const normalized = name.trim().toLowerCase();
  const match = keywordCategories.find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.[0] ?? 'other';
}

export function createEmptyReceipt(memberIds: string[]): Receipt {
  const items = [
    createReceiptItem('主菜', 2, 16.5, memberIds),
    createReceiptItem('Latte', 2, 5.25, memberIds),
    createReceiptItem('甜品', 1, 8, memberIds),
  ];

  return finishReceipt({
    merchant: 'Sunday Table',
    date: new Date().toISOString().slice(0, 10),
    currency: '$',
    items,
    tax: 3.72,
    serviceFee: 5.15,
    tip: 0,
    total: 60.37,
  });
}

export function createReceiptItem(
  name: string,
  quantity: number,
  unitPrice: number,
  memberIds: string[],
): ReceiptItem {
  const cleanQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const cleanUnit = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;

  return {
    id: crypto.randomUUID(),
    name,
    quantity: cleanQuantity,
    unitPrice: cleanUnit,
    total: roundMoney(cleanQuantity * cleanUnit),
    category: categorizeItem(name),
    assignedTo: [...memberIds],
  };
}

export function finishReceipt(receipt: Receipt): Receipt {
  const itemsTotal = receipt.items.reduce((sum, item) => sum + item.total, 0);
  const charges = receipt.tax + receipt.serviceFee + receipt.tip;
  return {
    ...receipt,
    tax: roundMoney(receipt.tax),
    serviceFee: roundMoney(receipt.serviceFee),
    tip: roundMoney(receipt.tip),
    total: roundMoney(receipt.total || itemsTotal + charges),
  };
}

export function parseReceiptText(text: string, memberIds: string[]): Receipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const merchant = lines[0] && !looksLikeMoneyLine(lines[0]) ? lines[0] : 'Pasted Receipt';
  const dateMatch = text.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/);
  const items: ReceiptItem[] = [];
  let tax = 0;
  let serviceFee = 0;
  let tip = 0;
  let explicitTotal = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const amount = extractLastAmount(line);
    if (amount === null) continue;

    if (/(tax|vat|税)/i.test(line)) {
      tax = amount;
      continue;
    }
    if (/(service|服务费|service charge)/i.test(line)) {
      serviceFee = amount;
      continue;
    }
    if (/(tip|gratuity|小费)/i.test(line)) {
      tip = amount;
      continue;
    }
    if (/(total|amount due|grand total|总计|合计)/i.test(line)) {
      explicitTotal = amount;
      continue;
    }
    if (lower === merchant.toLowerCase()) continue;

    const item = parseItemLine(line, amount, memberIds);
    if (item) items.push(item);
  }

  const safeItems =
    items.length > 0
      ? items
      : [
          createReceiptItem('共享餐食', 1, 38, memberIds),
          createReceiptItem('饮料', 2, 6.5, memberIds),
        ];

  const subtotal = safeItems.reduce((sum, item) => sum + item.total, 0);

  return finishReceipt({
    merchant,
    date: dateMatch?.[0].replaceAll('/', '-') ?? new Date().toISOString().slice(0, 10),
    currency: text.includes('£') ? '£' : text.includes('¥') || text.includes('￥') ? '¥' : '$',
    items: safeItems,
    tax,
    serviceFee,
    tip,
    total: explicitTotal || subtotal + tax + serviceFee + tip,
  });
}

export const mockReceiptProvider: ReceiptProvider = {
  name: 'Mock/local parser',
  async parseImage(file, memberIds) {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? 'IMAGE';
    return finishReceipt({
      merchant: `Receipt ${ext}`,
      date: new Date().toISOString().slice(0, 10),
      currency: '$',
      items: [
        createReceiptItem('Rice bowl', 2, 14.5, memberIds),
        createReceiptItem('Iced tea', 3, 4.25, memberIds),
        createReceiptItem('Movie ticket', 1, 18, memberIds),
      ],
      tax: 4.45,
      serviceFee: 3,
      tip: 8,
      total: 75.2,
    });
  },
  async parseText(text, memberIds) {
    return parseReceiptText(text, memberIds);
  },
};

function parseItemLine(line: string, amount: number, memberIds: string[]): ReceiptItem | null {
  const withoutAmount = line.replace(/[$£¥￥]?\s*-?\d+(?:[.,]\d{2})\s*$/, '').trim();
  if (!withoutAmount) return null;

  const quantityMatch = withoutAmount.match(/\b(?:x\s*)?(\d+(?:\.\d+)?)\b/i);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  const name = withoutAmount
    .replace(/\b(?:x\s*)?\d+(?:\.\d+)?\b/i, '')
    .replace(/[-–—]/g, ' ')
    .trim();

  return {
    id: crypto.randomUUID(),
    name: name || withoutAmount,
    quantity,
    unitPrice: roundMoney(amount / Math.max(quantity, 1)),
    total: roundMoney(amount),
    category: categorizeItem(name || withoutAmount),
    assignedTo: [...memberIds],
  };
}

function extractLastAmount(line: string): number | null {
  const matches = line.match(/-?[$£¥￥]?\s*\d+(?:[.,]\d{2})/g);
  if (!matches?.length) return null;
  const value = matches[matches.length - 1].replace(/[$£¥￥\s,]/g, '');
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikeMoneyLine(line: string) {
  return extractLastAmount(line) !== null;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
