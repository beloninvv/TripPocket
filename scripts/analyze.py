#!/usr/bin/env python3
"""Аналитика по экспорту TripPocket (JSON-бэкап v2).

Использование:
  python3 scripts/analyze.py trippocket-backup-2026-07-10.json
  python3 scripts/analyze.py trippocket-import.json --months 6

Файл берётся из приложения: Настройки → Экспорт данных (JSON).
Воспроизводит дашборд эксельки Fin_tracker и добавляет: тренды категорий
месяц-к-месяцу, дни-выбросы, медианный день, прогноз текущего месяца.
Только стандартная библиотека — никаких зависимостей.
"""

import argparse
import json
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

W = 84  # ширина отчёта


def rub(v: float, signed: bool = False) -> str:
    sign = "+" if signed and v >= 0 else ""
    return f"{sign}{v:,.0f} ₽".replace(",", " ")


def pct(v: float) -> str:
    return f"{v * 100:.0f}%"


def bar(share: float, width: int = 20) -> str:
    n = round(share * width)
    return "█" * n + "░" * (width - n)


def title(text: str) -> None:
    print(f"\n{'═' * W}\n  {text}\n{'═' * W}")


def month_label(key: str) -> str:
    names = ["янв", "фев", "мар", "апр", "май", "июн",
             "июл", "авг", "сен", "окт", "ноя", "дек"]
    y, m = key.split("-")
    return f"{names[int(m) - 1]} {y[2:]}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("backup", help="JSON-экспорт из приложения (бэкап v2)")
    ap.add_argument("--months", type=int, default=13, help="месяцев в таблицах")
    args = ap.parse_args()

    data = json.loads(Path(args.backup).expanduser().read_text())
    if data.get("version") != 2:
        sys.exit("Ожидается бэкап версии 2 (экспорт из приложения сборки 10+)")

    home = data.get("homeCurrency", "RUB")
    cats = {c["id"]: c for c in data["categories"]}
    spheres = {s["id"]: s for s in data["spheres"]}
    sphere_order = [s["id"] for s in sorted(data["spheres"], key=lambda s: s["sort_order"])]

    def value(tx) -> float | None:
        if tx.get("amount_home") is not None:
            return tx["amount_home"]
        if tx["currency"] == home:
            return tx["amount"]
        return None

    txs = []
    skipped = 0
    for tx in data["transactions"]:
        v = value(tx)
        if v is None:
            skipped += 1
            continue
        d = datetime.fromtimestamp(tx["spent_at"] / 1000)
        txs.append({**tx, "v": v, "d": d, "mk": d.strftime("%Y-%m")})
    exp = [t for t in txs if t["type"] == "expense"]
    inc = [t for t in txs if t["type"] == "income"]

    now = datetime.now()
    cur_mk = now.strftime("%Y-%m")
    months = sorted({t["mk"] for t in txs})

    # ── 1. Сводка ────────────────────────────────────────────────────────
    total_exp = sum(t["v"] for t in exp)
    total_inc = sum(t["v"] for t in inc)
    title(f"TripPocket · {len(txs)} записей · {months[0]} … {months[-1]}")
    print(f"  Доходы      {rub(total_inc):>15}")
    print(f"  Расходы     {rub(total_exp):>15}")
    print(f"  Накопления  {rub(total_inc - total_exp):>15}   "
          f"({pct((total_inc - total_exp) / total_inc) if total_inc else '—'} доходов)")
    for sid in sphere_order:
        s_total = sum(t["v"] for t in exp if t.get("sphere_id") == sid)
        if s_total:
            print(f"    {spheres[sid]['name']:<14}{rub(s_total):>15}   "
                  f"{pct(s_total / total_exp)}")
    no_sphere = sum(t["v"] for t in exp if not t.get("sphere_id"))
    if no_sphere:
        print(f"    {'Без сферы':<14}{rub(no_sphere):>15}")
    if skipped:
        print(f"  ⚠ пропущено записей без курса: {skipped}")

    # ── 2. Помесячная таблица (как в экселе) ─────────────────────────────
    by_month_sphere: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    inc_by_month: dict[str, float] = defaultdict(float)
    for t in exp:
        by_month_sphere[t["mk"]][t.get("sphere_id") or "-"] += t["v"]
    for t in inc:
        inc_by_month[t["mk"]] += t["v"]

    def days_in(mk: str) -> int:
        y, m = int(mk[:4]), int(mk[5:])
        if mk == cur_mk:
            return now.day
        nxt = datetime(y + m // 12, m % 12 + 1, 1)
        return (nxt - datetime(y, m, 1)).days

    title("По месяцам")
    heads = [spheres[s]["name"][:6] for s in sphere_order]
    print(f"  {'':<7}" + "".join(f"{h:>9}" for h in heads)
          + f"{'в день':>8}{'расход':>10}{'доход':>10}{'дельта':>10}{'накоп':>7}")
    for mk in months[-args.months:]:
        row = by_month_sphere.get(mk, {})
        e = sum(row.values())
        i = inc_by_month.get(mk, 0)
        daily = row.get("sphere_daily", 0) / days_in(mk)
        cells = "".join(f"{row.get(s, 0) / 1000:>8.0f}к" for s in sphere_order)
        savings = pct((i - e) / i) if i > 0 else "  —"
        mark = " ←" if mk == cur_mk else ""
        print(f"  {month_label(mk):<7}{cells}{daily:>8.0f}"
              f"{e / 1000:>9.0f}к{i / 1000:>9.0f}к{(i - e) / 1000:>+9.0f}к{savings:>7}{mark}")

    # ── 3. Категории повседневных (весь период) ──────────────────────────
    daily_exp = [t for t in exp if t.get("sphere_id") == "sphere_daily"]
    if daily_exp:
        title("Повседневные по категориям (весь период)")
        by_cat: dict[str, float] = defaultdict(float)
        cnt: dict[str, int] = defaultdict(int)
        for t in daily_exp:
            by_cat[t["category_id"]] += t["v"]
            cnt[t["category_id"]] += 1
        s_total = sum(by_cat.values())
        for cid, v in sorted(by_cat.items(), key=lambda kv: -kv[1]):
            name = cats.get(cid, {}).get("name", cid)
            print(f"  {name:<18}{bar(v / s_total)} {pct(v / s_total):>4} "
                  f"{rub(v):>13}   ⌀ {rub(v / cnt[cid])}")

    # ── 4. Дни недели (повседневные) ─────────────────────────────────────
    if daily_exp:
        title("Повседневные по дням недели")
        wd_names = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]
        by_wd = [0.0] * 7
        for t in daily_exp:
            by_wd[t["d"].weekday()] += t["v"]
        s_total = sum(by_wd)
        for i, v in enumerate(by_wd):
            print(f"  {wd_names[i]}  {bar(v / max(by_wd))} {pct(v / s_total):>4} {rub(v):>13}")
        wk = sum(by_wd[:5]); we = sum(by_wd[5:])
        print(f"  Будни {pct(wk / s_total)} · Выходные {pct(we / s_total)}")

    # ── 5. Лимиты (текущий месяц) ────────────────────────────────────────
    lim_lines = []
    for sid in sphere_order:
        s = spheres[sid]
        cur = by_month_sphere.get(cur_mk, {}).get(sid, 0)
        if s.get("daily_limit"):
            avg = cur / now.day
            flag = "⚠ ЛИМИТ ПРЕВЫШЕН — пора экономить" if avg > s["daily_limit"] else "✓ в норме"
            lim_lines.append(f"  {s['name']}: ⌀ {rub(avg)}/день при лимите "
                             f"{rub(s['daily_limit'])}/день — {flag}")
        if s.get("monthly_limit"):
            flag = "⚠ превышен" if cur > s["monthly_limit"] else "✓ в норме"
            lim_lines.append(f"  {s['name']}: {rub(cur)} из {rub(s['monthly_limit'])} за месяц — {flag}")
    if lim_lines:
        title(f"Лимиты · {month_label(cur_mk)}")
        print("\n".join(lim_lines))

    # ── 6. Тренды категорий месяц-к-месяцу ───────────────────────────────
    full_months = [m for m in months if m != cur_mk]
    if len(full_months) >= 4:
        last, prev3 = full_months[-1], full_months[-4:-1]
        by_cat_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for t in daily_exp:
            by_cat_month[t["category_id"]][t["mk"]] += t["v"]
        moves = []
        for cid, mm in by_cat_month.items():
            base = sum(mm.get(m, 0) for m in prev3) / 3
            cur_v = mm.get(last, 0)
            if base >= 1000 or cur_v >= 1000:
                moves.append((cid, base, cur_v, cur_v - base))
        moves.sort(key=lambda x: -abs(x[3]))
        title(f"Тренды повседневных: {month_label(last)} против среднего за 3 мес. до")
        for cid, base, cur_v, diff in moves[:8]:
            name = cats.get(cid, {}).get("name", cid)
            arrow = "▲" if diff > 0 else "▼"
            rel = f" ({pct(diff / base) if base else 'новое'})"
            print(f"  {arrow} {name:<18}{rub(base):>12} → {rub(cur_v):>12}"
                  f"  {rub(diff, signed=True):>12}{rel}")

    # ── 7. Аномалии за 90 дней ───────────────────────────────────────────
    recent = [t for t in exp if (now - t["d"]).days <= 90]
    if recent:
        title("Аномалии за 90 дней")
        top = sorted(recent, key=lambda t: -t["v"])[:5]
        print("  Самые крупные траты:")
        for t in top:
            name = cats.get(t["category_id"], {}).get("name", "?")
            note = f" — {t['note']}" if t.get("note") else ""
            print(f"    {t['d']:%d.%m}  {rub(t['v']):>12}  {name}{note[:40]}")
        by_day: dict[str, float] = defaultdict(float)
        for t in recent:
            if t.get("sphere_id") == "sphere_daily":
                by_day[t["d"].strftime("%d.%m")] += t["v"]
        if len(by_day) >= 7:
            vals = list(by_day.values())
            mean, sd = statistics.mean(vals), statistics.pstdev(vals)
            spikes = sorted(((d, v) for d, v in by_day.items() if v > mean + 2 * sd),
                            key=lambda kv: -kv[1])
            med = statistics.median(vals)
            print(f"  Повседневный день: медиана {rub(med)}, среднее {rub(mean)}")
            if spikes:
                print("  Дни-выбросы (среднее + 2σ):")
                for d, v in spikes[:5]:
                    print(f"    {d}  {rub(v):>12}")

    # ── 8. Прогноз текущего месяца ───────────────────────────────────────
    cur_daily = by_month_sphere.get(cur_mk, {}).get("sphere_daily", 0)
    if cur_daily and now.day >= 3:
        y, m = now.year, now.month
        dim = ((datetime(y + m // 12, m % 12 + 1, 1)) - datetime(y, m, 1)).days
        run_rate = cur_daily / now.day * dim
        hist = [by_month_sphere[mk].get("sphere_daily", 0) for mk in full_months[-3:]]
        title(f"Прогноз повседневных · {month_label(cur_mk)}")
        print(f"  Потрачено за {now.day} дн.: {rub(cur_daily)} → прогноз на месяц: {rub(run_rate)}")
        if hist:
            avg3 = sum(hist) / len(hist)
            diff = run_rate - avg3
            print(f"  Средний месяц (3 последних полных): {rub(avg3)} "
                  f"({rub(diff, signed=True)} к прогнозу)")
    print()


if __name__ == "__main__":
    main()
