import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { fetchAllExportData } from "../services/export";
import { generateCSV } from "../services/export/csvExporter";
import { generateExcel } from "../services/export/excelExporter";
import { generateJSON } from "../services/export/jsonExporter";
import { generatePDF } from "../services/export/pdfExporter";
import { listRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";
import { requireRecent2FA } from "../middleware/auth";

interface DatedRecord extends DriveRecord { date: string }

const router = Router();

function dateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── GET /api/export/preview ─────────────────────────────────────────────────
// Cheap record-count summary of what an export/backup would include, shown to
// the user before they commit to a download.
/** ?from/&to are YYYY-MM-DD (inclusive days); the optional type/category/wallet/source choices narrow the same way everywhere. */
function rangeFrom(req: Request) {
  const q = (k: string) => (req.query[k] ? String(req.query[k]) : undefined);
  const from = q("from") ? new Date(`${q("from")!.slice(0, 10)}T00:00:00.000Z`) : undefined;
  const to = q("to") ? new Date(`${q("to")!.slice(0, 10)}T23:59:59.999Z`) : undefined;
  const kinds = new Set((q("kinds") ?? "").split(",").map((k) => k.trim().toUpperCase()).filter(Boolean));
  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
    type: kinds.size === 1 ? ([...kinds][0] as "INCOME" | "EXPENSE") : undefined,
    categoryId: q("categoryId"), accountId: q("accountId"), paymentMethodTypeId: q("paymentMethodTypeId"),
  };
}

router.get(
  "/preview",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const r = rangeFrom(req);
    const validFrom = r.from, validTo = r.to;

    const [allTransactions, budgets, investments, bills, goals, categories, accounts] = await Promise.all([
      listRecords<DatedRecord>(userId, "transactions"),
      listRecords(userId, "budgets"),
      listRecords(userId, "investments"),
      listRecords(userId, "bills"),
      listRecords(userId, "goals"),
      listRecords(userId, "categories"),
      listRecords(userId, "accounts"),
    ]);
    const transactions = allTransactions.filter((t) => {
      const x = t as unknown as { date: string; type: string; categoryId?: string; accountId?: string; paymentMethodTypeId?: string };
      const d = new Date(x.date);
      return (!validFrom || d >= validFrom) && (!validTo || d <= validTo) && (!r.type || x.type === r.type)
        && (!r.categoryId || x.categoryId === r.categoryId) && (!r.accountId || x.accountId === r.accountId)
        && (!r.paymentMethodTypeId || x.paymentMethodTypeId === r.paymentMethodTypeId);
    });

    res.json({
      counts: {
        transactions: transactions.length, budgets: budgets.length, investments: investments.length,
        bills: bills.length, goals: goals.length, categories: categories.length, accounts: accounts.length,
      },
      range: { from: validFrom?.toISOString() ?? null, to: validTo?.toISOString() ?? null },
    });
  })
);

router.get(
  "/",
  requireRecent2FA,
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string)?.toLowerCase() ?? "csv";
    const allowed = ["csv", "xlsx", "json", "pdf"];
    if (!allowed.includes(format)) {
      res.status(400).json({ error: `Invalid format '${format}'. Must be one of: ${allowed.join(", ")}` });
      return;
    }

    try {
      const data = await fetchAllExportData(req.auth!.userId, rangeFrom(req));

      data.meta = { from: (req.query.from as string) || undefined, to: (req.query.to as string) || undefined };
      // Income/expense ("kinds"), category, wallet and money-source choices are applied inside fetchAllExportData so the totals match.

      const typesParam = (req.query.types as string) || "";
      const selectedTypes = typesParam ? new Set(typesParam.split(",").map((t) => t.trim())) : null;
      if (selectedTypes) {
        if (!selectedTypes.has("transactions")) data.transactions = [];
        if (!selectedTypes.has("budgets")) data.budgets = [];
        if (!selectedTypes.has("investments")) data.investments = [];
        if (!selectedTypes.has("bills")) data.bills = [];
        if (!selectedTypes.has("goals")) data.goals = [];
        if (!selectedTypes.has("categories")) data.categories = [];
        if (!selectedTypes.has("accounts")) data.accounts = [];
        if (!selectedTypes.has("settings")) data.settings = null;
        if (!selectedTypes.has("analytics")) data.analytics = null;
      }

      const ds = dateStr();

      switch (format) {
        case "csv": {
          const buf = generateCSV(data);
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="finance-export-${ds}.csv"`);
          res.send(buf);
          break;
        }
        case "xlsx": {
          const buf = await generateExcel(data);
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader("Content-Disposition", `attachment; filename="finance-export-${ds}.xlsx"`);
          res.send(buf);
          break;
        }
        case "json": {
          const json = generateJSON(data);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="finance-export-${ds}.json"`);
          res.send(json);
          break;
        }
        case "pdf": {
          const buf = await generatePDF(data);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="finance-report-${ds}.pdf"`);
          res.send(buf);
          break;
        }
      }
    } catch (err) {
      console.error("Export failed:", err);
      res.status(500).json({ error: "Failed to generate export. Please try again." });
    }
  })
);

export default router;
