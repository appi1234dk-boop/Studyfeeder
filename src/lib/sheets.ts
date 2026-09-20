import { google } from "googleapis";
import type { Item } from "./types";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SHEET_NAME = "자료";
const OBSIDIAN_QUEUE_SHEET = "obsidian_queue";
const LINKS_SHEET = "links";
const THREAD_STRUCTURE_SHEET = "thread_structure";

export type ThreadStructureEntry = {
  kind: "folder" | "thread";
  id: string;
  name: string;
  parent_id: string;
  sort_order: number;
  is_archived?: boolean;
};

export async function getThreadStructure(): Promise<ThreadStructureEntry[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${THREAD_STRUCTURE_SHEET}!A2:F`,
    });
    return ((res.data.values as string[][]) || []).flatMap((row) => {
      if ((row[0] !== "folder" && row[0] !== "thread") || !row[1] || !row[2] || row[5] === "TRUE") return [];
      return [{ kind: row[0], id: row[1], name: row[2], parent_id: row[3] || "", sort_order: Number(row[4]) || 0, is_archived: false } as ThreadStructureEntry];
    });
  } catch {
    return [];
  }
}

async function ensureThreadStructureSheet() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === THREAD_STRUCTURE_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: THREAD_STRUCTURE_SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${THREAD_STRUCTURE_SHEET}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: { values: [["kind", "id", "name", "parent_id", "sort_order", "is_archived"]] },
    });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${THREAD_STRUCTURE_SHEET}!F1`, valueInputOption: "RAW", requestBody: { values: [["is_archived"]] } });
  }
  return sheets;
}

export async function upsertThreadStructure(entries: ThreadStructureEntry[]) {
  const sheets = await ensureThreadStructureSheet();
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${THREAD_STRUCTURE_SHEET}!A2:F`,
  });
  const rows = (current.data.values as string[][]) || [];
  const rowById = new Map(rows.map((row, index) => [row[1], index + 2]));
  const updates = entries.filter((entry) => rowById.has(entry.id)).map((entry) => ({
    range: `${THREAD_STRUCTURE_SHEET}!A${rowById.get(entry.id)}:F${rowById.get(entry.id)}`,
    values: [[entry.kind, entry.id, entry.name, entry.parent_id, String(entry.sort_order), entry.is_archived ? "TRUE" : "FALSE"]],
  }));
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  const additions = entries.filter((entry) => !rowById.has(entry.id));
  if (additions.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${THREAD_STRUCTURE_SHEET}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: additions.map((entry) => [entry.kind, entry.id, entry.name, entry.parent_id, String(entry.sort_order), entry.is_archived ? "TRUE" : "FALSE"]) },
    });
  }
}

export async function renameThreadStructureEntry(id: string, newName: string) {
  const sheets = await ensureThreadStructureSheet();
  const structureResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${THREAD_STRUCTURE_SHEET}!A2:F`,
  });
  const structureRows = (structureResponse.data.values as string[][]) || [];
  const entryIndex = structureRows.findIndex((row) => row[1] === id);
  if (entryIndex < 0) return { status: "not_found" as const };

  const entry = structureRows[entryIndex];
  const kind = entry[0] as ThreadStructureEntry["kind"];
  const oldName = entry[2] || "";
  if (structureRows.some((row, index) => index !== entryIndex && row[0] === kind && row[2] === newName)) {
    return { status: "duplicate" as const };
  }

  const updates: { range: string; values: string[][] }[] = [{
    range: `${THREAD_STRUCTURE_SHEET}!C${entryIndex + 2}`,
    values: [[newName]],
  }];
  const updatedItems = 0;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updates },
  });
  return { status: "renamed" as const, kind, oldName, newName, updatedItems };
}

export async function deleteThreadStructureEntry(id: string) {
  const sheets = await ensureThreadStructureSheet();
  const structureResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${THREAD_STRUCTURE_SHEET}!A2:F` });
  const structureRows = (structureResponse.data.values as string[][]) || [];
  const entryIndex = structureRows.findIndex((row) => row[1] === id);
  if (entryIndex < 0) return { status: "not_found" as const };
  const entry = structureRows[entryIndex];
  const kind = entry[0] as ThreadStructureEntry["kind"];
  const name = entry[2] || "";
  const updates: { range: string; values: string[][] }[] = [{ range: `${THREAD_STRUCTURE_SHEET}!F${entryIndex + 2}`, values: [["TRUE"]] }];
  const affectedItems = 0;
  if (kind === "folder") {
    structureRows.forEach((row, index) => {
      if ((row[3] || "") === id) updates.push({ range: `${THREAD_STRUCTURE_SHEET}!D${index + 2}`, values: [[""]] });
    });
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: "RAW", data: updates } });
  return { status: "deleted" as const, kind, name, affectedItems };
}

export type RelatedLink = { related_id: string; score: number; reason: string };
export type LinksMap = Record<string, RelatedLink[]>;

export async function getLinks(): Promise<LinksMap> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  let rows: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${LINKS_SHEET}!A2:E`,
    });
    rows = (res.data.values as string[][]) || [];
  } catch {
    return {}; // links 탭이 아직 없으면 빈 맵
  }
  const map: LinksMap = {};
  for (const row of rows) {
    const itemId = row[0];
    const relatedId = row[1];
    if (!itemId || !relatedId) continue;
    (map[itemId] ||= []).push({
      related_id: relatedId,
      score: parseFloat(row[2] || "0") || 0,
      reason: row[3] || "",
    });
  }
  for (const id of Object.keys(map)) {
    map[id].sort((a, b) => b.score - a.score);
  }
  return map;
}

