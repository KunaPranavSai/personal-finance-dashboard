import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Reference data only — category/subcategory taxonomy and payment accounts.
// Intentionally NO transactions, budgets, investments, bills, or goals:
// the app must start with a clean empty state.
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

async function main() {
  for (const [name, subs] of Object.entries(expenseCategories)) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, type: "EXPENSE" },
    });
    for (const sub of subs) {
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: {},
        create: { name: sub, categoryId: category.id },
      });
    }
  }

  for (const [name, subs] of Object.entries(incomeCategories)) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, type: "INCOME" },
    });
    for (const sub of subs) {
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: {},
        create: { name: sub, categoryId: category.id },
      });
    }
  }

  for (const name of accounts) {
    await prisma.account.upsert({ where: { name }, update: {}, create: { name } });
  }

  const existingNotif = await prisma.notification.findFirst({ where: { type: "insight", title: "Welcome to Finance Dashboard Pro" } });
  if (!existingNotif) {
    await prisma.notification.create({
      data: {
        type: "insight",
        title: "Welcome to Finance Dashboard Pro",
        message: "Start by adding your transactions and setting up budgets.",
      },
    });
  }

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", data: {} as object },
  });

  await prisma.appProfile.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", data: {} as object },
  });

  console.log("Seed complete: categories, subcategories, accounts, notifications, and settings created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
