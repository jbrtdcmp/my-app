# Ride dispatch algorithm

**Name:** Haversine-based nearest-driver matching with queue fairness.

**Problem it solves:** when a passenger books a tricycle, decide which driver is offered the ride first. Before this algorithm, every online driver saw every waiting request in all five towns, newest first, and the fastest tap won. Drivers far away could take rides, and the passenger who had waited longest sank to the bottom of the list.

**Code:** `api/dispatch_service.php` (the algorithm), used by `GET /rides` and `POST /rides/{id}/accept` in `api/index.php`. Tests: `scripts/dispatch-test.php`, run with `npm run test:dispatch`.

## Inputs

| Input | Source |
| --- | --- |
| Pickup point of the ride (latitude, longitude) | `rides.pickup_lat`, `rides.pickup_lng` |
| How long the ride has been waiting | `rides.requested_at` |
| Each driver's last GPS point and when it was sent | `driver_profiles.last_lat`, `last_lng`, `last_seen_at` (sent every 4 s while the driver is online) |
| How long each driver has waited since their last finished ride | latest `rides.completed_at` for that driver |
| Drivers who declined the ride | `ride_driver_declines` |

## Steps

1. **Find candidates.** Keep drivers who are approved, online (location sent in the last 60 seconds), not on another ride, within 5 km of the pickup, and who have not declined this ride.
2. **Measure distance.** For each candidate, compute the straight-line distance from the driver to the pickup with the Haversine formula.
3. **Rank.** Sort candidates into 300 m distance bands, nearest band first. Inside a band, the driver who has waited longest since their last finished ride goes first, the same rule a TODA terminal queue (*pila*) uses. A driver with no finished ride yet counts as having waited longest.
4. **Offer in turn.** The ride is offered to the top driver first. Every 20 seconds it opens to one more driver in the ranking. If a driver declines, they leave the ranking and the next driver moves up at once.
5. **Fall back.** If no candidate qualifies, or every candidate has had a turn, the ride opens to every approved driver, so no ride is left without a driver to see it.

The server also checks the same rule when a driver taps Accept, so a driver cannot take a ride before it is offered to them.

## Haversine formula

For two points with latitudes φ₁, φ₂ and longitudes λ₁, λ₂ (in radians), and the Earth's radius r = 6,371 km:

```
a = sin²(Δφ / 2) + cos φ₁ · cos φ₂ · sin²(Δλ / 2)
d = 2r · atan2(√a, √(1 − a))
```

## Pseudocode

```
function rankDrivers(ride, drivers, declined):
    ranked = []
    for each driver in drivers:
        if driver in declined: skip
        distance = haversine(driver.location, ride.pickup)
        if distance > 5 km: skip
        ranked.add(driver, distance)
    sort ranked by (floor(distance / 0.3 km) ascending,
                    minutes since last finished ride descending,
                    distance ascending)
    return ranked

function canSee(driver, ranked, secondsWaiting):
    offeredTo = floor(secondsWaiting / 20) + 1        # how many drivers have been offered the ride
    if ranked is empty or offeredTo > size(ranked):
        return true                                    # open to every driver
    return position of driver in ranked < offeredTo
```

## Settings

| Setting | Value | Constant in `api/dispatch_service.php` |
| --- | --- | --- |
| Driver counts as online if their location is newer than | 60 seconds | `DISPATCH_ONLINE_SECONDS` |
| Search radius around the pickup | 5 km | `DISPATCH_RADIUS_KM` |
| Distance band treated as a tie | 300 m | `DISPATCH_TIE_BAND_KM` |
| Time each driver has before the next one is added | 20 seconds | `DISPATCH_OFFER_SECONDS` |

## Worked example

A passenger books from Cantilan town center. Five drivers are online:

| Driver | Distance to pickup | Waited since last ride | Result |
| --- | --- | --- | --- |
| A | 0.10 km | 5 minutes | 2nd (same band as B, waited less) |
| B | 0.20 km | 40 minutes | **1st** (nearest band, waited longest) |
| C | 0.50 km | no rides yet | 3rd |
| D | 1.20 km | 100 minutes | 4th |
| E | 6.00 km | 500 minutes | left out (beyond 5 km) |

B sees the ride at once. A also sees it after 20 seconds, C after 40, and D after 60. At 80 seconds every candidate has had a turn and the ride opens to all approved drivers. If B declines, A becomes first immediately. This example is one of the automated tests.

## Complexity

For *n* online drivers, computing distances is O(*n*) and sorting is O(*n* log *n*). With the few dozen drivers a town has, this takes well under a millisecond.

## How to evaluate it

Compare rides before and after the algorithm using the `rides` and `ride_status_events` tables:

- **Average pickup distance:** distance from the accepting driver to the pickup.
- **Time to accept:** `accepted_at − requested_at`.
- **Acceptance rate:** share of requests accepted within 2 minutes.
- **Fairness:** how evenly rides are spread across drivers, for example the standard deviation of rides per driver per day.

## Limits

- Distance is a straight line, not road distance. It is good for ranking nearby drivers, but a river or a long road can make a "near" driver slower in practice.
- A driver must share GPS to be ranked. A driver without location only sees rides once they open to everyone.
- The offer timing uses the app's 8-second refresh, so a newly offered driver may see the ride up to 8 seconds after their turn starts.
