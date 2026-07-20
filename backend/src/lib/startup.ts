import { prisma } from "./prisma";

const expenseCategories: Record<string, string[]> = {
  Home: ["Mortgage", "Rent", "Utilities", "Repairs"],
  "Daily Living": ["Groceries", "Dining Out", "Pet Care"],
  Transportation: ["Fuel", "Public Transport", "Parking"],
  Entertainment: ["Streaming Services", "Movies", "Concerts"],
  Health: ["Prescriptions", "Medical Expenses", "Health Club"],
  Personal: ["Clothing", "Salon", "Gifts"],
  "Dues & Subscriptions": ["Internet", "Memberships"],
  "Financial Obligations": ["Credit Cards", "Loans", "Taxes"],
  EMI: ["Home Loan EMI", "Car Loan EMI", "Personal Loan EMI"],
  Shopping: ["Electronics", "Home Goods"],
  Travel: ["Flights", "Hotels"],
  Education: ["Tuition", "Courses"],
  Insurance: ["Life", "Health", "Vehicle"],
  Investments: ["Mutual Funds", "Stocks", "SIPs"],
  Miscellaneous: ["Uncategorized"],
};

const incomeCategories: Record<string, string[]> = {
  Salary: ["Base Salary", "Bonus"],
  Freelancing: ["Freelance Project"],
  "Business Income": ["Side Business"],
  Interest: ["Savings Interest", "FD Interest"],
  Dividends: ["Stock Dividends"],
  "Rental Income": ["Property Rent"],
  Refunds: ["Tax Refund", "Purchase Refund"],
  "Other Income": ["Gifts", "Other"],
};

const accounts = ["Bank Account", "Credit Card", "Wallet", "Cash", "Savings Account"];

/** Seed default categories/accounts and a welcome notification for a newly approved user. */
export async function seedDefaultDataForUser(userId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { userId } });
  if (existing > 0) return;

  for (const [name, subs] of Object.entries(expenseCategories)) {
    const category = await prisma.category.create({ data: { userId, name, type: "EXPENSE" } });
    for (const sub of subs) {
      await prisma.subcategory.create({ data: { name: sub, categoryId: category.id } });
    }
  }

  for (const [name, subs] of Object.entries(incomeCategories)) {
    const category = await prisma.category.create({ data: { userId, name, type: "INCOME" } });
    for (const sub of subs) {
      await prisma.subcategory.create({ data: { name: sub, categoryId: category.id } });
    }
  }

  for (const name of accounts) {
    await prisma.account.create({ data: { userId, name } });
  }
}
