<?php
declare(strict_types=1);

// Ride dispatch: Haversine-based nearest-driver matching with queue fairness.
//
// 1. Candidates are verified drivers who are online (location sent in the last
//    DISPATCH_ONLINE_SECONDS), free (no active ride) and within
//    DISPATCH_RADIUS_KM of the pickup, minus anyone who declined the ride.
// 2. Candidates are ranked by Haversine distance to the pickup in bands of
//    DISPATCH_TIE_BAND_KM. Inside a band, the driver who has waited longest
//    since their last completed ride goes first, like a TODA terminal queue.
// 3. The ride is offered to the top driver first, then opens to one more
//    driver every DISPATCH_OFFER_SECONDS. A decline moves the next driver up.
// 4. Once every candidate has had a turn, or nobody qualifies, the request is
//    open to every approved driver so no ride gets stuck.
//
// The ranking and offer rules below are pure functions; only the loaders at
// the bottom touch the database.

const DISPATCH_ONLINE_SECONDS = 60;
const DISPATCH_RADIUS_KM = 5.0;
const DISPATCH_TIE_BAND_KM = 0.3;
const DISPATCH_OFFER_SECONDS = 20;

function dispatchHaversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earth = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

/**
 * Ranks candidate drivers for one ride.
 *
 * @param array{pickup_lat: float|string|null, pickup_lng: float|string|null} $ride
 * @param list<array{driver_id: int, lat: float, lng: float, idle_minutes: ?int}> $drivers online, free, verified drivers
 * @param list<int> $declinedDriverIds drivers who declined this ride
 * @return list<array{driver_id: int, distance_km: float, idle_minutes: ?int}> best match first
 */
function dispatchRankDrivers(array $ride, array $drivers, array $declinedDriverIds): array
{
    if ($ride['pickup_lat'] === null || $ride['pickup_lng'] === null) return [];
    $pickupLat = (float)$ride['pickup_lat'];
    $pickupLng = (float)$ride['pickup_lng'];
    $declined = array_flip($declinedDriverIds);

    $ranked = [];
    foreach ($drivers as $driver) {
        if (isset($declined[$driver['driver_id']])) continue;
        $distance = dispatchHaversineKm($pickupLat, $pickupLng, $driver['lat'], $driver['lng']);
        if ($distance > DISPATCH_RADIUS_KM) continue;
        $ranked[] = ['driver_id' => $driver['driver_id'], 'distance_km' => round($distance, 2), 'idle_minutes' => $driver['idle_minutes']];
    }

    usort($ranked, static function (array $a, array $b): int {
        // Same 300 m band: whoever waited longest goes first. A driver with no
        // completed ride yet has waited longest of all.
        $band = intdiv((int)round($a['distance_km'] * 1000), (int)round(DISPATCH_TIE_BAND_KM * 1000))
            <=> intdiv((int)round($b['distance_km'] * 1000), (int)round(DISPATCH_TIE_BAND_KM * 1000));
        if ($band !== 0) return $band;
        $idleA = $a['idle_minutes'] ?? PHP_INT_MAX;
        $idleB = $b['idle_minutes'] ?? PHP_INT_MAX;
        if ($idleA !== $idleB) return $idleB <=> $idleA;
        return [$a['distance_km'], $a['driver_id']] <=> [$b['distance_km'], $b['driver_id']];
    });
    return $ranked;
}

/**
 * Decides whether one driver may see and accept a waiting ride right now.
 *
 * @param list<array{driver_id: int, distance_km: float, idle_minutes: ?int}> $ranked from dispatchRankDrivers()
 * @return array{visible: bool, phase: string, rank: ?int, distance_km: ?float}
 *   phase is 'offer' while the ride goes driver by driver, 'open' once everyone may see it.
 */
function dispatchOfferFor(int $driverId, array $ranked, int $waitingSeconds): array
{
    $rank = null;
    foreach ($ranked as $index => $candidate) {
        if ($candidate['driver_id'] === $driverId) {
            $rank = $index;
            break;
        }
    }
    $distance = $rank === null ? null : $ranked[$rank]['distance_km'];
    $offeredTo = intdiv(max(0, $waitingSeconds), DISPATCH_OFFER_SECONDS) + 1;

    // Nobody nearby is online, or every nearby driver has had a turn.
    if (!$ranked || $offeredTo > count($ranked)) {
        return ['visible' => true, 'phase' => 'open', 'rank' => $rank, 'distance_km' => $distance];
    }
    return ['visible' => $rank !== null && $rank < $offeredTo, 'phase' => 'offer', 'rank' => $rank, 'distance_km' => $distance];
}

