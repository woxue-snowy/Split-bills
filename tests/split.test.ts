import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReceiptCandidate, type Receipt } from '../lib/receipt.ts';
import { computeSplit, type Member } from '../lib/split.ts';

const members: Member[] = [
  { id: 'a', name: 'Alex' },
  { id: 'b', name: 'Jamie' },
  { id: 'c', name: 'Sam' },
];

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
