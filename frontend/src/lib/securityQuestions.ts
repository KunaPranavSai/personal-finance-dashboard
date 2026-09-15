// Mirrors backend/src/lib/securityQuestions.ts — keep both in sync. Display
// only; the backend is the source of truth that validates `key` values.
export const SECURITY_QUESTIONS: { key: string; text: string }[] = [
  { key: "first_pet_name", text: "What was the name of your first pet?" },
  { key: "childhood_best_friend", text: "What was the first name of your childhood best friend?" },
  { key: "mother_maiden_name", text: "What is your mother's maiden name?" },
  { key: "first_school", text: "What was the name of your first school?" },
  { key: "birth_city", text: "In what city were you born?" },
  { key: "favorite_teacher", text: "What was the name of your favorite teacher?" },
];
