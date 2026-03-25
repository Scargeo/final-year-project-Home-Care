const mongoose = require('mongoose');
const {nanoid} = require('nanoid');

// Define the privateNurse schema
const privateNurseSchema = new mongoose.Schema({
    uid: {
        type: String,
        required: true,
        unique: true,
        default: function() {
            return 'PNUR-' + nanoid(8).toUpperCase();
        },
    },
    nurseFirstName: {
        type: String,
        required: true,
        minlenght: [2, "First name"],
        maxlenght: 20,
    },
    nurseLastName: {
        type: String,
        required: true,
        minlenght: [2, "Last name"],
        maxlenght: 20,
    },
    nurseEmail: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    nursePhone: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Please use a valid 10-digit phone number.'],
    },
    nursePassword: {
        type: String,
        required: true,
        hash: true,
    },
    nurseAddress: {
        type: String,
        required: true,
    },
}, { timestamps: true });

// Create the PrivateNurse model
const PrivateNurse = mongoose.model('PrivateNurse', privateNurseSchema);

module.exports = PrivateNurse;