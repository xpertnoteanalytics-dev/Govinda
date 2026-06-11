// src/controllers/placesController.ts
import { Request, Response, NextFunction } from "express";
import * as mapsService from "../services/mapsService";
import { ImportedPlace } from "../models/ImportedPlace";
import { ALL_PLACE_CATEGORIES } from "../types/places";
import type { PlaceCategory } from "../types/places";

export async function search(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { lat, lng, radius, category, city, locationLabel } = req.body;
    const parsedLat = lat != null && lat !== "" ? Number(lat) : undefined;
    const parsedLng = lng != null && lng !== "" ? Number(lng) : undefined;
    const query = {
      lat: parsedLat != null && !Number.isNaN(parsedLat) ? parsedLat : undefined,
      lng: parsedLng != null && !Number.isNaN(parsedLng) ? parsedLng : undefined,
      radius: Number(radius) || 5000,
      category: category as PlaceCategory,
      city: city as string | undefined,
      locationLabel: locationLabel as string | undefined,
    };
    const data = await mapsService.searchPlaces(query);
    await mapsService.recordSearchHistory(req.tenantId!, req.user!.id, query, data);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const category = req.query.category as PlaceCategory | undefined;
    const place = await mapsService.getPlaceDetails(req.params.placeId as string, category);
    res.json({ success: true, data: { place } });
  } catch (err) {
    next(err);
  }
}

export async function history(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const searches = await mapsService.listSearchHistory(req.tenantId!, req.user!.id);
    res.json({ success: true, data: { searches } });
  } catch (err) {
    next(err);
  }
}

export async function removeHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await mapsService.deleteSearchHistory(req.params.historyId as string, req.tenantId!, req.user!.id);
    res.json({ success: true, data: { message: "Deleted" } });
  } catch (err) {
    next(err);
  }
}

export async function analytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await mapsService.getSearchAnalytics(req.tenantId!, req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

interface CsvRow {
  name: string;
  category: string;
  phone?: string;
  address?: string;
  lat: string;
  lng: string;
}

export async function importCsv(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rows = req.body.records as CsvRow[];

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: { message: "No records provided" } });
      return;
    }

    const results = {
      imported: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    for (const row of rows) {
      const lat = parseFloat(row.lat);
      const lng = parseFloat(row.lng);

      if (!row.name?.trim()) {
        results.errors.push(`Row missing name`);
        continue;
      }
      if (!ALL_PLACE_CATEGORIES.includes(row.category as PlaceCategory)) {
        results.errors.push(`"${row.name}": invalid category "${row.category}"`);
        continue;
      }
      if (isNaN(lat) || isNaN(lng)) {
        results.errors.push(`"${row.name}": invalid lat/lng`);
        continue;
      }

      // Duplicate check — same name + coordinates within ~10m
      const existing = await ImportedPlace.findOne({
        tenantId: req.tenantId,
        name: { $regex: new RegExp(`^${row.name.trim()}$`, "i") },
        lat: { $gte: lat - 0.0001, $lte: lat + 0.0001 },
        lng: { $gte: lng - 0.0001, $lte: lng + 0.0001 },
      });

      if (existing) {
        results.duplicates++;
        continue;
      }

      await ImportedPlace.create({
        tenantId: req.tenantId,
        userId: req.user!.id,
        name: row.name.trim(),
        category: row.category as PlaceCategory,
        phone: row.phone?.trim() || undefined,
        address: row.address?.trim() || undefined,
        lat,
        lng,
        source: "csv_import",
      });

      results.imported++;
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function listImported(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const places = await ImportedPlace.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: { places } });
  } catch (err) {
    next(err);
  }
}