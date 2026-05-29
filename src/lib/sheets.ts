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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:Q`,
  });

  const rows = res.data.values || [];
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
    thread: row[14] || "",
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
