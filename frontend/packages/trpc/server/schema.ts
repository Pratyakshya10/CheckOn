import { z } from "zod";

/** Empty input for no-arg procedures. */
export const emptyInput = z.object({}).strict();

export { z };
