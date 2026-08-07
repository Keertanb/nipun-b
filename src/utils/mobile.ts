/**
 * Normalize Indian mobile numbers from SSO / registry payloads.
 */
export function normalizeMobile(mobile: string): string {
	const digits = String(mobile || '').replace(/\D/g, '');
	if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
	if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
	return digits;
}
