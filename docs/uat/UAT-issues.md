# PASAKJA — Issues found during UAT

UAT was first run on 12 November 2026 against the local build (XAMPP: Apache, PHP 8.0, MariaDB 10.4; Vite dev server), driven in Chromium at phone (390×844) and desktop (1440×900) sizes. The first run passed 21 of 24 scenarios, and DEF-01 to DEF-05 below were fixed and retested.

On 21 November 2026 the scenarios were checked against the approved requirements in the project paper (*Software Eng._Pasakja*, Section II). That review and developer testing found DEF-06 to DEF-09, and four scenarios were added (UAT-25 to UAT-28). After the fixes the full suite was re-run from a clean database: **28 of 28 passed** (see `UAT-results.md`).

## Defects found and fixed

| ID | Severity | Found in | Problem | Fix | Retest |
|---|---|---|---|---|---|
| DEF-01 | High | UAT-17 Emergency SOS | Admins could not close an SOS alert (“Mark resolved”), and a passenger could not end their own alert (“I’m safe”). The app called `POST /sos/{id}/resolve`, but the API only answered `POST /sos/{id}`, so every attempt returned “Endpoint not found”. | The API now accepts both addresses. | Pass |
| DEF-02 | Medium | UAT-17 Emergency SOS | For an SOS sent outside a ride, the admin card said “Location not provided” even though the location had been shared (the “Open reported location” link was shown beside it). The label actually showed the ride’s town, which is empty without a ride. | The card shows the ride’s town or the passenger’s home town, their phone number, and “No location shared” only when there are no coordinates. | Pass |
| DEF-03 | Medium | UAT-10 Share live trip | The shared trip page showed a blank grey box instead of the map (the map had no height), and it was always centred on Carrascal. | The map has a fixed height and is centred on the trip’s town; the test now also checks that map tiles load. | Pass |
| DEF-04 | Low | UAT-15 Cancel a booking | After cancelling a booking, the passenger was taken to the ride history instead of Home, where they would book again. | Cancelling (while finding a driver or after one accepted) returns the passenger to Home and the driver to Requests. | Pass |
| DEF-05 | Low | UAT-16 Map pin names | If OpenStreetMap answered slowly once, the pin kept showing coordinates (e.g. “Map pin (9.36947, 125.95181)”) instead of a place name. | Longer wait (6 s), IPv4 connection, and one automatic retry. | Pass |
| DEF-06 | High | Requirements review (FR6) | Admins had no way to suspend a user account, which FR6 requires. | New Dashboard → Accounts tab lists passengers and drivers with Suspend (reason required) and Reactivate. A suspended user is signed out everywhere, drops out of driver matching, and sees the reason when signing in. Refused while the user is on an active ride. Each action is written to the admin activity log. | Pass (UAT-25) |
| DEF-07 | Medium | Requirements review (FR5) | Drivers saw only today’s earnings; FR5 asks for earnings reports. | Driver Profile → Earnings shows fares and ride counts for today, this week (from Monday), this month and all time. | Pass (UAT-26) |
| DEF-08 | Low | Developer testing | A tall profile photo stretched into an oval and spilled outside its circle (72×96 px inside a 72×72 circle). | The photo is pinned to the circle and cropped (`object-fit: cover`), on the Profile page and in the sidebar. Before/after: `before-after/`. | Pass (UAT-22) |
| DEF-09 | Medium | Developer testing | Passengers and drivers could not change their name or phone number after signing up. | Profile → Edit for name, phone, email and home town. A new phone or email needs the current password; a number already used by another account is refused. | Pass (UAT-27) |

The project paper’s earlier evaluation also recorded **TS-10 “System calculates distance using GPS coordinates” — Fail**. Distance and routes now follow the streets (OSRM), confirmed by UAT-09.

## Requirements not yet fully met

| Req. | Status | Plan |
|---|---|---|
| FR5 | Ride and alert notices show in Alerts only while the app is open; no push notifications. | Add browser push notifications. |
| NFR1 | Booking response time (≤ 3 s) not measured. | Week 11 performance test. |
| NFR2 | 100 concurrent users not tested. | Week 11 load test. |
| NFR4 | Passed in Chromium at phone, tablet and desktop sizes; Safari not tested on a real iPhone. | Test on an iPhone (GPS, camera, layout). |
| NFR5 | Local server, no automatic backups. | Week 12 deployment with monitoring and scheduled backups. |

## Observations and recommended improvements

These did not fail a test but should be addressed or noted before real use.

1. **Real-device testing.** UAT ran in a desktop browser imitating phone screens on the local server. GPS over HTTPS, taking a license photo with the camera, and Safari’s layout should be confirmed on real Android and iPhone handsets, and again after deployment.
2. **Beneficiary validation.** Feedback from actual passengers, TODA drivers and administrators is still to be collected (see the questionnaire and acknowledgment forms in the Week 10 report).
3. **Fare rates are samples.** The town fares and between-town fares are still marked “Sample rate”. They should be confirmed with the TODA or LGU and saved in Dashboard → Fares.
4. **Emergency contact numbers are blank.** PNP, MDRRMO and hospital numbers for each town show as “Unconfigured” and should be filled in with verified numbers.
5. **Older demo driver has no license photo.** “Demo Driver” was approved before license photos were required, so the Drivers list shows “Missing”.
6. **Before a public launch:** limit repeated sign-in attempts, add phone-number verification (OTP), and move from the free OpenStreetMap services (map tiles, routing, place names) to a hosted or paid service sized for real traffic.
7. **Driver flow after a trip.** After Complete ride the driver lands on their Rides list. Returning to Requests might let drivers take the next booking faster; worth asking drivers during beneficiary testing.
8. **Driver vehicle details.** Drivers cannot change their plate, body or license number in the app, and admins have no screen for it either. A change request with admin re-approval should be added.
