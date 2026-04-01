export type PlannerMode = 'trip' | 'budget';
export type MeasurementSystem = 'metric' | 'imperial';
export type ThemePreference = 'system' | 'light' | 'dark';
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric';
export type EfficiencyUnit =
  | 'km/l'
  | 'l/100km'
  | 'mpg'
  | 'km/kg'
  | 'mi/kg'
  | 'km/kWh'
  | 'mpge';

export type CountryPreset = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  measurementSystem: MeasurementSystem;
  distanceUnit: 'km' | 'mi';
  speedUnit: 'km/h' | 'mph';
};

export type VehicleProfile = {
  id: string;
  name: string;
  fuelType: FuelType;
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  tankCapacity: number;
  notes?: string;
};

export type TripLeg = {
  id: string;
  label: string;
  distance: number;
  efficiencyValue?: number;
  fuelPrice?: number;
};

export type SavedTrip = {
  id: string;
  date: string;
  routeName: string;
  vehicleId: string;
  fuelType: FuelType;
  totalDistance: number;
  totalFuelUsed: number;
  totalCost: number;
  tollCost: number;
  costPerDistance: number;
  passengerCount: number;
  emissionsKg: number;
  durationHours: number;
};

export type FuelLog = {
  id: string;
  date: string;
  vehicleId: string;
  odometer: number;
  fuelAdded: number;
  cost: number;
  mileage: number;
};

export type PlannerSettings = {
  theme: ThemePreference;
  countryCode: string;
};

export type PlannerState = {
  settings: PlannerSettings;
  vehicles: VehicleProfile[];
  activeVehicleId: string;
  trips: SavedTrip[];
  logs: FuelLog[];
};

export type TripCalculationInput = {
  fuelType: FuelType;
  system: MeasurementSystem;
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  fuelPrice: number;
  avgSpeed: number;
  roundTrip: boolean;
  tollCost: number;
  passengerCount: number;
  tankCapacity: number;
  legs: TripLeg[];
};

export type TripCalculation = {
  totalDistance: number;
  fuelUsed: number;
  totalCost: number;
  costPerDistance: number;
  durationHours: number;
  emissionsKg: number;
  costPerPassenger: number;
  maxRangeOnTank: number;
};

export type BudgetCalculation = {
  budgetDistance: number;
  fuelAmount: number;
  estimatedEmissions: number;
};

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    locale: 'en-IN',
    measurementSystem: 'metric',
    distanceUnit: 'km',
    speedUnit: 'km/h',
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    locale: 'en-US',
    measurementSystem: 'imperial',
    distanceUnit: 'mi',
    speedUnit: 'mph',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    locale: 'en-GB',
    measurementSystem: 'imperial',
    distanceUnit: 'mi',
    speedUnit: 'mph',
  },
  {
    code: 'EU',
    name: 'Europe',
    currency: 'EUR',
    locale: 'en-IE',
    measurementSystem: 'metric',
    distanceUnit: 'km',
    speedUnit: 'km/h',
  },
];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  electric: 'Electric',
};

export const DEFAULT_PRICE_SUGGESTIONS: Record<string, Record<FuelType, number>> = {
  IN: { petrol: 102.5, diesel: 89.6, cng: 79.8, electric: 9.2 },
  US: { petrol: 3.85, diesel: 4.15, cng: 2.75, electric: 0.18 },
  GB: { petrol: 1.54, diesel: 1.61, cng: 1.19, electric: 0.29 },
  EU: { petrol: 1.82, diesel: 1.69, cng: 1.14, electric: 0.31 },
};

const GALLON_TO_LITER = 3.78541;
const CO2_PER_LITER = { petrol: 2.31, diesel: 2.68 };

export function getCountryPreset(code: string) {
  return COUNTRY_PRESETS.find((preset) => preset.code === code) ?? COUNTRY_PRESETS[0];
}

export function getDistanceUnit(system: MeasurementSystem) {
  return system === 'metric' ? 'km' : 'mi';
}

export function getSpeedUnit(system: MeasurementSystem) {
  return system === 'metric' ? 'km/h' : 'mph';
}

