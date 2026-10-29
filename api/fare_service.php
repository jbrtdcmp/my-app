<?php
declare(strict_types=1);

final class FareValidationException extends RuntimeException
{
}

final class FareConfigurationException extends RuntimeException
{
}

// Approximate municipal centers copied from src/components/Map.tsx; used only for nearest-town inference.
const PASAKJA_TOWN_CENTERS = [
    'Carrascal' => ['lat' => 9.3703, 'lng' => 125.9492],
    'Cantilan' => ['lat' => 9.3333, 'lng' => 125.9667],
    'Madrid' => ['lat' => 9.2624, 'lng' => 125.9635],
    'Carmen' => ['lat' => 9.2260, 'lng' => 126.0170],
    'Lanuza' => ['lat' => 9.2350, 'lng' => 126.0640],
];

const PASAKJA_RIDE_TYPES = ['regular', 'pakyaw', 'padala', 'scheduled', 'group'];
const PASAKJA_DISCOUNTS = ['none', 'student', 'senior', 'pwd'];

function fareHaversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earth = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function fareNearestTown(float $lat, float $lng): string
{
    $nearest = '';
    $nearestDistance = INF;
    foreach (PASAKJA_TOWN_CENTERS as $town => $center) {
        $distance = fareHaversineKm($lat, $lng, $center['lat'], $center['lng']);
        if ($distance < $nearestDistance) {
            $nearest = $town;
            $nearestDistance = $distance;
        }
    }
    return $nearest;
}

function fareCanonicalTown(?string $town): ?string
{
    $town = trim((string)$town);
    if ($town === '') return null;
    foreach (PASAKJA_TOWN_CENTERS as $name => $center) {
        if (strcasecmp($name, $town) === 0) return $name;
    }
    throw new FareValidationException('Choose a supported municipality.');
}

function fareRoundUpToFive(float $amount): float
{
    $cents = (int)round(max(0.0, $amount) * 100);
    return (ceil($cents / 500) * 500) / 100;
}

function loadFareRules(PDO $pdo): array
{
    $settings = $pdo->query('SELECT student_discount_percent, senior_discount_percent, pwd_discount_percent, special_ride_types FROM fare_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
    if (!$settings) throw new FareConfigurationException('Fare settings are not configured.');

    $specialRideTypes = json_decode((string)$settings['special_ride_types'], true);
    if (!is_array($specialRideTypes)) {
        $specialRideTypes = array_filter(array_map('trim', explode(',', (string)$settings['special_ride_types'])));
    }
    $specialRideTypes = array_values(array_intersect(PASAKJA_RIDE_TYPES, $specialRideTypes));

    $municipalities = [];
    $statement = $pdo->query('SELECT municipality, base_fare, included_km, per_km_rate, special_trip_multiplier, is_placeholder FROM municipality_fares');
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $municipalities[$row['municipality']] = [
            'base_fare' => (float)$row['base_fare'],
            'included_km' => (float)$row['included_km'],
            'per_km_rate' => (float)$row['per_km_rate'],
            'special_trip_multiplier' => (float)$row['special_trip_multiplier'],
            'is_placeholder' => (bool)(int)$row['is_placeholder'],
        ];
    }

    $intertown = [];
    $statement = $pdo->query('SELECT origin_municipality, destination_municipality, fixed_fare, is_placeholder FROM intertown_fares');
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $intertown[$row['origin_municipality'] . '|' . $row['destination_municipality']] = [
            'fixed_fare' => (float)$row['fixed_fare'],
            'is_placeholder' => (bool)(int)$row['is_placeholder'],
        ];
    }

    return [
        'discounts' => [
            'none' => 0.0,
            'student' => (float)$settings['student_discount_percent'],
            'senior' => (float)$settings['senior_discount_percent'],
            'pwd' => (float)$settings['pwd_discount_percent'],
        ],
        'special_ride_types' => $specialRideTypes,
        'municipalities' => $municipalities,
        'intertown' => $intertown,
    ];
}

