import fs from "fs";
import path from "path";

const root = "d:/Gnet-New-CRM";
const permFile = fs.readFileSync(`${root}/Frontend/src/constants/permissions.js`, "utf8");
const keys = [...permFile.matchAll(/key: "([A-Z_]+)"/g)].map((m) => m[1]);

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) walk(p);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(e.name) && e.name !== "_perm_audit.mjs") files.push(p);
  }
}
walk(`${root}/Frontend/src`);
walk(`${root}/Backend`);

const onlyCatalog = [];
const feOnly = [];
const beOnly = [];
const both = [];

for (const k of keys) {
  const refs = files.filter((f) => fs.readFileSync(f, "utf8").includes(k));
  const nonCat = refs.filter((f) => !f.endsWith("permissions.js"));
  if (nonCat.length === 0) onlyCatalog.push(k);
  const inFe = nonCat.some((f) => f.includes("Frontend"));
  const inBe = nonCat.some((f) => f.includes("Backend"));
  if (inFe && inBe) both.push(k);
  else if (inFe) feOnly.push(k);
  else if (inBe) beOnly.push(k);
}

// Extract P object and sidebar keys from mockData
const routes = fs.readFileSync(`${root}/Frontend/src/routes/AppRoutes.jsx`, "utf8");
const mock = fs.readFileSync(`${root}/Frontend/src/data/mockData.js`, "utf8");
const routePerms = new Set([...routes.matchAll(/"[A-Z][A-Z0-9_]+"/g)].map((m) => m[0].slice(1, -1)));
const sidebarPerms = new Set([...mock.matchAll(/"[A-Z][A-Z0-9_]+"/g)].map((m) => m[0].slice(1, -1)));

const catalogNotInSidebar = keys.filter((k) => !sidebarPerms.has(k));
const sidebarNotInCatalog = [...sidebarPerms].filter((k) => k.includes("_") && !keys.includes(k));

// Module CRUD completeness in catalog
const modules = new Map();
for (const k of keys) {
  const m = k.match(/^(VIEW|CREATE|EDIT|DELETE|MANAGE|PUNCH|APPROVE|SEND)_(.+)$/);
  if (m) {
    const mod = m[2];
    if (!modules.has(mod)) modules.set(mod, new Set());
    modules.get(mod).add(m[1]);
  } else {
    if (!modules.has(k)) modules.set(k, new Set());
    modules.get(k).add("SPECIAL");
  }
}

const incompleteModules = [];
for (const [mod, actions] of modules) {
  const std = ["VIEW", "CREATE", "EDIT", "DELETE", "MANAGE"];
  const hasAnyCrud = std.some((a) => actions.has(a));
  if (!hasAnyCrud) continue;
  const missing = std.filter((a) => !actions.has(a));
  if (missing.length) incompleteModules.push({ mod, missing: missing.join(", "), have: [...actions].join(", ") });
}

// Pages in AppRoutes without hasPermission in file
const pageImports = [...routes.matchAll(/pages\/([^"]+)/g)].map((m) => m[1]);
const pagesNoPermCheck = [];
for (const rel of new Set(pageImports)) {
  const candidates = files.filter((f) => f.replace(/\\/g, "/").includes(rel.replace(/\.jsx?$/, "")));
  if (!candidates.length) continue;
  const content = candidates.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  if (!/hasPermission|canCreate|canEdit|canDelete|canView|permissionGranted|canEditLead|canDeleteLead/.test(content)) {
    pagesNoPermCheck.push(rel);
  }
}

// Backend admin routes without checkPermission
const adminRoutes = fs.readFileSync(`${root}/Backend/routes/admin.routes.js`, "utf8");
const lines = adminRoutes.split("\n");
const routesNoCheck = lines.filter((l) => /^router\.(get|post|put|patch|delete)\(/.test(l) && !l.includes("checkPermission"));

const keysNoBackendEnforcement = [];
const backendScanFiles = files.filter((f) => f.includes("Backend") && !f.endsWith("permissions.js"));
for (const k of keys) {
  const inRoutes = backendScanFiles.some(
    (f) => f.includes("routes") && fs.readFileSync(f, "utf8").includes(k)
  );
  const inControllers = backendScanFiles.some(
    (f) => f.includes("controllers") && fs.readFileSync(f, "utf8").includes(k)
  );
  const inMiddleware = backendScanFiles.some(
    (f) => f.includes("middlewares") && fs.readFileSync(f, "utf8").includes(k)
  );
  if (!inRoutes && !inControllers && !inMiddleware) keysNoBackendEnforcement.push(k);
}

console.log(JSON.stringify({
  totalKeys: keys.length,
  onlyCatalog,
  catalogNotInSidebar,
  sidebarNotInCatalog,
  incompleteModules,
  pagesNoPermCheck: [...new Set(pagesNoPermCheck)].sort(),
  adminRoutesWithoutCheckPermission: routesNoCheck.length,
  feOnly,
  keysNoBackendEnforcement,
}, null, 2));