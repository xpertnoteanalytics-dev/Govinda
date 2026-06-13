// src/controllers/stakeholderController.ts
import { Request, Response, NextFunction } from "express";
import { Stakeholder } from "../models/Stakeholder";
import { StakeholderInteraction } from "../models/StakeholderInteraction";
import { StakeholderImport } from "../models/StakeholderImport";
import { resolveObjectIdString } from "../utils/resolveId";

// ─── List stakeholders ────────────────────────────────────────────────────────
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, search, page = "1", limit = "50" } = req.query;
    const filter: Record<string, unknown> = {
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
    };
    if (type) filter.stakeholderType = type;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { organizationName: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [stakeholders, total] = await Promise.all([
      Stakeholder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Stakeholder.countDocuments(filter),
    ]);
    res.json({ success: true, data: { stakeholders, total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    next(err);
  }
}

// ─── Get single stakeholder ───────────────────────────────────────────────────
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stakeholder = await Stakeholder.findOne({
      _id: resolveObjectIdString(req.params.id, "id"),
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
    });
    if (!stakeholder) {
      res.status(404).json({ success: false, error: { message: "Stakeholder not found" } });
      return;
    }
    const interactions = await StakeholderInteraction.find({
      stakeholderId: stakeholder._id,
    }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: { stakeholder, interactions } });
  } catch (err) {
    next(err);
  }
}

// ─── Create stakeholder ───────────────────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, mobile, organizationName, organizationAddress, stakeholderType, details, notes, tags } = req.body;

    const existing = await Stakeholder.findOne({
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
      mobile,
    });
    if (existing) {
      res.status(409).json({ success: false, error: { message: "Mobile number already exists", code: "DUPLICATE_MOBILE" } });
      return;
    }

    const stakeholder = await Stakeholder.create({
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
      userId: resolveObjectIdString(req.user!.id, "userId"),
      name, email, mobile, organizationName, organizationAddress,
      stakeholderType: stakeholderType ?? "other",
      details, notes, tags,
    });

    res.status(201).json({ success: true, data: { stakeholder } });
  } catch (err) {
    next(err);
  }
}

// ─── Update stakeholder ───────────────────────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stakeholder = await Stakeholder.findOneAndUpdate(
      {
        _id: resolveObjectIdString(req.params.id, "id"),
        tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
      },
      { $set: req.body },
      { new: true }
    );
    if (!stakeholder) {
      res.status(404).json({ success: false, error: { message: "Stakeholder not found" } });
      return;
    }
    res.json({ success: true, data: { stakeholder } });
  } catch (err) {
    next(err);
  }
}

// ─── Delete stakeholder ───────────────────────────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await Stakeholder.deleteOne({
      _id: resolveObjectIdString(req.params.id, "id"),
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: { message: "Stakeholder not found" } });
      return;
    }
    res.json({ success: true, data: { message: "Deleted" } });
  } catch (err) {
    next(err);
  }
}

// ─── Bulk import ──────────────────────────────────────────────────────────────
interface ImportRow {
  name: string;
  email?: string;
  mobile: string;
  organizationName?: string;
  organizationAddress?: string;
  stakeholderType?: string;
  [key: string]: unknown;
}

const VALID_TYPES = ["patient", "partner", "employee", "sponsor", "vendor", "donor", "government", "other"];

export async function bulkImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, fileName } = req.body as { records: ImportRow[]; fileName: string };

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, error: { message: "No records provided" } });
      return;
    }

    const tenantId = resolveObjectIdString(req.tenantId!, "tenantId");
    const userId = resolveObjectIdString(req.user!.id, "userId");

    const result = { imported: 0, duplicates: 0, errors: 0, errorDetails: [] as string[] };

    // Create import batch
    const batch = await StakeholderImport.create({
      tenantId, userId,
      fileName: fileName ?? "import.csv",
      totalRows: records.length,
    });

    for (const row of records) {
      if (!row.name?.trim()) {
        result.errors++;
        result.errorDetails.push(`Row missing name`);
        continue;
      }
      if (!row.mobile?.trim()) {
        result.errors++;
        result.errorDetails.push(`"${row.name}": missing mobile`);
        continue;
      }

      const normalizedMobile = row.mobile.trim().replace(/\s/g, "");
      const type = VALID_TYPES.includes(row.stakeholderType?.toLowerCase() ?? "")
        ? row.stakeholderType!.toLowerCase()
        : "other";

      const existing = await Stakeholder.findOne({ tenantId, mobile: normalizedMobile });
      if (existing) {
        result.duplicates++;
        continue;
      }

      try {
        await Stakeholder.create({
          tenantId, userId,
          name: row.name.trim(),
          email: row.email?.trim().toLowerCase() || undefined,
          mobile: normalizedMobile,
          organizationName: row.organizationName?.trim() || undefined,
          organizationAddress: row.organizationAddress?.trim() || undefined,
          stakeholderType: type,
          importBatchId: batch._id,
        });
        result.imported++;
      } catch {
        result.errors++;
        result.errorDetails.push(`"${row.name}": failed to save`);
      }
    }

    await StakeholderImport.findByIdAndUpdate(batch._id, {
      imported: result.imported,
      duplicates: result.duplicates,
      errors: result.errors,
      errorDetails: result.errorDetails,
    });

    res.json({ success: true, data: { ...result, batchId: batch._id.toString() } });
  } catch (err) {
    next(err);
  }
}

// ─── Import history ───────────────────────────────────────────────────────────
export async function importHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const imports = await StakeholderImport.find({
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
    }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: { imports } });
  } catch (err) {
    next(err);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = resolveObjectIdString(req.tenantId!, "tenantId");

    const [total, byType, interactions, sentiments] = await Promise.all([
      Stakeholder.countDocuments({ tenantId }),
      Stakeholder.aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$stakeholderType", count: { $sum: 1 } } },
      ]),
      StakeholderInteraction.countDocuments({ tenantId }),
      StakeholderInteraction.aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$sentiment", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byType: Object.fromEntries(byType.map((b) => [b._id, b.count])),
        totalInteractions: interactions,
        sentiments: Object.fromEntries(sentiments.map((s) => [s._id, s.count])),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Add interaction ──────────────────────────────────────────────────────────
export async function addInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { summary, channel, sentiment, feedback, suggestions, actionItems, topics, conversation } = req.body;

    const stakeholder = await Stakeholder.findOne({
      _id: resolveObjectIdString(req.params.id, "id"),
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
    });
    if (!stakeholder) {
      res.status(404).json({ success: false, error: { message: "Stakeholder not found" } });
      return;
    }

    const interaction = await StakeholderInteraction.create({
      tenantId: resolveObjectIdString(req.tenantId!, "tenantId"),
      userId: resolveObjectIdString(req.user!.id, "userId"),
      stakeholderId: stakeholder._id,
      summary, channel, sentiment, feedback,
      suggestions, actionItems, topics, conversation,
    });

    res.status(201).json({ success: true, data: { interaction } });
  } catch (err) {
    next(err);
  }
}