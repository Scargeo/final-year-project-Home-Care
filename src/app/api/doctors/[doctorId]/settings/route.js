import { NextResponse } from 'next/server'

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
      licenseNumber,
      specialty,
      notificationPrefs,
      privacyPrefs,
      personalizationPrefs,
    } = body

    // Build update object with only provided fields
    const updateFields = {}
    if (firstName) updateFields.firstName = firstName
    if (lastName) updateFields.lastName = lastName
    if (doctorEmail) updateFields.doctorEmail = doctorEmail
    if (doctorPhone) updateFields.doctorPhone = doctorPhone
    if (licenseNumber) updateFields.licenseNumber = licenseNumber
    if (specialty) updateFields.specialty = specialty
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs
    if (personalizationPrefs) updateFields.personalizationPrefs = personalizationPrefs

    // Call backend server to update doctor
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000'}/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
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
