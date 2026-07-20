import * as zod from "zod";

// Configuration parsing does not need runtime code generation. Apply this
// before any private schema is created and route all repository Zod use here.
zod.config({ jitless: true });

export { zod as privateZod };
