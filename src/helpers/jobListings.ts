import { z } from "zod";
import {
  apiResponseValidator,
  jsonSheetCellValidator,
  jsonSheetRowValidator,
} from "./sheetsApi";

/**
 * All required fields for a job listing.
 */
export const requiredFields = [
  "company",
  "jobTitle",
  "location",
  "appStatus",
  "url",
  "notes",
  "dateSubmitted",
  "dateLastModified",
] as const satisfies readonly string[];

/** An individual required field in a spreadsheet's fields. */
export type RequiredField = typeof requiredFields[number];

/** Used with isRequiredField helper function */
const requiredFieldsSet = new Set(requiredFields);

/** Provides type narrowing info about whether a value is a RequiredField. */
function isRequiredField(value: unknown): value is RequiredField {
  return requiredFieldsSet.has(value as RequiredField);
}

/**
 * Validator for a JobListing object for use throughout the React app.
 *
 * @todo See if there's a better way to keep this and requiredFields in sync at
 * compile time, rather than having to use a bunch of test suites to verify that
 * data can be parsed properly.
 */
export const jobListingValidator = z.object({
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  appStatus: z.string().min(1),
  dateSubmitted: z.string().datetime(),
  dateLastModified: z.string().datetime(),
  extraFields: z.record(jsonSheetCellValidator),

  // "Optional" fields; will always be strings, but can be empty
  location: z.string(),
  notes: z.string(),
  url: z.union([z.literal(""), z.string().url()]),
});

/** Represents a single job listing added by the user. */
export type JobListing = z.infer<typeof jobListingValidator>;

/** A JobListing that has all properties set to optional, except extraFields. */
type PartialJobListing = Partial<JobListing> & Pick<JobListing, "extraFields">;

const rowSplitTransformer = apiResponseValidator.transform((data) => {
  const [fieldRow, ...dataRows] = data.values;
  return { fields: fieldRow, rows: dataRows };
});

const jobListingRowValidator = z.object({
  fields: z
    .string()
    .array()
    .min(requiredFields.length)
    .refine((apiFields) => apiFields.length === new Set(apiFields).size, {
      message: "Duplicate column names found in fields row.",
    })
    .refine(
      (apiFields) => requiredFields.every((rf) => apiFields.includes(rf)),
      { message: "Not all required fields present in fields property." }
    ),
  rows: z.array(jsonSheetRowValidator.min(requiredFields.length)),
});

/**
 * Takes a set of validated field names and data rows and extracts as many
 * JobListing objects from them as possible.
 */
const jobListingTransformer = jobListingRowValidator.transform(
  function toJobListings(apiData) {
    const fieldIndices = new Map(
      apiData.fields.map((field, index) => [index, field])
    );

    const partials = apiData.rows.map((row) => {
      const record: PartialJobListing = { extraFields: {} };
      for (const [index, cellValue] of row.entries()) {
        const recordKey = fieldIndices.get(index) ?? "";

        if (isRequiredField(recordKey)) {
          if (typeof cellValue !== "string") continue;
          record[recordKey] = cellValue;
        } else {
          record.extraFields[recordKey] = cellValue;
        }
      }

      return record;
    });

    return partials.flatMap((record) => {
      const listingResult = jobListingValidator.safeParse(record);
      return listingResult.success ? [listingResult.data] : [];
    });
  }
);

/** Fully validates and transforms data from the Google Sheets API. */
const jobListingDataPipeline = z.pipeline(
  rowSplitTransformer,
  jobListingTransformer
);

/**
 * Takes any kind of Google Sheets API data (fields and rows), and parses out as
 * many Job Listings as it can.
 *
 * Will always return an array, even if nothing could be parsed.
 */
export function parseJobListings(apiData: unknown): JobListing[] {
  const parseResult = jobListingDataPipeline.safeParse(apiData);
  return parseResult.success ? parseResult.data : [];
}
