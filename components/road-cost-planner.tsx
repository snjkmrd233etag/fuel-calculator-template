'use client';

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import {
  ArrowPathIcon,
  BanknotesIcon,
  BoltIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClockIcon,
  CloudIcon,
  CreditCardIcon,
  GlobeAltIcon,
  MoonIcon,
  PlusIcon,
  ShareIcon,
  SunIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import {
  calculateBudget,
  calculateTrip,
  COUNTRY_PRESETS,
  createId,
  DEFAULT_PRICE_SUGGESTIONS,
  DEFAULT_STATE,
  FUEL_TYPE_LABELS,
  formatCurrency,
  formatNumber,
  getAverageMileage,
  getCountryPreset,
  getCurrentMonthTotal,
  getCurrentYearTotal,
  getDistanceUnit,
  getEfficiencyOptions,
  getFuelBreakdown,
  getFuelUnit,
  getSpeedUnit,
  getTotalDistance,
  getTrendData,
  normalizePositiveNumber,
  type EfficiencyUnit,
  type FuelLog,
  type FuelType,
  type PlannerMode,
  type PlannerState,
  type SavedTrip,
  type TripLeg,
  type VehicleProfile,
} from '@/lib/fuel-planner';

const STORAGE_KEY = 'road-cost-planner-v1';

type TripFormState = {
  routeName: string;
  mode: PlannerMode;
  fuelPrice: string;
  avgSpeed: string;
  tollCost: string;
  budget: string;
  passengerCount: string;
  roundTrip: boolean;
  legs: TripLeg[];
};

type VehicleFormState = {
  name: string;
  fuelType: FuelType;
  efficiencyValue: string;
  efficiencyUnit: EfficiencyUnit;
  tankCapacity: string;
  notes: string;
};

type LogFormState = {
  date: string;
  odometer: string;
  fuelAdded: string;
  cost: string;
};

function loadInitialState(): PlannerState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PlannerState>;

    return {
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
      vehicles: parsed.vehicles?.length ? parsed.vehicles : DEFAULT_STATE.vehicles,
      activeVehicleId: parsed.activeVehicleId ?? DEFAULT_STATE.activeVehicleId,
      trips: parsed.trips ?? [],
      logs: parsed.logs ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function getSystemCountryCode() {
  if (typeof navigator === 'undefined') return 'IN';
  const locale = navigator.language.toUpperCase();
  if (locale.includes('US')) return 'US';
  if (locale.includes('GB')) return 'GB';
  if (['DE', 'FR', 'ES', 'IT', 'NL'].some((code) => locale.includes(code))) return 'EU';
  return 'IN';
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getDefaultVehicleForm(countryCode: string): VehicleFormState {
  const system = getCountryPreset(countryCode).measurementSystem;
  const fuelType: FuelType = countryCode === 'IN' ? 'petrol' : 'diesel';

  return {
    name: '',
    fuelType,
    efficiencyValue: '',
    efficiencyUnit: getEfficiencyOptions(fuelType, system)[0],
    tankCapacity: '',
    notes: '',
  };
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-slate-950/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className={classNames('rounded-2xl p-3', accent)}>
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}

function MiniTrendChart({ values, stroke }: { values: number[]; stroke: string }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (value / max) * 88;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function BarChart({
  items,
  formatter,
}: {
  items: { label: string; value: number; tone: string }[];
  formatter: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatter(item.value)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className={classNames('h-full rounded-full transition-[width] duration-500', item.tone)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoadCostPlanner() {
  const [plannerState, setPlannerState] = useState<PlannerState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [shareMessage, setShareMessage] = useState('');
  const [today, setToday] = useState('2026-01-01');

  useEffect(() => {
    const restored = loadInitialState();
    setPlannerState({
      ...restored,
      settings: {
        ...restored.settings,
        countryCode: restored.settings.countryCode || getSystemCountryCode(),
      },
    });
    setToday(getToday());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plannerState));
  }, [isLoaded, plannerState]);

  const preset = getCountryPreset(plannerState.settings.countryCode);
  const activeVehicle =
    plannerState.vehicles.find((vehicle) => vehicle.id === plannerState.activeVehicleId) ??
    plannerState.vehicles[0];
  const system = preset.measurementSystem;
  const distanceUnit = getDistanceUnit(system);
  const speedUnit = getSpeedUnit(system);
  const fuelUnit = getFuelUnit(activeVehicle.fuelType, system);
  const suggestedPrice =
    DEFAULT_PRICE_SUGGESTIONS[preset.code]?.[activeVehicle.fuelType] ?? 0;

  const [tripForm, setTripForm] = useState<TripFormState>({
    routeName: 'Bangalore to Mysore',
    mode: 'trip',
    fuelPrice: String(suggestedPrice || 0),
    avgSpeed: '72',
    tollCost: '0',
    budget: '3000',
    passengerCount: '1',
    roundTrip: false,
    legs: [{ id: 'leg-initial', label: 'Main route', distance: 145 }],
  });
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(() =>
    getDefaultVehicleForm(preset.code),
  );
  const [logForm, setLogForm] = useState<LogFormState>({
    date: '',
    odometer: '',
    fuelAdded: '',
    cost: '',
  });

  useEffect(() => {
    setTripForm((current) => ({
      ...current,
      fuelPrice:
        Number(current.fuelPrice) > 0 ? current.fuelPrice : String(suggestedPrice || ''),
      avgSpeed:
        Number(current.avgSpeed) > 0 ? current.avgSpeed : system === 'metric' ? '72' : '45',
      budget:
        Number(current.budget) > 0 ? current.budget : preset.code === 'IN' ? '3000' : '100',
    }));
    setVehicleForm((current) => ({
      ...current,
      efficiencyUnit: getEfficiencyOptions(current.fuelType, system).includes(
        current.efficiencyUnit,
      )
        ? current.efficiencyUnit
        : getEfficiencyOptions(current.fuelType, system)[0],
    }));
  }, [preset.code, suggestedPrice, system]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark =
      plannerState.settings.theme === 'dark' ||
      (plannerState.settings.theme === 'system' && systemDark);
    root.classList.toggle('dark', shouldUseDark);
  }, [plannerState.settings.theme]);

  useEffect(() => {
    if (!logForm.date && today) {
      setLogForm((current) => ({ ...current, date: today }));
    }
  }, [logForm.date, today]);

  const tripResult = useMemo(
    () =>
      calculateTrip({
        fuelType: activeVehicle.fuelType,
        system,
        efficiencyValue: activeVehicle.efficiencyValue,
        efficiencyUnit: activeVehicle.efficiencyUnit,
        fuelPrice: normalizePositiveNumber(tripForm.fuelPrice),
        avgSpeed: normalizePositiveNumber(tripForm.avgSpeed),
        roundTrip: tripForm.roundTrip,
        tollCost: normalizePositiveNumber(tripForm.tollCost),
        passengerCount: normalizePositiveNumber(tripForm.passengerCount) || 1,
        tankCapacity: activeVehicle.tankCapacity,
        legs: tripForm.legs,
      }),
    [activeVehicle, system, tripForm],
  );

  const budgetResult = useMemo(
    () =>
      calculateBudget({
        budget: normalizePositiveNumber(tripForm.budget),
        system,
        efficiencyValue: activeVehicle.efficiencyValue,
        efficiencyUnit: activeVehicle.efficiencyUnit,
        fuelPrice: normalizePositiveNumber(tripForm.fuelPrice),
        fuelType: activeVehicle.fuelType,
      }),
    [activeVehicle, system, tripForm.budget, tripForm.fuelPrice],
  );

  const monthTotal = useMemo(
    () => getCurrentMonthTotal(plannerState.logs, today),
    [plannerState.logs, today],
  );
  const yearTotal = useMemo(
    () => getCurrentYearTotal(plannerState.logs, today),
    [plannerState.logs, today],
  );
  const averageMileage = useMemo(() => getAverageMileage(plannerState.logs), [plannerState.logs]);
  const totalDistanceDriven = useMemo(
    () => getTotalDistance(plannerState.trips),
    [plannerState.trips],
  );
  const trendData = useMemo(() => getTrendData(plannerState.logs), [plannerState.logs]);
  const fuelBreakdown = useMemo(
    () => getFuelBreakdown(plannerState.trips),
    [plannerState.trips],
  );

  const filteredTrips = useMemo(
    () =>
      plannerState.trips.filter((trip) => {
        const vehicleName =
          plannerState.vehicles.find((vehicle) => vehicle.id === trip.vehicleId)?.name ?? '';
        const routeMatches =
          !historyQuery ||
          trip.routeName.toLowerCase().includes(historyQuery.toLowerCase()) ||
          vehicleName.toLowerCase().includes(historyQuery.toLowerCase());
        const vehicleMatches =
          historyVehicleFilter === 'all' || trip.vehicleId === historyVehicleFilter;
        const tripDate = new Date(trip.date);
        const now = new Date(today);
        const dateMatches =
          historyDateFilter === 'all' ||
          (historyDateFilter === 'month' &&
            tripDate.getMonth() === now.getMonth() &&
            tripDate.getFullYear() === now.getFullYear()) ||
          (historyDateFilter === 'year' && tripDate.getFullYear() === now.getFullYear());
        return routeMatches && vehicleMatches && dateMatches;
      }),
    [
      historyDateFilter,
      historyQuery,
      historyVehicleFilter,
      plannerState.trips,
      plannerState.vehicles,
    ],
  );

  const saveTrip = () => {
    if (!tripResult.totalDistance) return;

    const trip: SavedTrip = {
      id: createId('trip'),
      date: new Date().toISOString(),
      routeName: tripForm.routeName || 'Untitled trip',
      vehicleId: activeVehicle.id,
      fuelType: activeVehicle.fuelType,
      totalDistance: tripResult.totalDistance,
      totalFuelUsed: tripResult.fuelUsed,
      totalCost: tripResult.totalCost,
      tollCost: normalizePositiveNumber(tripForm.tollCost),
      costPerDistance: tripResult.costPerDistance,
      passengerCount: normalizePositiveNumber(tripForm.passengerCount) || 1,
      emissionsKg: tripResult.emissionsKg,
      durationHours: tripResult.durationHours,
    };

    setPlannerState((current) => ({
      ...current,
      trips: [trip, ...current.trips].slice(0, 50),
    }));
  };

  const saveVehicle = () => {
    const efficiencyValue = normalizePositiveNumber(vehicleForm.efficiencyValue);
    const tankCapacity = normalizePositiveNumber(vehicleForm.tankCapacity);
    if (!vehicleForm.name || !efficiencyValue || !tankCapacity) return;

    const vehicle: VehicleProfile = {
      id: createId('vehicle'),
      name: vehicleForm.name,
      fuelType: vehicleForm.fuelType,
      efficiencyValue,
      efficiencyUnit: vehicleForm.efficiencyUnit,
      tankCapacity,
      notes: vehicleForm.notes,
    };

    setPlannerState((current) => ({
      ...current,
      vehicles: [vehicle, ...current.vehicles],
      activeVehicleId: vehicle.id,
    }));
    setVehicleForm(getDefaultVehicleForm(preset.code));
  };

  const saveFuelLog = () => {
    const fuelAdded = normalizePositiveNumber(logForm.fuelAdded);
    const cost = normalizePositiveNumber(logForm.cost);
    const odometer = normalizePositiveNumber(logForm.odometer);
    if (!(fuelAdded && cost && odometer)) return;

    const mileage =
      activeVehicle.efficiencyUnit === 'l/100km'
        ? 100 / activeVehicle.efficiencyValue
        : activeVehicle.efficiencyValue;

    const log: FuelLog = {
      id: createId('log'),
      date: logForm.date,
      vehicleId: activeVehicle.id,
      odometer,
      fuelAdded,
      cost,
      mileage,
    };

    setPlannerState((current) => ({
      ...current,
      logs: [log, ...current.logs].slice(0, 120),
    }));
    setLogForm({ date: today, odometer: '', fuelAdded: '', cost: '' });
  };

  const applySuggestedPrice = () => {
    setTripForm((current) => ({ ...current, fuelPrice: String(suggestedPrice) }));
  };

  const shareTripSummary = async () => {
    const summary = `${tripForm.routeName || 'Trip'}\n${formatNumber(
      tripResult.totalDistance,
      1,
      preset.locale,
    )} ${distanceUnit}, ${formatCurrency(tripResult.totalCost, preset)}, ${formatNumber(
      tripResult.fuelUsed,
      1,
      preset.locale,
    )} ${fuelUnit} of ${FUEL_TYPE_LABELS[activeVehicle.fuelType]}, ${formatNumber(
      tripResult.emissionsKg,
      1,
      preset.locale,
    )} kg CO2`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Road Cost Planner', text: summary });
        setShareMessage('Trip summary shared.');
        return;
      }

      await navigator.clipboard.writeText(summary);
      setShareMessage('Trip summary copied to clipboard.');
    } catch {
      setShareMessage('Sharing was not available.');
    }
  };

  const tips = [
    activeVehicle.fuelType === 'electric'
      ? 'Use lower tariff charging windows to reduce cost per kWh on repeat routes.'
      : 'Steady throttle and correct tyre pressure usually improve mileage more than small route changes.',
    plannerState.logs.length > 2 && averageMileage > 0
      ? `Your logged average is ${formatNumber(averageMileage, 1, preset.locale)} ${activeVehicle.efficiencyUnit}. Watch for sudden drops after service or tyre changes.`
      : 'Start logging fill-ups with odometer readings to unlock meaningful mileage trends.',
    tripResult.emissionsKg > 0
      ? `This route is estimated at ${formatNumber(tripResult.emissionsKg, 1, preset.locale)} kg CO2. Ride-sharing lowers both cost and emissions immediately.`
      : 'Add speed, tolls, and extra legs for a more realistic real-world estimate.',
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_right,_rgba(251,191,36,0.16),_transparent_22%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_45%,_#ffffff_100%)] text-slate-950 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_25%),radial-gradient(circle_at_left,_rgba(245,158,11,0.12),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/30 bg-white/70 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                Premium Road Cost Planner
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Fuel, toll, mileage, budget range, and trip insights in one planner.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                  Built for India and global drivers with multi-unit support, vehicle profiles,
                  trip history, carbon estimates, and lightweight local persistence.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPlannerState((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        theme:
                          current.settings.theme === 'dark'
                            ? 'light'
                            : current.settings.theme === 'light'
                              ? 'system'
                              : 'dark',
                      },
                    }))
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                >
                  {plannerState.settings.theme === 'dark' ? (
                    <MoonIcon className="size-4" />
                  ) : plannerState.settings.theme === 'light' ? (
                    <SunIcon className="size-4" />
                  ) : (
                    <GlobeAltIcon className="size-4" />
                  )}
                  Theme: {plannerState.settings.theme}
                </button>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                  <GlobeAltIcon className="size-4" />
                  <select
                    aria-label="Country preset"
                    value={plannerState.settings.countryCode}
                    onChange={(event) =>
                      setPlannerState((current) => ({
                        ...current,
                        settings: { ...current.settings, countryCode: event.target.value },
                      }))
                    }
                    className="bg-transparent outline-none"
                  >
                    {COUNTRY_PRESETS.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200"
                >
                  <ArrowPathIcon className="size-4" />
                  Current price
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCard
                title="Estimated trip cost"
                value={formatCurrency(tripResult.totalCost, preset)}
                subtitle="Fuel plus tolls for the current route"
                icon={BanknotesIcon}
                accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
              />
              <SummaryCard
                title="Fuel or energy needed"
                value={`${formatNumber(tripResult.fuelUsed, 1, preset.locale)} ${fuelUnit}`}
                subtitle={`${FUEL_TYPE_LABELS[activeVehicle.fuelType]} usage estimate`}
                icon={BoltIcon}
                accent="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"
              />
              <SummaryCard
                title="Budget range"
                value={`${formatNumber(budgetResult.budgetDistance, 1, preset.locale)} ${distanceUnit}`}
                subtitle="How far the selected budget can take this vehicle"
                icon={TruckIcon}
                accent="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
              />
              <SummaryCard
                title="CO2 estimate"
                value={`${formatNumber(tripResult.emissionsKg, 1, preset.locale)} kg`}
                subtitle="Approximate trip emissions"
                icon={CloudIcon}
                accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Calculator
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Trip mode and budget mode
                  </h2>
                </div>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
                  {(['trip', 'budget'] as PlannerMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTripForm((current) => ({ ...current, mode }))}
                      className={classNames(
                        'rounded-full px-4 py-2 text-sm font-medium capitalize transition',
                        tripForm.mode === mode
                          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
                      )}
                    >
                      {mode} mode
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Route name
                  </span>
                  <input
                    aria-label="Route name"
                    value={tripForm.routeName}
                    onChange={(event) =>
                      setTripForm((current) => ({ ...current, routeName: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                    placeholder="Delhi to Jaipur"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Active vehicle
                  </span>
                  <select
                    aria-label="Active vehicle"
                    value={activeVehicle.id}
                    onChange={(event) =>
                      setPlannerState((current) => ({
                        ...current,
                        activeVehicleId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                  >
                    {plannerState.vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} | {FUEL_TYPE_LABELS[vehicle.fuelType]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Efficiency
                  </span>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {formatNumber(activeVehicle.efficiencyValue, 1, preset.locale)}{' '}
                    {activeVehicle.efficiencyUnit}
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Fuel price ({preset.currency}/{fuelUnit})
                  </span>
                  <input
                    aria-label="Fuel price"
                    inputMode="decimal"
                    value={tripForm.fuelPrice}
                    onChange={(event) =>
                      setTripForm((current) => ({ ...current, fuelPrice: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                    placeholder={String(suggestedPrice)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Average speed ({speedUnit})
                  </span>
                  <input
                    aria-label="Average speed"
                    inputMode="decimal"
                    value={tripForm.avgSpeed}
                    onChange={(event) =>
                      setTripForm((current) => ({ ...current, avgSpeed: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                    placeholder={system === 'metric' ? '72' : '45'}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Toll estimate
                  </span>
                  <input
                    aria-label="Toll estimate"
                    inputMode="decimal"
                    value={tripForm.tollCost}
                    onChange={(event) =>
                      setTripForm((current) => ({ ...current, tollCost: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={tripForm.roundTrip}
                    onChange={(event) =>
                      setTripForm((current) => ({
                        ...current,
                        roundTrip: event.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-slate-900"
                  />
                  Round trip
                </label>

                <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <span>Passengers</span>
                  <input
                    aria-label="Passenger count"
                    inputMode="numeric"
                    value={tripForm.passengerCount}
                    onChange={(event) =>
                      setTripForm((current) => ({
                        ...current,
                        passengerCount: event.target.value,
                      }))
                    }
                    className="w-12 bg-transparent text-right outline-none"
                  />
                </label>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Trip legs</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setTripForm((current) => ({
                        ...current,
                        legs: [
                          ...current.legs,
                          {
                            id: createId('leg'),
                            label: `Stop ${current.legs.length + 1}`,
                            distance: 0,
                          },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-white/10 dark:bg-white/5"
                  >
                    <PlusIcon className="size-4" />
                    Add leg
                  </button>
                </div>

                <div className="space-y-3">
                  {tripForm.legs.map((leg, index) => (
                    <div
                      key={leg.id}
                      className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 md:grid-cols-[1fr_0.9fr_0.9fr_auto]"
                    >
                      <label className="space-y-2">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Leg label
                        </span>
                        <input
                          value={leg.label}
                          onChange={(event) =>
                            setTripForm((current) => ({
                              ...current,
                              legs: current.legs.map((item) =>
                                item.id === leg.id
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-slate-950/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Distance ({distanceUnit})
                        </span>
                        <input
                          inputMode="decimal"
                          value={String(leg.distance)}
                          onChange={(event) =>
                            setTripForm((current) => ({
                              ...current,
                              legs: current.legs.map((item) =>
                                item.id === leg.id
                                  ? {
                                      ...item,
                                      distance: Number(event.target.value) || 0,
                                    }
                                  : item,
                              ),
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-slate-950/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Override price
                        </span>
                        <input
                          inputMode="decimal"
                          value={leg.fuelPrice ?? ''}
                          onChange={(event) =>
                            setTripForm((current) => ({
                              ...current,
                              legs: current.legs.map((item) =>
                                item.id === leg.id
                                  ? {
                                      ...item,
                                      fuelPrice: Number(event.target.value) || undefined,
                                    }
                                  : item,
                              ),
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-slate-950/40"
                          placeholder={tripForm.fuelPrice}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() =>
                            setTripForm((current) => ({
                              ...current,
                              legs:
                                current.legs.length === 1
                                  ? current.legs
                                  : current.legs.filter((item) => item.id !== leg.id),
                            }))
                          }
                          className="rounded-full border border-slate-200 px-3 py-3 text-sm font-medium dark:border-white/10"
                          aria-label={`Remove leg ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-[0_18px_60px_rgba(15,23,42,0.3)] dark:bg-white dark:text-slate-950">
                {tripForm.mode === 'trip' ? (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-sm opacity-70">Total fuel</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(tripResult.fuelUsed, 1, preset.locale)} {fuelUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-70">Trip cost</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(tripResult.totalCost, preset)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-70">Cost per {distanceUnit}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(tripResult.costPerDistance, preset)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-70">Travel time</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {tripResult.durationHours
                          ? `${formatNumber(tripResult.durationHours, 1, preset.locale)} h`
                          : 'Add speed'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-sm opacity-70">Fuel budget</span>
                      <input
                        inputMode="decimal"
                        value={tripForm.budget}
                        onChange={(event) =>
                          setTripForm((current) => ({ ...current, budget: event.target.value }))
                        }
                        className="w-full rounded-2xl bg-white/10 px-4 py-3 outline-none dark:bg-slate-900/10"
                      />
                    </label>
                    <div>
                      <p className="text-sm opacity-70">Distance possible</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(budgetResult.budgetDistance, 1, preset.locale)}{' '}
                        {distanceUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-70">Fuel purchasable</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(budgetResult.fuelAmount, 1, preset.locale)} {fuelUnit}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-sm opacity-70">Tank range</p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatNumber(tripResult.maxRangeOnTank, 0, preset.locale)} {distanceUnit}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-70">CO2</p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatNumber(tripResult.emissionsKg, 1, preset.locale)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-70">Split cost</p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatCurrency(tripResult.costPerPassenger, preset)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-70">Mode</p>
                    <p className="mt-2 text-xl font-semibold capitalize">{tripForm.mode}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveTrip}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
                  >
                    Save trip
                  </button>
                  <button
                    type="button"
                    onClick={shareTripSummary}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium"
                  >
                    <ShareIcon className="size-4" />
                    Share summary
                  </button>
                  {shareMessage ? (
                    <p className="self-center text-sm opacity-70">{shareMessage}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Insights
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Cost and mileage dashboard
                  </h2>
                </div>
                <ChartBarSquareIcon className="size-8 text-slate-400" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  title="This month"
                  value={formatCurrency(monthTotal, preset)}
                  subtitle="Fuel spending from logs"
                  icon={CalendarDaysIcon}
                  accent="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white"
                />
                <SummaryCard
                  title="This year"
                  value={formatCurrency(yearTotal, preset)}
                  subtitle="Running total"
                  icon={CreditCardIcon}
                  accent="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white"
                />
                <SummaryCard
                  title="Distance tracked"
                  value={`${formatNumber(totalDistanceDriven, 0, preset.locale)} ${distanceUnit}`}
                  subtitle="Saved trips"
                  icon={TruckIcon}
                  accent="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Fuel cost trend
                      </p>
                      <p className="text-lg font-semibold">
                        {trendData.length ? 'Recent fill-ups' : 'Waiting for fuel logs'}
                      </p>
                    </div>
                    <BanknotesIcon className="size-5 text-slate-400" />
                  </div>
                  <div className="mt-4">
                    <MiniTrendChart
                      values={trendData.length ? trendData.map((item) => item.cost) : [0, 0, 0]}
                      stroke="#0ea5e9"
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {(trendData.length ? trendData : [{ label: '-', cost: 0, mileage: 0 }]).map(
                      (item) => (
                        <div
                          key={item.label}
                          className="rounded-xl bg-white px-2 py-2 dark:bg-slate-900/70"
                        >
                          <p>{item.label}</p>
                          <p className="mt-1 font-medium text-slate-900 dark:text-white">
                            {formatCurrency(item.cost, preset)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cost breakdown by fuel type
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {plannerState.trips.length
                      ? 'Based on saved trip history'
                      : 'Save trips to populate the chart'}
                  </p>
                  <div className="mt-4">
                    <BarChart
                      items={fuelBreakdown.map((item, index) => ({
                        label: FUEL_TYPE_LABELS[item.fuelType],
                        value: item.total,
                        tone: [
                          'bg-sky-500',
                          'bg-emerald-500',
                          'bg-amber-500',
                          'bg-violet-500',
                        ][index],
                      }))}
                      formatter={(value) => formatCurrency(value, preset)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Mileage and tips
                    </p>
                    <p className="text-lg font-semibold">
                      Average logged mileage: {formatNumber(averageMileage, 1, preset.locale)}{' '}
                      {activeVehicle.efficiencyUnit}
                    </p>
                  </div>
                  <ClockIcon className="size-5 text-slate-400" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {tips.map((tip) => (
                    <div
                      key={tip}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300"
                    >
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Vehicle profiles
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Save and switch vehicles fast
                  </h2>
                </div>
                <TruckIcon className="size-8 text-slate-400" />
              </div>

              <div className="mt-5 space-y-3">
                {plannerState.vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() =>
                      setPlannerState((current) => ({
                        ...current,
                        activeVehicleId: vehicle.id,
                      }))
                    }
                    className={classNames(
                      'w-full rounded-[1.5rem] border p-4 text-left transition',
                      vehicle.id === activeVehicle.id
                        ? 'border-sky-300 bg-sky-50 dark:border-sky-400/40 dark:bg-sky-400/10'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-white/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{vehicle.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {FUEL_TYPE_LABELS[vehicle.fuelType]} |{' '}
                          {formatNumber(vehicle.efficiencyValue, 1, preset.locale)}{' '}
                          {vehicle.efficiencyUnit}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                        <p>Tank</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {formatNumber(vehicle.tankCapacity, 1, preset.locale)}{' '}
                          {getFuelUnit(vehicle.fuelType, system)}
                        </p>
                      </div>
                    </div>
                    {vehicle.notes ? (
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        {vehicle.notes}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Vehicle name
                  </span>
                  <input
                    value={vehicleForm.name}
                    onChange={(event) =>
                      setVehicleForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    placeholder="Weekend SUV"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Fuel type
                    </span>
                    <select
                      value={vehicleForm.fuelType}
                      onChange={(event) => {
                        const nextFuelType = event.target.value as FuelType;
                        setVehicleForm((current) => ({
                          ...current,
                          fuelType: nextFuelType,
                          efficiencyUnit: getEfficiencyOptions(nextFuelType, system)[0],
                        }));
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    >
                      {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map((fuelType) => (
                        <option key={fuelType} value={fuelType}>
                          {FUEL_TYPE_LABELS[fuelType]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Efficiency unit
                    </span>
                    <select
                      value={vehicleForm.efficiencyUnit}
                      onChange={(event) =>
                        setVehicleForm((current) => ({
                          ...current,
                          efficiencyUnit: event.target.value as EfficiencyUnit,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    >
                      {getEfficiencyOptions(vehicleForm.fuelType, system).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Average efficiency
                    </span>
                    <input
                      inputMode="decimal"
                      value={vehicleForm.efficiencyValue}
                      onChange={(event) =>
                        setVehicleForm((current) => ({
                          ...current,
                          efficiencyValue: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Tank capacity ({getFuelUnit(vehicleForm.fuelType, system)})
                    </span>
                    <input
                      inputMode="decimal"
                      value={vehicleForm.tankCapacity}
                      onChange={(event) =>
                        setVehicleForm((current) => ({
                          ...current,
                          tankCapacity: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Notes
                  </span>
                  <textarea
                    value={vehicleForm.notes}
                    onChange={(event) =>
                      setVehicleForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    placeholder="Highway-biased estimate, fleet tag, or service note"
                  />
                </label>

                <button
                  type="button"
                  onClick={saveVehicle}
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  Save vehicle profile
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Fuel log
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Track fill-ups and mileage
                  </h2>
                </div>
                <BoltIcon className="size-8 text-slate-400" />
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Date
                    </span>
                    <input
                      type="date"
                      value={logForm.date}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, date: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Odometer ({distanceUnit})
                    </span>
                    <input
                      inputMode="decimal"
                      value={logForm.odometer}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, odometer: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Fuel added ({fuelUnit})
                    </span>
                    <input
                      inputMode="decimal"
                      value={logForm.fuelAdded}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, fuelAdded: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Cost ({preset.currency})
                    </span>
                    <input
                      inputMode="decimal"
                      value={logForm.cost}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, cost: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveFuelLog}
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  Save fuel log
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Trip history
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Search and filter saved trips
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Search route or vehicle"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
              />
              <select
                value={historyVehicleFilter}
                onChange={(event) => setHistoryVehicleFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="all">All vehicles</option>
                {plannerState.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
              <select
                value={historyDateFilter}
                onChange={(event) => setHistoryDateFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="all">All time</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredTrips.length ? (
              filteredTrips.map((trip) => {
                const vehicle =
                  plannerState.vehicles.find((item) => item.id === trip.vehicleId) ??
                  activeVehicle;

                return (
                  <article
                    key={trip.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">{trip.routeName}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {new Date(trip.date).toLocaleDateString(preset.locale)} | {vehicle.name}{' '}
                          | {FUEL_TYPE_LABELS[trip.fuelType]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Total cost
                        </p>
                        <p className="text-2xl font-semibold">
                          {formatCurrency(trip.totalCost, preset)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-5">
                      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Distance
                        </p>
                        <p className="mt-2 font-semibold">
                          {formatNumber(trip.totalDistance, 1, preset.locale)} {distanceUnit}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Fuel
                        </p>
                        <p className="mt-2 font-semibold">
                          {formatNumber(trip.totalFuelUsed, 1, preset.locale)} {fuelUnit}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Time
                        </p>
                        <p className="mt-2 font-semibold">
                          {formatNumber(trip.durationHours, 1, preset.locale)} h
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Per {distanceUnit}
                        </p>
                        <p className="mt-2 font-semibold">
                          {formatCurrency(trip.costPerDistance, preset)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          CO2
                        </p>
                        <p className="mt-2 font-semibold">
                          {formatNumber(trip.emissionsKg, 1, preset.locale)} kg
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                Save trips to build a searchable history by route, date, and vehicle.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Cost splitter
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Share trip cost per passenger
                </h2>
              </div>
              <CreditCardIcon className="size-7 text-slate-400" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Current split: {formatCurrency(tripResult.costPerPassenger, preset)} per passenger
              based on {normalizePositiveNumber(tripForm.passengerCount) || 1} travellers.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Cheapest fuel
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Future live price integration
                </h2>
              </div>
              <GlobeAltIcon className="size-7 text-slate-400" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Placeholder ready for a future station-price or tariff API. The calculator model
              already supports manual current-price updates per leg.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/30 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Privacy
                </p>
                <h2 className="text-xl font-semibold tracking-tight">Local-first persistence</h2>
              </div>
              <GlobeAltIcon className="size-7 text-slate-400" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Vehicles, trips, logs, theme, and country preferences stay in local storage. No
              backend is required for the current release.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
