import { NextResponse } from 'next/server'

export async function PATCH(req, context) {
  try {
    const { id } = await context.params
    const body = await req.json()

    if (!id) {
      return NextResponse.json({ message: 'Missing patient ID' }, { status: 400 })
    }

    const {
      patientFirstName,
      patientLastName,
      patientEmail,
      patientPhone,
      patientAddress,
      notificationPrefs,
      privacyPrefs,
    } = body

    // Build update object with only provided fields
    const updateFields = {}
    if (patientFirstName) updateFields.patientFirstName = patientFirstName
    if (patientLastName) updateFields.patientLastName = patientLastName
    if (patientEmail) updateFields.patientEmail = patientEmail
    if (patientPhone) updateFields.patientPhone = patientPhone
    if (patientAddress) updateFields.patientAddress = patientAddress
    if (notificationPrefs) updateFields.notificationPrefs = notificationPrefs
    if (privacyPrefs) updateFields.privacyPrefs = privacyPrefs

    // Call backend server to update patient
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000'}/api/patients/${encodeURIComponent(id)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
      body: JSON.stringify(updateFields),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data || { message: 'Failed to update patient settings' }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error updating patient settings:', error)
    return NextResponse.json(
      { message: 'Failed to update patient settings', error: error.message },
      { status: 500 }
    )
  }
}
