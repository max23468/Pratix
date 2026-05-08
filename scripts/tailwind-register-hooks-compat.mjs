import nodeModule, { isBuiltin, registerHooks, syncBuiltinESMExports } from "node:module";

const originalRegister = nodeModule.register?.bind(nodeModule);
const registeredTailwindLoaders = new Set();

if (typeof originalRegister === "function" && typeof registerHooks === "function") {
  nodeModule.register = function register(specifier, parentURL, options) {
    if (isTailwindEsmCacheLoader(specifier)) {
      const loaderUrl = String(specifier);

      if (!registeredTailwindLoaders.has(loaderUrl)) {
        registerHooks({
          resolve(importSpecifier, context, nextResolve) {
            const result = nextResolve(importSpecifier, context);

            if (result.url === loaderUrl || isBuiltin(result.url) || !context.parentURL) {
              return result;
            }

            const id = new URL(context.parentURL).searchParams.get("id");
            if (id === null) {
              return result;
            }

            const url = new URL(result.url);
            url.searchParams.set("id", id);

            return { ...result, url: `${url}` };
          },
        });

        registeredTailwindLoaders.add(loaderUrl);
      }

      return;
    }

    return originalRegister(specifier, parentURL, options);
  };

  syncBuiltinESMExports();
}

function isTailwindEsmCacheLoader(specifier) {
  try {
    const url = specifier instanceof URL ? specifier : new URL(String(specifier));
    return (
      url.protocol === "file:" &&
      url.pathname.endsWith("/node_modules/@tailwindcss/node/dist/esm-cache.loader.mjs")
    );
  } catch {
    return false;
  }
}
