import type { Receipt } from './receipt';

export type Member = {
  id: string;
  name: string;
};

export type FeeAllocationMode = 'proportional' | 'even';

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

export function computeSplit(
  receipt: Receipt,
  members: Member[],
  feeMode: FeeAllocationMode,
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
    const shares = allocateCents(toCents(item.total), safeParticipants);

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
