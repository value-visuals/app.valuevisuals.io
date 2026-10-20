/** Avoid exposing Firebase internal details or user enumeration in the UI. */
export function authErrorMessage(error: unknown, action: "signin" | "signup" = "signin"): string {
  const code = (error as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-api-key":
    case "auth/app-not-authorized":
    case "auth/invalid-app-credential":
      return "Firebase configuration is invalid. Check the project's Firebase web app variables in .env.local.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is disabled in Firebase. Enable it in Authentication > Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized by Firebase. Check Authentication > Settings > Authorized domains.";
    case "auth/network-request-failed":
      return "Firebase could not be reached. Check your internet connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later or reset your password.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/weak-password":
      return "Please choose a stronger password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try signing in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Unable to sign in. Check your email and password.";
    default:
      return action === "signup" ? "Unable to create an account. Please try again." : "Unable to sign in. Check your credentials and try again.";
  }
}
