'use client';

import { useMemo, useState } from 'react';

type Mode = 'trip' | 'budget';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

function toPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function FuelCalculator() {
  const [mode, setMode] = useState<Mode>('trip');
  const [distance, setDistance] = useState('420');
  const [efficiency, setEfficiency] = useState('28');
  const [fuelPrice, setFuelPrice] = useState('3.85');
  const [budget, setBudget] = useState('75');

  const values = useMemo(() => {
    const parsedDistance = toPositiveNumber(distance);
    const parsedEfficiency = toPositiveNumber(efficiency);
    const parsedFuelPrice = toPositiveNumber(fuelPrice);
    const parsedBudget = toPositiveNumber(budget);

    const gallonsNeeded =
      parsedDistance > 0 && parsedEfficiency > 0
        ? parsedDistance / parsedEfficiency
        : 0;
    const tripCost = gallonsNeeded * parsedFuelPrice;
    const drivableDistance =
      parsedBudget > 0 && parsedFuelPrice > 0 && parsedEfficiency > 0
        ? (parsedBudget / parsedFuelPrice) * parsedEfficiency
        : 0;
    const costPerMile =
      parsedFuelPrice > 0 && parsedEfficiency > 0
        ? parsedFuelPrice / parsedEfficiency
        : 0;

    return {
      gallonsNeeded,
      tripCost,
      drivableDistance,
      costPerMile,
    };
  }, [budget, distance, efficiency, fuelPrice]);

  return (
    <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-4 py-8 text-slate-950 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-12">
      <div className="flex flex-col justify-between rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.35),_transparent_34%),linear-gradient(135deg,_#fff7ed_0%,_#ffffff_45%,_#ecfeff_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:p-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              Road Cost Planner
            </span>
            <div className="space-y-3">
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-balance sm:text-5xl">
                Fuel calculator for trip cost, fuel needed, and budget range.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                Estimate how much fuel a drive needs, what it will cost, and how
                far your fuel budget can take you.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-4 ring-1 ring-slate-200 backdrop-blur">
              <p className="text-sm text-slate-500">Trip fuel needed</p>
              <p className="mt-2 text-3xl font-bold">
                {numberFormatter.format(values.gallonsNeeded)} gal
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-lg">
              <p className="text-sm text-slate-300">Estimated trip cost</p>
              <p className="mt-2 text-3xl font-bold">
                {currencyFormatter.format(values.tripCost)}
              </p>
            </div>
            <div className="rounded-3xl bg-teal-950 p-4 text-teal-50 shadow-lg">
              <p className="text-sm text-teal-200">Cost per mile</p>
              <p className="mt-2 text-3xl font-bold">
                {currencyFormatter.format(values.costPerMile)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-[1.5rem] bg-slate-950 p-5 text-slate-50 sm:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Budget range
            </p>
            <p className="mt-2 text-3xl font-bold">
              {numberFormatter.format(values.drivableDistance)} miles
            </p>
          </div>
          <p className="text-sm leading-6 text-slate-300">
            Switch to budget mode to see how far a fixed amount at the pump can
            carry this vehicle.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-8">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('trip')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === 'trip'
                ? 'bg-amber-300 text-slate-950'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            Trip mode
          </button>
          <button
            type="button"
            onClick={() => setMode('budget')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === 'budget'
                ? 'bg-amber-300 text-slate-950'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            Budget mode
          </button>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Distance to drive
            </span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4">
              <input
                inputMode="decimal"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
                className="w-full bg-transparent py-4 text-lg outline-none"
                placeholder="420"
              />
              <span className="text-sm text-slate-400">miles</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Vehicle efficiency
            </span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4">
              <input
                inputMode="decimal"
                value={efficiency}
                onChange={(event) => setEfficiency(event.target.value)}
                className="w-full bg-transparent py-4 text-lg outline-none"
                placeholder="28"
              />
              <span className="text-sm text-slate-400">mpg</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Fuel price
            </span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4">
              <span className="text-sm text-slate-400">$</span>
              <input
                inputMode="decimal"
                value={fuelPrice}
                onChange={(event) => setFuelPrice(event.target.value)}
                className="w-full bg-transparent py-4 pl-3 text-lg outline-none"
                placeholder="3.85"
              />
              <span className="text-sm text-slate-400">/ gal</span>
            </div>
          </label>

          <label className={`block transition ${mode === 'budget' ? 'opacity-100' : 'opacity-70'}`}>
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Fuel budget
            </span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4">
              <span className="text-sm text-slate-400">$</span>
              <input
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                className="w-full bg-transparent py-4 pl-3 text-lg outline-none"
                placeholder="75"
              />
            </div>
          </label>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          {mode === 'trip' ? (
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Trip summary
              </p>
              <p className="text-3xl font-bold text-white">
                {currencyFormatter.format(values.tripCost)}
              </p>
              <p className="text-sm leading-6 text-slate-300">
                You will need about{' '}
                <span className="font-semibold text-white">
                  {numberFormatter.format(values.gallonsNeeded)} gallons
                </span>{' '}
                of fuel for this drive.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Budget summary
              </p>
              <p className="text-3xl font-bold text-white">
                {numberFormatter.format(values.drivableDistance)} miles
              </p>
              <p className="text-sm leading-6 text-slate-300">
                With this budget, you can cover roughly{' '}
                <span className="font-semibold text-white">
                  {numberFormatter.format(values.drivableDistance)} miles
                </span>{' '}
                at the current fuel price.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
