import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { fetchAllExportData } from "../services/export";
import { generateCSV } from "../services/export/csvExporter";
import { generateExcel } from "../services/export/excelExporter";
import { generateJSON } from "../services/export/jsonExporter";
import { generatePDF } from "../services/export/pdfExporter";

const router = Router();

function dateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string)?.toLowerCase() ?? "csv";
    const allowed = ["csv", "xlsx", "json", "pdf"];
    if (!allowed.includes(format)) {
      res.status(400).json({ error: `Invalid format '${format}'. Must be one of: ${allowed.join(", ")}` });
      return;
    }

    try {
      const data = await fetchAllExportData();
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
