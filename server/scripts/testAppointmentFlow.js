#!/usr/bin/env node
/**
 * Smoke test for appointment proposal and confirmation flow
 * 
 * Tests:
 * 1. Query chat endpoint with appointment request (without confirmation)
 * 2. Verify proposedAppointment is returned in action
 * 3. Query chat endpoint with actionConfirm=true and preferredAppointment
 * 4. Verify appointment is created (actionTaken=true)
 * 
 * Usage:
 *   node server/scripts/testAppointmentFlow.js
 */

const path = require('path')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const axios = require('axios')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const MONGO_STRING = process.env.MONGO_STRING || process.env.MONGO_URI

async function connectDB() {
  try {
    if (!MONGO_STRING) {
      throw new Error('MONGO_STRING env var not set')
    }
    await mongoose.connect(MONGO_STRING)
    console.log('[Test] MongoDB connected')
  } catch (error) {
    console.error('[Test] DB connection failed:', error.message)
    throw error
  }
}

async function testAppointmentFlow() {
  try {
    await connectDB()

    const testPatientId = 'test-patient-' + Date.now()
    const testUserId = 'test-user-' + Date.now()

    console.log('\n=== Test 1: Propose Appointment (no confirmation) ===')
    const proposeRes = await axios.post(`${BASE_URL}/api/ai/chat`, {
      query: 'I need to see a cardiologist for chest pain assessment',
      userId: testUserId,
      patientId: testPatientId,
      userRole: 'patient',
    })

    console.log('Response status:', proposeRes.status)
    console.log('Has action field:', Boolean(proposeRes.data.action))
    console.log('Has proposedAppointment:', Boolean(proposeRes.data.action?.proposedAppointment))

    if (proposeRes.data.action?.proposedAppointment) {
      const proposed = proposeRes.data.action.proposedAppointment
      console.log('Proposed appointment:')
      console.log('  Doctor:', proposed.doctor?.name || proposed.doctorId)
      console.log('  Specialty:', proposed.specialty)
      console.log('  Date:', new Date(proposed.appointmentDate).toLocaleString())
      console.log('  Consultation Type:', proposed.consultationType)
    } else {
      console.warn('⚠️  No proposed appointment returned')
    }

    if (proposeRes.data.action?.actionTaken) {
      console.warn('⚠️  Action was taken immediately (expected false until confirmed)')
    } else {
      console.log('✓ Action not taken (as expected, awaiting confirmation)')
    }

    console.log('\n=== Test 2: Confirm and Create Appointment ===')
    if (!proposeRes.data.action?.proposedAppointment) {
      console.log('Skipping confirm test (no proposal returned)')
      return
    }

    const confirmRes = await axios.post(`${BASE_URL}/api/ai/chat`, {
      query: 'I need to see a cardiologist for chest pain assessment',
      userId: testUserId,
      patientId: testPatientId,
      userRole: 'patient',
      conversationId: proposeRes.data.conversationId,
      actionConfirm: true,
      preferredAppointment: {
        date: proposeRes.data.action.proposedAppointment.appointmentDate,
        consultationType: proposeRes.data.action.proposedAppointment.consultationType,
      },
    })

    console.log('Response status:', confirmRes.status)
    console.log('Has action field:', Boolean(confirmRes.data.action))
    console.log('Action taken:', confirmRes.data.action?.actionTaken)

    if (confirmRes.data.action?.actionTaken) {
      console.log('✓ Appointment created successfully')
      if (confirmRes.data.action.actions) {
        confirmRes.data.action.actions.forEach((act, i) => {
          console.log(`  Action ${i + 1}:`, act.type)
          if (act.result?.appointmentId) {
            console.log(`    Appointment ID: ${act.result.appointmentId}`)
          }
        })
      }
    } else {
      console.warn('⚠️  Appointment not created (actionTaken=false)')
      if (confirmRes.data.action?.error) {
        console.warn('  Error:', confirmRes.data.action.error)
      }
    }

    console.log('\n=== Test 3: Non-urgent Query (home remedy) ===')
    const homeRemedyRes = await axios.post(`${BASE_URL}/api/ai/chat`, {
      query: 'I have a mild fever and sore throat',
      userId: testUserId,
      patientId: testPatientId,
      userRole: 'patient',
    })

    console.log('Response status:', homeRemedyRes.status)
    if (homeRemedyRes.data.action?.recommendation) {
      console.log('AI recommendation:', homeRemedyRes.data.action.recommendation)
    }
    console.log('No appointment proposed:', !homeRemedyRes.data.action?.proposedAppointment)

    console.log('\n✓ Smoke test completed successfully')
  } catch (error) {
    console.error('\n✗ Test failed:', error.message)
    if (error.response?.data) {
      console.error('Response data:', error.response.data)
    }
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

testAppointmentFlow()
