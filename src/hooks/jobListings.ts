/**
 * @file Provides the connectors for the boundaries between the frontend app
 * and the various Google Sheet APIs.
 *
 * @todo Get a lot of this logic fleshed out. A lot of it is half-implemented,
 * due to unfamiliarity with the Sheets API.
 *
 * One concern is that in order to transform a JobListing object into a row, the
 * code might need to grab the header row to determine how the object properties
 * should be serialized into an array - namely, in which order.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSpreadsheetData, SheetsApiResponse } from "@/helpers/sheetsApi";
import { JobListing, parseJobListings } from "@/helpers/jobListings";
import { JsonCellValue } from "../types/googleSheets";
import { NonEmptyArray, Result } from "../types/general";
import { BASE_SHEETS_API_URL } from "@/constants/googleSheets";

const baseQueryKey = "jobListings";

function toNewSheetRows(
  apiData: SheetsApiResponse,
  ...jobListings: JobListing[]
): Result<JsonCellValue[][]> {}

async function postJobListing(
  spreadsheetId: string,
  payload: JobListing | JobListing[]
): Promise<void> {
  const prevSpreadsheetResult = await getSpreadsheetData(spreadsheetId);
  if (!prevSpreadsheetResult.ok) {
    throw prevSpreadsheetResult.error;
  }

  const newSpreadsheetRows = Array.isArray(payload)
    ? toNewSheetRows(prevSpreadsheetResult.data, ...payload)
    : toNewSheetRows(prevSpreadsheetResult.data, payload);

  const response = await fetch(`${BASE_SHEETS_API_URL}/${spreadsheetId}`, {
    method: "POST",
    body: JSON.stringify(newSpreadsheetRows),
  });

  if (!response.ok) {
    throw new Error(`Error when posting new spreadsheet values`);
  }
}

async function getJobListings(spreadsheetId: string): Promise<JobListing[]> {
  const spreadsheetResult = await getSpreadsheetData(spreadsheetId);
  if (!spreadsheetResult.ok) {
    throw spreadsheetResult.error;
  }

  return parseJobListings(spreadsheetResult.data);
}

export function useGetJobListings(spreadsheetId: string) {
  return useQuery({
    queryKey: [baseQueryKey, spreadsheetId],
    queryFn: () => getJobListings(spreadsheetId),
  });
}

export function usePostJobListings(spreadsheetId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: JobListing | NonEmptyArray<JobListing>) =>
      postJobListing(spreadsheetId, data),
    onSuccess: () => client.invalidateQueries([baseQueryKey, spreadsheetId]),
  });
}
