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

export async function getAllItems(): Promise<Item[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:P`,
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
  updates: { title?: string; ideas?: string; is_read?: boolean; thread?: string; tags?: string }
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
