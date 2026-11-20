import { enginePathsIn } from "@openinary/core/light";

/** public/, cache/ and temp/ in the working directory (apps/api in images). */
export const enginePaths = enginePathsIn(process.cwd());
