# Economy — actual formulas and boundaries

All stored monetary values are safe integer cents. Rates use integer basis points (10000 = 100%). Ratios displayed by the UI are derived formatting. Every financial transfer is explicit.

## Wages and households

Initial/new job monthly salary = max(minimumWage, 180000 + skill × 1200) cents. Existing salaries are raised to the policy floor. Monthly cents are split exactly across each 30-day period: floor(salary/30), with one extra cent on the first salary%30 settlement days. Firms pay min(available cash, scheduled daily wage), reducing their cash and crediting the household. Income tax = floor(paid wage × rate / 10000). The tax goes directly to the treasury. Household income is actual daily receipts after withholding, including welfare, not hypothetical contractual income.

Welfare pays unemployed and retired citizens, limited by available treasury cash. Baseline desired daily consumption is 2400 cents per adult / 1600 per child. Actual consumption is limited to available household cash. Municipal housing rent settles after consumption; unpaid rent increments household arrears, without minting cash or crediting unpaid revenue to the government. Arrears are an obligation indicator rather than a bank loan and do not automatically compound or get forgiven. Current net wealth = household cash − arrears. Private citizen pocket reserves are separate initial balances; day-to-day wages/spending use the household pool. Pocket reserves transfer to the household on death.

## Firms and external sector

Household consumption is allocated to active firms in proportion to employees × productivity. Allocation rounds down; unallocated rounding cents, or all spending with no productive firms, become imports.

Export capacity = sum of daily equivalent (260000 + employee skill × 700). Export sales = floor(capacity × productivity × demand × 85 / 100000000). Demand starts at 10000 basis points and moves by seeded −2500..2200 per 30-day update, bounded to 3000..15000. This models an external demand market; revenues are a function of workers, productivity and demand, never a random cash delta.

Operating overhead = 800 + 450 × employeeCount cents/day, capped to available cash. Paid overhead leaves the city as imports. Pretax profit = domestic + export revenues − paid overhead − paid payroll. Corporate tax applies only to positive profit. Company cash pays all these transfers.

Persistent loss days increment on negative profit and recover by two on profitable days. At monthly review, lossDays ≥ 30 and cash < 60 × current daily payroll causes a 20% workforce reduction (rounded up). Positive profits and >120 daily payroll reserves may expand staffing, capped at 30 employees per firm. Exhausted cash, or no workers after >60 loss days, causes bankruptcy. History stays queryable.

## Housing

Municipal units have finite capacity (5 residents), district rent variation and seeded quality. Every 30 days, district occupancy >92% raises rent 1%; occupancy <70% reduces it 1%; otherwise unchanged. Monthly rents are bounded to 15000..200000 cents. Estimated value is 240 × monthly rent. A distressed household seeks a vacant unit with adequate capacity and rent <80% of its current rent. No resident is magically teleported into a non-existent unit.

Construction command creates 1–50 actual units, costs 800000 cents each and is rejected if the treasury cannot afford it. Construction costs are external imports. This is a supply policy rather than a building editor.

## Cash conservation invariant

`treasury + firm cash + household cash + citizen cash = opening city money + exports + financing − imports`.

Financing records seed-generated startup funds and migrants' arrival balances. It does not represent a complete financial sector. Taxes, wages, municipal rent and welfare are internal transfers and cancel in this equation. All benchmark/seed-sweep invariant audits verify it exactly, alongside integer/finite values and reference consistency. This is a deliberately open, simplified economy: no stock market, banks, mortgages, supply-chain inventory, player gifts or individual control.
