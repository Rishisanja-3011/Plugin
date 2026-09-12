# PLUGIN Renewable Optimization

## Product flow

PLUGIN keeps the existing authentication, station discovery, connector status, booking, charging session, billing, wallet, notification, station-management, and admin workflows. Renewable optimization is integrated into those flows rather than implemented as a separate demo.

1. The driver chooses a real station and available connector in the Android/Expo app.
2. PLUGIN derives charger power and currently available station capacity from those connectors.
3. The backend loads the India grid-region renewable outlook and compares GREENEST, CHEAPEST, FASTEST, and BALANCED windows.
4. Accepting an option updates the existing booking date, time, and duration; the normal conflict-safe booking service remains authoritative.
5. The booking stores the preference and an energy-impact snapshot. The same values follow the booking into the charging session, bill, payment screen, and history.
6. A station operator sees actual configured connector capacity, currently charging load, available capacity, renewable surplus, and peak risk. Accept/defer/reject decisions are persisted and audited.
7. The admin grid-operator persona sees the selected station's actual connector capacity and may publish an audited demand-response signal.

The driver experience is mobile-first. The React web application remains a usable alternative for drivers and hosts the richer station-operator and grid-persona dashboards.

## Architecture

```text
Expo driver app / React web portals
                |
                v
        Spring Security roles
                |
                +--> EnergyController --> RenewableEnergyService
                |                            |--> IndiaEnergyAtlasGridDataProvider
                |                            |--> stale last-successful cache
                |                            `--> explicit demo provider (opt-in only)
                |
                +--> OptimizationController --> ChargingOptimizationService
                |                               `--> normalized regional outlook
                |
                +--> BookingService --> ChargingImpactService
                |                         `--> booking/session/bill snapshot
                |
                +--> OperatorEnergyController --> connector state + decisions
                `--> GridOperatorController ----> capacity outlook + grid signals
```

Third-party credentials remain server-only. No Atlas key is placed in Vite or Expo code.

## India grid data

`IndiaEnergyAtlasGridDataProvider` calls the India Energy Atlas fuel-mix endpoint with `X-API-Key`. It groups state records into product regions:

- `IN-NR`: Northern Region
- `IN-WE`: Western Region
- `IN-SR`: Southern Region
- `IN-ER`: Eastern Region
- `IN-NER`: North Eastern Region

The available endpoint supplies recent hourly state fuel mix, not guaranteed forward dispatch. PLUGIN therefore rolls the latest 24-hour pattern forward and labels it `FORECAST` with quality `ATLAS_24H_PROFILE_DERIVED`. Renewable share is calculated from solar, wind, hydro, small hydro, and biomass. Carbon intensity and tariff are clearly planning estimates.

The backend requests a 48-hour normalized profile once per provider/region cache window and slices it for current, mobile, operator, grid, and optimization requests. The default cache is 900 seconds to stay comfortably within sandbox quotas. Provider failure returns a prior successful value as `STALE`; without prior data, the endpoint returns an error. There is no silent demo substitution.

```text
GRID_DATA_PROVIDER=india-energy-atlas
GRID_DATA_API_KEY=<server-only-key>
GRID_DATA_CACHE_SECONDS=900
```

Use `GRID_DATA_PROVIDER=demo` only for an explicitly identified offline rehearsal.

## Optimization method

The engine limits effective power to the lower of connector power and station available capacity, assumes 92% charging efficiency, and evaluates 30-minute candidate starts within a maximum 48-hour request horizon.

```text
balanced score = 45% renewable availability
               + 25% lower estimated price
               + 20% lower grid load
               + 10% lower waiting time
```

Each alternative includes its schedule, expected renewable share, estimated price, expected carbon, carbon saved versus immediate charging, green score, and plain-language explanation. The existing booking service revalidates station hours, connector availability, overlaps, duration, and deliverable energy before saving anything.

## Authorization

| Capability | Anonymous | Customer | Station operator | Admin/grid persona |
| --- | ---: | ---: | ---: | ---: |
| View regional energy outlook | Yes | Yes | Yes | Yes |
| Request and book optimized charging | No | Yes | No | No |
| View station energy dashboard | No | No | Yes | Yes |
| Record station recommendation decisions | No | No | Yes | Yes |
| View grid-persona dashboard and publish signals | No | No | No | Yes |

The hackathon implementation reuses the existing `ADMIN` role for the grid-operator persona to avoid weakening the established identity model.

## Honest boundaries

- India Energy Atlas data is an external planning input, not a direct connection to GRID-INDIA/SLDC dispatch systems.
- EV-demand forecasting is an explainable time-of-day model, not a claimed machine-learning model.
- Carbon and tariff values are estimates, not certified settlement or carbon-credit accounting.
- Grid signals are persisted operational recommendations; physical charger throttling requires a future OCPP/charger integration.
- If the external service and cache are both unavailable, ordinary station and booking features remain usable, but renewable recommendations are reported unavailable.
