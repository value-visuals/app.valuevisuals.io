// src/lib/getApiUrl.ts
export function getApiUrl() {
  return process.env.LOCAL_TESTING === "true"
    ? process.env.TEST_API_URL!
    : process.env.PROD_API_URL!;
}

