const { body } = require("express-validator");

const addressValidation = [
    body("address.city").notEmpty().withMessage("City is required"),
    body("address.state").notEmpty().withMessage("State is required"),
    body("address.pincode").notEmpty().withMessage("Pincode is required"),
    body("address.locality").notEmpty().withMessage("Locality is required"),
    body("address.street").notEmpty().withMessage("Street is required")
];

const registerValidator = [
    body("name").notEmpty().withMessage("Name is required").isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("email").isEmail().withMessage("Provide a valid email").normalizeEmail(),
    body("phone").notEmpty().withMessage("Phone is required").isMobilePhone().withMessage("Provide a valid phone number"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    ...addressValidation
];

const loginValidator = [
    body("email").notEmpty().withMessage("Email or Client ID is required").trim(),
    body("password").notEmpty().withMessage("Password is required"),
];

module.exports = {
    registerValidator,
    loginValidator
};
