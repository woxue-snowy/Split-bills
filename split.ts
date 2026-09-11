import type { Receipt } from './receipt';

export type Member = {
  id: string;
  name: string;
};

export type FeeAllocationMode = 'proportional' | 'even';
export type SplitMode = 'equal' | 'percentage' | 'exact' | 'shares';

export type ItemSplitRule = {
  mode: SplitMode;
  values?: Record<string, number>;
};

export type ItemSplitRules = Record<string, ItemSplitRule>;

export type MemberBreakdown = {
  memberId: string;
  name: string;
  itemSubtotal: number;
  tax: number;
  serviceFee: number;
  tip: number;
  adjustment: number;
  total: number;
  details: Array<{
    label: string;
    amount: number;
  }>;
};

export type SplitSummary = {
  subtotal: number;
  tax: number;
  serviceFee: number;
  tip: number;
  adjustment: number;
  grandTotal: number;
  people: MemberBreakdown[];
};

export type DebtBalance = {
  memberId: string;
  name: string;
  balance: number;
};

export type DebtTransfer = {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
};

export function computeSplit(
  receipt: Receipt,
  members: Member[],
  feeMode: FeeAllocationMode,
  splitRules: ItemSplitRules = {},
): SplitSummary {
  const activeMembers = members.length > 0 ? members : [{ id: 'guest-1', name: 'Guest 1' }];
  const orderedMemberIds = activeMembers.map((member) => member.id);
  const subtotalByMember = new Map(orderedMemberIds.map((id) => [id, 0]));
  const detailsByMember = new Map(
    orderedMemberIds.map((id) => [id, [] as MemberBreakdown['details']]),
  );

  for (const item of receipt.items) {
    const participants = item.assignedTo.filter((id) => subtotalByMember.has(id));
    const safeParticipants = participants.length > 0 ? participants : orderedMemberIds;
    const rule = splitRules[item.id] ?? { mode: 'equal' as const };
    const shares = allocateItem(toCents(item.total), safeParticipants, rule);

    for (const [memberId, cents] of shares) {
      subtotalByMember.set(memberId, (subtotalByMember.get(memberId) ?? 0) + cents);
      detailsByMember.get(memberId)?.push({
        label: item.name,
        amount: fromCents(cents),
      });
    }
  }

  const subtotalCents = sumMap(subtotalByMember);
  const taxShares = allocateCharge(receipt.tax, orderedMemberIds, subtotalByMember, subtotalCents, feeMode);
  const serviceShares = allocateCharge(
    receipt.serviceFee,
    orderedMemberIds,
    subtotalByMember,
    subtotalCents,
    feeMode,
  );
  const tipShares = allocateCharge(receipt.tip, orderedMemberIds, subtotalByMember, subtotalCents, feeMode);
  const listedTotalCents =
    toCents(receipt.tax) +
    toCents(receipt.serviceFee) +
    toCents(receipt.tip) +
    receipt.items.reduce((sum, item) => sum + toCents(item.total), 0);
  const adjustmentCents = toCents(receipt.total) - listedTotalCents;
  const adjustmentShares = allocateCharge(
    fromCents(adjustmentCents),
    orderedMemberIds,
    subtotalByMember,
    subtotalCents,
    feeMode,
  );

  return {
    subtotal: fromCents(subtotalCents),
    tax: roundMoney(receipt.tax),
    serviceFee: roundMoney(receipt.serviceFee),
    tip: roundMoney(receipt.tip),
    adjustment: fromCents(adjustmentCents),
    grandTotal: fromCents(toCents(receipt.total)),
    people: activeMembers.map((member) => {
      const itemSubtotal = subtotalByMember.get(member.id) ?? 0;
      const tax = taxShares.get(member.id) ?? 0;
      const serviceFee = serviceShares.get(member.id) ?? 0;
      const tip = tipShares.get(member.id) ?? 0;
      const adjustment = adjustmentShares.get(member.id) ?? 0;
      const total = itemSubtotal + tax + serviceFee + tip + adjustment;

      return {
        memberId: member.id,
        name: member.name,
        itemSubtotal: fromCents(itemSubtotal),
        tax: fromCents(tax),
        serviceFee: fromCents(serviceFee),
        tip: fromCents(tip),
        adjustment: fromCents(adjustment),
        total: fromCents(total),
        details: detailsByMember.get(member.id) ?? [],
      };
    }),
  };
}

export function createSinglePayerBalances(
  summary: SplitSummary,
  paidByMemberId: string,
): DebtBalance[] {
  return summary.people.map((person) => {
    const paid = person.memberId === paidByMemberId ? summary.grandTotal : 0;
    return {
      memberId: person.memberId,
      name: person.name,
      balance: roundMoney(paid - person.total),
    };
  });
}

export function simplifyDebts(balances: DebtBalance[]): DebtTransfer[] {
  const normalized = balances
    .map((balance) => ({ ...balance, cents: toCents(balance.balance) }))
    .filter((balance) => balance.cents !== 0);

  const total = normalized.reduce((sum, balance) => sum + balance.cents, 0);
  if (Math.abs(total) > 1) {
    throw new Error('Debt balances must net to zero before simplification.');
  }

  const creditors = normalized
    .filter((balance) => balance.cents > 0)
    .map((balance) => ({ ...balance }))
    .sort((a, b) => b.cents - a.cents);
  const debtors = normalized
    .filter((balance) => balance.cents < 0)
    .map((balance) => ({ ...balance, cents: Math.abs(balance.cents) }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: DebtTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const cents = Math.min(creditor.cents, debtor.cents);

    if (cents > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        fromName: debtor.name,
        toMemberId: creditor.memberId,
        toName: creditor.name,
        amount: fromCents(cents),
      });
    }

    creditor.cents -= cents;
    debtor.cents -= cents;
    if (creditor.cents === 0) creditorIndex += 1;
    if (debtor.cents === 0) debtorIndex += 1;
  }

  return transfers;
}

