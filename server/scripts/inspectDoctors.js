const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration');

async function run() {
  if (!process.env.MONGO_STRING) {
    console.error('MONGO_STRING not set in environment. Please set server/.env or export variable.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_STRING);
    console.log('Connected to MongoDB');

    const count = await Doctor.countDocuments();
    console.log(`Doctor documents count: ${count}`);

    const docs = await Doctor.find().select('doctorId doctorFirstName doctorLastName specialization isAvailable isVerified role yearsOfExperience').limit(20).lean();
    if (!docs || docs.length === 0) {
      console.log('No doctor documents found.');
    } else {
      console.log('Sample doctors:');
      docs.forEach((d) => {
        console.log(JSON.stringify(d));
      });
    }
  } catch (err) {
    console.error('Error querying doctors:', err.message || err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
