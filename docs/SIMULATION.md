# Daily simulation contract

Version: 0.1.0. Day 0 contains the generated population and documented starting facts. One tick is one day; a year is 365 days. Economic settlement periods are 30 days (not Gregorian months). UI Y01 D001 is canonical day zero.

Fixed order (tested):

1. Calendar: increment day.
2. Demography: adulthood, retirement, mortality, capacity-limited births.
3. Household: reset daily flows and release empty households' housing.
4. Employment: weekly deterministic matching, qualified voluntary exits.
5. Income: employer-funded wages, withholding tax.
6. Government: treasury-limited welfare for unemployed/retired residents.
7. Expense: affordable consumption, paid municipal rent and rental arrears.
8. Company: realized export sales, operating costs, profit tax, layoffs, insolvency and quarterly formation.
9. Housing: monthly occupancy-based rent and affordability-driven relocation.
10. Relationship: rebuild current coworker edges monthly; keep seeded families/friendships.
11. Migration: vacant-home/job-driven arrivals and severe-hardship departures.
12. Metrics: derive actual current counts and financial summaries.
13. Event aggregation: append actual 30-day metric snapshots.

This order differs intentionally from the suggested pipeline: current-day household consumption is distributed before business solvency decisions, so wages, sales and profits have an explicit settlement order. Changing it changes simulation semantics and requires a version bump.

Initial generator creates four districts, approximately population/2.5 households, finite vacant/occupied housing and population/12.5 companies (minimum eight). At 250 residents this gives 100 households, 20 companies and 116 units. Seeded name pools generate people; birthdays, traits, skills, age mix, company capacity and district rents vary deterministically. Initial family/spouse/friend edges are starting conditions, not invented historical marriage stories. Initial citizen arrivals, occupancy, firm formation and employment assignments are explicit Day-0 events. There are no fabricated earlier biographies.

Age is derived from birthDay. Labor age is 18–64. Retirement/death/migration release employment. Mortality is age-dependent monthly probability, not a fixed population decrement. Births require a living spouse, suitable parental age, savings and housing capacity, with recorded parent-child relationships. Migration adds external arrival funds to the financing ledger. Archived persons are retained to keep all references valid. Empty households retain historical finances but leave current household metrics.

Initial children are generated young enough that every seeded parent is at least 18 years older. The invariant checker enforces this biological age ordering for all recorded parent links. Newly arrived adults receive a birthday relative to their arrival day, not a fixed Day-0 age.

Employment allocates real job slots to real available workers. New vacancies derive from target staffing, profits/reserves and persistent losses. Company demand follows bounded seeded export demand changes every 30 days. Layoffs derive from persistent negative profits and low payroll reserves; bankruptcy derives from exhausted cash or sustained loss with no workers. Founders are ambitious job seekers under a population-scaled active-firm limit. Startup capital is explicit external financing, not an unrecorded money increment.

Event effects record cause IDs: COMPANY_LAYOFF/BANKRUPT → CITIZEN_FIRED → HOUSEHOLD_INCOME_DROP → RENT_DEFAULT → HOUSEHOLD_MOVED. Event refs support citizen, family, company and city histories. Template news has no independent RNG or truth mutations. No romance, elections, crime, supply chains, transport, banking, sophisticated education or healthcare lifecycle is implemented in Phase 1.
