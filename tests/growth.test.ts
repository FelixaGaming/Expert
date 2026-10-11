import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthPlan, type PlanAnswers } from '../growth';

const answers: PlanAnswers = { goal: '', budgetCap: '1000', hoursPerWeek: '5', location: '', currency: 'CAD', focus: [] };

test('the server adds up the budget and judges the limit against the higher estimate', async () => {
  const raw = {
    field: 'x',
    opportunities: [
      { id: 'O1', type: 'award', name: 'Award One', organization: 'Org', url: '', cost: { low: 100, high: 200 }, effortHours: 5, impact: 4 },
      { id: 'O2', type: 'speaking', name: 'Talk Two', organization: 'Org', url: '', cost: { low: 300, high: 900 }, effortHours: 20, impact: 5 },
    ],
    pathway: [{ phase: 'Next 90 days', steps: [{ action: 'Apply to both', opportunityIds: ['O1', 'O2', 'O999'], effortHours: 10, cost: { low: 0, high: 0 } }] }],
    budget: { lineItems: [{ item: 'Fees', category: 'awards', low: 100, high: 200 }, { item: 'Travel', category: 'travel', low: 200, high: 300 }] },
  };
  const plan = await buildGrowthPlan(raw, 'Test Person', answers);
  assert.deepEqual(plan.budget.total, { low: 300, high: 500 });
  assert.deepEqual(plan.budget.byCategory.travel, { low: 200, high: 300 });
  // the step points at two real opportunities, so it costs at least what they cost; the unknown id is dropped
  assert.deepEqual(plan.pathway[0].steps[0].opportunityIds, ['O1', 'O2']);
  assert.deepEqual(plan.pathway[0].steps[0].cost, { low: 400, high: 1100 });
  // pathway is dearer than the table, so the cap (1000) is judged against the higher figure and a note is added
  assert.equal(plan.budget.withinCap, false);
  assert.ok(plan.budget.notes[0].includes('more than the budget table'));
});

test('opportunities without a link are kept but marked, and ranked by impact for effort', async () => {
  const raw = {
    opportunities: [
      { id: 'A', name: 'Hard and low impact', cost: { low: 0, high: 0 }, effortHours: 80, impact: 1 },
      { id: 'B', name: 'Easy and high impact', cost: { low: 0, high: 0 }, effortHours: 2, impact: 5 },
    ],
  };
  const plan = await buildGrowthPlan(raw, 'T', answers);
  assert.equal(plan.opportunities[0].id, 'B');
  assert.ok(plan.opportunities.every((o) => o.linkState === 'no-link'));
  assert.equal(plan.checks.opened, 0);
});

test('bad or missing numbers never break the plan', async () => {
  const plan = await buildGrowthPlan({ budget: { lineItems: [{ item: 'x', category: 'c', low: 'abc', high: -5 }] }, opportunities: [{ name: 'Y', cost: { low: '$1,200', high: '2k' } }] }, 'T', { ...answers, budgetCap: '' });
  assert.deepEqual(plan.budget.total, { low: 0, high: 0 });
  assert.equal(plan.budget.withinCap, null);
  assert.equal(plan.opportunities[0].cost.low, 1200);
});
