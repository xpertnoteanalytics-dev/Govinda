import { Request, Response, NextFunction } from "express";
import * as mapsService from "../services/mapsService";
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

    await mapsService.recordSearchHistory(
      req.tenantId!,
      req.user!.id,
      query,
      data
    );

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
    const place = await mapsService.getPlaceDetails(
      req.params.placeId as string,
      category
    );
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
    const searches = await mapsService.listSearchHistory(
      req.tenantId!,
      req.user!.id
    );
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
    await mapsService.deleteSearchHistory(
      req.params.historyId as string,
      req.tenantId!,
      req.user!.id
    );
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
    const data = await mapsService.getSearchAnalytics(
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
