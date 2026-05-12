const path = require('path')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const { nanoid } = require('nanoid')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const Admin = require('../models/admin/adminUser')

function printUsage() {
  console.log('Usage: npm run create:admin -- --name "Full Name" --email "admin@example.com" --password "StrongPassword123!" [--force]')
  console.log('Environment variables also work: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD')
}

function readArg(name) {
  const prefix = `--${name}=`
  const found = process.argv.slice(2).find((entry) => entry.startsWith(prefix))
  return found ? found.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`)
}

function readPositionalArgs() {
  const args = process.argv.slice(2).filter((entry) => !entry.startsWith('--'))
  if (args.length < 3) return { adminName: '', adminEmail: '', adminPassword: '' }
  return {
    adminName: args[0] || '',
    adminEmail: args[1] || '',
    adminPassword: args.slice(2).join(' ') || '',
  }
}

async function main() {
  const positionalArgs = readPositionalArgs()
  const adminName = String(readArg('name') || positionalArgs.adminName || process.env.ADMIN_NAME || '').trim()
  const adminEmail = String(readArg('email') || positionalArgs.adminEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = String(readArg('password') || positionalArgs.adminPassword || process.env.ADMIN_PASSWORD || '').trim()
  const force = hasFlag('force')

  if (!adminName || !adminEmail || !adminPassword) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (!process.env.MONGO_STRING) {
    console.error('MONGO_STRING is not set. Check server/.env before running this script.')
    process.exitCode = 1
    return
  }

  await mongoose.connect(process.env.MONGO_STRING)

  try {
    const existingAdmin = await Admin.findOne({ adminEmail })
    if (existingAdmin && !force) {
      console.log(`Admin already exists for ${adminEmail}. Use --force to replace the password and name.`)
      return
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const updatedAdmin = await Admin.findOneAndUpdate(
      { adminEmail },
      {
        $set: {
          adminName,
          adminEmail,
          adminPassword: hashedPassword,
          role: 'admin',
          isSuperAdmin: true,
        },
        $setOnInsert: {
          adminId: `ADM-${nanoid(8).toUpperCase()}`,
        },
      },
      { upsert: true, new: true },
    )

    console.log('Admin ready:')
    console.log(JSON.stringify({
      adminId: updatedAdmin.adminId,
      adminName: updatedAdmin.adminName,
      adminEmail: updatedAdmin.adminEmail,
      role: updatedAdmin.role,
      isSuperAdmin: updatedAdmin.isSuperAdmin,
    }, null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error('Failed to create admin:', error.message || error)
  process.exitCode = 1
})
