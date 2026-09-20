# Penny Pilot

## Complete User Manual

### Smart Money Management

This manual is the official Penny Pilot handbook. It explains what Penny Pilot is, how to use every feature, how your financial numbers are calculated, where your information is stored, how security works, and what to do if something goes wrong. It is written for Penny Pilot users, not developers, no technical or configuration knowledge is required to follow it.

---

## Table of Contents

1. [Welcome to Penny Pilot](#part-1-welcome-to-penny-pilot)
2. [Getting Started](#part-2-getting-started)
3. [Understanding the Penny Pilot Home](#part-3-understanding-the-penny-pilot-home)
4. [Understanding Your Money](#part-4-understanding-your-money)
5. [Expenses](#part-5-expenses)
6. [Income](#part-6-income)
7. [Transactions](#part-7-transactions)
8. [Wallets / Accounts](#part-8-wallets-accounts)
9. [Money Sources](#part-9-money-sources)
10. [Categories & Subcategories](#part-10-categories-subcategories)
11. [Budgets](#part-11-budgets)
12. [Investments](#part-12-investments)
13. [Bills & EMIs](#part-13-bills-emis)
14. [Goals](#part-14-goals)
15. [Savings](#part-15-savings)
16. [Analytics](#part-16-analytics)
17. [Reports](#part-17-reports)
18. [Financial Intelligence](#part-18-financial-intelligence)
19. [Search](#part-19-search)
20. [Notifications](#part-20-notifications)
21. [Storage](#part-21-storage)
22. [Backup, Export, Import & Restore](#part-22-backup-export-import-restore)
23. [Settings](#part-23-settings)
24. [Security](#part-24-security)
25. [Account Recovery](#part-25-account-recovery)
26. [Voice Greetings](#part-26-voice-greetings)
27. [Mobile Experience](#part-27-mobile-experience)
28. [Desktop Experience](#part-28-desktop-experience)
29. [How Penny Pilot Calculates Things](#part-29-how-penny-pilot-calculates-things)
30. [Annual Cash Flow](#part-30-annual-cash-flow)
31. [Data Flow](#part-31-data-flow)
32. [What Happens When You Edit or Delete Something](#part-32-what-happens-when-you-edit-or-delete-something)
33. [Error & Troubleshooting Guide](#part-33-error-troubleshooting-guide)
34. [Data & Privacy Explanation](#part-34-data-privacy-explanation)
35. [Limitations](#part-35-limitations)
36. [FAQ](#part-36-faq)
37. [Quick Reference](#part-37-quick-reference)
38. [Glossary](#part-38-glossary)

---

## Part 1: Welcome to Penny Pilot

Penny Pilot is a personal finance application that helps you keep track of your income, expenses, budgets, bills, savings goals, and investments in one place.

**The problem it solves.** Most people track their money across several disconnected places, a banking app, a notes app, a spreadsheet, and memory. Penny Pilot brings all of that into a single dashboard so you can see your whole financial picture at once, instead of piecing it together.

**Who it is for.** Penny Pilot is designed for individuals who want to manually record and understand their own finances, from everyday spending to long-term goals, without connecting their bank accounts to a third party.

**What you can manage in Penny Pilot:**

- Income and expense transactions
- Budgets by category
- Recurring bills and EMIs
- Savings goals
- Investments
- Wallets/accounts and money sources
- Categories and subcategories

**How Penny Pilot brings it together.** Every transaction you record feeds the same underlying data. That same data powers your dashboard, your analytics charts, your reports, and your budget tracking. Everything you see is always based on what you have actually entered, not a separate copy of it.

**Main capabilities at a glance:**

| Area | What you can do |
|---|---|
| Transactions | Record income and expenses with categories, accounts, and money sources |
| Budgets | Set spending limits per category and track usage |
| Bills | Track recurring bills and EMIs with due dates |
| Goals | Set savings targets and track progress |
| Investments | Track investment value, contributions, and gains |
| Analytics & Reports | View spending patterns, trends, and category breakdowns |
| Storage | Choose Google Drive or This Device Only for where your data lives |
| Security | Password login, optional two-factor authentication, and passkeys |

---

## Part 2: Getting Started

Follow these steps the first time you use Penny Pilot.

**1. Open Penny Pilot.** Visit the Penny Pilot website in your browser, on desktop or mobile.

**2. Create an account.** Select **Get Started** or **Sign Up**. Enter your name, email address, and a password. Your account becomes active immediately. There is no waiting period or admin approval step.

**3. Sign in.** After creating your account, sign in with your email and password. You may also add a security question and set up extra protection at this stage.

**4. Complete the initial setup.** Penny Pilot will briefly walk you through where its main features live.

**5. Choose your storage option.** You will be asked how you want your financial data stored:

- **Google Drive**, your data is stored as files inside your own Google Drive.
- **This Device Only (Local-Only)**, your data stays only in this browser, with no external account connection.

You can change this choice later in Settings.

**6. Connect Google Drive (if selected).** If you choose Google Drive, you will be asked to sign in with your Google account and grant Penny Pilot permission to create and use its own dedicated folder in your Drive. See [Part 21: Storage](#part-21-storage) for full details.

**7. Start adding financial information.** Begin by adding an expense or income entry, a wallet/account, and a money source, so your categories and totals have real data to work with.

**8. Review the dashboard.** Open Home/Dashboard to see your totals, cash flow, and category breakdown update immediately as you add information.

> **Tip:** You do not need to set up budgets, bills, goals, or investments before you start. You can add these at any time, Penny Pilot works with whatever information you give it.

---

## Part 3: Understanding the Penny Pilot Home

The Home screen (called the Dashboard on desktop) is your financial overview. Every section below reads from the same underlying data, your transactions, budgets, bills, goals, and investments.

### Greeting

**What it shows:** A time-of-day greeting with your first name.
**Where it comes from:** Your account name and the current time on your device.
**When it changes:** Once per day, and whenever your display name changes.

### Total Net Worth

**What it shows:** A single number representing your overall financial position.
**How it is calculated:** Total Net Worth = Total Savings (all-time income minus all-time expenses) + the current value of your investments.
**When it changes:** Whenever you add, edit, or delete a transaction or an investment.

### Financial Intelligence

**What it shows:** A short list of plain-language observations about your finances, for example, a note about a category where spending has increased, or a reminder about an upcoming bill.
**Where it comes from:** Your own transactions, budgets, bills, goals, and investments.
**How it works:** These are generated by a fixed set of rules that check your real numbers. They are not written by AI and do not use any outside data. If a rule's condition isn't met (for example, there is no overdue bill), that observation simply doesn't appear.
**When it changes:** Every time your underlying financial data changes.

### Income / Expenses (shown as pills on Home)

**What it shows:** Your total income and total expenses.
**Where it comes from:** All your income and expense transactions.
**When it changes:** Immediately after any transaction is added, edited, or deleted.

### Monthly Cash Flow

**What it shows:** This month's income vs. this month's expenses, with a status badge (for example, "On track" or "Overspending").
**How it is calculated:** Monthly income and monthly expenses are totalled separately for the current calendar month, then compared. If both are zero, the status shows "No activity yet."
**When it changes:** As soon as you add a transaction dated in the current month.

### Annual Cash Flow

**What it shows:** This year's total income and expenses, plus a breakdown of where your income has gone (bills, investments, goals, and more).
**Where it comes from:** All transactions dated in the current calendar year, plus your bills, investments, and goals.
**Full explanation:** See [Part 30: Annual Cash Flow](#part-30-annual-cash-flow).

### Category Breakdown

**What it shows:** Your top spending categories for the period shown.
**How it is calculated:** Expense transactions are grouped by category and totalled, then sorted from highest to lowest.
**Example:** If you spent ₹8,000 on Groceries and ₹3,000 on Transport this month, Groceries appears first with a larger share of the breakdown.

### Recent Transactions

**What it shows:** Your most recently added income and expense entries.
**Where it comes from:** Your transaction list, sorted by date, newest first.
**When it changes:** Immediately after you add a new transaction.

### Quick Access

**What it shows:** Shortcuts to quickly add an expense, income entry, budget, investment, or goal without leaving the current screen.

### Insights and Charts

Penny Pilot's Home and Analytics screens use simple bar and line charts to visualize your income, expenses, and category spending over time. Every chart is drawn directly from your transaction history, nothing is pre-filled or simulated.

---

## Part 4: Understanding Your Money

### Income
Money coming in, salary, freelance payments, or any other amount you record as income.

### Expenses
Money going out, anything you spend, recorded as an expense entry.

### Savings
The amount left over after your income and expenses are compared. Penny Pilot does not require a separate "savings" transaction type, your savings figure is derived automatically.

### Net Worth
Penny Pilot calculates Net Worth as:

> **Net Worth = (Total Income − Total Expenses) + Current Investment Value**

This is an all-time figure: it reflects every income and expense transaction you have ever recorded, plus the current value of everything in your Investments list.

### Cash Flow
Penny Pilot uses this formula:

> **Net Cash Flow = Income − Expenses**

This formula is applied over different time windows depending on where you see it:

- **Home's "Cash Flow" figure** looks at the trailing 30 days.
- **Monthly Cash Flow** looks only at the current calendar month.
- **Annual Cash Flow** looks at the current calendar year.

---

## Part 5: Expenses

**Adding an expense:** Select **Add Expense** (from Quick Access, the Expenses page, or the Transactions area), then fill in the amount, date, category, and optionally a wallet/account, money source, merchant, and notes. Select **Save**.

**Editing an expense:** Open the expense from your Expenses or Transactions list and select the edit action. Change any field and save.

**Removing an expense:** Select the delete action on the expense row. You will be asked to confirm before it is permanently removed.

**Fields you can set:**

| Field | Purpose |
|---|---|
| Amount | How much was spent |
| Date | When it happened |
| Category / Subcategory | What kind of expense it is |
| Wallet/Account | Which account the money came from |
| Money Source | How you paid (cash, card, UPI, etc.) |
| Description / Merchant | A note about what it was for |

**What happens after saving:** The expense is added to your records immediately. Your Home totals, Category Breakdown, Monthly and Annual Cash Flow, Analytics charts, Budget usage (if the category has a budget), and Reports all reflect the new expense right away. There is no separate step to "publish" or "sync" it into your dashboard.

---

## Part 6: Income

**Adding income:** Select **Add Income**, then enter the amount, date, category, and optionally a wallet/account, money source, and description. Save to record it.

**Editing or removing income:** Works the same way as expenses, open the entry to edit it, or use the delete action to remove it (with confirmation).

**Fields you can set:** Amount, date, category, wallet/account, money source, and description, the same set of fields expenses use, since income and expenses are both transactions (see [Part 7](#part-7-transactions)).

**Effects of adding income:**

- **Dashboard:** Total Income, Total Savings, and Net Worth update immediately.
- **Cash Flow:** Monthly and Annual Cash Flow both reflect the new income right away.
- **Reports and Analytics:** Income vs. Expense charts and monthly reports update to include it.

---

## Part 7: Transactions

In Penny Pilot, **Income** and **Expenses** are both types of a single underlying record called a **Transaction**. Every transaction has a type, either `INCOME` or `EXPENSE`, plus an amount, date, category, and the other fields described above.

This is why the Income and Expenses pages look and work almost identically: they are the same feature, filtered to show one type of transaction at a time. The **Transactions** view (called **Activity** on mobile) shows both types together.

**How transaction information flows:**

1. **Create**, you fill in the transaction form.
2. **Save**, Penny Pilot validates the entry (for example, the amount must be a positive number) and stores it.
3. **Update financial totals**, your income/expense/savings totals are recalculated from the full set of transactions.
4. **Refresh related views**, Home, Analytics, Budgets, and Reports all re-read the updated totals the next time they are displayed, which in practice is immediately.

---

## Part 8: Wallets / Accounts

A **Wallet** (also labeled **Account** in some places) represents a place your money sits, for example, a bank account, a cash wallet, or a specific savings account.

**Creating a wallet:** Go to Customizations (desktop) or Manage (mobile), select the Wallets tab, and select **Add Wallet**. Give it a name and save.

**Editing a wallet:** Select the edit action next to the wallet and change its name.

**Using it with transactions:** When adding a transaction, you can optionally choose which wallet the money moved through. This field is optional, you are not required to set up wallets before recording transactions.

**Relationship with financial records:** A wallet is a label attached to transactions; it does not hold a separate balance of its own inside Penny Pilot. Its purpose is to let you filter and understand your transactions by where the money moved.

**Where it appears:** Wallets appear as a selectable field on the transaction form, and as a filter option on Analytics.

---

## Part 9: Money Sources

A **Money Source** (also called a **Payment Method**) represents *how* a payment was made, for example, Cash, UPI, Credit Card, or Debit Card.

**How it differs from a Wallet:** A Wallet is *where* the money lives (which account); a Money Source is *how* it moved (which payment method). Penny Pilot keeps these separate because the same wallet can be used through different payment methods, and tracking both gives you a more accurate picture, for example, seeing how much of your spending goes through cards versus cash, independent of which account it came from.

**How it is selected:** Money Source is an optional field on the transaction form, shown alongside Wallet/Account.

**Creating or editing:** Go to Customizations → Money Sources (desktop) or Manage → Money Sources (mobile), and use **Add Money Source** or the edit action.

**Relation to transactions:** Like wallets, money sources are a label on each transaction, used for filtering and analysis, not a separate balance.

---

## Part 10: Categories & Subcategories

**Categories** classify what a transaction is for, for example, Groceries, Transport, or Salary. Each category is marked as either an Income category or an Expense category.

**Subcategories** let you add a more specific label within a category, for example, "Dining Out" under "Food."

**How transactions use them:** Every transaction is assigned exactly one category (subcategory is optional). This is what powers Category Breakdown and category-based budgets.

**How category totals are calculated:** Penny Pilot adds up every transaction assigned to a category, for the period being viewed, to produce that category's total.

**How category breakdowns work:** Categories are sorted by total amount, largest first, so you can immediately see where most of your money is going.

**What users can and cannot change:** You can create new categories and subcategories, and rename existing ones, from Customizations (desktop) or Manage (mobile). A category cannot be deleted if transactions still reference it.

---

## Part 11: Budgets

A budget sets a spending limit for a category over a period (monthly, quarterly, or yearly).

**Creating a budget:**

1. Go to Budget.
2. Select **Add Budget**.
3. Choose the category.
4. Enter the amount (your limit) and the period.
5. Save.

**Viewing spending against a budget:** The Budget screen shows, for each budget: the limit, how much you have actually spent in that category for the period, the remaining amount, and the percentage used.

**Budget status.** Penny Pilot classifies each budget into one of three statuses, based on how much of the limit has been used:

| Status | Meaning | When it applies |
|---|---|---|
| **Under Budget** | You are comfortably within your limit | Usage below 85% |
| **Near Limit** | You are approaching your limit | Usage from 85% up to just under 100% |
| **Over Budget** | You have exceeded your limit | Usage at 100% or more |

**Example:** If your Groceries budget is ₹10,000 and you have spent ₹8,600 this month, that is 86% used, Penny Pilot marks this budget **Near Limit**. If you then spend another ₹1,500, usage is 101%, and the status becomes **Over Budget**.

---

## Part 12: Investments

**Creating an investment:** Go to Investments, select **Add Investment**, and enter the instrument name, category, invested amount, current value, purchase date, and optionally a monthly contribution and expected annual return percentage.

**Contributions:** The monthly contribution field is a value you record yourself (how much you regularly add to this investment), Penny Pilot does not automatically deduct or transfer money.

**Values and gains/losses:** For each investment, Penny Pilot calculates:

> **Profit/Loss = Current Value − Invested Amount**
> **Return (%) = Profit/Loss ÷ Invested Amount × 100**

This is shown per investment and as a portfolio-wide total across all your investments.

**Investment information on the dashboard:** Home's Net Worth figure includes the total current value of your investments. The "Investment Growth" figure on Home compares your current portfolio value against your total recorded monthly contributions, as a simplified indicator of how the portfolio has grown relative to what you have been contributing.

**Annual financial views:** Your investments' monthly contributions (multiplied by 12) are used as one of the segments in the Annual Cash Flow breakdown, see [Part 30](#part-30-annual-cash-flow).

> **Note:** Investment values are what you enter, Penny Pilot does not connect to any brokerage or market-data source to update prices automatically. You are responsible for keeping the current value up to date.

---

## Part 13: Bills & EMIs

**Creating a bill:** Go to Bills & EMI, select **Add Bill**, and enter the name, type (such as EMI, Subscription, Rent, or Utility), due date, and amount. You can optionally mark it as auto-pay and record any amount already paid.

**Recurring information:** Penny Pilot tracks each bill's due date and paid amount; if a bill recurs, you record its next due date the same way, either by editing the existing bill or adding a new due cycle.

**Tracking status:** Each bill is shown as one of the following:

| Status | Meaning |
|---|---|
| **Paid** | The amount paid meets or exceeds the bill amount |
| **Partially Paid** | Some amount has been paid, but not the full amount, and it is not yet overdue |
| **Overdue** | The due date has passed and the bill is not fully paid |
| **Upcoming** | The due date has not yet passed and the bill is not fully paid |

**Editing and deleting:** Both are supported from the Bills screen, open a bill to edit it, or use the delete action (with confirmation) to remove it.

**Dashboard impact:** Upcoming bills (due dates in the future, soonest first) appear in your Home summary. Unpaid bill amounts also feed into the Annual Cash Flow "Bills" segment.

**Reminders/notifications:** Bill-related notifications appear in your Notifications list when relevant (see [Part 20](#part-20-notifications)).

---

## Part 14: Goals

**Creating a goal:** Go to Goals, select **Add Goal**, and enter a name, category (Emergency Fund is a built-in category Penny Pilot recognizes specially, see below), target amount, current amount, and optionally a monthly contribution.

**Progress:** Penny Pilot calculates progress as:

> **Progress (%) = Current Amount ÷ Target Amount**

capped at 100% once you reach or exceed your target.

**Contributions:** The monthly contribution is a value you set yourself to reflect how much you intend to put toward the goal each month; it is not automatically transferred from any account.

**Categories:** You choose a category when creating a goal. If you name a goal's category as an Emergency Fund–type goal, Penny Pilot uses its progress specifically to calculate your Emergency Fund Progress figure on Home and in your Financial Health score.

**Dashboard representation:** Goals with the Emergency Fund category feed the Emergency Fund Progress metric; all goals' monthly contributions feed the Annual Cash Flow breakdown.

**Current limitation:** Goals do not automatically receive money from your transactions, updating a goal's current amount is a manual action.

---

## Part 15: Savings

Penny Pilot does not ask you to create a separate "savings" record. Instead:

> **Savings = Total Income − Total Expenses**

**Where it comes from:** Every income and expense transaction you have recorded.

**How it appears on the dashboard:** As "Total Savings" on Home, and as an input into your Net Worth and Savings Rate figures. The dedicated Savings screen breaks this down further into Total Income, Total Expenses, Total Savings, Savings Rate, and a month-by-month savings trend.

**Relationship to income and expenses:** Because savings is a calculated difference rather than its own record, it always stays exactly consistent with your transaction history. There is nothing to keep "in sync."

**Storage modes:** This calculation works identically whether your data is stored in Google Drive or kept Local-Only, the formula only depends on your transaction records, wherever they are stored.

---

## Part 16: Analytics

The Analytics screen offers a deeper look at your data than Home, with adjustable filters (time range, category, wallet, and money source).

| Chart/Metric | What it represents | Period | Grouping |
|---|---|---|---|
| Key Metrics | Transaction count, income, expenses, savings, averages | Selected range | Totals over the range |
| Income vs. Expense Trend | How income and expenses moved month to month | Selected range | Grouped by month |
| Expense by Category | Which categories you spend the most in | Selected range | Grouped by category |
| Income by Category | Which categories your income comes from | Selected range | Grouped by category |
| Money Sources breakdown | Spending grouped by payment method | Selected range | Grouped by money source |
| Monthly Table | A row-by-row monthly summary | Selected range | Grouped by month |
| Custom Chart Studio | A configurable chart (choose metric, grouping, and visualization) | Daily, weekly, monthly, or year-to-date | Your choice |

**How to interpret it:** Every figure on Analytics is a direct sum or average of your own transactions for the filters you've selected, there is no estimation or projection involved unless you are looking at a trend line you draw conclusions from yourself.

---

## Part 17: Reports

Reports present your data in a more traditional, tabular format, useful for reviewing or exporting.

**Available reports:**

- **Monthly Summary**, income, expenses, and transaction count per month.
- **Category Report**, total spent and transaction count per category.
- **Budget vs. Actual**, your budgeted amount, actual spending, and variance per category.

**Filtering:** Reports reflect your full transaction history unless you use the Analytics screen's filters, which apply the same underlying data with your chosen range and criteria.

**Exports:** From Reports and Settings → Backup, you can download your data as CSV, Excel, JSON, or PDF (see [Part 22](#part-22-backup-export-import-restore)).

**Interpreting totals:** Every total in a report is a direct sum of the underlying transactions for that row, for example, a month's "Income" column is the sum of every income transaction dated in that month.

---

## Part 18: Financial Intelligence

"Financial Intelligence" is the short list of observations shown on your Home screen (see [Part 3](#part-3-understanding-the-penny-pilot-home)).

**What insights are:** Plain-language notes generated from your own financial data, never from anyone else's data, and never from an outside data source.

**What information they use:** Your current dashboard summary, income, expenses, savings rate, budget usage, categories, upcoming bills, and investments.

**Types of observations you may see:**

- Spending observations (for example, a category where spending is notably high)
- Budget observations (approaching or exceeding a limit)
- Savings observations (savings rate trending up or down)
- Recurring/upcoming expense observations (an upcoming bill)
- Income/expense balance observations (spending more than you earn this period)
- Investment observations (contribution or portfolio-related notes)

**Important:** These are rule-based observations, not AI-generated text and not predictions. Each one only appears when your actual numbers meet a specific, fixed condition.

---

## Part 19: Search

Penny Pilot includes a global search, available on both mobile and desktop.

**What you can search:**

- Pages and features within Penny Pilot (for example, typing "budget" surfaces the Budget page)
- Your own transactions, budgets, investments, bills, goals, wallets/accounts, money sources, and categories

**Partial searches and matching:** Search matches on partial text, not just exact matches, for example, searching "groc" can surface a "Groceries" category. It also tolerates small typos and plural/singular differences.

**Suggestions and related results:** Results are grouped by type (Pages, Transactions, Budgets, and so on) so you can quickly scan the kind of result you're looking for.

**Navigation:** Selecting a result takes you directly to the relevant page or record.

**Mobile vs. desktop:** Search is available from the top bar on desktop and from the search icon on mobile; the underlying search behavior is identical on both.

**Privacy of search:** Search only ever looks through information belonging to the account you are signed into. It cannot surface another user's data.

---

## Part 20: Notifications

Penny Pilot generates a small set of notification types based on your activity:

| Type | What it's about |
|---|---|
| Budget Alert | A budget is near or over its limit |
| Bill Due | A bill is coming due or overdue |
| Goal Progress | Progress toward a savings goal |
| Insight | A financial observation worth surfacing |

**Unread/read status:** New notifications appear marked as unread. Opening or acting on one marks it read; you can also mark all as read at once.

**Navigating from a notification:** Selecting a notification takes you to the related page (for example, a bill notification opens Bills).

**Clearing/dismissing:** You can delete an individual notification, or clear all notifications at once, from the Notifications screen.

Penny Pilot also has a separate **Announcements** tab for platform-wide messages (such as maintenance notices), separate from your personal notifications.

---

## Part 21: Storage

Penny Pilot never stores your financial data in its own central database by default. You choose where it lives.

### Google Drive

**Why it's offered:** So your financial data stays in a place you already control and can access independently of Penny Pilot.

**Connecting Google Drive:** During setup, or later from Settings → Storage, choose Google Drive mode and sign in with your Google account, granting Penny Pilot permission to create and use its own folder.

**What happens after connecting:** Penny Pilot creates a dedicated "Penny Pilot" folder in your Google Drive and stores your financial records there as structured data files.

**How Penny Pilot accesses it:** Penny Pilot only requests a restricted level of Google Drive access that lets it see and manage the files it creates itself, it cannot browse, read, or modify the rest of your Google Drive.

**If Drive becomes disconnected:** Penny Pilot shows a "Sync paused" indicator, and further changes are held until you reconnect, your existing data in Drive is not affected.

**Reconnecting:** Go to Settings → Storage and reconnect your Google account.

**Permission problems:** If Penny Pilot's access is revoked (for example, from your Google Account settings), you will need to reconnect and grant access again from Settings.

**Quota problems:** If your Google Drive storage is full, new saves cannot be written until you free up space in your Drive or upgrade your Google storage plan.

**Unavailable service or missing files:** If Google Drive is temporarily unreachable, or Penny Pilot's data folder/files are missing or were moved, Penny Pilot will show a sync error rather than silently losing information; reconnecting or restoring the folder resolves this in most cases.

### Local-Only ("This Device Only")

**What it means:** Your financial data is stored only in this browser's local storage, on this device, no Google account or external service is involved.

**Where it's kept:** Inside your browser's own local storage on this specific device.

**Using another device or browser:** Local-Only data does **not** follow you, opening Penny Pilot in a different browser or on a different device will not show your Local-Only data, because it never left the original browser.

**Limitations:** No cross-device access, and clearing your browser's site data will remove your Penny Pilot data along with it.

**When to prefer this option:** If you want to avoid connecting any external account, or you only ever use Penny Pilot from one browser on one device.

### Comparison

| | Google Drive | Local-Only |
|---|---|---|
| Storage location | Your own Google Drive | This browser, on this device |
| Multi-device access | Yes, the same Google account can be reconnected on another device | No, data stays on the original browser/device only |
| Internet dependency | Requires an internet connection to save/sync | Works fully offline; no internet required |
| Data control | You can inspect, back up, or remove the files directly in your Drive | You control the browser's storage directly; clearing site data removes it |

---

## Part 22: Backup, Export, Import & Restore

| Term | What it means | When to use it | What it affects |
|---|---|---|---|
| **Backup** | Google Drive automatically keeps prior versions of your data files as you use Penny Pilot (Drive mode only) | You want a safety net without doing anything manually | Only applies in Google Drive mode |
| **Export** | Downloading a copy of your data as a file (CSV, Excel, JSON, or PDF) | You want your data outside Penny Pilot, for records, taxes, or your own analysis | Creates a file on your device; does not change your Penny Pilot data |
| **Import** | Bringing data into Penny Pilot from a file | You are moving existing records into Penny Pilot | Adds records to your account |
| **Restore** | Reverting to a previous version of your Drive data | You want to undo recent changes | Only applies in Google Drive mode, using Google Drive's own version history |

**Google Drive mode:** Because Google Drive automatically versions the files Penny Pilot writes, you can restore an earlier version of your data directly from the Storage settings. Export/Import work the same as in Local-Only mode.

**Local-Only mode:** There is no automatic version history, since there is no external service keeping prior copies. Export remains available so you can keep your own manual backups.

---

## Part 23: Settings

| Area | What it covers |
|---|---|
| **Account** | Your name, email, and profile details |
| **Security** | Password changes, two-factor authentication, passkeys |
| **Account Recovery** | Security questions and recovery options |
| **Storage** | Switching between Google Drive and Local-Only, backup/export/import, restore |
| **Preferences** | Appearance (light/dark), currency, and similar display preferences |
| **Voice Greetings** | Turning spoken greetings on or off |
| **Privacy** | Options such as sharing anonymous usage data or analytics |
| **Legal information** | Links to the Privacy Policy and Terms of Service |

Each area is reached from the Settings screen's own tabs, and every change is saved immediately when you select Save on that section.

---

## Part 24: Security

### Password security
Your password is never stored in plain text, it is stored using one-way hashing, so even Penny Pilot cannot see your actual password. This protects your account if the stored data were ever exposed.

### Sessions
Signing in creates a session that keeps you signed in for a period of inactivity you can configure (Session Timeout, in Settings → Security). This protects your account if you step away from a signed-in device.

### Logout
Signing out ends your current session immediately.

### Two-factor authentication (2FA)
Optional. Once enabled, signing in requires a 6-digit code from an authenticator app in addition to your password, protecting your account even if your password is ever discovered by someone else. Backup codes are provided when you enable it, for use if you lose access to your authenticator app.

### Passkeys
Optional. A passkey lets you sign in using your device's own biometric or security-key authentication (such as fingerprint, face recognition, or Windows Hello) instead of typing a password, using the standard WebAuthn technology built into modern browsers and operating systems.

### Account recovery
If you lose access to your password or 2FA method, Penny Pilot provides a recovery path, see [Part 25](#part-25-account-recovery).

### What each feature protects against

| Feature | Protects against |
|---|---|
| Hashed passwords | Your password being exposed even if stored data is compromised |
| Session timeout | Unauthorized use of an unattended signed-in device |
| Two-factor authentication | Account access using only a stolen or guessed password |
| Passkeys | Password theft and phishing, since there is no password to steal |

---

## Part 25: Account Recovery

**When recovery is needed:** You've forgotten your password, or lost access to your two-factor authentication method.

**How to begin:** Select **Forgot password?** on the sign-in screen and enter your account email.

**Verification:** Penny Pilot verifies your request before allowing a password reset.

**Two-factor recovery:** If you have 2FA enabled and cannot access your authenticator app, use one of the backup codes provided when you first set up 2FA, in place of the 6-digit code.

**Recovery codes:** Treat backup codes as sensitive, each one can be used once, and they exist specifically for the situation where your normal 2FA method is unavailable.

**Password reset:** Once verified, you'll be able to set a new password.

**Existing sessions:** Completing a password reset does not automatically end other active sessions; use Settings → Security to review session-related options if you're concerned about a specific device.

**If recovery fails:** If you cannot complete recovery on your own, for example, you've lost both your password and your 2FA backup codes, contact Penny Pilot support using the contact details on the Privacy Policy or Terms of Service page.

---

## Part 26: Voice Greetings

Penny Pilot can play a short spoken greeting at certain moments:

- When you sign up
- When you sign in
- On your very first sign-in after creating your account
- When you sign out

**Enabling/disabling:** This is controlled by a single Voice Greetings preference in Settings, which you can turn on or off at any time.

**Default:** Voice Greetings are supported as an opt-in preference; check Settings to see your current setting.

**If audio is unavailable:** If your browser or device cannot play audio (for example, a restricted permission or unsupported browser), Penny Pilot simply skips the spoken greeting, you'll still see the on-screen greeting text and toast message.

---

## Part 27: Mobile Experience

On mobile, Penny Pilot uses a bottom navigation bar with:

| Tab | What it opens |
|---|---|
| **Home** | Your dashboard overview |
| **Activity** | Your transactions (income and expenses together) |
| **Budget** | Your budgets |
| **Invest** | Your investments |
| **More** | Everything else, Bills, Savings, Goals, Analytics, Reports, Customizations, Notifications, Profile, and Settings |

**Adding a transaction:** A floating **+** button is available from most screens for quickly adding an expense, income, budget, investment, or goal.

**Search:** Reached from the search icon, with the same behavior described in [Part 19](#part-19-search).

**Sheets:** Forms (like adding an expense or a bill) open as a sheet that slides up from the bottom, rather than a separate page, this keeps you in context.

**Safe areas and responsive behavior:** The mobile layout adjusts to your device's screen and safe areas (such as notches) automatically, and the same features are available whether you're using Penny Pilot in a mobile browser or as an installed app.

---

## Part 28: Desktop Experience

On desktop, Penny Pilot uses a persistent sidebar and a top bar instead of bottom navigation.

| Element | Purpose |
|---|---|
| **Sidebar** | Full navigation to every module, Dashboard, Activity, Budget, Invest, Expenses, Income, Bills, Savings, Goals, Analytics, Reports, Customizations, Notifications, Profile, Settings |
| **Topbar** | Quick-add actions, search, notifications, sync status, and your account menu |
| **Dashboard** | The desktop version of Home, laid out with more columns to take advantage of the larger screen |
| **Modules** | Each sidebar destination opens a full page for that feature |
| **Search** | The same global search described in [Part 19](#part-19-search), reached from the top bar |
| **Settings, Reports, Analytics** | Full desktop pages with the same information as their mobile counterparts, laid out for a wider screen |

**Mobile vs. desktop:** Desktop and mobile are the same application and the same data, desktop simply gives every feature more room and reaches it through the sidebar instead of bottom tabs and a "More" menu. Nothing you can do on one is a separate copy of a feature on the other.

---

## Part 29: How Penny Pilot Calculates Things

This chapter documents every major calculation Penny Pilot performs, based on the current application.

### Total Income
**What it means:** All money recorded as income.
**How it is calculated:** The sum of every transaction marked as Income.
**Example:** Three income entries of ₹40,000, ₹5,000, and ₹2,000 give a Total Income of ₹47,000.
**When it changes:** Whenever an income transaction is added, edited, or deleted.

### Total Expenses
**What it means:** All money recorded as spent.
**How it is calculated:** The sum of every transaction marked as Expense.
**When it changes:** Whenever an expense transaction is added, edited, or deleted.

### Savings
**What it means:** What's left after expenses.
**How it is calculated:** Total Income − Total Expenses.
**Example:** Income ₹47,000, Expenses ₹30,000 → Savings ₹17,000.
**When it changes:** Whenever any transaction changes.

### Net Cash Flow
**What it means:** The same idea as Savings, applied to a specific window of time.
**How it is calculated:** Income − Expenses, for the period being shown (30 days, current month, or current year, depending on where it's displayed).

### Net Worth
**What it means:** Your overall financial position.
**How it is calculated:** Savings (all-time) + current total value of your Investments.
**Example:** Savings ₹17,000, Investments currently worth ₹50,000 → Net Worth ₹67,000.
**When it changes:** Whenever a transaction or an investment's current value changes.

### Savings Rate
**What it means:** What share of your income you're keeping.
**How it is calculated:** Savings ÷ Total Income.
**Example:** Savings ₹17,000 on Income ₹47,000 ≈ 36%.

### Monthly Cash Flow
**How it is calculated:** Income and Expenses are each totalled for the current calendar month, then compared.

### Annual Cash Flow
**How it is calculated:** Income and Expenses are each totalled for the current calendar year. See [Part 30](#part-30-annual-cash-flow) for the full breakdown.

### Budget Usage / Remaining / Status
**How it is calculated:** Usage % = amount actually spent in that category during the period ÷ the budget's limit. Remaining = limit − amount spent. Status follows the thresholds in [Part 11](#part-11-budgets) (Under Budget below 85%, Near Limit from 85% up to 100%, Over Budget at 100% or more).

### Category Totals
**How it is calculated:** All transactions assigned to a category are summed for the period being viewed.

### Investment Gain/Loss
**How it is calculated:** Current Value − Invested Amount, per investment (and summed across all investments for your total portfolio Profit/Loss).

### Investment Return (%)
**How it is calculated:** Profit/Loss ÷ Invested Amount × 100.

### Investment Growth (Home dashboard figure)
**How it is calculated:** Current total portfolio value − total recorded monthly contributions. This is a simplified indicator, not a precise annualized return.

### Bills
**How it is calculated:** A bill is Paid once its paid amount meets or exceeds its total amount; Overdue once its due date has passed while unpaid or partially paid; otherwise Upcoming or Partially Paid, as explained in [Part 13](#part-13-bills-emis).

### Goal Progress
**How it is calculated:** Current Amount ÷ Target Amount, capped at 100%.

### Emergency Fund Progress
**How it is calculated:** The current amount ÷ target amount of your Emergency Fund–category goal (if you have created one).

### Financial Health Score
**What it means:** A single 0–100 score summarizing your overall financial position.
**How it is calculated:** A weighted combination of four factors: your savings rate (up to 30 points), how well you're staying within budget (up to 25 points), your emergency fund progress (up to 25 points), and how much of your income is reflected in your investment portfolio (up to 20 points).
**When it changes:** Whenever the underlying transactions, budgets, goals, or investments change.

### Averages
- **Average Daily Spending** = Total Expenses ÷ number of days your transaction history spans.
- **Average Transaction Amount** = (Total Income + Total Expenses) ÷ total number of transactions.

### Monthly Comparisons
Penny Pilot compares the current calendar month's income/expenses against the previous calendar month to show percentage change (for example, "+3.2% vs. last month").

---

## Part 30: Annual Cash Flow

The Annual Cash Flow visualization on Home shows where this year's income has actually gone, using only real, recorded data. Each segment below is only shown if it has a real value greater than zero:

| Segment | Where the value comes from |
|---|---|
| **Bills** | The unpaid portion of your bills (amount minus what's already been paid) |
| **Investments** | Your investments' monthly contributions, multiplied by 12 |
| **Emergency Fund** | The monthly contribution of any goal in the Emergency Fund category, multiplied by 12 |
| **Goals** | The monthly contribution of your other (non–Emergency Fund) goals, multiplied by 12 |
| **Other Expenses** | Your total annual expenses, minus whatever is already counted under Bills |
| **Unallocated** | Whatever income is left over once the above segments are subtracted |

**Why it can change:** Because every segment is computed from your real bills, investments, and goals, adding, editing, or deleting any of these, or any transaction, immediately changes the segments the next time you view Home.

If you have no bills, investments, or goals recorded, Penny Pilot falls back to a simple two-part view: total income vs. total expenses for the year.

---

## Part 31: Data Flow

**Adding an expense:**

```
You enter an expense
   ↓
Penny Pilot validates it (amount, required fields)
   ↓
The record is saved
   ↓
Income/expense/savings totals are recalculated
   ↓
Home updates
   ↓
Analytics updates
   ↓
Reports reflect the change
```

**Income** follows the identical flow, since income and expenses are both transactions.

**Budgets:** Creating or editing a budget updates the Budget screen immediately; since budget usage is calculated from your transactions at display time, it also updates automatically whenever a relevant transaction changes.

**Investments:** Adding, editing, or deleting an investment immediately updates your portfolio totals, Net Worth, Investment Growth, and the Annual Cash Flow Investments segment.

**Bills:** Adding, editing, or deleting a bill immediately updates your Upcoming Bills list, bill status, and the Annual Cash Flow Bills segment.

**Goals:** Adding, editing, or deleting a goal immediately updates its progress bar and, where relevant, your Emergency Fund Progress and the Annual Cash Flow Goals/Emergency Fund segments.

**Savings:** There is no separate "add savings" flow, Savings is always the live result of Total Income − Total Expenses, so it updates automatically whenever a transaction changes.

---

## Part 32: What Happens When You Edit or Delete Something

**When a transaction (income or expense) is edited:**

1. The original record is updated with your new values.
2. Total Income/Expenses/Savings are recalculated using the new values.
3. Home's totals, Cash Flow, and Category Breakdown update.
4. Analytics charts update.
5. Reports reflect the new value.

**When a transaction is deleted:**

1. The record is permanently removed after you confirm.
2. All totals that included it (Income/Expenses/Savings, Net Worth, Category Breakdown, Cash Flow) are recalculated without it.
3. Analytics and Reports no longer include it.

**When a budget, bill, goal, or investment is edited or deleted:** The same principle applies, the specific totals and dashboard sections that depend on that record (Budget usage, Upcoming Bills, Goal progress, Net Worth/Investment Growth, and the relevant Annual Cash Flow segment) update immediately to reflect the change.

**Deleting a category:** A category cannot be deleted while transactions still reference it, to avoid leaving transactions without a category.

---

## Part 33: Error & Troubleshooting Guide

### I cannot log in
**Symptoms:** Sign-in fails or shows an error.
**Possible cause:** Incorrect email/password, or your account requires 2FA/a passkey you haven't completed.
**What to try:** Double-check your email and password; use **Forgot password?** if needed.
**When to contact support:** If your credentials are correct and sign-in still fails repeatedly.

### I cannot complete 2FA
**Symptoms:** Your 6-digit code is rejected.
**Possible cause:** Your authenticator app's clock has drifted, or you're using an expired code.
**What to try:** Wait for a fresh code from your authenticator app and try again; if that fails, use a backup code.
**When to contact support:** If you have no working authenticator and no backup codes.

### I forgot my password
**What to try:** Use **Forgot password?** on the sign-in screen (see [Part 25](#part-25-account-recovery)).

### I lost access to recovery methods
**Symptoms:** You can't complete 2FA and have no backup codes.
**What to try:** Contact Penny Pilot support directly using the contact information on the Privacy Policy or Terms of Service page.

### Google Drive is disconnected
**Symptoms:** A "Sync paused" indicator appears; changes don't seem to save to Drive.
**Possible cause:** Your Google account access was revoked or expired.
**What to try:** Go to Settings → Storage and reconnect Google Drive.

### Google Drive permission error
**Symptoms:** An error mentions Drive access or permission.
**Possible cause:** Access to Penny Pilot's Drive folder was removed from your Google Account settings.
**What to try:** Reconnect from Settings → Storage, granting access again.

### Google Drive storage/quota issue
**Symptoms:** Saves fail with a storage-related error.
**Possible cause:** Your Google Drive is full.
**What to try:** Free up space in your Google Drive, or increase your Google storage plan, then try again.

### Financial information is not appearing
**Symptoms:** A transaction, budget, or other record you added doesn't show up.
**Possible cause:** You may be viewing a filtered range (Analytics/Reports) that excludes it, or it was saved under a different account/storage mode than the one currently active.
**What to try:** Check your active filters, and confirm you're using the storage mode (Google Drive vs. Local-Only) the record was saved under.

### Dashboard looks outdated
**Symptoms:** Recently added information isn't reflected on Home.
**What to try:** Refresh the page. Penny Pilot updates Home automatically after changes made within the app; a manual refresh resolves rare display delays.

### Local-Only information is unavailable
**Symptoms:** Your data isn't there on a different browser or device.
**Possible cause:** This is expected, Local-Only data stays on the original browser/device only (see [Part 21](#part-21-storage)).
**What to try:** Switch back to the original browser/device, or move to Google Drive mode going forward if you need multi-device access.

### Search does not find something
**Possible cause:** A typo beyond what fuzzy matching tolerates, or the item belongs to a different storage mode/account than the one currently active.
**What to try:** Try a shorter or simpler search term.

### Notifications are not appearing
**Possible cause:** There may simply be nothing to notify you about yet (for example, no bill is due soon).
**What to try:** Check the Notifications screen directly; confirm nothing is filtered out.

### Voice greeting does not play
**Possible cause:** The Voice Greetings preference is turned off, or your browser blocked audio playback.
**What to try:** Check the Voice Greetings preference in Settings; check your browser's audio/autoplay permissions for the site.

### Application does not load
**Possible cause:** A connectivity issue, or a temporary service disruption.
**What to try:** Check your internet connection and refresh; if using Local-Only mode, Penny Pilot should still work offline for viewing/editing existing data once previously loaded.
**When to contact support:** If the problem persists across a refresh and a stable connection.

---

## Part 34: Data & Privacy Explanation

Penny Pilot handles the financial information you choose to enter: transactions, budgets, bills, goals, investments, wallets/accounts, money sources, and categories, along with your account and security information (name, email, hashed password, and optional 2FA/passkey data).

**Where it can be stored:**

- **Google Drive mode**, your financial data lives in your own Google Drive, in a folder only Penny Pilot's app can see and manage.
- **Local-Only mode**, your financial data lives only in your browser's local storage on your device.

**Account/security information:** Your account details (used to sign you in) are handled separately from your financial data, regardless of which storage mode you choose for your finances.

**What you should understand about your data:** You choose where your financial data lives, and you can change that choice, export your data, or disconnect Google Drive at any time from Settings.

This manual is not a substitute for Penny Pilot's official Privacy Policy and Terms of Service, which are the legally binding documents describing how your information is handled. Please refer to those pages directly for complete, legally accurate details.

---

## Part 35: Limitations

The following are current limitations of Penny Pilot, based on the application as it exists today:

- Investment values are entered manually; Penny Pilot does not connect to any market-data source or brokerage to update prices automatically.
- Goals and investment monthly contributions are figures you record yourself; Penny Pilot does not move or deduct money automatically.
- Local-Only data does not sync across devices or browsers, it stays wherever it was created.
- Penny Pilot does not connect directly to your bank; all transactions are entered manually.
- Self-service account deletion is not currently available from within the app; account deletion requests are handled by contacting support directly.
- Financial Health Score, budget status, and other figures are calculated from a fixed set of rules based on your own data. They are not personalized financial advice.

---

## Part 36: FAQ

**Getting started**

*Do I need to set anything up before I can use Penny Pilot?* No, you can start adding expenses and income right after creating your account.

**Expenses**

*Can I edit an expense after saving it?* Yes, at any time from the Expenses or Transactions screen.

**Income**

*Is income tracked separately from expenses?* They are both "transactions," shown together in Activity/Transactions and separately on the Income and Expenses screens.

**Budgets**

*What happens if I go over budget?* Nothing is blocked, Penny Pilot simply marks the budget "Over Budget" so you're aware.

**Investments**

*Does Penny Pilot update my investment values automatically?* No, you update the current value yourself.

**Bills**

*Can I mark a bill as partially paid?* Yes, record any amount already paid, and Penny Pilot shows it as Partially Paid until the full amount is recorded.

**Goals**

*Can multiple goals run at the same time?* Yes.

**Savings**

*Do I need to create a savings entry?* No, Savings is calculated automatically from your income and expenses.

**Storage**

*Can I switch storage modes later?* Yes, from Settings → Storage.

**Google Drive**

*Can Penny Pilot see the rest of my Google Drive?* No, it only has access to the specific folder it creates for itself.

**Local-Only**

*What happens if I clear my browser data?* Your Local-Only Penny Pilot data is removed along with it, since it's stored in that browser's local storage.

**Security**

*Is 2FA required?* No, it's optional, though recommended.

**Recovery**

*What if I lose my 2FA backup codes and my authenticator?* Contact Penny Pilot support directly.

**Reports**

*Can I export a report?* Yes, from Reports or Settings → Backup, in CSV, Excel, JSON, or PDF format.

**Analytics**

*Can I build my own chart?* Yes, using the Custom Chart Studio on the Analytics screen.

**Mobile**

*Is the mobile experience missing any features compared to desktop?* No, mobile and desktop offer the same features, organized differently for each screen size.

**Desktop**

*Where is the "More" menu on desktop?* Desktop doesn't need one, every destination is reachable directly from the sidebar.

---

## Part 37: Quick Reference

### Add an Expense
1. Select **Add Expense** (Quick Access, or the Expenses/Transactions screen).
2. Enter amount, date, and category.
3. Optionally add wallet, money source, and notes.
4. Save.

### Add Income
1. Select **Add Income**.
2. Enter amount, date, and category.
3. Optionally add wallet, money source, and notes.
4. Save.

### Create Budget
1. Go to Budget → **Add Budget**.
2. Choose a category, amount, and period.
3. Save.

### Add Goal
1. Go to Goals → **Add Goal**.
2. Enter name, category, target amount, and current amount.
3. Save.

### Add Investment
1. Go to Investments → **Add Investment**.
2. Enter instrument name, category, invested amount, and current value.
3. Save.

### Add Bill
1. Go to Bills & EMI → **Add Bill**.
2. Enter name, type, due date, and amount.
3. Save.

### View Analytics
1. Open Analytics.
2. Adjust the time range and filters as needed.

### View Reports
1. Open Reports.
2. Choose Monthly Summary, Category Report, or Budget vs. Actual.

### Connect Google Drive
1. Go to Settings → Storage.
2. Choose Google Drive.
3. Sign in with Google and grant access.

### Switch Storage
1. Go to Settings → Storage.
2. Select the other storage option.

### Enable 2FA
1. Go to Settings → Security.
2. Start two-factor authentication setup.
3. Scan the QR code with an authenticator app and confirm the code.
4. Save your backup codes.

### Configure Passkeys
1. Go to Settings → Security.
2. Add a passkey and follow your device's prompt (fingerprint, face, or security key).

### Recover Account
1. Select **Forgot password?** on the sign-in screen.
2. Follow the verification steps.
3. Set a new password.

### Export Data
1. Go to Reports or Settings → Backup.
2. Select **Export data**.
3. Choose a date range, what to include, and a file format.
4. Download.

---

## Part 38: Glossary

| Term | Meaning |
|---|---|
| **Wallet / Account** | A label for where money sits (for example, a bank account or cash) |
| **Money Source / Payment Method** | A label for how a payment was made (for example, Cash, UPI, Card) |
| **Transaction** | A single income or expense record |
| **Expense** | A transaction representing money going out |
| **Income** | A transaction representing money coming in |
| **Budget** | A spending limit set for a category over a period |
| **Goal** | A savings target with a current and target amount |
| **Savings** | Total Income minus Total Expenses |
| **Investment** | A tracked instrument with an invested amount and current value |
| **Bill** | A recurring or one-time payment obligation with a due date |
| **Google Drive Storage** | Storing your financial data in your own Google Drive |
| **Local-Only** | Storing your financial data only in your current browser |
| **Net Worth** | Savings plus your current investment value |
| **Cash Flow** | Income minus Expenses over a given period |
| **Financial Intelligence** | Rule-based observations generated from your own data |
| **Recovery** | The process of regaining account access after losing your password or 2FA method |
| **Passkey** | A biometric or device-based sign-in method that replaces a password |
| **Two-Factor Authentication (2FA)** | A second sign-in step using a time-based code, in addition to your password |

---

## Documentation Coverage

| Feature | Covered | Notes |
|---|---|---|
| Getting started | Yes | Full first-time journey |
| Dashboard/Home | Yes | Every section explained |
| Expenses / Income / Transactions | Yes | Including data flow |
| Wallets / Money Sources | Yes | |
| Categories & Subcategories | Yes | |
| Budgets | Yes | Includes real status thresholds |
| Investments | Yes | Includes real gain/loss formula |
| Bills & EMIs | Yes | |
| Goals | Yes | |
| Savings | Yes | |
| Analytics | Yes | |
| Reports | Yes | |
| Financial Intelligence | Yes | Confirmed rule-based, not AI |
| Search | Yes | |
| Notifications | Yes | |
| Storage (Drive & Local-Only) | Yes | Includes comparison table |
| Backup/Export/Import/Restore | Yes | |
| Settings | Yes | |
| Security | Yes | |
| Account Recovery | Yes | |
| Voice Greetings | Yes | |
| Mobile Experience | Yes | |
| Desktop Experience | Yes | |
| Calculations | Yes | Verified against actual formulas in the application |
| Annual Cash Flow | Yes | All real segments documented |
| Data flow / CRUD behavior | Yes | |
| Troubleshooting | Yes | |
| Data & Privacy | Yes | Points to official Privacy Policy for legal detail |
| Limitations | Yes | |
| FAQ | Yes | |
| Quick Reference | Yes | |
| Glossary | Yes | |
| Pricing | Not applicable | Penny Pilot has no pricing/billing system to document |

---

## Current Limitations

See [Part 35: Limitations](#part-35-limitations) for the full list. In summary: investment values, and goal/investment contributions, are entered manually; Local-Only storage does not sync across devices; there is no automatic bank connection; and self-service account deletion is not yet available.

---

## Last Updated

September 20, 2026
