#!/usr/bin/env bash
# Email Verification System - Quick Setup Script
# Run this to validate your environment and get started

echo "════════════════════════════════════════════════════════════════"
echo "  Email Verification System - Setup Validation"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "  ✓ Node.js found: $NODE_VERSION"
else
    echo "  ✗ Node.js not found. Please install Node.js 16+"
    exit 1
fi

# Check MongoDB
echo ""
echo "✓ Checking MongoDB..."
if command -v mongod &> /dev/null; then
    echo "  ✓ MongoDB found"
else
    echo "  ⚠ MongoDB not found in PATH"
    echo "  Make sure MongoDB is installed and running on localhost:27017"
fi

# Check .env file
echo ""
echo "✓ Checking .env configuration..."
if [ -f "server/.env" ]; then
    echo "  ✓ server/.env found"
    if grep -q "EMAIL_SERVICE" server/.env; then
        echo "  ✓ EMAIL_SERVICE configured"
    else
        echo "  ⚠ EMAIL_SERVICE not set in .env"
    fi
else
    echo "  ✗ server/.env not found"
    echo "  Copy server/.env.example to server/.env and configure email"
fi

# Check dependencies
echo ""
echo "✓ Checking dependencies..."
if grep -q '"nodemailer"' server/package.json; then
    echo "  ✓ nodemailer in package.json"
else
    echo "  ✗ nodemailer not found in package.json"
fi

# Installation instructions
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  SETUP INSTRUCTIONS"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. Install backend dependencies:"
echo "   cd server && npm install"
echo ""
echo "2. Configure email in server/.env:"
echo "   cp server/.env.example server/.env"
echo "   nano server/.env  # Edit with your Gmail credentials"
echo ""
echo "3. Get Gmail App Password:"
echo "   - Go to myaccount.google.com/apppasswords"
echo "   - Select Mail and Windows Computer"
echo "   - Copy the 16-character password"
echo "   - Set as EMAIL_PASSWORD in .env"
echo ""
echo "4. Start MongoDB (if running locally):"
echo "   mongod"
echo ""
echo "5. Start backend:"
echo "   cd server && npm start"
echo ""
echo "6. In another terminal, start frontend:"
echo "   npm run dev"
echo ""
echo "7. Test the flow:"
echo "   - Go to http://localhost:3000/signup"
echo "   - Fill in form and submit"
echo "   - Check email for verification link"
echo "   - Click link to verify"
echo "   - Login with verified account"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  DOCUMENTATION"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "For detailed information, see:"
echo "  - EMAIL_VERIFICATION_SUMMARY.md (overview)"
echo "  - EMAIL_VERIFICATION_SETUP.md (comprehensive guide)"
echo "  - QUICK_START_EMAIL_VERIFICATION.md (quick reference)"
echo "  - EMAIL_VERIFICATION_CODE_FLOW.md (technical details)"
echo ""
echo "════════════════════════════════════════════════════════════════"