export function validateItemSplit(
  itemTotal: number,
  participantIds: string[],
  rule: ItemSplitRule,
): string | null {
  if (participantIds.length === 0) return '至少选择一位参与者';
  if (rule.mode === 'equal') return null;

  const values = participantIds.map((id) => safeWeight(rule.values?.[id]));
  const sum = values.reduce((total, value) => total + value, 0);

  if (rule.mode === 'percentage' && Math.abs(sum - 100) > 0.01) {
    return `百分比合计需为 100%，当前为 ${roundMoney(sum)}%`;
  }
  if (rule.mode === 'exact' && Math.abs(sum - itemTotal) > 0.009) {
    return `固定金额合计需为 ${itemTotal.toFixed(2)}`;
  }
  if (rule.mode === 'shares' && sum <= 0) {
    return '份额合计必须大于 0';
  }
  return null;
}

export function formatSettlement(summary: SplitSummary, currency: string): string {
  const lines = [
    `结算总额 ${money(summary.grandTotal, currency)}`,
    `行项目 ${money(summary.subtotal, currency)} / 税费 ${money(summary.tax, currency)} / 服务费 ${money(summary.serviceFee, currency)} / 小费 ${money(summary.tip, currency)}`,
  ];

  if (summary.adjustment !== 0) {
    lines.push(`总额差异 ${money(summary.adjustment, currency)}`);
  }

  for (const person of summary.people) {
    lines.push(
      `${person.name}: ${money(person.total, currency)} (项目 ${money(person.itemSubtotal, currency)}, 税 ${money(person.tax, currency)}, 服务费 ${money(person.serviceFee, currency)}, 小费 ${money(person.tip, currency)}${person.adjustment ? `, 差异 ${money(person.adjustment, currency)}` : ''})`,
    );
  }

  return lines.join('\n');
}

export function money(value: number, currency = '$'): string {
  return `${currency}${roundMoney(value).toFixed(2)}`;
}

function allocateItem(
  cents: number,
  participantIds: string[],
  rule: ItemSplitRule,
): Map<string, number> {
  if (rule.mode === 'equal') return allocateCents(cents, participantIds);

  const validationError = validateItemSplit(fromCents(cents), participantIds, rule);
  if (validationError) return allocateCents(cents, participantIds);

  if (rule.mode === 'exact') {
    return new Map(
      participantIds.map((id) => [id, toCents(safeWeight(rule.values?.[id]))]),
    );
  }

  const weights = participantIds.map((id) => ({ id, weight: safeWeight(rule.values?.[id]) }));
  return allocateWeightedCents(cents, weights);
}

function allocateWeightedCents(
  cents: number,
  weights: Array<{ id: string; weight: number }>,
): Map<string, number> {
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return allocateCents(cents, weights.map((entry) => entry.id));

  const rawShares = weights.map(({ id, weight }) => {
    const exact = (cents * weight) / totalWeight;
    const floor = Math.floor(exact);
    return { id, floor, remainder: exact - floor };
  });

  let assigned = rawShares.reduce((sum, share) => sum + share.floor, 0);
  const result = new Map(rawShares.map((share) => [share.id, share.floor]));
  const remainderOrder = [...rawShares].sort((a, b) => b.remainder - a.remainder);

  for (const share of remainderOrder) {
    if (assigned >= cents) break;
    result.set(share.id, (result.get(share.id) ?? 0) + 1);
    assigned += 1;
  }

  return result;
}

function allocateCharge(
  amount: number,
  memberIds: string[],
  subtotalByMember: Map<string, number>,
  subtotalCents: number,
  mode: FeeAllocationMode,
): Map<string, number> {
  const cents = toCents(amount);
  if (cents === 0) return new Map(memberIds.map((id) => [id, 0]));
  if (cents < 0) {
    const positiveShares = allocateCharge(
      fromCents(Math.abs(cents)),
      memberIds,
      subtotalByMember,
      subtotalCents,
      mode,
    );
    return new Map([...positiveShares].map(([id, value]) => [id, -value]));
  }

  if (mode === 'even' || subtotalCents === 0) {
    return allocateCents(cents, memberIds);
  }

  const rawShares = memberIds.map((id) => {
    const weight = subtotalByMember.get(id) ?? 0;
    const exact = (cents * weight) / subtotalCents;
    return {
      id,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = rawShares.reduce((sum, share) => sum + share.floor, 0);
  const result = new Map(rawShares.map((share) => [share.id, share.floor]));
  const remainderOrder = [...rawShares].sort((a, b) => b.remainder - a.remainder);

  while (assigned !== cents) {
    for (const share of remainderOrder) {
      if (assigned === cents) break;
      result.set(share.id, (result.get(share.id) ?? 0) + 1);
      assigned += 1;
    }
  }

  return result;
}

function allocateCents(cents: number, memberIds: string[]) {
  const safeMemberIds = memberIds.length > 0 ? memberIds : ['guest-1'];
  const base = Math.trunc(cents / safeMemberIds.length);
  let remainder = cents - base * safeMemberIds.length;
  const result = new Map(safeMemberIds.map((id) => [id, base]));
  const direction = cents >= 0 ? 1 : -1;

  for (const id of safeMemberIds) {
    if (remainder === 0) break;
    result.set(id, (result.get(id) ?? 0) + direction);
    remainder -= direction;
  }

  return result;
}

function safeWeight(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? Number(value) : 0;
}

function sumMap(map: Map<string, number>) {
  return [...map.values()].reduce((sum, value) => sum + value, 0);
}

function toCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function fromCents(value: number): number {
  return roundMoney(value / 100);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
