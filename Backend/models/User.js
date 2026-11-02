const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema({
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    locality: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String }
}, { _id: false });

const documentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
}, { _id: true });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { 
        type: String, 
        enum: ["ADMIN", "EMPLOYEE"], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ["ACTIVE", "INACTIVE", "BLOCKED"], 
        default: "ACTIVE" 
    },
    address: { type: addressSchema, required: true },
    
    employeeId: { type: String, unique: true, sparse: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    employeeType: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeType' },
    workMode: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkMode' },
    salary: { type: Number, min: 0 },
    joiningDate: { type: Date },
    dob: { type: Date },
    responsibility: { type: String, trim: true, maxlength: 20000 },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permissions: [{ type: String }],
    documents: { type: [documentSchema], default: [] },
    avatar: {
        url: { type: String, trim: true, default: "" },
        publicId: { type: String, trim: true, default: "" },
    },
    /** Personal notification prefs — if useCustom is false, admin defaults apply */
    notificationPrefs: {
        useCustom: { type: Boolean, default: false },
        soundEnabled: { type: Boolean, default: true },
        toastEnabled: { type: Boolean, default: true },
        ringtoneUrl: { type: String, trim: true, default: "" },
        ringtonePublicId: { type: String, trim: true, default: "" },
        ringtoneName: { type: String, trim: true, maxlength: 120, default: "" },
    },
    
    refreshToken: { type: String } // To handle token rotation and logout
}, { timestamps: true });

userSchema.index({ reportingManager: 1 });
userSchema.index({ userType: 1, status: 1 });
userSchema.index({ userType: 1, status: 1, name: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ joiningDate: 1 });

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
