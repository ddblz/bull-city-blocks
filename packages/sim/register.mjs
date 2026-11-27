// Lets plain Node (22.15+, with built-in type stripping) run the workspace's TypeScript sources,
// which import sibling modules without the ".ts" extension. Workers inherit it via execArgv.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      const relative = /^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier);
      if (error?.code === "ERR_MODULE_NOT_FOUND" && relative)
        return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});
