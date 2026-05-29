import { AIMemory } from "../models";
import { resolveObjectIdString } from "../utils/resolveId";

export async function saveMemory(
  tenantId: string,
  userId: string,
  key: string,
  value: string,
  category?: string
) {
  const doc = await AIMemory.findOneAndUpdate(
    {
      tenantId: resolveObjectIdString(tenantId, "tenantId"),
      userId: resolveObjectIdString(userId, "userId"),
      key: key.trim(),
    },
    { value: value.trim(), category: category?.trim() },
    { upsert: true, new: true }
  );
  return {
    key: doc.key,
    value: doc.value,
    category: doc.category,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getMemories(tenantId: string, userId: string, limit = 20) {
  const entries = await AIMemory.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ updatedAt: -1 })
    .limit(limit);

  return entries.map((e) => ({
    key: e.key,
    value: e.value,
    category: e.category,
    updatedAt: e.updatedAt.toISOString(),
  }));
}

export async function deleteMemory(tenantId: string, userId: string, key: string) {
  await AIMemory.deleteOne({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
    key: key.trim(),
  });
}

export function formatMemoriesForPrompt(
  memories: { key: string; value: string; category?: string }[]
): string {
  if (!memories.length) return "";
  const lines = memories.map(
    (m) => `- ${m.key}${m.category ? ` (${m.category})` : ""}: ${m.value}`
  );
  return `\nPersistent memory:\n${lines.join("\n")}`;
}
