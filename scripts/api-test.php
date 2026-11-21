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

// Driver ID photos: must be big enough to read
$idThrew = static function (string $value): ?string {
    try { validatedIdPhotoDataUrl($value); return null; } catch (InvalidArgumentException $error) { return $error->getMessage(); }
};
// A plain grey PNG of any size, built by hand so the test doesn't need the GD extension.
function blankPng(int $width, int $height): string
{
    $chunk = static fn(string $type, string $data): string => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
    $rows = str_repeat("\0" . str_repeat("\x80", $width), $height);
    return "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 0, 0, 0, 0)) . $chunk('IDAT', gzcompress($rows)) . $chunk('IEND', '');
}
$readableId = 'data:image/png;base64,' . base64_encode(blankPng(800, 500));
check('a readable 800×500 ID photo is accepted', $idThrew($readableId) === null);
check('a tiny 16×16 image is refused as an ID', str_contains((string)$idThrew($png), 'too small to read'));
check('an ID photo must be an image', $idThrew('data:application/pdf;base64,' . base64_encode('%PDF-1.4')) !== null);
check('tricycle is a known vehicle type', in_array('tricycle', VEHICLE_TYPES, true));

// Phone numbers: every common way of writing a PH mobile number becomes +639…
foreach (['09171234567', '9171234567', '639171234567', '+639171234567', '+63 917 123 4567', '0917-123-4567'] as $typed) {
    check("\"$typed\" is stored as +639171234567", normalizePhilippinePhone($typed) === '+639171234567', normalizePhilippinePhone($typed));
}
check('a landline keeps only its digits', normalizePhilippinePhone('(086) 212-3456') === '0862123456');
check('a mobile number is checked in every stored form', phoneVariants('+639171234567') === ['+639171234567', '09171234567', '639171234567', '9171234567']);
check('other numbers are checked as they are', phoneVariants('0862123456') === ['0862123456']);

// Sign-in limits
check('four recent failures still allow a try', attemptWaitSeconds([1000, 1100, 1200, 1300], 1400, 5, 900) === 0);
check('the sixth try within 15 minutes waits until the oldest failure is 15 minutes old', attemptWaitSeconds([1000, 1100, 1200, 1300, 1400], 1500, 5, 900) === 400);
check('failures older than 15 minutes no longer count', attemptWaitSeconds([100, 1100, 1200, 1300, 1400], 1500, 5, 900) === 0);
check('with more failures than the limit, the wait follows the one that keeps it over', attemptWaitSeconds([1000, 1050, 1100, 1200, 1300, 1400], 1500, 5, 900) === 450);
check('a wait is shown in whole minutes', waitText(61) === '2 minutes' && waitText(30) === '1 minute');
check('attempts on 0917…, 917… and +63917… count against one account', attemptIdentifier('0917 123 4567') === '+639171234567' && attemptIdentifier('9171234567') === '+639171234567');
check('attempts by email ignore letter case', attemptIdentifier(' Juan@Email.com ') === 'juan@email.com');

// Suspension reasons
check('a suspension reason is trimmed and kept', validatedSuspensionReason("  Repeated   complaints \n") === 'Repeated complaints');
$tooShort = false;
try { validatedSuspensionReason('bad'); } catch (InvalidArgumentException) { $tooShort = true; }
check('a reason shorter than 5 characters is refused', $tooShort);
$tooLong = false;
try { validatedSuspensionReason(str_repeat('x', 256)); } catch (InvalidArgumentException) { $tooLong = true; }
check('a reason longer than 255 characters is refused', $tooLong);

// Account details (sign-up and profile edits)
[$account, $errors] = validateAccountDetails(['name' => '  Juan   Dela Cruz ', 'phone' => '0917 123 4567', 'email' => ' Juan@Email.COM ', 'municipality' => 'madrid']);
check('profile details are cleaned up', !$errors && $account === ['name' => 'Juan Dela Cruz', 'phone' => '+639171234567', 'email' => 'juan@email.com', 'municipality' => 'Madrid'], json_encode($account));
[$account, $errors] = validateAccountDetails(['name' => 'Ana Santos', 'phone' => '+639181234567', 'email' => '', 'municipality' => '']);
check('a blank email and home town are saved as empty', !$errors && $account['email'] === null && $account['municipality'] === null);
[$account, $errors] = validateAccountDetails(['name' => ['Juan'], 'phone' => ['0917'], 'email' => 'juan@email.com']);
check('a list where text belongs is refused, not saved as "Array"', isset($errors['name'], $errors['phone']) && $account['name'] === '', json_encode($errors));
[, $errors] = validateAccountDetails(['name' => 'A', 'phone' => '12', 'email' => 'not-an-email', 'municipality' => 'Manila']);
check('a bad name, phone, email and town are each reported', array_keys($errors) === ['name', 'phone', 'email', 'municipality'], json_encode($errors));

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
