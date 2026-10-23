import { registerHooks } from 'node:module';

/** Add Node's required extension before a query or hash, leaving packages and explicit files alone. */
export function resolveTypeScriptSpecifier(specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const suffixAt = specifier.search(/[?#]/);
  const path = suffixAt < 0 ? specifier : specifier.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? '' : specifier.slice(suffixAt);
  return /\.[a-z]+$/i.test(path) ? specifier : `${path}.ts${suffix}`;
}

/** Scope this hook to a dynamic import; callers deregister it in a finally block. */
export function registerTypeScriptImports() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(resolveTypeScriptSpecifier(specifier), context);
    },
  });
}
