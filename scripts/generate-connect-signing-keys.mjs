#!/usr/bin/env node
/**
 * Generate Connect production-jwks signing keys (RS256 default, ES256 optional).
 *
 * Usage:
 *   node scripts/generate-connect-signing-keys.mjs
 *   node scripts/generate-connect-signing-keys.mjs --alg ES256 --out-dir secrets/connect-signing
 *
 * Never prints private key material to stdout/stderr.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    alg: "RS256",
    outDir: path.join(repoRoot, "secrets", "connect-signing"),
    kid: "moauth-connect-1",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--alg" && argv[i + 1]) {
      options.alg = String(argv[++i]).toUpperCase();
      continue;
    }
    if (arg === "--out-dir" && argv[i + 1]) {
      options.outDir = path.resolve(repoRoot, argv[++i]);
      continue;
    }
    if (arg === "--kid" && argv[i + 1]) {
      options.kid = String(argv[++i]).trim();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  if (!["RS256", "ES256"].includes(options.alg)) {
    throw new Error(`Unsupported --alg ${options.alg}. Use RS256 (default) or ES256.`);
  }

  return options;
}

function printHelp() {
  console.log(`Generate Connect OIDC signing keys

Options:
  --alg RS256|ES256     Signing algorithm (default: RS256)
  --out-dir <path>      Output directory (default: secrets/connect-signing)
  --kid <kid>           JWKS key id (default: moauth-connect-1)

Outputs:
  private.pem           PKCS#8 private key (gitignored)
  public.pem            SPKI public key
  connect-signing.env.snippet   Safe env template (no private key inline)
`);
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  const { privateKey, publicKey } = await generateKeyPair(options.alg, { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  await mkdir(options.outDir, { recursive: true });

  const privatePath = path.join(options.outDir, "private.pem");
  const publicPath = path.join(options.outDir, "public.pem");
  const snippetPath = path.join(options.outDir, "connect-signing.env.snippet");

  await writeFile(privatePath, `${privatePem}\n`, { mode: 0o600 });
  await writeFile(publicPath, `${publicPem}\n`, { mode: 0o644 });

  const snippet = `# Connect production-jwks signing (generated ${new Date().toISOString()})
# Recommended: keep private key on disk; do not commit private.pem.
MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=${options.alg}
MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=${options.kid}
MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=${privatePath}

# Optional inline PEM (prefer PRIVATE_KEY_FILE in production):
# MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"

# Connect issuer (set to your public Connect URL):
# MOAUTH_CONNECT_ISSUER=https://connect.example.com
# MOAUTH_CONNECT_PUBLIC_URL=https://connect.example.com
`;

  await writeFile(snippetPath, snippet, { mode: 0o644 });

  console.log("Connect signing keys generated.");
  console.log(`  algorithm: ${options.alg}`);
  console.log(`  kid: ${options.kid}`);
  console.log(`  private key file: ${privatePath}`);
  console.log(`  public key file: ${publicPath}`);
  console.log(`  env snippet: ${snippetPath}`);
  console.log("Private key material was written to disk only (not printed).");
}

main().catch((error) => {
  console.error(`Key generation failed: ${error?.message || error}`);
  process.exitCode = 1;
});