import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export async function GET(req, context) {
  try {
    const { doctorId } = await context.params

    if (!doctorId) {
      return NextResponse.json({ message: 'Missing doctor ID' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(`${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
      method: 'GET',
      headers: {
        authorization: authHeader,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data || { message: 'Failed to fetch doctor settings' }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error fetching doctor settings:', error)
    return NextResponse.json(
      { message: 'Failed to fetch doctor settings', error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(req, context) {
  try {
    const { doctorId } = await context.params
    const body = await req.json()

    if (!doctorId) {
      return NextResponse.json({ message: 'Missing doctor ID' }, { status: 400 })
    }

    const {
      firstName,
      lastName,
      doctorEmail,
      doctorPhone,
      doctorAddress,
      licenseNumber,
      specialty,
      notificationPrefs,
      privacyPrefs,
      personalizationPrefs,
    } = body

    // Build update object with only provided fields
    const updateFields = {}
    if (firstName) updateFields.doctorFirstName = firstName
    if (lastName) updateFields.doctorLastName = lastName
    if (doctorEmail) updateFields.doctorEmail = doctorEmail
    if (doctorPhone) updateFields.doctorPhone = doctorPhone
    if (doctorAddress) updateFields.doctorAddress = doctorAddress
    if (licenseNumber) updateFields.licenseNumber = licenseNumber
    if (specialty) updateFields.specialty = specialty
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs
    if (personalizationPrefs) updateFields.personalizationPrefs = personalizationPrefs

    // Call backend server to update doctor
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(`${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: authHeader,
      },
      body: JSON.stringify(updateFields),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data || { message: 'Failed to update doctor settings' }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error updating doctor settings:', error)
    return NextResponse.json(
      { message: 'Failed to update doctor settings', error: error.message },
      { status: 500 }
    )
  }
}
