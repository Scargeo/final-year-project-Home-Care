const mongoose = require('mongoose');
const PrivateNurse = require('./privateNurseRegistration');

// Define the nurse requirement schema
const privateNurseRequirementSchema = new mongoose.Schema({
    requirementId: {
        type: mongoose.Schema.Types.ObjectId, // Use ObjectId to reference the nurse
        ref: "PrivateNurse",
        required: true,
    },
    nurseId: {
        type: String,
        required: true,
        unique: true,
    },
},
 { timestamps: true }
);

// Create the PrivateNurseRequirement model
const PrivateNurseRequirement = mongoose.model('PrivateNurseRequirement', privateNurseRequirementSchema);

module.exports = PrivateNurseRequirement;