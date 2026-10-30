import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, OWNERSHIP, POLICY, ROLES } from '../src/domain/policy.js';

test('authorize: toàn bộ ma trận hành động × vai trò × sở hữu lấy từ POLICY', () => {
  for (const [action, byRole] of Object.entries(POLICY)) {
    for (const role of ROLES) {
      for (const ownership of OWNERSHIP) {
        const actor = { userId: 'U1', role, channel: 'web' };
        const resource =
          ownership === 'none'
            ? null
            : { ownerId: ownership === 'own' ? actor.userId : 'U2' };
        const expected = byRole[role].includes(ownership) || byRole[role].includes('any');
        assert.equal(
          authorize(actor, action, resource).allowed,
          expected,
          `${action} × ${role} × ${ownership}`
        );
      }
    }
  }
});

test('authorize: action chưa khai báo bị từ chối', () => {
  assert.equal(authorize({ role: 'owner' }, 'action.unknown').allowed, false);
});
