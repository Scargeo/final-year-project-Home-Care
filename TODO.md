# TODO - SOS Contact Patient Call Feature

## Task
Remove chat and call buttons from the SOS header. Make "Contact patient" open the call link. When a provider clicks "Contact patient", it should ring on the patient app (voice by default; video only for appointments).

## Steps
- [x] 1. Update `server/middleware/sosController.js` - add `call` action + emit `provider-calling` socket event to patient room
- [x] 2. Update `src/app/secure/emergency/page.jsx` - remove Chat/Call header links, rewrite `contactPatient` to open call link, add patient incoming-call ring UI + socket listener + ringing tone
- [x] 3. Update `src/app/secure/call/page.jsx` - add nurseAuth support, route nurse redirects to /secure/nurse, voice-only for SOS
- [ ] 4. Verify & test
