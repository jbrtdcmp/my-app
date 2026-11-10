<?php
declare(strict_types=1);

// Tests for api/dispatch_service.php and api/ride_status.php. Run: C:\xampp\php\php.exe scripts\dispatch-test.php
require __DIR__ . '/../api/dispatch_service.php';
require __DIR__ . '/../api/ride_status.php';

$failures = 0;
$passed = 0;
function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $passed;
    if ($ok) {
        $passed++;
        echo "  ok  $name\n";
    } else {
        $failures++;
        echo "  FAIL $name" . ($detail !== '' ? " ($detail)" : '') . "\n";
    }
}

// One degree of latitude is about 111.19 km, so this places a driver due north of the pickup.
const KM_PER_LAT_DEGREE = 111.195;
$pickup = ['pickup_lat' => 9.3333, 'pickup_lng' => 125.9667]; // Cantilan town center
function driverAt(int $id, float $kmNorth, ?int $idleMinutes): array
{
    return ['driver_id' => $id, 'lat' => 9.3333 + $kmNorth / KM_PER_LAT_DEGREE, 'lng' => 125.9667, 'idle_minutes' => $idleMinutes];
}
$ids = static fn(array $ranked): array => array_map(static fn(array $row): int => $row['driver_id'], $ranked);
$visibleIds = static function (array $driverIds, array $ranked, int $seconds): array {
    return array_values(array_filter($driverIds, static fn(int $id): bool => dispatchOfferFor($id, $ranked, $seconds)['visible']));
};

echo "Haversine distance\n";
$carrascalToCantilan = dispatchHaversineKm(9.3703, 125.9492, 9.3333, 125.9667);
check('Carrascal center to Cantilan center is about 4.54 km', abs($carrascalToCantilan - 4.54) < 0.02, sprintf('got %.3f km', $carrascalToCantilan));
check('same point is 0 km', dispatchHaversineKm(9.3333, 125.9667, 9.3333, 125.9667) === 0.0);

echo "Ranking\n";
$drivers = [
    driverAt(1, 0.10, 5),     // A: closest, just finished a ride
    driverAt(2, 0.20, 40),    // B: same 300 m band as A, waited longer
    driverAt(3, 0.50, null),  // C: next band, has never had a ride
    driverAt(4, 1.20, 100),   // D: farther band
    driverAt(5, 6.00, 500),   // E: outside the 5 km radius
];
$ranked = dispatchRankDrivers($pickup, $drivers, []);
check('ranks B, A, C, D', $ids($ranked) === [2, 1, 3, 4], 'got ' . implode(', ', $ids($ranked)));
check('drivers beyond 5 km are left out', !in_array(5, $ids($ranked), true));
check('distance is reported in km', abs($ranked[0]['distance_km'] - 0.20) < 0.01, 'got ' . $ranked[0]['distance_km']);

$bandEdge = dispatchRankDrivers($pickup, [driverAt(10, 0.29, 0), driverAt(11, 0.31, 600)], []);
check('different bands: nearer driver wins even if the other waited longer', $ids($bandEdge) === [10, 11], 'got ' . implode(', ', $ids($bandEdge)));
$sameWait = dispatchRankDrivers($pickup, [driverAt(20, 0.25, 10), driverAt(21, 0.05, 10)], []);
check('same band and same wait: nearer driver wins', $ids($sameWait) === [21, 20], 'got ' . implode(', ', $ids($sameWait)));
$neverVsLong = dispatchRankDrivers($pickup, [driverAt(30, 0.10, 9999), driverAt(31, 0.15, null)], []);
check('same band: a driver with no rides yet goes before one who has waited', $ids($neverVsLong) === [31, 30], 'got ' . implode(', ', $ids($neverVsLong)));

$afterDecline = dispatchRankDrivers($pickup, $drivers, [2]);
check('a decline moves the next driver up', $ids($afterDecline) === [1, 3, 4], 'got ' . implode(', ', $ids($afterDecline)));
check('a ride without pickup coordinates has no ranking', dispatchRankDrivers(['pickup_lat' => null, 'pickup_lng' => null], $drivers, []) === []);

echo "Offers over time\n";
$everyone = [1, 2, 3, 4, 5, 99];
check('at 0 s only the top driver sees it', $visibleIds($everyone, $ranked, 0) === [2], 'got ' . implode(', ', $visibleIds($everyone, $ranked, 0)));
check('at 19 s still only the top driver', $visibleIds($everyone, $ranked, 19) === [2]);
check('at 20 s the second driver joins', $visibleIds($everyone, $ranked, 20) === [1, 2]);
check('at 79 s all four ranked drivers, nobody else', $visibleIds($everyone, $ranked, 79) === [1, 2, 3, 4]);
check('at 80 s everyone has had a turn, so it opens to all', $visibleIds($everyone, $ranked, 80) === $everyone);
check('phase is offer while going driver by driver', dispatchOfferFor(2, $ranked, 0)['phase'] === 'offer');
check('phase is open once everyone may see it', dispatchOfferFor(99, $ranked, 80)['phase'] === 'open');
check('the offer reports the driver distance', dispatchOfferFor(2, $ranked, 0)['distance_km'] === $ranked[0]['distance_km']);
check('an unranked driver has no distance', dispatchOfferFor(99, $ranked, 80)['distance_km'] === null);
check('a negative wait is treated as 0 s', $visibleIds($everyone, $ranked, -5) === [2]);
check('with no nearby online driver it is open to all at once', $visibleIds($everyone, [], 0) === $everyone);
check('after a decline the next driver sees it at 0 s', $visibleIds($everyone, $afterDecline, 0) === [1]);

// Driver ride steps: each next status must name the status it comes from.
check('Start pickup moves an accepted ride', rideStatusBefore('arriving') === 'accepted');
check('Start trip moves an arriving ride', rideStatusBefore('in_progress') === 'arriving');
check('Complete ride moves an in-progress ride', rideStatusBefore('completed') === 'in_progress');
check('a driver cannot set a ride back to accepted', rideStatusBefore('accepted') === null);
check('a driver cannot cancel through the status step', rideStatusBefore('cancelled') === null);

echo "\n$passed passed, $failures failed\n";
exit($failures === 0 ? 0 : 1);
