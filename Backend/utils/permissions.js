const ACTION_PREFIX = /^(VIEW|CREATE|EDIT|DELETE|PUNCH|APPROVE)_(.+)$/;

const DEFAULT_CLIENT_PERMISSIONS = ["VIEW_OFFER_BANNERS"];

/** Used when an employee has no permissions saved yet (legacy accounts). */
const DEFAULT_EMPLOYEE_PERMISSIONS = [
    "VIEW_DASHBOARD",
    "VIEW_CHAT",
    "CREATE_CHAT_GROUPS",
    "PUNCH_ATTENDANCE",
    "VIEW_ATTENDANCE",
    "VIEW_LEAVE",
    "CREATE_LEAVE",
    "VIEW_OFFER_BANNERS",
    "CREATE_TICKETS",
    // Assigned work — list APIs still scope to their own clients/projects/tasks
    "VIEW_CLIENTS",
    "VIEW_PROJECTS",
    "VIEW_DAILY_TASKS",
    "VIEW_URGENT_WORK",
];

/** Always merged for employees so assigned work stays visible even if admin trimmed perms. */
const EMPLOYEE_ASSIGNED_WORK_PERMISSIONS = [
    "VIEW_CLIENTS",
    "VIEW_PROJECTS",
    "VIEW_DAILY_TASKS",
    "VIEW_URGENT_WORK",
];

const permissionGranted = (user, required) => {
    if (!user) return false;
    if (String(user.userType || "").toUpperCase() === "ADMIN") return true;
    if (!required || (Array.isArray(required) && required.length === 0)) return true;

    const userType = String(user.userType || "").toUpperCase();
    const base = Array.isArray(user.permissions) && user.permissions.length
        ? user.permissions
        : (userType === "CLIENT" ? DEFAULT_CLIENT_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS);
    const granted = new Set(base);
    // Employees always keep access to their assigned clients / projects / daily work.
    if (userType === "EMPLOYEE") {
        for (const key of EMPLOYEE_ASSIGNED_WORK_PERMISSIONS) granted.add(key);
    }
    const list = Array.isArray(required) ? required : [required];

    return list.some((key) => {
        if (!key) return true;
        if (granted.has(key)) return true;
        const match = String(key).match(ACTION_PREFIX);
        if (match) {
            const moduleKey = match[2];
            if (granted.has(`MANAGE_${moduleKey}`)) return true;
            if (
                moduleKey === "ATTENDANCE"
                || moduleKey === "ATTENDANCE_REPORT"
                || moduleKey === "TEAM_ATTENDANCE"
                || moduleKey === "ALL_ATTENDANCE"
            ) {
                if (granted.has("MANAGE_ATTENDANCE")) return true;
            }
            if (moduleKey === "CHAT_GROUPS" && granted.has("MANAGE_CHAT")) return true;
            if (moduleKey === "LEAVE_QUEUE" && granted.has("APPROVE_LEAVE")) return true;
        }
        return false;
    });
};

const resolveClientPermissions = (client) => {
    const list = Array.isArray(client?.permissions) ? client.permissions.filter(Boolean) : [];
    return list.length ? list : [...DEFAULT_CLIENT_PERMISSIONS];
};

const resolveEmployeePermissions = (user) => {
    const list = Array.isArray(user?.permissions) ? user.permissions.filter(Boolean) : [];
    const base = list.length ? list : [...DEFAULT_EMPLOYEE_PERMISSIONS];
    return [...new Set([...base, ...EMPLOYEE_ASSIGNED_WORK_PERMISSIONS])];
};

module.exports = {
    permissionGranted,
    resolveClientPermissions,
    resolveEmployeePermissions,
    DEFAULT_CLIENT_PERMISSIONS,
    DEFAULT_EMPLOYEE_PERMISSIONS,
    EMPLOYEE_ASSIGNED_WORK_PERMISSIONS,
};
