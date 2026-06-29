const DEFAULT_PRODUCT_NAME = "MoYuan ID";

function publicEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

export const identityBrand = Object.freeze({
  productName: publicEnv("NEXT_PUBLIC_IDENTITY_PRODUCT_NAME", DEFAULT_PRODUCT_NAME),
  accountName: publicEnv("NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME", publicEnv("NEXT_PUBLIC_IDENTITY_PRODUCT_NAME", DEFAULT_PRODUCT_NAME)),
  gatewayName: publicEnv("NEXT_PUBLIC_IDENTITY_GATEWAY_NAME", "Connect"),
  publicDomain: publicEnv("NEXT_PUBLIC_IDENTITY_PUBLIC_DOMAIN", "id.example.com"),
  supportEmail: publicEnv("NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL", "support@example.com"),
});
