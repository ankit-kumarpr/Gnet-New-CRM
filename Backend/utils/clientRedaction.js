const { permissionGranted } = require("./permissions");

const CONTACT_KEYS = ["email", "phone", "whatsapp", "address"];
const EXTRA_KEYS = ["remark", "payments", "password", "refreshToken"];

/** Admin / client managers can see phone, email, etc. Assigned viewers see name only. */
const canViewClientContact = (user) => {
    if (!user) return false;
    if (String(user.userType || "").toUpperCase() === "ADMIN") return true;
    return permissionGranted(user, ["MANAGE_CLIENTS", "EDIT_CLIENTS", "CREATE_CLIENTS"]);
};

const CLIENT_POPULATE_FULL = "name clientId phone email whatsapp";
const CLIENT_POPULATE_SAFE = "name clientId";

const clientPopulateSelect = (user) =>
    canViewClientContact(user) ? CLIENT_POPULATE_FULL : CLIENT_POPULATE_SAFE;

const redactClient = (client, user) => {
    if (!client || typeof client !== "object") return client;
    if (canViewClientContact(user)) return client;

    const src = client.toObject ? client.toObject() : client;
    const out = { ...src };
    for (const key of CONTACT_KEYS) delete out[key];
    for (const key of EXTRA_KEYS) delete out[key];
    return out;
};

const redactClients = (rows, user) => {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => redactClient(row, user));
};

/** Redact nested `client` on project / report style payloads. */
const redactNestedClient = (row, user) => {
    if (!row || typeof row !== "object") return row;
    if (!row.client) return row;
    return { ...row, client: redactClient(row.client, user) };
};

const redactNestedClients = (rows, user) => {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => redactNestedClient(row, user));
};

module.exports = {
    canViewClientContact,
    clientPopulateSelect,
    CLIENT_POPULATE_FULL,
    CLIENT_POPULATE_SAFE,
    redactClient,
    redactClients,
    redactNestedClient,
    redactNestedClients,
};
