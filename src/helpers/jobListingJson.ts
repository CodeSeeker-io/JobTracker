import { z } from "zod";

/**
 * All required fields for a job listing.
 */
const requiredFields = [
  "company",
  "jobTitle",
  "location",
  "appStatus",
  "url",
  "notes",
  "dateSubmitted",
  "dateLastModified",
] as const satisfies readonly string[];
type RequiredField = typeof requiredFields[number];

/**
 * Validator for any Google Sheets cells values that are JSON-serializable.
 */
const jsonSheetCellValidator = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Validator for a row of cell values from a Google Sheets spreadsheet.
 */
const jsonSheetRowValidator = jsonSheetCellValidator
  .array()
  .nonempty()
  .min(requiredFields.length);

/**
 * Validator for any kind of data that comes from the Google Sheets API that
 * at least vaguely meets the loose requirements for a job search database.
 */
const apiDataSchema = z.object({
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

/** Used with isRequiredField */
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

type JobListing = z.infer<typeof jobListingValidator>;
type PartialJobListing = Partial<JobListing> & Pick<JobListing, "extraFields">;

/**
 * Takes a set of validated field names and data rows and restructures them into
 * JSON objects.
 *
 * Objects are not validated for the proper structure; this needs to happen in
 * a separate validation step.
 */
const recordsTransformer = apiDataSchema.transform((apiData) => {
  const fieldIndices = new Map(
    apiData.fields.map((field, index) => [index, field])
  );

  return apiData.rows.map((row) => {
    const result: PartialJobListing = { extraFields: {} };
    for (const [index, cellValue] of row.entries()) {
      const recordKey = fieldIndices.get(index) ?? "";

      if (isRequiredField(recordKey)) {
        if (typeof cellValue !== "string") continue;
        result[recordKey] = cellValue;
      } else {
        result.extraFields[recordKey] = cellValue;
      }
    }

    return result;
  });
});

/**
 * Takes any kind of Google Sheets API data (fields and rows), and parses out as
 * many Job Listings as it can.
 *
 * Will always return an array, even if nothing could be parsed.
 */
function parseJobListings(apiData: unknown): JobListing[] {
  const recordsResult = recordsTransformer.safeParse(apiData);
  if (!recordsResult.success) {
    return [];
  }

  return recordsResult.data.flatMap((record) => {
    const listingResult = jobListingValidator.safeParse(record);
    return listingResult.success ? [listingResult.data] : [];
  });
}

export { parseJobListings, requiredFields };
export type { JobListing, RequiredField };
