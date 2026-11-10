<?php
declare(strict_types=1);

// The steps a driver moves a ride through, each status mapped to the one after it.
const RIDE_STATUS_STEPS = ['accepted' => 'arriving', 'arriving' => 'in_progress', 'in_progress' => 'completed'];

/** The status a ride must have before a driver can move it to $next, or null if $next is not a driver step. */
function rideStatusBefore(string $next): ?string
{
    $previous = array_search($next, RIDE_STATUS_STEPS, true);
    return $previous === false ? null : $previous;
}
