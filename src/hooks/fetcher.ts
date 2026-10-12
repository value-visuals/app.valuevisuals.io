export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    next: {
      revalidate: 15 * 60,
    },
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (res.status !== 200) {
    throw new Error("An error occurred while fetching the data");
  }
  return res.json();
};
