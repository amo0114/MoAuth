import { buildDiscoveryMetadata } from "@moauth/connect-contract";
import { getConnectIssuer } from "../config/env.js";

export function getDiscoveryMetadata() {
  return buildDiscoveryMetadata({ issuer: getConnectIssuer() });
}
