/**
 * Generic data-API call helper.
 *
 * Stubbed out post-Manus migration: PALIMPS does not currently use
 * the Manus data API gateway. Replace with direct fetch() calls when
 * a specific external API is needed.
 */
export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  _apiId: string,
  _options: DataApiCallOptions = {},
): Promise<unknown> {
  throw new Error(
    "callDataApi() is no longer wired to a gateway. Call the target external " +
      "API directly with fetch() instead.",
  );
}
