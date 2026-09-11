import assert from 'node:assert/strict';
import test from 'node:test';

import type { Receipt } from '../lib/receipt.ts';
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
