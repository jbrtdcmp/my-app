<?php
declare(strict_types=1);

// Tests for api/features_service.php. Run: C:\xampp\php\php.exe scripts\api-test.php
require __DIR__ . '/../api/features_service.php';

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

// Towns
check('town names match regardless of case', canonicalTown('cantilan') === 'Cantilan');
check('an unknown town is rejected', canonicalTown('Manila') === null);

// Alerts
[$alert, $errors] = validateAlertInput(['municipality' => 'all', 'type' => 'weather', 'title' => 'Heavy rain', 'message' => 'Expect delays on the coastal road.']);
check('"all" towns is stored as every town', $alert['municipality'] === null && !$errors);
[$alert, $errors] = validateAlertInput(['municipality' => 'madrid', 'type' => 'market', 'title' => 'Market day', 'message' => 'Extra tricycles near the market.']);
check('a single town is kept, with its proper name', $alert['municipality'] === 'Madrid' && !$errors);
[, $errors] = validateAlertInput(['municipality' => 'Davao', 'type' => 'party', 'title' => 'Hi', 'message' => '']);
check('bad town, type, title and message are all reported', isset($errors['municipality'], $errors['type'], $errors['title'], $errors['message']));

// Fares
[$rule, $errors] = validateMunicipalityFareInput(['base_fare' => '30', 'included_km' => '1', 'per_km_rate' => '5.5', 'special_trip_multiplier' => '1.25']);
check('a valid town fare passes and becomes numbers', !$errors && $rule['per_km_rate'] === 5.5 && $rule['base_fare'] === 30.0);
[, $errors] = validateMunicipalityFareInput(['base_fare' => '-5', 'included_km' => 'abc', 'per_km_rate' => '5', 'special_trip_multiplier' => '0.5']);
check('negative fare, non-number km and multiplier below 1 are rejected', isset($errors['base_fare'], $errors['included_km'], $errors['special_trip_multiplier']) && !isset($errors['per_km_rate']));
[$pair, $errors] = validateIntertownFareInput(['origin' => 'carrascal', 'destination' => 'Madrid', 'fixed_fare' => 60]);
check('a fare between two towns passes', !$errors && $pair['origin'] === 'Carrascal' && $pair['fixed_fare'] === 60.0);
[, $errors] = validateIntertownFareInput(['origin' => 'Madrid', 'destination' => 'madrid', 'fixed_fare' => 60]);
check('the same town on both ends is rejected', isset($errors['destination']));
[$discounts, $errors] = validateDiscountInput(['student' => 20, 'senior' => 20, 'pwd' => 101]);
check('a discount over 100% is rejected', isset($errors['pwd']) && !isset($errors['student']));

// Temporary passwords
$password = generateTemporaryPassword();
check('a temporary password has 10 characters', strlen($password) === 10);
check('a temporary password has no look-alike characters', !preg_match('/[0O1lI]/', $password), $password);
check('two temporary passwords differ', generateTemporaryPassword() !== generateTemporaryPassword());

// Profile photos
$png = 'data:image/png;base64,' . base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP8z4AfMOGVZhhVMKpgKCkAAHFxAh0n2Wd6AAAAAElFTkSuQmCC'));
check('a small PNG photo is accepted', validatedAvatarDataUrl($png) === $png);
$threw = static function (string $value): bool {
    try { validatedAvatarDataUrl($value); return false; } catch (InvalidArgumentException) { return true; }
};
check('a non-image data URL is rejected', $threw('data:text/html;base64,' . base64_encode('<script>alert(1)</script>')));
check('text pretending to be a PNG is rejected', $threw('data:image/png;base64,' . base64_encode('not really a png')));
check('a photo over the size limit is rejected', $threw('data:image/png;base64,' . base64_encode(str_repeat('a', 210000))));

// Place names from OpenStreetMap
check('a shop on a street reads "name, street, town"', placeLabelFromNominatim(['name' => 'Solar Drugstore', 'address' => ['road' => 'Falcon Street', 'town' => 'Cantilan']]) === 'Solar Drugstore, Falcon Street, Cantilan');
check('a plain street reads "street, town"', placeLabelFromNominatim(['name' => 'Rizal Street', 'address' => ['road' => 'Rizal Street', 'municipality' => 'Cantilan']]) === 'Rizal Street, Cantilan');
check('without a street the village is used', placeLabelFromNominatim(['name' => '', 'address' => ['village' => 'Lininti-an', 'town' => 'Cantilan']]) === 'Lininti-an, Cantilan');
check('an empty result gives no label', placeLabelFromNominatim(['address' => ['country' => 'Philippines']]) === null);

// Ride notifications
check('accepting a ride tells the passenger a driver was found', rideNotificationForPassenger('accepted')[1] === 'Driver found');
check('completing a ride shows the fare without trailing zeros', str_contains(rideNotificationForPassenger('completed', 25.0)[2], '₱25 '));
check('steps without a notice return nothing', rideNotificationForPassenger('finding') === null);

echo "\n$passed passed, $failures failed\n";
exit($failures === 0 ? 0 : 1);