export async function getAllItems(): Promise<Item[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const [res, structure] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A2:R` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${THREAD_STRUCTURE_SHEET}!A2:F` }),
  ]);

  const rows = res.data.values || [];
  const threadNames = new Map(((structure.data.values as string[][]) || []).filter((row) => row[0] === "thread" && row[1] && row[5] !== "TRUE").map((row) => [row[1], row[2] || ""]));
  return rows.map((row, i) => ({
    id: row[0] || "",
    created_at: row[1] || "",
    type: (row[2] || "article") as Item["type"],
    url: row[3] || "",
    title: row[4] || "",
    summary: row[5] || "",
    tags: row[6] || "",
    folder: row[7] || "",
    is_read: row[8] === "TRUE",
    read_at: row[9] || "",
    is_archived: row[10] === "TRUE",
    ideas: row[11] || "",
    action: row[12] || "",
    source: row[13] || "",
    thread: row[17] ? (threadNames.get(row[17]) || "") : (row[14] || ""),
    thread_id: row[17] || "",
    images: row[15] || "",
    value_rating: parseInt(row[16] || "0", 10) || 0,
    rowIndex: i + 2, // 1-indexed, skip header
  }));
}

export async function deleteItem(rowIndex: number) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!K${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["TRUE"]] },
  });
}

export async function updateItem(
  rowIndex: number,
  updates: {
    title?: string;
    ideas?: string;
    is_read?: boolean;
    thread?: string;
    thread_id?: string;
    tags?: string;
    value_rating?: number;
  }
) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const requests: { range: string; values: string[][] }[] = [];

  if (updates.title !== undefined) {
    requests.push({ range: `${SHEET_NAME}!E${rowIndex}`, values: [[updates.title]] });
  }
  if (updates.ideas !== undefined) {
    requests.push({ range: `${SHEET_NAME}!L${rowIndex}`, values: [[updates.ideas]] });
  }
  if (updates.is_read !== undefined) {
    requests.push({ range: `${SHEET_NAME}!I${rowIndex}`, values: [[updates.is_read ? "TRUE" : "FALSE"]] });
    if (updates.is_read) {
      const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\.\s*/g, "-").slice(0, 16);
      requests.push({ range: `${SHEET_NAME}!J${rowIndex}`, values: [[now]] });
    }
  }
  if (updates.thread !== undefined) {
    let threadId = updates.thread_id || "";
    if (updates.thread && !threadId) {
      const structure = await getThreadStructure();
      threadId = structure.find((entry) => entry.kind === "thread" && entry.name === updates.thread)?.id || "";
    }
    requests.push({ range: `${SHEET_NAME}!R${rowIndex}`, values: [[threadId]] });
    requests.push({ range: `${SHEET_NAME}!O${rowIndex}`, values: [[updates.thread]] });
  }
  if (updates.tags !== undefined) {
    requests.push({ range: `${SHEET_NAME}!G${rowIndex}`, values: [[updates.tags]] });
  }
  if (updates.value_rating !== undefined) {
    const r = Math.max(0, Math.min(3, Math.trunc(updates.value_rating)));
    requests.push({ range: `${SHEET_NAME}!Q${rowIndex}`, values: [[String(r)]] });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: requests,
      },
    });
  }
}

async function ensureObsidianQueue() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === OBSIDIAN_QUEUE_SHEET
  );
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: OBSIDIAN_QUEUE_SHEET } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${OBSIDIAN_QUEUE_SHEET}!A1:I1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "queued_at", "source", "item_id", "title", "url", "memo",
        "status", "synced_at", "obsidian_filename",
      ]],
    },
  });
}

export async function appendToObsidianQueue(args: {
  source: "telegram" | "web";
  itemId: string;
  title: string;
  url: string;
  memo: string;
}) {
  await ensureObsidianQueue();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const queuedAt = new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
    .replace("T", " ");
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${OBSIDIAN_QUEUE_SHEET}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        queuedAt, args.source, args.itemId, args.title, args.url, args.memo,
        "pending", "", "",
      ]],
    },
  });
}
