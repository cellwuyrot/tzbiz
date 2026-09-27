export const buildOrderUrl = (baseUrl: string, slug: string) => {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ service: slug }).toString();
  return url.toString();
};
