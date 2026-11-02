const mongoose = require("mongoose");
const User = require("../models/User");

const downlineIds = async (userId) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return [];
    const [row] = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(userId) } },
        {
            $graphLookup: {
                from: User.collection.name,
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "reportingManager",
                as: "downline",
                maxDepth: 15,
            },
        },
        { $project: { _id: 0, ids: "$downline._id" } },
    ]);
    return row?.ids || [];
};

module.exports = { downlineIds };
