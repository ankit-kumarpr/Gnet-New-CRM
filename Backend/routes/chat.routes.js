const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { receiveChatAvatar } = require("../config/cloudinary");
const {
    listRooms,
    searchPeople,
    openDm,
    createGroup,
    updateGroup,
    removeGroupMember,
    deleteGroup,
    getRoom,
    listMessages,
    createMessage,
} = require("../controllers/chat.controller");

router.use(authenticate);
router.use((req, res, next) => {
    if (req.authKind === "CLIENT" || req.user?.userType === "CLIENT") {
        return res.status(403).json({ success: false, message: "Chat is only available for staff" });
    }
    return next();
});

router.get("/rooms", listRooms);
router.get("/people", searchPeople);
router.post("/dm", openDm);
router.post("/groups", receiveChatAvatar, createGroup);
router.patch("/groups/:id", receiveChatAvatar, updateGroup);
router.post("/groups/:id/remove-member", removeGroupMember);
router.delete("/groups/:id", deleteGroup);
router.get("/rooms/:id", getRoom);
router.get("/rooms/:id/messages", listMessages);
router.post("/rooms/:id/messages", createMessage);

module.exports = router;
