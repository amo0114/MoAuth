const DEFAULT_PRODUCT_NAME = "Aura";

function publicEnv(value, fallback) {
  return value && value.trim() ? value : fallback;
}

const productName = publicEnv(
  process.env.NEXT_PUBLIC_IDENTITY_PRODUCT_NAME,
  DEFAULT_PRODUCT_NAME
);

export const identityBrand = Object.freeze({
  productName,
  accountName: publicEnv(
    process.env.NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME,
    productName
  ),
  gatewayName: publicEnv(process.env.NEXT_PUBLIC_IDENTITY_GATEWAY_NAME, "Connect"),
  connectBaseUrl: publicEnv(
    process.env.NEXT_PUBLIC_IDENTITY_CONNECT_URL,
    "http://127.0.0.1:3000"
  ),
  supportEmail: publicEnv(
    process.env.NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL,
    "support@example.com"
  ),
  slogan: publicEnv(process.env.NEXT_PUBLIC_IDENTITY_SLOGAN, "入本源，见真知。"),
  logos: Object.freeze({
    default: "/brand/aura-logo-mark.png",
    light: "/brand/aura-logo-mark-light.png",
    dark: "/brand/aura-logo-mark-dark.png",
  }),
});
