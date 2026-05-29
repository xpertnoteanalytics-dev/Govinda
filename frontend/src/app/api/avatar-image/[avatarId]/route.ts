import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const AVATAR_IMAGES: Record<string, string> = {
  govinda: "C:\\Users\\josin\\Downloads\\ChatGPT Image May 20, 2026, 01_52_29 PM.png",
  durga:   "C:\\Users\\josin\\Downloads\\ChatGPT Image May 20, 2026, 02_33_33 PM.png",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> }
) {
  const { avatarId } = await params;
  const imagePath = AVATAR_IMAGES[avatarId];

  if (!imagePath) {
    return NextResponse.json({ error: "Avatar image not found" }, { status: 404 });
  }

  try {
    const absolutePath = path.resolve(imagePath);
    const image = await fs.readFile(absolutePath);
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[avatar-image] failed to load image", { avatarId, error });
    return NextResponse.json({ error: "Failed to load avatar image" }, { status: 500 });
  }
}
