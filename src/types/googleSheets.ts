import { Json } from "./general";

/**
 * A set of basic methods representing a cell image that exists, but is not yet
 * ready to be inserted into a sheet. This type does not exist in the GAS type
 * library for some reason.
 */
export type CellImage = {
  getAltTextDescription: () => string;
  getAltTextTitle: () => string;
  getContentUrl: () => string;
  getUrl: () => string;
  toBuilder: () => CellImageBuilder;
};

/**
 * The builder form for a CellImage. This is a CellImage that is ready to be
 * inserted.
 *
 * Calling range.getValues() on a sheet with an image will give you one of
 * these. This type does not exist in the GAS type library.
 */
export type CellImageBuilder = CellImage & {
  build: () => CellImage;
  setAltTextDescription: (newDescription: string) => CellImage;
  setAltTextTitle: (newTitle: string) => CellImage;
  setSourceUrl: (newUrl: string) => CellImageBuilder;
};

export type CellValue = string | number | boolean | Date | CellImageBuilder;
export type JsonCellValue = CellValue & Json;
