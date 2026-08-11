type OtpEntry = {
	otp: string;
	clusterId: string;
	expiresAt: number;
	attempts: number;
};

type ResetTokenEntry = {
	clusterId: string;
	email: string;
	expiresAt: number;
};

const otpStore = new Map<string, OtpEntry>();
const resetTokenStore = new Map<string, ResetTokenEntry>();

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string) {
	return String(email || '').trim().toLowerCase();
}

export function saveVerifierOtp(email: string, clusterId: string, otp: string) {
	const key = normalizeEmail(email);
	otpStore.set(key, {
		otp,
		clusterId: String(clusterId),
		expiresAt: Date.now() + OTP_TTL_MS,
		attempts: 0,
	});
}

export function verifyStoredVerifierOtp(email: string, otp: string) {
	const key = normalizeEmail(email);
	const entry = otpStore.get(key);
	if (!entry) return { ok: false as const, reason: 'missing' };
	if (Date.now() > entry.expiresAt) {
		otpStore.delete(key);
		return { ok: false as const, reason: 'expired' };
	}
	entry.attempts += 1;
	if (entry.attempts > MAX_ATTEMPTS) {
		otpStore.delete(key);
		return { ok: false as const, reason: 'locked' };
	}
	if (String(otp).trim() !== entry.otp) {
		return { ok: false as const, reason: 'invalid' };
	}
	otpStore.delete(key);
	return { ok: true as const, clusterId: entry.clusterId };
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
