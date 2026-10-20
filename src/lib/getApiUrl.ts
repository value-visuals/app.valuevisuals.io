/** Existing Node API origin; never transmit Firebase ID tokens over plaintext HTTP. */
export function getApiUrl(): string {
  const local = process.env.LOCAL_TESTING === "true";
  const raw = local ? process.env.TEST_API_URL : process.env.PROD_API_URL;
  if (!raw) throw new Error("Missing backend API origin. Configure PROD_API_URL or TEST_API_URL.");
  const address = new URL(raw);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname);
  if (address.protocol !== "https:" && !(local && loopback && address.protocol === "http:")) {
    throw new Error("The backend API must use HTTPS (HTTP is allowed only on loopback in local testing).");
  }
  if (address.username || address.password || address.search || address.hash) {
    throw new Error("Backend API URL must not include userinfo, queries or fragments.");
  }
  return raw.replace(/\/+$/, "");
}
