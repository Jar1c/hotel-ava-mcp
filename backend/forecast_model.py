"""
Monthly demand/revenue forecasting for the admin AI Assistant (scikit-learn).

Trains a GradientBoostingRegressor on a gapless monthly history panel built
straight from Supabase bookings:

* build_history() – room-nights occupancy % + revenue for every month spanned
  by the data (cancelled bookings are filtered by the caller). Occupancy uses
  the standard hotel formula: room-nights sold / (rooms x nights in month).
* predict_year()  – 12 monthly predictions for a target year (live forecast).
* backtest()      – rolling-origin validation: for each month with enough
  prior history, retrain using ONLY earlier months and predict the held-out
  month. The published ISO/IEC 25059 accuracy numbers come from this — the
  same pipeline that serves the live chart (credibility: traceable method).

Feature vector per month: [sin(season), cos(season), year offset, lag-1,
mean of up to 3 previous months]. Lags come from observed actuals; past the
last observed month the chain continues with its own predictions.
"""

from __future__ import annotations

import math
from calendar import monthrange
from datetime import datetime, timedelta

from sklearn.ensemble import GradientBoostingRegressor

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Rolling-origin needs at least this many history rows before the first
# origin is tested (below that the model is meaningless — frontend then
# shows "Insufficient data").
MIN_TRAIN_ROWS = 6


def _model() -> GradientBoostingRegressor:
    # Shallow trees + leaf floor keep the model from memorising a ~12-row
    # monthly panel; lag/season features carry most of the signal.
    return GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=2,
        min_samples_leaf=2,
        random_state=42,
    )


def build_history(bookings: list[dict], rooms: list[dict]) -> list[dict]:
    """Gapless monthly panel: occupancy % and revenue per month, all years."""
    total_rooms = max(len(rooms), 1)
    nights: dict[tuple[int, int], int] = {}
    revenue: dict[tuple[int, int], float] = {}
    bounds: list[tuple[int, int]] = []

    for b in bookings:
        try:
            ci = datetime.strptime(b["check_in"][:10], "%Y-%m-%d")
            co = datetime.strptime(b["check_out"][:10], "%Y-%m-%d")
        except (ValueError, KeyError, TypeError):
            continue
        ym = (ci.year, ci.month)
        bounds.append(ym)
        revenue[ym] = revenue.get(ym, 0) + (b.get("total_price") or 0)
        # Room-nights clipped to each calendar month of the stay. Day-use
        # bookings (check_out == check_in) correctly contribute 0 nights.
        d = ci
        while d < co:
            k = (d.year, d.month)
            nights[k] = nights.get(k, 0) + 1
            bounds.append(k)
            d += timedelta(days=1)

    if not bounds:
        return []

    lo, hi = min(bounds), max(bounds)
    panel: list[dict] = []
    y, m = lo
    while (y, m) <= hi:
        dim = monthrange(y, m)[1]
        occ = nights.get((y, m), 0) / (total_rooms * dim) * 100
        panel.append({
            "t": len(panel),
            "year": y,
            "month": m,
            "monthName": MONTH_NAMES[m - 1],
            "occupancy": round(min(occ, 100.0), 2),
            "revenue": round(revenue.get((y, m), 0), 2),
        })
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return panel


def _features(month: int, year: int, lag1: float, roll3: float, base_year: int) -> list[float]:
    ang = 2 * math.pi * (month - 1) / 12
    return [math.sin(ang), math.cos(ang), float(year - base_year), lag1, roll3]


def _lag_roll(values: list[float], i: int) -> tuple[float, float]:
    """lag-1 and rolling mean of up to 3 previous rows (actuals only)."""
    lag = values[i - 1] if i > 0 else values[i]
    if i > 0:
        window = values[max(0, i - 3):i]
        roll = sum(window) / len(window)
    else:
        roll = values[i]
    return lag, roll


def predict_year(history: list[dict], year: int) -> dict[str, list[float]]:
    """Predict occupancy and revenue for the 12 months of `year`."""
    result = {"occupancy": [0.0] * 12, "revenue": [0.0] * 12}
    if not history:
        return result

    base_year = history[0]["year"]
    now = datetime.now()
    cutoff = (now.year, now.month)
    for key in ("occupancy", "revenue"):
        actuals = {(h["year"], h["month"]): h[key] for h in history}
        series = dict(actuals)
        values = [h[key] for h in history]
        global_mean = sum(values) / len(values)

        # Fit on fully-elapsed months only — the current month is partial and
        # future rows are mostly "no bookings yet"; both would teach the model
        # a fake cliff at "today".
        train_idx = [i for i, h in enumerate(history)
                     if (h["year"], h["month"]) < cutoff]
        X = [_features(history[i]["month"], history[i]["year"], *_lag_roll(values, i), base_year)
             for i in train_idx]
        y = [values[i] for i in train_idx]
        model = _model()
        if len(X) >= 3:
            model.fit(X, y)
            predict_fn = lambda row: float(model.predict([row])[0])  # noqa: E731
        else:
            predict_fn = lambda row: float(sum(values) / len(values))  # noqa: E731

        preds: list[float] = []
        for m in range(1, 13):
            # Lags prefer actuals for fully-elapsed months; months not yet
            # over use the model's own prediction instead of partial data.
            def prior_value(key) -> float | None:  # noqa: E306
                if key in actuals and key < cutoff:
                    return actuals[key]
                return series.get(key)

            prev_key = (year - 1, 12) if m == 1 else (year, m - 1)
            lag = prior_value(prev_key)
            if lag is None:
                lag = preds[-1] if preds else global_mean
            if m == 1:
                prior_keys = [(year - 1, mm) for mm in (10, 11, 12)]
            else:
                prior_keys = [(year, mm) for mm in range(max(1, m - 3), m)]
            prior = [v for v in (prior_value(k) for k in prior_keys) if v is not None]
            roll = sum(prior) / len(prior) if prior else lag
            p = predict_fn(_features(m, year, lag, roll, base_year))
            if key == "occupancy":
                p = min(max(p, 0.0), 100.0)
            else:
                p = max(p, 0.0)
            series[(year, m)] = p
            preds.append(p)
        result[key] = preds
    return result


def backtest(history: list[dict], key: str) -> list[dict]:
    """Rolling-origin: train on rows < origin, predict the held-out month.

    Only fully-elapsed months are evaluated — the current month is partial
    and future months have ~no bookings yet, so counting them would grade
    the model against data that does not exist yet.
    """
    points: list[dict] = []
    if len(history) <= MIN_TRAIN_ROWS:
        return points

    now = datetime.now()
    cutoff = (now.year, now.month)
    values = [h[key] for h in history]
    for origin in range(MIN_TRAIN_ROWS, len(history)):
        h = history[origin]
        if (h["year"], h["month"]) >= cutoff:
            break
        X = [_features(history[i]["month"], history[i]["year"],
                       *_lag_roll(values, i), history[0]["year"])
             for i in range(origin)]
        y = values[:origin]
        model = _model()
        if len(X) < 3:
            continue
        model.fit(X, y)
        lag = values[origin - 1]
        window = values[max(0, origin - 3):origin]
        roll = sum(window) / len(window)
        pred = float(model.predict([_features(h["month"], h["year"], lag, roll, history[0]["year"])])[0])
        if key == "occupancy":
            pred = min(max(pred, 0.0), 100.0)
        else:
            pred = max(pred, 0.0)
        points.append({
            "month": h["monthName"],
            "predicted": round(pred, 2),
            "actual": h[key],
        })
    return points
