/** Options for `get()` / `resolve()` lookups. */
export interface GetOptions {
	/** Return undefined instead of throwing ProviderNotFoundError. */
	optional?: boolean;
}
