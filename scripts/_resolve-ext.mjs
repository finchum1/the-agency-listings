// Lets a plain node script import the app's Vite-style source (extensionless imports like "./teams"). Used by the check-*.mjs scripts.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && /^\.{1,2}\//.test(specifier)) {
      for (const ext of [".js", ".jsx", "/index.js"]) {
        try {
          return await next(specifier + ext, context);
        } catch {
          // try the next one
        }
      }
    }
    throw err;
  }
}
