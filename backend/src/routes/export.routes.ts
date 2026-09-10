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
router.get(
  "/preview",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const validFrom = from && !isNaN(from.getTime()) ? from : undefined;
    const validTo = to && !isNaN(to.getTime()) ? to : undefined;

    const [allTransactions, budgets, investments, bills, goals, categories, accounts] = await Promise.all([
      listRecords<DatedRecord>(userId, "transactions"),
      listRecords(userId, "budgets"),
      listRecords(userId, "investments"),
      listRecords(userId, "bills"),
      listRecords(userId, "goals"),
      listRecords(userId, "categories"),
      listRecords(userId, "accounts"),
    ]);
    const transactions = allTransactions.filter(
      (t) => (!validFrom || new Date(t.date) >= validFrom) && (!validTo || new Date(t.date) <= validTo)
    );

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
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      const data = await fetchAllExportData(req.auth!.userId, {
        from: from && !isNaN(from.getTime()) ? from : undefined,
        to: to && !isNaN(to.getTime()) ? to : undefined,
      });

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
