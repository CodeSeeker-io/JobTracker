import { z } from "zod";

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

/**
 * Validator for any Google Sheets cells values that are JSON-serializable.
 */
const jsonSheetCellValidator = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Validator for a row of cell values from a Google Sheets spreadsheet.
 */
// nonempty and min seem redundant, but it does change the resulting value's
// type - particularly what can safely be destructured from it
const jsonSheetRowValidator = jsonSheetCellValidator
  .array()
  .nonempty()
  .min(requiredFields.length);

/**
 * Takes the initial API response, and:
 * 1. Does basic validation on the structure of the data
 * 2. Strips the data of extra properties
 * 3. Splits the values into separate fields and data rows
 */
const initialResponseProcessor = z
  .object({
    majorDimension: z.literal("ROWS"),
    values: z.array(jsonSheetRowValidator).nonempty().min(2),
  })
  .transform((data) => {
    const [fieldsRow, ...dataRows] = data.values;
    return { fields: fieldsRow, rows: dataRows };
  });

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
const jobListingValidator = z.object({
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

/**
 * Validator for API data that has been cleaned and split into separate fields
 * and data rows.
 */
const apiDataValidator = z.object({
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
  rows: z.array(jsonSheetRowValidator),
});

/** Represents a single job listing added by the user. */
export type JobListing = z.infer<typeof jobListingValidator>;

/** A JobListing that has all properties set to optional, except extraFields. */
type PartialJobListing = Partial<JobListing> & Pick<JobListing, "extraFields">;

/**
 * Takes a set of validated field names and data rows and restructures them into
 * JSON objects.
 *
 * Objects are not validated for the proper structure; this needs to happen in
 * a separate validation step.
 */
const recordsTransformer = apiDataValidator
  .transform((apiData) => {
    const fieldIndices = new Map(
      apiData.fields.map((field, index) => [index, field])
    );

    return apiData.rows.map((row) => {
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
  })
  .transform((records) => {
    return records.flatMap((record) => {
      const listingResult = jobListingValidator.safeParse(record);
      return listingResult.success ? [listingResult.data] : [];
    });
  });

/** Fully validates and transforms data from the Google Sheets API. */
const jobListingDataPipeline = z.pipeline(
  initialResponseProcessor,
  recordsTransformer
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
