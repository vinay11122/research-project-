export function getTrackedLink(
  emailId: string,
  linkId: string
) {
  return `/track/click/${emailId}/${linkId}`
}
