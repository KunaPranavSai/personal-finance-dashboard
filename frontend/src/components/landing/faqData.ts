// Single source of truth for the landing page FAQ — both the visible
// accordion (FAQ.tsx) and the FAQPage JSON-LD (FAQJsonLd.tsx) render from
// this exact list, so the structured data can never drift from what a
// visitor actually sees.
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Penny Pilot?",
    answer: "Penny Pilot is a personal finance app for tracking income, expenses, budgets, bills, savings goals, and investments in one place.",
  },
  {
    question: "What can I use Penny Pilot for?",
    answer: "Use Penny Pilot for everyday expense tracking, income tracking, monthly budgeting, bill reminders, savings goals, and investment tracking — all from a single dashboard.",
  },
  {
    question: "Can Penny Pilot track income and expenses?",
    answer: "Yes. Every transaction records a date, description, amount, category, and account, so you can see exactly where your money comes from and where it goes.",
  },
  {
    question: "Can I create budgets and savings goals?",
    answer: "Yes. Set monthly, quarterly, or yearly budgets per category, and create savings goals with a target amount and monthly contribution to track your progress.",
  },
  {
    question: "Does Penny Pilot support Google Drive storage?",
    answer: "Yes. You can choose Google Drive mode so your financial data is stored as files in your own Google Drive, using the restricted drive.file scope.",
  },
  {
    question: "Can I use Penny Pilot with Local-Only storage?",
    answer: "Yes. This Device Only mode keeps your data in your browser's local storage, with no Google account connection required.",
  },
  {
    question: "Is Penny Pilot available on mobile?",
    answer: "Yes. Penny Pilot is a Progressive Web App, so it works in any mobile browser and can be installed to your home screen.",
  },
  {
    question: "How do I get started with Penny Pilot?",
    answer: "Create a free account, choose your storage mode, and start logging your income, expenses, budgets, bills, and goals.",
  },
];