function calculateFare(
    array $municipalityRule,
    ?array $intertownRule,
    float $distanceKm,
    string $rideType,
    string $discount,
    array $discountPercents,
    array $specialRideTypes
): array {
    if (!in_array($rideType, PASAKJA_RIDE_TYPES, true)) throw new FareValidationException('Unknown ride type.');
    if (!in_array($discount, PASAKJA_DISCOUNTS, true) || !array_key_exists($discount, $discountPercents)) {
        throw new FareValidationException('Invalid discount type.');
    }

    $distanceKm = round(max(0.0, $distanceKm), 2);
    $discountPercent = min(100.0, max(0.0, (float)$discountPercents[$discount]));

    if ($intertownRule !== null) {
        $baseFare = round((float)$intertownRule['fixed_fare'], 2);
        $includedKm = 0.0;
        $billableKm = 0.0;
        $perKmRate = 0.0;
        $distanceFare = 0.0;
        $multiplier = 1.0;
        $subtotal = $baseFare;
        $multiplierAmount = 0.0;
        $isPlaceholder = (bool)$intertownRule['is_placeholder'];
        $isIntertown = true;
    } else {
        $baseFare = round((float)$municipalityRule['base_fare'], 2);
        $includedKm = round((float)$municipalityRule['included_km'], 2);
        $perKmRate = round((float)$municipalityRule['per_km_rate'], 2);
        $billableKm = round(max(0.0, $distanceKm - $includedKm), 2);
        $distanceFare = round($billableKm * $perKmRate, 2);
        $multiplier = in_array($rideType, $specialRideTypes, true)
            ? round((float)$municipalityRule['special_trip_multiplier'], 2)
            : 1.0;
        $subtotal = round(($baseFare + $distanceFare) * $multiplier, 2);
        $multiplierAmount = round($subtotal - ($baseFare + $distanceFare), 2);
        $isPlaceholder = (bool)$municipalityRule['is_placeholder'];
        $isIntertown = false;
    }

    $discountAmount = round($subtotal * $discountPercent / 100, 2);
    $totalBeforeRounding = round(max(0.0, $subtotal - $discountAmount), 2);
    $total = fareRoundUpToFive($totalBeforeRounding);

    return [
        'currency' => 'PHP',
        'distance_km' => $distanceKm,
        'distance_method' => 'haversine',
        'is_intertown' => $isIntertown,
        'ride_type' => $rideType,
        'discount' => $discount,
        'base_fare' => $baseFare,
        'included_km' => $includedKm,
        'billable_km' => $billableKm,
        'per_km_rate' => $perKmRate,
        'distance_fare' => $distanceFare,
        'special_trip_multiplier' => $multiplier,
        'multiplier_amount' => $multiplierAmount,
        'subtotal' => $subtotal,
        'discount_percent' => $discountPercent,
        'discount_amount' => $discountAmount,
        'total_before_rounding' => $totalBeforeRounding,
        'rounding_adjustment' => round($total - $totalBeforeRounding, 2),
        'total' => $total,
        'is_placeholder' => $isPlaceholder,
        'no_surge_pricing' => true,
    ];
}

function quoteFare(
    array $rules,
    float $pickupLat,
    float $pickupLng,
    float $destinationLat,
    float $destinationLng,
    string $rideType,
    string $discount,
    ?string $selectedTown = null,
    ?string $selectedDestinationTown = null
): array {
    $pickupTown = fareNearestTown($pickupLat, $pickupLng);
    $destinationTown = fareNearestTown($destinationLat, $destinationLng);
    $selectedTown = fareCanonicalTown($selectedTown);
    $selectedDestinationTown = fareCanonicalTown($selectedDestinationTown);

    if ($selectedTown !== null && $selectedTown !== $pickupTown) {
        throw new FareValidationException("The selected town {$selectedTown} does not match the pickup pin ({$pickupTown}). Move the pin or select {$pickupTown}.");
    }
    if ($selectedDestinationTown !== null && $selectedDestinationTown !== $destinationTown) {
        throw new FareValidationException("The selected destination town {$selectedDestinationTown} does not match the destination pin ({$destinationTown}). Move the pin or select {$destinationTown}.");
    }

    $municipalityRule = $rules['municipalities'][$pickupTown] ?? null;
    if (!$municipalityRule) throw new FareValidationException("No fare is configured for {$pickupTown}.");

    $intertownRule = null;
    if ($pickupTown !== $destinationTown) {
        $intertownRule = $rules['intertown'][$pickupTown . '|' . $destinationTown]
            ?? $rules['intertown'][$destinationTown . '|' . $pickupTown]
            ?? null;
        if (!$intertownRule) {
            throw new FareValidationException("No inter-town fare is configured for {$pickupTown} to {$destinationTown}.");
        }
    }

    $distanceKm = round(fareHaversineKm($pickupLat, $pickupLng, $destinationLat, $destinationLng), 2);
    $calculation = calculateFare(
        $municipalityRule,
        $intertownRule,
        $distanceKm,
        $rideType,
        $discount,
        $rules['discounts'],
        $rules['special_ride_types']
    );

    return array_merge($calculation, [
        'municipality' => $pickupTown,
        'destination_municipality' => $destinationTown,
    ]);
}