export function getFuelUnit(fuelType: FuelType, system: MeasurementSystem) {
  if (fuelType === 'electric') return 'kWh';
  if (fuelType === 'cng') return 'kg';
  return system === 'metric' ? 'L' : 'gal';
}

export function getEfficiencyOptions(
  fuelType: FuelType,
  system: MeasurementSystem,
): EfficiencyUnit[] {
  if (fuelType === 'electric') return system === 'metric' ? ['km/kWh'] : ['mpge'];
  if (fuelType === 'cng') return system === 'metric' ? ['km/kg'] : ['mi/kg'];
  return system === 'metric' ? ['km/l', 'l/100km'] : ['mpg'];
}

export function formatCurrency(value: number, preset: CountryPreset) {
  return new Intl.NumberFormat(preset.locale, {
    style: 'currency',
    currency: preset.currency,
    maximumFractionDigits: preset.currency === 'INR' ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, digits = 1, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function normalizePositiveNumber(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function distanceToMetric(distance: number, system: MeasurementSystem) {
  return system === 'metric' ? distance : distance * 1.60934;
}

function distanceToImperial(distance: number, system: MeasurementSystem) {
  return system === 'imperial' ? distance : distance * 0.621371;
}

function estimateFuelUsed(
  distance: number,
  system: MeasurementSystem,
  efficiencyValue: number,
  efficiencyUnit: EfficiencyUnit,
) {
  if (!(distance > 0 && efficiencyValue > 0)) return 0;

  const distanceKm = distanceToMetric(distance, system);
  const distanceMiles = distanceToImperial(distance, system);

  switch (efficiencyUnit) {
    case 'km/l':
    case 'km/kg':
    case 'km/kWh':
      return distanceKm / efficiencyValue;
    case 'l/100km':
      return (distanceKm * efficiencyValue) / 100;
    case 'mpg':
    case 'mi/kg':
      return distanceMiles / efficiencyValue;
    case 'mpge':
      return (distanceMiles / efficiencyValue) * 33.7;
  }
}

export function estimateEmissionsKg(
  fuelType: FuelType,
  fuelUsed: number,
  system: MeasurementSystem,
  efficiencyUnit: EfficiencyUnit,
) {
  if (!(fuelUsed > 0)) return 0;

  if (fuelType === 'petrol') {
    const liters = efficiencyUnit === 'mpg' || system === 'imperial' ? fuelUsed * GALLON_TO_LITER : fuelUsed;
    return liters * CO2_PER_LITER.petrol;
  }

  if (fuelType === 'diesel') {
    const liters = efficiencyUnit === 'mpg' || system === 'imperial' ? fuelUsed * GALLON_TO_LITER : fuelUsed;
    return liters * CO2_PER_LITER.diesel;
  }

  if (fuelType === 'cng') return fuelUsed * 2.75;
  return fuelUsed * 0.82;
}

export function calculateTrip(input: TripCalculationInput): TripCalculation {
  const multiplier = input.roundTrip ? 2 : 1;

  const totals = input.legs.reduce(
    (accumulator, leg) => {
      const legDistance = normalizePositiveNumber(leg.distance) * multiplier;
      const legEfficiency = normalizePositiveNumber(leg.efficiencyValue ?? input.efficiencyValue);
      const legPrice = normalizePositiveNumber(leg.fuelPrice ?? input.fuelPrice);
      const legFuel = estimateFuelUsed(
        legDistance,
        input.system,
        legEfficiency,
        input.efficiencyUnit,
      );

      accumulator.totalDistance += legDistance;
      accumulator.totalFuel += legFuel;
      accumulator.totalCost += legFuel * legPrice;
      return accumulator;
    },
    { totalDistance: 0, totalFuel: 0, totalCost: 0 },
  );

  const durationHours =
    input.avgSpeed > 0 ? totals.totalDistance / normalizePositiveNumber(input.avgSpeed) : 0;
  const totalCostWithTolls = totals.totalCost + normalizePositiveNumber(input.tollCost);
  const tankRange = calculateBudget({
    budget: normalizePositiveNumber(input.tankCapacity) * normalizePositiveNumber(input.fuelPrice),
    system: input.system,
    efficiencyValue: input.efficiencyValue,
    efficiencyUnit: input.efficiencyUnit,
    fuelPrice: input.fuelPrice,
    fuelType: input.fuelType,
  }).budgetDistance;

  return {
    totalDistance: totals.totalDistance,
    fuelUsed: totals.totalFuel,
    totalCost: totalCostWithTolls,
    costPerDistance: totals.totalDistance > 0 ? totalCostWithTolls / totals.totalDistance : 0,
    durationHours,
    emissionsKg: estimateEmissionsKg(
      input.fuelType,
      totals.totalFuel,
      input.system,
      input.efficiencyUnit,
    ),
    costPerPassenger:
      input.passengerCount > 0 ? totalCostWithTolls / input.passengerCount : totalCostWithTolls,
    maxRangeOnTank: tankRange,
  };
}

export function calculateBudget(input: {
  budget: number;
  system: MeasurementSystem;
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  fuelPrice: number;
  fuelType: FuelType;
}): BudgetCalculation {
  const budget = normalizePositiveNumber(input.budget);
  const fuelPrice = normalizePositiveNumber(input.fuelPrice);
  const efficiencyValue = normalizePositiveNumber(input.efficiencyValue);

  if (!(budget > 0 && fuelPrice > 0 && efficiencyValue > 0)) {
    return { budgetDistance: 0, fuelAmount: 0, estimatedEmissions: 0 };
  }

  const fuelAmount = budget / fuelPrice;
  let budgetDistance = 0;

  switch (input.efficiencyUnit) {
    case 'km/l':
    case 'km/kg':
    case 'km/kWh':
    case 'mpg':
    case 'mi/kg':
      budgetDistance = fuelAmount * efficiencyValue;
      break;
    case 'l/100km':
      budgetDistance = (fuelAmount * 100) / efficiencyValue;
      break;
    case 'mpge':
      budgetDistance = (fuelAmount / 33.7) * efficiencyValue;
      break;
  }

  return {
    budgetDistance,
    fuelAmount,
    estimatedEmissions: estimateEmissionsKg(
      input.fuelType,
      fuelAmount,
      input.system,
      input.efficiencyUnit,
    ),
  };
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCurrentMonthTotal(logs: FuelLog[], referenceDate: string) {
  const now = new Date(referenceDate);
  return logs
    .filter((log) => {
      const date = new Date(log.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((total, log) => total + log.cost, 0);
}

export function getCurrentYearTotal(logs: FuelLog[], referenceDate: string) {
  const year = new Date(referenceDate).getFullYear();
  return logs
    .filter((log) => new Date(log.date).getFullYear() === year)
    .reduce((total, log) => total + log.cost, 0);
}

export function getAverageMileage(logs: FuelLog[]) {
  if (!logs.length) return 0;
  return logs.reduce((total, log) => total + log.mileage, 0) / logs.length;
}

export function getTotalDistance(trips: SavedTrip[]) {
  return trips.reduce((total, trip) => total + trip.totalDistance, 0);
}

export function getFuelBreakdown(trips: SavedTrip[]) {
  return (['petrol', 'diesel', 'cng', 'electric'] as FuelType[]).map((fuelType) => ({
    fuelType,
    total: trips
      .filter((trip) => trip.fuelType === fuelType)
      .reduce((total, trip) => total + trip.totalCost, 0),
  }));
}

export function getTrendData(logs: FuelLog[]) {
  return logs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map((log) => ({
      label: new Date(log.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      cost: log.cost,
      mileage: log.mileage,
    }));
}

export const DEFAULT_STATE: PlannerState = {
  settings: { theme: 'system', countryCode: 'IN' },
  vehicles: [
    {
      id: 'vehicle-default',
      name: 'City Hatch',
      fuelType: 'petrol',
      efficiencyValue: 18,
      efficiencyUnit: 'km/l',
      tankCapacity: 35,
      notes: 'Daily commute car',
    },
  ],
  activeVehicleId: 'vehicle-default',
  trips: [],
  logs: [],
};
