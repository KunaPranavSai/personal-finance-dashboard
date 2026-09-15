// Fixed, approved security-question list (Master Plan account-recovery v2).
// `key` is what's stored on SecurityQuestion.questionKey — never store or
// accept arbitrary free-text questions. Mirrored in
// frontend/src/lib/securityQuestions.ts for display; keep both in sync.
export const SECURITY_QUESTIONS: { key: string; text: string }[] = [
  { key: "first_pet_name", text: "What was the name of your first pet?" },
  { key: "childhood_best_friend", text: "What was the first name of your childhood best friend?" },
  { key: "mother_maiden_name", text: "What is your mother's maiden name?" },
  { key: "first_school", text: "What was the name of your first school?" },
  { key: "birth_city", text: "In what city were you born?" },
  { key: "favorite_teacher", text: "What was the name of your favorite teacher?" },
];

export const SECURITY_QUESTION_KEYS = new Set(SECURITY_QUESTIONS.map((q) => q.key));

export function securityQuestionText(key: string): string | undefined {
  return SECURITY_QUESTIONS.find((q) => q.key === key)?.text;
}

/** Consistent normalization applied before hashing AND before verifying, so
 * trivial formatting differences ("Fido", " fido ", "FIDO") don't cause a
 * correct answer to fail. Never log the input to this function. */
export function normalizeSecurityAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
