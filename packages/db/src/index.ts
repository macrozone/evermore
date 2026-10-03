import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export { PrismaClient, Prisma } from "./generated/prisma/client.js";
export type { Player } from "./generated/prisma/client.js";

/** Create one client per app/service and disconnect it when the process exits. */
export function createDb(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error("DATABASE_URL is required to connect to the Evermore database");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
