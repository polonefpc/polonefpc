import { describe, test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { rewardModes, reusableReply } from './account-visibility';

describe('admin section visibility', () => {
  test('tasks can be hidden without hiding the wheel', () => {
    deepStrictEqual(rewardModes({ tab_tasks_visible: 'false' }), { wheel: true, tasks: false });
  });
  test('the wheel can be hidden without hiding tasks', () => {
    deepStrictEqual(rewardModes({ tab_wheel_visible: 'false' }), { wheel: false, tasks: true });
  });
  test('hiding rewards hides both sections', () => {
    deepStrictEqual(rewardModes({ tab_rewards_visible: 'false' }), { wheel: false, tasks: false });
  });
});
describe('reusable support messages', () => {
  test('manually saved messages are available immediately', () => {
    strictEqual(reusableReply({ pinned: true, uses: 0 }), true);
  });
  test('frequently sent messages are available after two sends', () => {
    strictEqual(reusableReply({ pinned: false, uses: 1 }), false);
    strictEqual(reusableReply({ pinned: false, uses: 2 }), true);
  });
});