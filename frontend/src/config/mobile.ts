const DEFAULT_MOBILE_BUILD_PAGE =
  'https://expo.dev/accounts/karina1234/projects/mobile/builds/3c71cdad-64c2-411c-9606-5289955f0b5f';

export function getMobileBuildPageUrl(): string {
  const fromEnv = process.env.REACT_APP_MOBILE_BUILD_URL?.trim();
  return fromEnv || DEFAULT_MOBILE_BUILD_PAGE;
}
