const mongoose = require("mongoose");
const User = require("../models/User");

const loadUserProfile = async (userId, { employeesOnly = false } = {}) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const error = new Error("Invalid profile");
        error.status = 400;
        throw error;
    }
    const filter = { _id: userId };
    if (employeesOnly) filter.userType = "EMPLOYEE";
    const person = await User.findOne(filter)
        .select("-password -refreshToken")
        .populate("department", "name")
        .populate("designation", "name")
        .populate("employeeType", "name")
        .populate("workMode", "name")
        .populate("reportingManager", "name employeeId");
    if (!person) return null;

    const team = await User.find({ reportingManager: person._id, userType: "EMPLOYEE" })
        .select("name employeeId status")
        .sort({ name: 1 })
        .limit(100)
        .lean();

    return { data: person, team };
};

module.exports = { loadUserProfile };
