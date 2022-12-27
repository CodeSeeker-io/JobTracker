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
export type RequiredField = typeof requiredFields[number];

/**
 * Validator for any Google Sheets cells values that are JSON-serializable.
 */
const jsonSheetCellSchema = z.union([z.string(), z.number(), z.boolean()]);

const jsonSheetRowSchema = jsonSheetCellSchema
  .array()
  .nonempty()
  .min(requiredFields.length);

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
  rows: z.array(jsonSheetRowSchema),
});

const requiredFieldsSet = new Set(requiredFields);
function isRequiredField(value: unknown): value is RequiredField {
  return requiredFieldsSet.has(value as RequiredField);
}

/**
 * @todo See if there's a better way to keep this and requiredFields in sync at
 * compile time, rather than having to use a bunch of test suites to verify data
 * can be parsed properly.
 */
const jobListingSchema = z.object({
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  appStatus: z.string().min(1),
  dateSubmitted: z.string().datetime(),
  dateLastModified: z.string().datetime(),
  extraFields: z.record(jsonSheetCellSchema),

  // "Optional" fields; will always be strings, but can be empty
  location: z.string(),
  notes: z.string(),
  url: z.union([z.literal(""), z.string().url()]),
});

export type JobListing = z.infer<typeof jobListingSchema>;
type PartialJobListing = Partial<JobListing> & Pick<JobListing, "extraFields">;

const recordsTransformer = apiDataSchema.transform((apiData) => {
  const fieldIndices = new Map(
    apiData.fields.map((field, index) => [index, field])
  );

  return apiData.rows.map((row) => {
    const result: PartialJobListing = { extraFields: {} };
    for (const [index, cellValue] of row.entries()) {
      const recordKey = fieldIndices.get(index);

      if (isRequiredField(recordKey) && typeof cellValue === "string") {
        result[recordKey] = cellValue;
      } else if (recordKey === "extraFields") {
        result.extraFields[recordKey] = cellValue;
      }
    }

    return result;
  });
});

/**
 * Takes any kind of API data, and parses out as many Job Listings as it can.
 * Will always return an array, even if nothing could be parsed.
 */
export function parseJobListings(apiData: unknown): JobListing[] {
  const recordsResult = recordsTransformer.safeParse(apiData);
  if (!recordsResult.success) {
    return [];
  }

  return recordsResult.data.flatMap((record) => {
    const listingResult = jobListingSchema.safeParse(record);
    return listingResult.success ? [listingResult.data] : [];
  });
}
