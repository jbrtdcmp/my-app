<?php
declare(strict_types=1);

// Pure helpers for community alerts, fare editing, password resets, profile
// photos, place names and ride notifications. No database or HTTP here, so
// scripts/api-test.php can test them directly.

const ALERT_TYPES = ['community', 'weather', 'market', 'fiesta', 'port'];
const PASAKJA_TOWNS = ['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];

/** Matches a town name case-insensitively; null when it isn't one of the five towns. */
function canonicalTown(?string $town): ?string
{
    $town = trim((string)$town);
    foreach (PASAKJA_TOWNS as $name) {
        if (strcasecmp($name, $town) === 0) return $name;
    }
    return null;
}

/**
 * Checks an admin's alert. Returns [clean values, field errors].
 * An empty or "all" municipality means every town (stored as NULL).
 */
function validateAlertInput(array $input): array
{
    $errors = [];
    $title = trim((string)($input['title'] ?? ''));
    $message = trim((string)($input['message'] ?? ''));
    $type = (string)($input['type'] ?? 'community');
    $area = trim((string)($input['municipality'] ?? ''));
    $municipality = null;
    if ($area !== '' && strcasecmp($area, 'all') !== 0) {
        $municipality = canonicalTown($area);
        if ($municipality === null) $errors['municipality'] = 'Choose one of the five towns or all.';
    }
    if (!in_array($type, ALERT_TYPES, true)) $errors['type'] = 'Choose an alert type.';
    if (mb_strlen($title) < 3 || mb_strlen($title) > 120) $errors['title'] = 'Title must be 3 to 120 characters.';
    if (mb_strlen($message) < 3 || mb_strlen($message) > 500) $errors['message'] = 'Message must be 3 to 500 characters.';
    return [['municipality' => $municipality, 'type' => $type, 'title' => $title, 'message' => $message], $errors];
}

/** Reads a decimal field and checks it is between $min and $max. */
function fareNumber(array $input, string $field, float $min, float $max, array &$errors, string $label): float
{
    $value = $input[$field] ?? null;
    if (!is_numeric($value)) {
        $errors[$field] = "$label must be a number.";
        return 0.0;
    }
    $number = round((float)$value, 2);
    if ($number < $min || $number > $max) $errors[$field] = "$label must be between $min and $max.";
    return $number;
}

/** Checks one town's fare rule: base fare, km included in it, per-km rate and pakyaw multiplier. */
function validateMunicipalityFareInput(array $input): array
{
    $errors = [];
    $clean = [
        'base_fare' => fareNumber($input, 'base_fare', 0, 1000, $errors, 'Base fare'),
        'included_km' => fareNumber($input, 'included_km', 0, 20, $errors, 'Kilometres included'),
        'per_km_rate' => fareNumber($input, 'per_km_rate', 0, 200, $errors, 'Rate per km'),
        'special_trip_multiplier' => fareNumber($input, 'special_trip_multiplier', 1, 5, $errors, 'Special trip multiplier'),
    ];
    return [$clean, $errors];
}

/** Checks a fixed fare between two different towns. */
function validateIntertownFareInput(array $input): array
{
    $errors = [];
    $origin = canonicalTown((string)($input['origin'] ?? ''));
    $destination = canonicalTown((string)($input['destination'] ?? ''));
    if ($origin === null) $errors['origin'] = 'Choose the starting town.';
    if ($destination === null) $errors['destination'] = 'Choose the destination town.';
    if ($origin !== null && $origin === $destination) $errors['destination'] = 'Choose two different towns.';
    $fare = fareNumber($input, 'fixed_fare', 1, 2000, $errors, 'Fixed fare');
    return [['origin' => $origin, 'destination' => $destination, 'fixed_fare' => $fare], $errors];
}

/** Checks the student, senior and PWD discount percentages. */
function validateDiscountInput(array $input): array
{
    $errors = [];
    $clean = [
        'student' => fareNumber($input, 'student', 0, 100, $errors, 'Student discount'),
        'senior' => fareNumber($input, 'senior', 0, 100, $errors, 'Senior discount'),
        'pwd' => fareNumber($input, 'pwd', 0, 100, $errors, 'PWD discount'),
    ];
    return [$clean, $errors];
}

/** A temporary password an admin can read out over the phone: no look-alike characters (0/O, 1/l/I). */
function generateTemporaryPassword(int $length = 10): string
{
    $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $password = '';
    for ($i = 0; $i < $length; $i++) $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $password;
}

const VEHICLE_TYPES = ['tricycle'];

/**
 * Stores Philippine mobile numbers one way: 09171234567, 9171234567, 639171234567
 * and +639171234567 all become +639171234567. Anything else keeps only digits and +.
 */
function normalizePhilippinePhone(string $input): string
{
    $digits = preg_replace('/[^0-9+]/', '', $input) ?? '';
    if (preg_match('/^\+?63(9\d{9})$/', $digits, $match)) return '+63' . $match[1];
    if (preg_match('/^0?(9\d{9})$/', $digits, $match)) return '+63' . $match[1];
    return $digits;
}

/**
 * The reason an admin gives for suspending an account; the user sees it when signing in.
 * Returns the trimmed reason, or throws InvalidArgumentException with a user-facing message.
 */
function validatedSuspensionReason(string $reason): string
{
    $reason = trim((string)preg_replace('/\s+/u', ' ', $reason));
    if (mb_strlen($reason) < 5) throw new InvalidArgumentException('Give a reason of at least 5 characters. The user will see it.');
    if (mb_strlen($reason) > 255) throw new InvalidArgumentException('Keep the reason under 255 characters.');
    return $reason;
}

/** Every way one mobile number may already be stored (+639…, 09…, 639…, 9…), for duplicate checks. */
function phoneVariants(string $normalized): array
{
    if (!preg_match('/^\+63(9\d{9})$/', $normalized, $match)) return [$normalized];
    return ['+63' . $match[1], '0' . $match[1], '63' . $match[1], $match[1]];
}

/**
 * Checks the account details used at sign-up and on the profile page.
 * Returns [clean values, field errors]: a 2–120 character name, a phone number in +63 form,
 * an optional email (null when blank) and an optional home town (null when blank).
 */
function validateAccountDetails(array $input): array
{
    $name = trim((string)preg_replace('/\s+/u', ' ', (string)($input['name'] ?? '')));
    $phone = normalizePhilippinePhone((string)($input['phone'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $townInput = trim((string)($input['municipality'] ?? ''));
    $town = canonicalTown($townInput);
    $errors = [];
    if (mb_strlen($name) < 2 || mb_strlen($name) > 120) $errors['name'] = 'Enter your full name.';
    if (!preg_match('/^\+?[0-9]{7,18}$/', $phone)) $errors['phone'] = 'Enter a valid phone number.';
    if ($email !== '' && (strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL))) $errors['email'] = 'Enter a valid email address.';
    if ($townInput !== '' && $town === null) $errors['municipality'] = 'Choose one of the five towns.';
    return [['name' => $name, 'phone' => $phone, 'email' => $email === '' ? null : $email, 'municipality' => $town], $errors];
}

/**
 * Validates an image sent as a data URL (the browser resizes it first): JPEG, PNG or WebP,
 * real image bytes of the declared type, within the size limits.
 * Returns the data URL to store, or throws InvalidArgumentException with a user-facing message.
 */
function validatedImageDataUrl(string $dataUrl, int $maxBytes, int $maxSide, int $minSide = 16): string
{
    if (!preg_match('#^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $matches)) {
        throw new InvalidArgumentException('Send the photo as a JPEG, PNG or WebP image.');
    }
    $bytes = base64_decode($matches[2], true);
    if ($bytes === false || $bytes === '') throw new InvalidArgumentException('The photo could not be read.');
    if (strlen($bytes) > $maxBytes) throw new InvalidArgumentException('The photo is too large. Choose a smaller image.');
    $info = @getimagesizefromstring($bytes);
    if (!$info || ($info['mime'] ?? '') !== $matches[1]) throw new InvalidArgumentException('That file is not a valid image.');
    if ($info[0] < $minSide || $info[1] < $minSide || $info[0] > $maxSide || $info[1] > $maxSide) {
        throw new InvalidArgumentException('The photo size is not supported.');
    }
    return $dataUrl;
}

/** Profile photo: small, shown as a circle. */
function validatedAvatarDataUrl(string $dataUrl): string
{
    return validatedImageDataUrl($dataUrl, 200000, 1024);
}

/** Driver's licence or ID: large enough for an admin to read the text. */
function validatedIdPhotoDataUrl(string $dataUrl): string
{
    try {
        return validatedImageDataUrl($dataUrl, 700000, 2400, 200);
    } catch (InvalidArgumentException $error) {
        throw new InvalidArgumentException($error->getMessage() === 'The photo size is not supported.'
            ? 'The ID photo is too small to read. Take a closer, clearer photo.'
            : $error->getMessage());
    }
}

/**
 * Builds a short place name from an OpenStreetMap Nominatim reverse result,
 * e.g. "Rizal Street, Cantilan" or "Cantilan Public Market". Null when there is nothing useful.
 */
function placeLabelFromNominatim(array $result): ?string
{
    $address = is_array($result['address'] ?? null) ? $result['address'] : [];
    $name = trim((string)($result['name'] ?? ''));
    $road = trim((string)($address['road'] ?? $address['pedestrian'] ?? $address['footway'] ?? $address['path'] ?? ''));
    $area = '';
    foreach (['neighbourhood', 'suburb', 'village', 'hamlet', 'quarter'] as $key) {
        if (!empty($address[$key])) { $area = trim((string)$address[$key]); break; }
    }
    $town = '';
    foreach (['town', 'municipality', 'city', 'county'] as $key) {
        if (!empty($address[$key])) { $town = trim((string)$address[$key]); break; }
    }
    $parts = [];
    if ($name !== '' && $name !== $road) $parts[] = $name;
    if ($road !== '') $parts[] = $road;
    elseif ($area !== '') $parts[] = $area;
    if (!$parts) return null;
    if ($town !== '' && !in_array($town, $parts, true)) $parts[] = $town;
    $label = implode(', ', array_slice($parts, 0, 3));
    return mb_substr($label, 0, 190);
}

/** The notice the passenger gets when a driver moves the ride on. Null for steps without one. */
function rideNotificationForPassenger(string $status, ?float $fare = null): ?array
{
    return match ($status) {
        'accepted' => ['ride_accepted', 'Driver found', 'A TODA driver accepted your ride and is getting ready.'],
        'arriving' => ['ride_arriving', 'Driver on the way', 'Your driver is heading to your pickup point.'],
        'in_progress' => ['ride_started', 'Trip started', 'Enjoy your ride. Share your trip if you want someone to follow along.'],
        'completed' => ['ride_completed', 'Trip completed', $fare !== null
            ? sprintf('You arrived. Please pay ₱%s in cash and rate your driver.', rtrim(rtrim(number_format($fare, 2, '.', ''), '0'), '.'))
            : 'You arrived. Please rate your driver.'],
        default => null,
    };
}
