export const REQUEST_SERVICE_EVENT = "trioz:request-service";
export function requestServiceUrl(slug?: string) {
  return slug
    ? `/?requestService=${encodeURIComponent(slug)}#contact`
    : "/#contact";
}
