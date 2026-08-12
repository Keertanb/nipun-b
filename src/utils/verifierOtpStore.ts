/** In-memory reset session after OTP is verified against otp_log. */
type ResetTokenEntry = {
	clusterId: string;
	email: string;
	expiresAt: number;
};

const resetTokenStore = new Map<string, ResetTokenEntry>();
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email: string) {
	return String(email || '').trim().toLowerCase();
}

export function issuePasswordResetToken(email: string, clusterId: string) {
	const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
	resetTokenStore.set(token, {
		clusterId: String(clusterId),
		email: normalizeEmail(email),
		expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
	});
	return token;
}

export function consumePasswordResetToken(token: string) {
	const entry = resetTokenStore.get(String(token || ''));
	if (!entry) return null;
	resetTokenStore.delete(String(token));
	if (Date.now() > entry.expiresAt) return null;
	return entry;
}

export function generateSixDigitOtp() {
	return String(Math.floor(100000 + Math.random() * 900000));
}
