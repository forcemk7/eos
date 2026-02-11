'use client'

import { useState, useEffect } from 'react'

function clamp(value: number, min: number | null, max: number | null): number {
  if (Number.isNaN(value)) return NaN
  if (min != null && value < min) return min
  if (max != null && value > max) return max
  return value
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '–'
  if (value <= 0) return '$0'
  const abs = Math.abs(value)

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  })

  return formatter.format(value)
}

function formatNumber(value: number, options: { maxFractionDigits?: number } = {}): string {
  if (!Number.isFinite(value)) return '–'
  const { maxFractionDigits = 1 } = options
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  })
  return formatter.format(value)
}

interface Model {
  hoursPerDay: number
  hoursPerWeek: number
  hoursPerMonth: number
  hoursPerYear: number
  incomePerMonthGross: number
  incomePerYearGross: number
  incomePerMonthNet: number
  incomePerYearNet: number
  hourlyRateGross: number
  hourlyRateNet: number
}

export default function RatesTab() {
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(6)
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState(5)
  const [weeksPerYear, setWeeksPerYear] = useState(48)
  const [minIncomePerMonth, setMinIncomePerMonth] = useState(4000)
  const [taxRate, setTaxRate] = useState(30)
  const [errors, setErrors] = useState<string[]>([])
  const [model, setModel] = useState<Model | null>(null)

  function validateInputs(inputs: {
    maxHoursPerDay: number
    workingDaysPerWeek: number
    weeksPerYear: number
    minIncomePerMonth: number
    taxRate: number
  }): string[] {
    const errs: string[] = []

    if (!(inputs.maxHoursPerDay > 0)) {
      errs.push('Max hours per day must be greater than 0.')
    }
    if (!(inputs.workingDaysPerWeek > 0 && inputs.workingDaysPerWeek <= 7)) {
      errs.push('Working days per week should be between 1 and 7.')
    }
    if (!(inputs.weeksPerYear > 0 && inputs.weeksPerYear <= 52)) {
      errs.push('Working weeks per year should be between 1 and 52.')
    }
    if (!(inputs.minIncomePerMonth >= 0)) {
      errs.push('Minimum income per month cannot be negative.')
    }
    if (!(inputs.taxRate >= 0 && inputs.taxRate <= 90 && Number.isFinite(inputs.taxRate))) {
      errs.push('Tax rate should be between 0% and 90%.')
    }

    return errs
  }

  function computeModel(inputs: {
    maxHoursPerDay: number
    workingDaysPerWeek: number
    weeksPerYear: number
    minIncomePerMonth: number
    taxRate: number
  }): Model {
    const hoursPerWeek = inputs.maxHoursPerDay * inputs.workingDaysPerWeek
    const hoursPerYear = inputs.maxHoursPerDay * inputs.workingDaysPerWeek * inputs.weeksPerYear
    const hoursPerMonth = hoursPerYear / 12

    const incomePerMonthGross = inputs.minIncomePerMonth
    const incomePerYearGross = incomePerMonthGross * 12

    const taxFraction = inputs.taxRate / 100
    const incomePerMonthNet = incomePerMonthGross * (1 - taxFraction)
    const incomePerYearNet = incomePerYearGross * (1 - taxFraction)

    const hourlyRateGross = hoursPerMonth > 0 ? incomePerMonthGross / hoursPerMonth : NaN
    const hourlyRateNet = hoursPerMonth > 0 ? incomePerMonthNet / hoursPerMonth : NaN

    return {
      hoursPerDay: inputs.maxHoursPerDay,
      hoursPerWeek,
      hoursPerMonth,
      hoursPerYear,
      incomePerMonthGross,
      incomePerYearGross,
      incomePerMonthNet,
      incomePerYearNet,
      hourlyRateGross,
      hourlyRateNet,
    }
  }

  function recalculate() {
    const rawInputs = {
      maxHoursPerDay,
      workingDaysPerWeek,
      weeksPerYear,
      minIncomePerMonth,
      taxRate,
    }

    const inputs = {
      maxHoursPerDay: clamp(rawInputs.maxHoursPerDay, 0, 24),
      workingDaysPerWeek: clamp(rawInputs.workingDaysPerWeek, 1, 7),
      weeksPerYear: clamp(rawInputs.weeksPerYear, 1, 52),
      minIncomePerMonth: clamp(rawInputs.minIncomePerMonth, 0, null),
      taxRate: clamp(rawInputs.taxRate, 0, 90),
    }

    const errs = validateInputs(inputs)
    if (errs.length) {
      setErrors(errs)
      return
    }

    setErrors([])
    const computed = computeModel(inputs)
    setModel(computed)
  }

  useEffect(() => {
    recalculate()
  }, [maxHoursPerDay, workingDaysPerWeek, weeksPerYear, minIncomePerMonth, taxRate])

  return (
    <div className="tab-content active">
      <section className="panel panel-input">
        <h2>Your constraints</h2>
        <p className="panel-subtitle">
          Start from your reality: how much time you're willing to sell, and what you need to receive.
        </p>

        <div className="field-group">
          <label htmlFor="maxHoursPerDay">Max hours per day you're willing to work</label>
          <div className="field-inline">
            <input
              id="maxHoursPerDay"
              type="number"
              min="0"
              step="0.25"
              value={maxHoursPerDay}
              onChange={(e) => setMaxHoursPerDay(parseFloat(e.target.value) || 0)}
            />
            <span className="field-suffix">hours / day</span>
          </div>
        </div>

        <div className="field-row">
          <div className="field-group">
            <label htmlFor="workingDaysPerWeek">Working days per week</label>
            <div className="field-inline">
              <input
                id="workingDaysPerWeek"
                type="number"
                min="1"
                max="7"
                step="1"
                value={workingDaysPerWeek}
                onChange={(e) => setWorkingDaysPerWeek(parseInt(e.target.value) || 1)}
              />
              <span className="field-suffix">days / week</span>
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="weeksPerYear">Working weeks per year</label>
            <div className="field-inline">
              <input
                id="weeksPerYear"
                type="number"
                min="1"
                max="52"
                step="1"
                value={weeksPerYear}
                onChange={(e) => setWeeksPerYear(parseInt(e.target.value) || 1)}
              />
              <span className="field-suffix">weeks / year</span>
            </div>
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="minIncomePerMonth">Minimum income you want</label>
          <div className="field-inline">
            <span className="field-prefix">$</span>
            <input
              id="minIncomePerMonth"
              type="number"
              min="0"
              step="100"
              value={minIncomePerMonth}
              onChange={(e) => setMinIncomePerMonth(parseFloat(e.target.value) || 0)}
            />
            <span className="field-suffix">per month (pre-tax)</span>
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="taxRate">Estimated tax rate</label>
          <div className="field-inline">
            <input
              id="taxRate"
              type="number"
              min="0"
              max="90"
              step="1"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            />
            <span className="field-suffix">% of income</span>
          </div>
          <p className="hint">
            Rough guess is fine. You're not filing taxes here – you're sanity-checking your story.
          </p>
        </div>

        <button className="primary-button" onClick={recalculate}>
          Recalculate
        </button>
      </section>

      <section className="panel panel-output">
        <h2>Your implied rates</h2>
        <p className="panel-subtitle">
          These numbers are what your constraints are quietly asking the world for.
          You can change the story by changing the inputs.
        </p>

        {errors.length > 0 && (
          <div className="error-box">
            {errors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}

        {model && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Time commitment</h3>
              <div className="stat-main">{formatNumber(model.hoursPerDay, { maxFractionDigits: 2 })}</div>
              <p className="stat-label">hours / day (max)</p>
              <ul className="stat-list">
                <li>{formatNumber(model.hoursPerMonth, { maxFractionDigits: 1 })} hours / month</li>
                <li>{formatNumber(model.hoursPerYear, { maxFractionDigits: 1 })} hours / year</li>
              </ul>
            </div>

            <div className="stat-card">
              <h3>Income expectation</h3>
              <div className="stat-main">{formatCurrency(model.incomePerMonthGross)}</div>
              <p className="stat-label">per month (pre-tax)</p>
              <ul className="stat-list">
                <li>{formatCurrency(model.incomePerYearGross)} per year (pre-tax)</li>
                <li>{formatCurrency(model.incomePerMonthNet)} / month after tax</li>
              </ul>
            </div>

            <div className="stat-card emphasis">
              <h3>Implied hourly rate</h3>
              <div className="stat-main">{formatCurrency(model.hourlyRateGross)}</div>
              <p className="stat-label">per hour (pre-tax)</p>
              <ul className="stat-list">
                <li>{formatCurrency(model.hourlyRateNet)} per hour after tax</li>
                <li>{formatNumber(model.hoursPerMonth, { maxFractionDigits: 1 })} hours / month at this pace</li>
              </ul>
            </div>
          </div>
        )}

        <section className="panel-notes">
          <h3>How to use this</h3>
          <p>
            Treat this as a private lab, not a judgment. If the numbers feel impossible or too low,
            that's a signal: maybe the story, the market, or your constraints need to change.
          </p>
          <p>
            In eOS, you can track different work configurations and see how they perform over time.
            This calculator helps you set your baseline expectations.
          </p>
        </section>
      </section>
    </div>
  )
}