/**
 * Filters one driver's ride list: waiting requests appear only while they are
 * offered to this driver, with the driver's distance to the pickup.
 *
 * @param list<array<string, mixed>> $rides rows with status, id, pickup_lat/lng and waiting_seconds
 * @return list<array<string, mixed>>
 */
function dispatchVisibleRides(PDO $pdo, array $rides, int $driverId): array
{
    $waiting = array_values(array_filter($rides, static fn(array $ride): bool => $ride['status'] === 'finding'));
    $candidates = $waiting ? loadDispatchCandidates($pdo) : [];
    $declines = loadRideDeclines($pdo, array_map(static fn(array $ride): int => (int)$ride['id'], $waiting));
    $visible = [];
    foreach ($rides as $ride) {
        if ($ride['status'] === 'finding') {
            $ranked = dispatchRankDrivers($ride, $candidates, $declines[(int)$ride['id']] ?? []);
            $offer = dispatchOfferFor($driverId, $ranked, (int)($ride['waiting_seconds'] ?? 0));
            if (!$offer['visible']) continue;
            $ride['pickup_distance_km'] = $offer['distance_km'];
            $ride['dispatch_phase'] = $offer['phase'];
        }
        unset($ride['waiting_seconds']);
        $visible[] = $ride;
    }
    return $visible;
}

/**
 * Whether a driver may accept this waiting ride right now.
 */
function dispatchMayAccept(PDO $pdo, int $rideId, int $driverId): bool
{
    $statement = $pdo->prepare("SELECT id, status, pickup_lat, pickup_lng, TIMESTAMPDIFF(SECOND, requested_at, CURRENT_TIMESTAMP) AS waiting_seconds FROM rides WHERE id = ?");
    $statement->execute([$rideId]);
    $ride = $statement->fetch();
    // Missing or already taken rides are left to the accept query to reject.
    if (!$ride || $ride['status'] !== 'finding') return true;
    $ranked = dispatchRankDrivers($ride, loadDispatchCandidates($pdo), loadRideDeclines($pdo, [$rideId])[$rideId] ?? []);
    return dispatchOfferFor($driverId, $ranked, (int)$ride['waiting_seconds'])['visible'];
}

/**
 * Online, free, verified drivers with a recent location.
 *
 * @return list<array{driver_id: int, lat: float, lng: float, idle_minutes: ?int}>
 */
function loadDispatchCandidates(PDO $pdo): array
{
    $statement = $pdo->prepare("SELECT dp.user_id, dp.last_lat, dp.last_lng,
            (SELECT TIMESTAMPDIFF(MINUTE, MAX(done.completed_at), CURRENT_TIMESTAMP) FROM rides done WHERE done.driver_id = dp.user_id AND done.status = 'completed') AS idle_minutes
        FROM driver_profiles dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.verification_status = 'verified'
          AND u.is_active = 1
          AND dp.last_lat IS NOT NULL AND dp.last_lng IS NOT NULL
          AND dp.last_seen_at >= CURRENT_TIMESTAMP(3) - INTERVAL ? SECOND
          AND NOT EXISTS (SELECT 1 FROM rides busy WHERE busy.driver_id = dp.user_id AND busy.status IN ('accepted', 'arriving', 'in_progress'))");
    $statement->execute([DISPATCH_ONLINE_SECONDS]);
    return array_map(static fn(array $row): array => [
        'driver_id' => (int)$row['user_id'],
        'lat' => (float)$row['last_lat'],
        'lng' => (float)$row['last_lng'],
        'idle_minutes' => $row['idle_minutes'] === null ? null : (int)$row['idle_minutes'],
    ], $statement->fetchAll());
}

/**
 * Drivers who declined each ride.
 *
 * @param list<int> $rideIds
 * @return array<int, list<int>> ride id => declining driver ids
 */
function loadRideDeclines(PDO $pdo, array $rideIds): array
{
    if (!$rideIds) return [];
    $placeholders = implode(',', array_fill(0, count($rideIds), '?'));
    $statement = $pdo->prepare("SELECT ride_id, driver_id FROM ride_driver_declines WHERE ride_id IN ($placeholders)");
    $statement->execute(array_values($rideIds));
    $declines = [];
    foreach ($statement->fetchAll() as $row) $declines[(int)$row['ride_id']][] = (int)$row['driver_id'];
    return $declines;
}
