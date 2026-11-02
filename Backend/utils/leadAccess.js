const { downlineIds } = require("./reporting");
const { permissionGranted } = require("./permissions");

const idOf = (value) => String(value?._id || value || "");

const hasPerm = (user, keys) => permissionGranted(user, keys);

const isAssigneeOnly = (user, lead) => {
    if (user.userType === "ADMIN") return false;
    if (idOf(lead.createdBy) === idOf(user._id)) return false;
    return idOf(lead.assignedTo) === idOf(user._id);
};

const canEditLeadData = (user, lead) => {
    if (user.userType === "ADMIN") return true;
    if (idOf(lead.createdBy) === idOf(user._id)) return true;
    if (isAssigneeOnly(user, lead)) return false;
    return hasPerm(user, ["MANAGE_LEADS", "EDIT_LEADS"]);
};

const canDeleteLead = (user, lead) => {
    if (user.userType === "ADMIN") return true;
    if (idOf(lead.createdBy) === idOf(user._id)) return true;
    if (isAssigneeOnly(user, lead)) return false;
    return hasPerm(user, ["MANAGE_LEADS", "DELETE_LEADS"]);
};

const canFollowLead = (user, lead) => {
    if (user.userType === "ADMIN") return true;
    const me = idOf(user._id);
    if (idOf(lead.createdBy) === me || idOf(lead.assignedTo) === me) return true;
    return hasPerm(user, ["MANAGE_LEADS", "EDIT_LEADS", "CREATE_LEADS"]);
};

const seesAllLeads = (user) => {
    if (user.userType === "ADMIN") return true;
    return hasPerm(user, ["VIEW_LEADS", "MANAGE_LEADS"]);
};

const leadTeamIds = async (user) => {
    const downline = await downlineIds(user._id);
    return [user._id, ...downline];
};

const canSeeLead = async (lead, user) => {
    if (!lead) return false;
    if (seesAllLeads(user)) return true;
    const team = new Set((await leadTeamIds(user)).map((id) => String(id)));
    return team.has(idOf(lead.assignedTo)) || team.has(idOf(lead.createdBy));
};

const canReassignLead = (lead, user) => {
    if (!lead) return false;
    if (user.userType === "ADMIN") return true;
    const me = idOf(user._id);
    if (idOf(lead.assignedTo) === me || idOf(lead.createdBy) === me) return true;
    return hasPerm(user, ["MANAGE_LEADS", "EDIT_LEADS"]);
};

module.exports = {
    canEditLeadData,
    canDeleteLead,
    canFollowLead,
    isAssigneeOnly,
    seesAllLeads,
    leadTeamIds,
    canSeeLead,
    canReassignLead,
};
