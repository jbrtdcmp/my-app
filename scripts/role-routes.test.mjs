import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isExactRoleRoute,
  isPathInRoleTree,
  pathForRide,
  pathForScreen,
  parentPathForScreen,
  resolveRolePath,
  useRoleRoutes,
} from '../src/navigation/roleRoutes.ts';

const expectedMenus = {
  passenger: ['home', 'map', 'bookings', 'alerts', 'profile'],
  driver: ['driver', 'map', 'bookings', 'alerts', 'profile'],
  admin: ['admin', 'drivers', 'bookings', 'alerts', 'profile'],
};

for (const [role, expected] of Object.entries(expectedMenus)) {
  test(`${role} menu and destinations stay in its route tree`, () => {
    const routes = useRoleRoutes(role);
    assert.deepEqual(routes.menu.map(item => item.id), expected);
    for (const item of routes.menu) {
      assert.equal(isPathInRoleTree(role, item.path), true);
      assert.equal(resolveRolePath(item.path)?.role, role);
    }
    assert.equal(routes.home, pathForScreen(role, expected[0]));
    assert.equal(routes.profile, pathForScreen(role, 'profile'));
    assert.equal(routes.alerts, pathForScreen(role, 'alerts'));
    for (const item of routes.menu) {
      if (item.id !== expected[0]) {
        assert.equal(isPathInRoleTree(role, parentPathForScreen(role, item.id)), true);
      }
    }
  });

  test(`${role} rejects paths owned by other roles`, () => {
    for (const otherRole of Object.keys(expectedMenus).filter(candidate => candidate !== role)) {
      const otherPath = useRoleRoutes(otherRole).home;
      assert.equal(isPathInRoleTree(role, otherPath), false);
      assert.equal(isExactRoleRoute(role, otherPath), false);
    }
  });
}

test('ride detail paths resolve only within passenger and driver trees', () => {
  for (const role of ['passenger', 'driver']) {
    const ridePath = pathForRide(role, 123);
    assert.equal(ridePath, `/${role}/ride/123`);
    assert.equal(resolveRolePath(ridePath)?.role, role);
    assert.equal(isExactRoleRoute(role, ridePath), true);
  }
  assert.equal(resolveRolePath('/admin/ride/123')?.screen, 'admin');
});
