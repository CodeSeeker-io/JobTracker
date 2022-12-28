/**
 * @file Exposes a collection of functions, validators, and types used for very
 * general Google Sheets interop.
 *
 * @todo Flesh out getSpreadsheetData to make a proper connection to the Sheets
 * API (particularly when getting API keys).
 */
import { z } from "zod";
import { BASE_SHEETS_API_URL } from "@/constants/googleSheets";
import { Result as Result } from "@/types/general";

/**
 * Validator for any Google Sheets cells values that are JSON-serializable.
 */
export const jsonSheetCellValidator = z.union([
  z.string(),
  z.number(),
  z.boolean(),
]);

/**
 * Validator for a row of cell values from a Google Sheets spreadsheet.
 */
export const jsonSheetRowValidator = jsonSheetCellValidator.array().nonempty();

/**
 * Takes the initial API response, and:
 * 1. Does basic validation on the structure of the data
 * 2. Strips the data of extra properties
 * 3. Splits the values into separate fields and data rows
 */
export const apiResponseValidator = z.object({
  range: z.string(),
  majorDimension: z.literal("ROWS"),
  values: z.array(jsonSheetRowValidator).nonempty(),
});

export type SheetsApiResponse = z.infer<typeof apiResponseValidator>;

export async function getSpreadsheetData(
  spreadsheetId: string
): Promise<Result<SheetsApiResponse>> {
  const response = await fetch(`${BASE_SHEETS_API_URL}/${spreadsheetId}`);

  if (!response.ok) {
    throw new Error(`Error during GET request.`);
  }

  try {
    const result: unknown = await response.json();
    return { ok: true, data: apiResponseValidator.parse(result) };
  } catch (err: unknown) {
    const formattedError =
      err instanceof Error ? err : new Error(`Non-error ${err} thrown`);
    return { ok: false, error: formattedError };
  }
}
