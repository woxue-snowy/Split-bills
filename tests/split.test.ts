import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReceiptCandidate, type Receipt } from '../lib/receipt.ts';
import {
  computeSplit,
  createSinglePayerBalances,
  simplifyDebts,
  type Member,
} from '../lib/split.ts';

const members: Member[] = [
  { id: 'a', name: 'Alex' },
  { id: 'b', name: 'Jamie' },
  { id: 'c', name: 'Sam' },
];

function oneItemReceipt(total = 100): Receipt {
  return {
    merchant: 'Test Cafe',
    date: '2026-09-11',
    currency: '£',
    tax: 0,
    serviceFee: 0,
    tip: 0,
    total,
    items: [
      {
        id: 'i1',
        name: 'Shared dinner',
        quantity: 1,
        unitPrice: total,
        total,
        category: 'food',
        assignedTo: ['a', 'b', 'c'],
      },
    ],
  };
}

void test('splits item totals by selected participants', () => {
  const receipt: Receipt = {
    merchant: 'Test Cafe',
    date: '2026-09-11',
    currency: '$',
    tax: 0,
    serviceFee: 0,
    tip: 0,
    total: 45,
    items: [
      {
        id: 'i1',
        name: 'Shared dinner',
        quantity: 1,
        unitPrice: 30,
        total: 30,
        category: 'food',
        assignedTo: ['a', 'b'],
      },
      {
        id: 'i2',
        name: 'Solo drink',
        quantity: 1,
        unitPrice: 15,
        total: 15,
        category: 'drink',
        assignedTo: ['c'],
      },
    ],
  };

  const summary = computeSplit(receipt, members, 'even');

  assert.equal(summary.people.find((person) => person.memberId === 'a')?.total, 15);
  assert.equal(summary.people.find((person) => person.memberId === 'b')?.total, 15);
  assert.equal(summary.people.find((person) => person.memberId === 'c')?.total, 15);
});

void test('allocates tax and service charges by consumption ratio', () => {
  const receipt: Receipt = {
    merchant: 'Test Cafe',
    date: '2026-09-11',
    currency: '$',
    tax: 10,
    serviceFee: 5,
    tip: 0,
    total: 115,
    items: [
      {
        id: 'i1',
        name: 'Large plate',
        quantity: 1,
        unitPrice: 80,
        total: 80,
        category: 'food',
        assignedTo: ['a'],
      },
      {
        id: 'i2',
        name: 'Small plate',
        quantity: 1,
        unitPrice: 20,
        total: 20,
        category: 'food',
        assignedTo: ['b'],
      },
    ],
  };

  const summary = computeSplit(receipt, members.slice(0, 2), 'proportional');

  assert.equal(summary.people.find((person) => person.memberId === 'a')?.tax, 8);
  assert.equal(summary.people.find((person) => person.memberId === 'a')?.serviceFee, 4);
  assert.equal(summary.people.find((person) => person.memberId === 'b')?.tax, 2);
  assert.equal(summary.people.find((person) => person.memberId === 'b')?.serviceFee, 1);
  assert.equal(summary.people.reduce((sum, person) => sum + person.total, 0), 115);
});

void test('supports percentage splits and preserves pennies', () => {
  const receipt = oneItemReceipt(10);
  const summary = computeSplit(receipt, members, 'even', {
    i1: { mode: 'percentage', values: { a: 33.33, b: 33.33, c: 33.34 } },
  });

  assert.deepEqual(summary.people.map((person) => person.total), [3.33, 3.33, 3.34]);
  assert.equal(summary.people.reduce((sum, person) => sum + person.total, 0), 10);
});

void test('supports exact amount splits', () => {
  const receipt = oneItemReceipt(100);
  const summary = computeSplit(receipt, members, 'even', {
    i1: { mode: 'exact', values: { a: 60, b: 25, c: 15 } },
  });

  assert.deepEqual(summary.people.map((person) => person.total), [60, 25, 15]);
});

void test('supports custom share weights', () => {
  const receipt = oneItemReceipt(100);
  const summary = computeSplit(receipt, members, 'even', {
    i1: { mode: 'shares', values: { a: 2, b: 1, c: 1 } },
  });

  assert.deepEqual(summary.people.map((person) => person.total), [50, 25, 25]);
});

void test('invalid custom split falls back safely without losing money', () => {
  const receipt = oneItemReceipt(30);
  const summary = computeSplit(receipt, members, 'even', {
    i1: { mode: 'percentage', values: { a: 10, b: 10, c: 10 } },
  });

  assert.deepEqual(summary.people.map((person) => person.total), [10, 10, 10]);
});

void test('simplifies balances into direct transfers', () => {
  const transfers = simplifyDebts([
    { memberId: 'a', name: 'Alex', balance: 25 },
    { memberId: 'b', name: 'Jamie', balance: -10 },
    { memberId: 'c', name: 'Sam', balance: 5 },
    { memberId: 'd', name: 'Taylor', balance: -20 },
  ]);

  assert.equal(transfers.reduce((sum, transfer) => sum + transfer.amount, 0), 30);
  assert.equal(transfers.length, 3);
  assert.deepEqual(
    transfers.map((transfer) => [transfer.fromName, transfer.toName, transfer.amount]),
    [
      ['Taylor', 'Alex', 20],
      ['Jamie', 'Alex', 5],
      ['Jamie', 'Sam', 5],
    ],
  );
});

void test('builds settlement transfers for a single payer bill', () => {
  const summary = computeSplit(oneItemReceipt(90), members, 'even');
  const balances = createSinglePayerBalances(summary, 'a');
  const transfers = simplifyDebts(balances);

  assert.deepEqual(
    transfers.map((transfer) => [transfer.fromMemberId, transfer.toMemberId, transfer.amount]),
    [
      ['b', 'a', 30],
      ['c', 'a', 30],
    ],
  );
});

void test('normalizes AI receipt output into app receipt shape', () => {
  const receipt = normalizeReceiptCandidate(
    {
      merchant: 'The Carbon',
      date: '2026/09/11',
      currency: 'GBP',
      items: [
        { name: 'Cake', quantity: 1, unitPrice: 25.9, total: 25.9, category: 'food' },
        { name: 'Delivery fee', quantity: 1, unitPrice: 2.3, total: 2.3, category: 'delivery' },
        { name: 'Magic show', quantity: 1, unitPrice: 47, total: 47, category: 'entertainment' },
      ],
      tax: 0,
      serviceFee: 0,
      tip: 0,
      total: 75.2,
    },
    ['a', 'b'],
  );

  assert.equal(receipt.merchant, 'The Carbon');
  assert.equal(receipt.date, '2026-09-11');
  assert.equal(receipt.currency, '£');
  assert.equal(receipt.items[1]?.category, 'delivery');
  assert.deepEqual(receipt.items[0]?.assignedTo, ['a', 'b']);
});
