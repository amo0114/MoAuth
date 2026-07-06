import { waitForServices } from "./helpers/services.js";

export default async function globalSetup() {
  await waitForServices();
}