'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CircleDollarSign,
  Copy,
  Download,
  Minus,
  PencilLine,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  categoryOptions,
  createEmptyReceipt,
  createReceiptItem,
  mockReceiptProvider,
  type Category,
  type Receipt,
  type ReceiptItem,
  roundMoney,
} from '@/lib/receipt';
import {
  computeSplit,
  formatSettlement,
  money,
  type FeeAllocationMode,
  type Member,
} from '@/lib/split';

const initialMembers: Member[] = [
  { id: 'member-1', name: 'Alex' },
  { id: 'member-2', name: 'Jamie' },
  { id: 'member-3', name: 'Sam' },
];

const sampleText = `Sunday Table
2026-09-11
Rice bowl x2 29.00
Iced tea x3 12.75
Movie ticket x1 18.00
Tax 4.45
Service fee 3.00
Tip 8.00
Total 75.20`;

export default function Home() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [receipt, setReceipt] = useState<Receipt>(() =>
    createEmptyReceipt(initialMembers.map((member) => member.id)),
  );
  const [feeMode, setFeeMode] = useState<FeeAllocationMode>('proportional');
  const [rawText, setRawText] = useState(sampleText);
  const [uploadedName, setUploadedName] = useState('mock receipt ready');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const memberIds = members.map((member) => member.id);
  const summary = useMemo(
    () => computeSplit(receipt, members, feeMode),
    [feeMode, members, receipt],
  );
  const settlement = useMemo(
    () => formatSettlement(summary, receipt.currency),
    [receipt.currency, summary],
  );

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'export_settlement_result',
            title: 'Export settlement result',
            description:
              'Return the current split-the-bill settlement text and optionally copy it to the clipboard.',
            inputSchema: {
              type: 'object',
              properties: {
                copyToClipboard: {
                  type: 'boolean',
                  description: 'Whether to copy the settlement text to the clipboard.',
                },
              },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              const copyToClipboard =
                typeof input === 'object' &&
                input !== null &&
                'copyToClipboard' in input &&
                Boolean((input as { copyToClipboard?: unknown }).copyToClipboard);

              if (copyToClipboard) {
                await navigator.clipboard.writeText(settlement);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }

              return {
                merchant: receipt.merchant,
                total: summary.grandTotal,
                currency: receipt.currency,
                settlement,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }

    return () => lifecycle.abort();
  }, [receipt.currency, receipt.merchant, settlement, summary.grandTotal]);

  async function handleFile(file?: File) {
    if (!file) return;
    setIsParsing(true);
    setUploadedName(file.name);
    setPreviewUrl(URL.createObjectURL(file));

    const parsed = await mockReceiptProvider.parseImage(file, memberIds);
    setReceipt(syncAssignments(parsed, memberIds));
    setIsParsing(false);
  }

  async function handleTextParse() {
    setIsParsing(true);
    const parsed = await mockReceiptProvider.parseText(rawText, memberIds);
    setReceipt(syncAssignments(parsed, memberIds));
    setUploadedName('pasted text');
    setIsParsing(false);
  }

  function updateReceiptField<K extends keyof Receipt>(key: K, value: Receipt[K]) {
    setReceipt((current) => ({ ...current, [key]: value }));
  }

  function updateCharge(key: 'tax' | 'serviceFee' | 'tip' | 'total', value: string) {
    updateReceiptField(key, parseMoney(value));
  }

  function updateItem(itemId: string, patch: Partial<ReceiptItem>) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, ...patch };
        if ('quantity' in patch || 'unitPrice' in patch) {
          next.total = roundMoney(next.quantity * next.unitPrice);
        }
        return next;
      }),
    }));
  }

  function addItem() {
    setReceipt((current) => ({
      ...current,
      items: [...current.items, createReceiptItem('新项目', 1, 0, memberIds)],
    }));
  }

  function removeItem(itemId: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  }

  function addMember() {
    const nextId = crypto.randomUUID();
    const nextMember = { id: nextId, name: `成员 ${members.length + 1}` };
    setMembers((current) => [...current, nextMember]);
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => ({
        ...item,
        assignedTo: [...item.assignedTo, nextId],
      })),
    }));
  }

  function removeMember(memberId: string) {
    if (members.length <= 1) return;
    const remaining = members.filter((member) => member.id !== memberId);
    const remainingIds = remaining.map((member) => member.id);
    setMembers(remaining);
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        const assignedTo = item.assignedTo.filter((id) => id !== memberId);
        return {
          ...item,
          assignedTo: assignedTo.length > 0 ? assignedTo : remainingIds,
        };
      }),
    }));
  }

  function renameMember(memberId: string, name: string) {
    setMembers((current) =>
      current.map((member) => (member.id === memberId ? { ...member, name } : member)),
    );
  }

  function toggleAssignee(itemId: string, memberId: string, checked: boolean) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = checked
          ? [...new Set([...item.assignedTo, memberId])]
          : item.assignedTo.filter((id) => id !== memberId);
        return { ...item, assignedTo: next };
      }),
    }));
  }

  async function copySettlement() {
    await navigator.clipboard.writeText(settlement);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadSettlement() {
    const blob = new Blob([settlement], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.merchant || 'bill'}-split.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#202124]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-lg border border-[#ded2c3] bg-[#fffdf9]/90 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#253026] text-white">
              <ReceiptText className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#5f674f]">SplitSnap MVP</p>
              <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">
                拍账单，少点几下分完
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#697064] sm:flex">
            <Sparkles className="size-4 text-[#c26d3d]" />
            {mockReceiptProvider.name}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
          <div className="space-y-4">
            <section className="rounded-lg border border-[#ded2c3] bg-[#fffdf9] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">账单来源</h2>
                  <p className="text-sm text-[#697064]">
                    上传或拍摄后先用 mock OCR 填充，可随时手动修正。
                  </p>
                </div>
                {isParsing ? (
                  <span className="inline-flex items-center gap-2 rounded-md bg-[#f0e5d4] px-2.5 py-1 text-sm text-[#6d563a]">
                    <RefreshCw className="size-4 animate-spin" />
                    识别中
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  className="min-h-36 rounded-lg border border-dashed border-[#b7aa98] bg-[#faf4e9] px-4 py-5 text-left transition hover:border-[#7d6f5c] hover:bg-[#f6ead8]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-white text-[#3f4938] shadow-sm">
                      <Upload className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">选择图片或打开相机</p>
                      <p className="mt-1 text-sm text-[#697064]">
                        支持小票、账单截图、菜单结账页。当前为 mock provider。
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 truncate text-sm text-[#7c5b34]">{uploadedName}</p>
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                </button>

                <div className="flex gap-2 sm:flex-col">
                  <Button
                    className="h-11 flex-1 bg-[#253026] px-4 text-white hover:bg-[#394535] sm:flex-none"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="size-4" />
                    拍摄
                  </Button>
                  <Button
                    className="h-11 flex-1 border-[#c9baa7] bg-white px-4 text-[#30352e] hover:bg-[#f8f0e5] sm:flex-none"
                    variant="outline"
                    onClick={handleTextParse}
                  >
                    <PencilLine className="size-4" />
                    解析文本
                  </Button>
                </div>
              </div>

              {previewUrl ? (
                <div
                  aria-hidden="true"
                  className="mt-3 h-48 w-full rounded-lg border border-[#e4d7c7] bg-cover bg-center"
                  style={{ backgroundImage: `url(${previewUrl})` }}
                />
              ) : null}

              <Textarea
                className="mt-3 min-h-28 border-[#d8c8b7] bg-white text-sm"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                aria-label="粘贴账单文本"
              />
            </section>

            <section className="rounded-lg border border-[#ded2c3] bg-[#fffdf9] p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-4">
                <LabeledInput
                  label="商家"
                  value={receipt.merchant}
                  onChange={(value) => updateReceiptField('merchant', value)}
                />
                <LabeledInput
                  label="日期"
                  type="date"
                  value={receipt.date}
                  onChange={(value) => updateReceiptField('date', value)}
                />
                <LabeledInput
                  label="币种"
                  value={receipt.currency}
                  onChange={(value) => updateReceiptField('currency', value || '$')}
                />
                <LabeledInput
                  label="总额"
                  type="number"
                  value={String(receipt.total)}
                  onChange={(value) => updateCharge('total', value)}
                />
              </div>
            </section>

            <section className="rounded-lg border border-[#ded2c3] bg-[#fffdf9] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">行项目</h2>
                  <p className="text-sm text-[#697064]">改名称会保留当前分类，可手动换类和选择承担人。</p>
                </div>
                <Button variant="outline" className="border-[#c9baa7] bg-white" onClick={addItem}>
                  <Plus className="size-4" />
                  添加
                </Button>
              </div>

              <div className="space-y-3">
                {receipt.items.map((item) => (
                  <article key={item.id} className="rounded-lg border border-[#e2d5c5] bg-white p-3">
                    <div className="grid gap-2 sm:grid-cols-[1.2fr_0.55fr_0.7fr_0.7fr_auto]">
                      <Input
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        aria-label="项目名称"
                        className="h-10 border-[#d8c8b7]"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, { quantity: parseMoney(event.target.value) })
                        }
                        aria-label="数量"
                        className="h-10 border-[#d8c8b7]"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(item.id, { unitPrice: parseMoney(event.target.value) })
                        }
                        aria-label="单价"
                        className="h-10 border-[#d8c8b7]"
                      />
                      <NativeSelect
                        value={item.category}
                        onChange={(event) =>
                          updateItem(item.id, { category: event.target.value as Category })
                        }
                        aria-label="分类"
                        className="w-full"
                      >
                        {categoryOptions.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button
                        size="icon-lg"
                        variant="ghost"
                        className="text-[#8c3f2d] hover:bg-[#f7e5dd]"
                        onClick={() => removeItem(item.id)}
                        aria-label="删除项目"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {members.map((member) => {
                        const checked = item.assignedTo.includes(member.id);
                        return (
                          <label
                            key={member.id}
                            className="flex h-9 items-center gap-2 rounded-lg border border-[#dfd2c2] bg-[#fffaf3] px-2.5 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleAssignee(item.id, member.id, Boolean(value))
                              }
                            />
                            {member.name || '未命名'}
                          </label>
                        );
                      })}
                      <span className="ml-auto self-center text-sm font-medium text-[#5d654f]">
                        {money(item.total, receipt.currency)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-lg border border-[#ded2c3] bg-[#fffdf9] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-[#5d654f]" />
                  <h2 className="text-lg font-semibold">成员</h2>
                </div>
                <Button variant="outline" className="border-[#c9baa7] bg-white" onClick={addMember}>
                  <UserPlus className="size-4" />
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#edf0df] text-sm font-semibold text-[#45503c]">
                      {index + 1}
                    </span>
                    <Input
                      value={member.name}
                      onChange={(event) => renameMember(member.id, event.target.value)}
                      aria-label={`成员 ${index + 1} 名称`}
                      className="h-10 border-[#d8c8b7] bg-white"
                    />
                    <Button
                      size="icon-lg"
                      variant="ghost"
                      className="text-[#8c3f2d] hover:bg-[#f7e5dd]"
                      onClick={() => removeMember(member.id)}
                      disabled={members.length <= 1}
                      aria-label="删除成员"
                    >
                      <Minus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#ded2c3] bg-[#fffdf9] p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="size-5 text-[#c26d3d]" />
                <h2 className="text-lg font-semibold">费用分摊</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <LabeledInput
                  label="税费"
                  type="number"
                  value={String(receipt.tax)}
                  onChange={(value) => updateCharge('tax', value)}
                />
                <LabeledInput
                  label="服务费"
                  type="number"
                  value={String(receipt.serviceFee)}
                  onChange={(value) => updateCharge('serviceFee', value)}
                />
                <LabeledInput
                  label="小费"
                  type="number"
                  value={String(receipt.tip)}
                  onChange={(value) => updateCharge('tip', value)}
                />
              </div>
              <label
                className="mt-3 block text-sm font-medium text-[#4d5546]"
                htmlFor="fee-mode"
              >
                税费/服务费/小费算法
                <NativeSelect
                  id="fee-mode"
                  value={feeMode}
                  onChange={(event) => setFeeMode(event.target.value as FeeAllocationMode)}
                  className="mt-1 w-full"
                >
                  <option value="proportional">按消费比例</option>
                  <option value="even">均分</option>
                </NativeSelect>
              </label>
            </section>

            <section className="rounded-lg border border-[#253026] bg-[#253026] p-4 text-white shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">结算结果</h2>
                  <p className="text-sm text-[#d7dec8]">{receipt.merchant}</p>
                </div>
                <span className="rounded-md bg-white/12 px-2 py-1 text-sm">
                  {money(summary.grandTotal, receipt.currency)}
                </span>
              </div>

              <div className="space-y-2">
                {summary.people.map((person) => (
                  <details
                    key={person.memberId}
                    className="rounded-lg border border-white/12 bg-white/[0.06] p-3"
                    open
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="font-medium">{person.name || '未命名'}</span>
                      <span className="text-lg font-semibold">
                        {money(person.total, receipt.currency)}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-1 text-sm text-[#d7dec8]">
                      <Line label="项目" value={money(person.itemSubtotal, receipt.currency)} />
                      <Line label="税费" value={money(person.tax, receipt.currency)} />
                      <Line label="服务费" value={money(person.serviceFee, receipt.currency)} />
                      <Line label="小费" value={money(person.tip, receipt.currency)} />
                      {person.adjustment !== 0 ? (
                        <Line label="总额差异" value={money(person.adjustment, receipt.currency)} />
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button className="h-10 bg-white text-[#253026] hover:bg-[#edf0df]" onClick={copySettlement}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? '已复制' : '复制'}
                </Button>
                <Button
                  className="h-10 border-white/25 bg-transparent text-white hover:bg-white/10"
                  variant="outline"
                  onClick={downloadSettlement}
                >
                  <Download className="size-4" />
                  导出
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-[#4d5546]">
      {label}
      <Input
        type={type}
        value={value}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 border-[#d8c8b7] bg-white"
      />
    </label>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function syncAssignments(receipt: Receipt, memberIds: string[]) {
  return {
    ...receipt,
    items: receipt.items.map((item) => ({
      ...item,
      assignedTo: item.assignedTo.filter((id) => memberIds.includes(id)).length
        ? item.assignedTo.filter((id) => memberIds.includes(id))
        : memberIds,
    })),
  };
}

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: object;
          annotations?: {
            readOnlyHint?: boolean;
            untrustedContentHint?: boolean;
          };
          execute(input: unknown): Promise<unknown>;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}
