/**
 * Validation utilities for TUI prompts
 */

/**
 * Validates that a string is not empty
 */
export function validateNotEmpty(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return "This field is required";
	}
}

/**
 * Validates that a name follows PascalCase convention
 */
export function validatePascalCase(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return "Name is required";
	}

	const trimmed = value.trim();

	// Check if it starts with uppercase letter
	if (!/^[A-Z]/.test(trimmed)) {
		return "Name must start with an uppercase letter (PascalCase)";
	}

	// Check if it contains only alphanumeric characters
	if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
		return "Name must contain only letters and numbers (no spaces or special characters)";
	}

	return undefined;
}

/**
 * Validates that a name follows kebab-case convention
 */
export function validateKebabCase(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return "Name is required";
	}

	const trimmed = value.trim();

	// Check if it follows kebab-case
	if (!/^[a-z][a-z0-9-]*$/.test(trimmed)) {
		return "Name must be in kebab-case (lowercase letters, numbers, and hyphens only)";
	}

	return undefined;
}

/**
 * Validates that a path is valid
 */
export function validatePath(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return "Path is required";
	}

	const trimmed = value.trim();

	// Basic path validation - allow relative and absolute paths (including Windows paths with colons)
	if (!/^[a-zA-Z0-9._\-/\\:]+$/.test(trimmed)) {
		return "Path contains invalid characters";
	}

	return undefined;
}

/**
 * Validates a service or module name
 */
export function validateComponentName(value: string): string | undefined {
	const emptyCheck = validateNotEmpty(value);
	if (emptyCheck) return emptyCheck;

	const pascalCheck = validatePascalCase(value);
	if (pascalCheck) return pascalCheck;

	return undefined;
}
