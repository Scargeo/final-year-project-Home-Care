const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const _pdfParseModule = require('pdf-parse');
// pdf-parse may export a function or named exports depending on environment. Create fallbacks:
const pdfParse = typeof _pdfParseModule === 'function' ? _pdfParseModule : (_pdfParseModule && (_pdfParseModule.default || _pdfParseModule))
const PDFParseClass = _pdfParseModule && (_pdfParseModule.PDFParse || _pdfParseModule.PDFParser || null);
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const { loadUser } = require('../../middleware/loadUserMiddleware');
const { allowDoctorOnly } = require('../../middleware/permissionMiddleware');
const LabResult = require('../../models/hospital/doctor/labResult');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const openRouterLLMModel = process.env.OPENROUTER_LLM_MODEL || 'openrouter/auto';

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'Home Care AI Lab Result Interpreter',
  },
});

// Configure multer for memory storage to process uploaded files in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, text, CSV, or image files.'));
    }
  },
});

/**
 * Extract text from uploaded file
 * For PDF: parse content
 * For text/csv: read directly
 * For images: return placeholder note (OCR can be integrated later)
 */
async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for extraction');
  }

  if (file.mimetype === 'application/pdf') {
    // Support multiple export shapes from pdf-parse
    try {
      if (typeof pdfParse === 'function') {
        const parsed = await pdfParse(file.buffer);
        return String(parsed.text || '').trim();
      }

      if (PDFParseClass) {
        const parser = new PDFParseClass({ data: new Uint8Array(file.buffer) });
        try {
          const result = await parser.getText()
          return String(result.text || '').trim();
        } finally {
          if (typeof parser.destroy === 'function') await parser.destroy()
        }
      }

      // As a last resort, try accessing default function
      if (_pdfParseModule && typeof _pdfParseModule === 'function') {
        const parsed = await _pdfParseModule(file.buffer);
        return String(parsed.text || '').trim();
      }

      throw new Error('pdf-parse is not available as a callable function or parser class')
    } catch (err) {
      console.error('[Lab Interpretation] PDF extraction failed:', err && err.message ? err.message : err)
      throw err
    }
  }

  if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
    return file.buffer.toString('utf-8').trim();
  }

  // Placeholder for image OCR integration
  if (file.mimetype.startsWith('image/')) {
    return '[Image uploaded. OCR extraction is not enabled yet. Please upload PDF or text for full interpretation.]';
  }

  throw new Error('Could not extract text from this file type');
}

/**
 * Parse AI markdown response into structured sections
 */
function parseInterpretationResponse(aiText) {
  const text = String(aiText || '').trim();
  if (!text) {
    return {
      summary: 'No interpretation generated.',
      keyFindings: [],
      normalValues: [],
      abnormalValues: [],
      recommendations: [],
      alertsOrConcerns: [],
    };
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const keyFindings = [];
  const recommendations = [];
  const alertsOrConcerns = [];
  const normalValues = [];
  const abnormalValues = [];

  let summary = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    const plainLine = line.replace(/^[-*\d.\s]+/, '').trim();

    if (!summary && plainLine.length > 25) {
      summary = plainLine;
    }

    if (lower.includes('finding') || lower.includes('noted') || lower.includes('observed')) {
      keyFindings.push(plainLine);
    }

    if (lower.includes('recommend') || lower.includes('advise') || lower.includes('follow')) {
      recommendations.push(plainLine);
    }

    if (lower.includes('critical') || lower.includes('urgent') || lower.includes('alert')) {
      alertsOrConcerns.push(plainLine);
    }

    // Simple value status inference for lab lines
    if (plainLine.includes(':') && (lower.includes('high') || lower.includes('low') || lower.includes('normal'))) {
      const [name, ...rest] = plainLine.split(':');
      const valuePart = rest.join(':').trim();

      if (lower.includes('normal')) {
        normalValues.push({
          testName: name.trim(),
          value: valuePart,
          status: 'normal',
        });
      } else {
        abnormalValues.push({
          testName: name.trim(),
          value: valuePart,
          status: lower.includes('critical') ? 'critical' : lower.includes('low') ? 'low' : 'high',
          interpretation: plainLine,
        });
      }
    }
  }

  return {
    summary: summary || 'AI interpretation generated. Review key findings below.',
    keyFindings: keyFindings.slice(0, 10),
    normalValues: normalValues.slice(0, 15),
    abnormalValues: abnormalValues.slice(0, 15),
    recommendations: recommendations.slice(0, 10),
    alertsOrConcerns: alertsOrConcerns.slice(0, 10),
  };
}

/**
 * Generate AI lab result interpretation
 */
async function generateInterpretation({ rawText, testType }) {
  const systemPrompt = `You are a clinical decision support assistant helping licensed doctors interpret laboratory results.
You must provide concise, clinically useful interpretation while clearly stating this does not replace clinical judgment.
Output practical insights under these sections:
1) Summary
2) Key Findings
3) Normal Values
4) Abnormal Values and possible significance
5) Recommendations / Follow-up
6) Alerts or Critical Concerns
Use clear Markdown bullet points and avoid overly verbose text.`;

  const userPrompt = `Interpret this lab result for a doctor.
Test type: ${testType || 'Not specified'}

Lab content:
${rawText}

Please include any abnormal values, possible significance, and recommended follow-up checks.`;

  const completion = await openai.chat.completions.create({
    model: openRouterLLMModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  });

  return String(completion.choices?.[0]?.message?.content || '').trim();
}

// Apply user loading middleware for authenticated doctor context
router.use(loadUser);
// Restrict lab interpretation endpoints to doctors only.
router.use(allowDoctorOnly());

/**
 * POST /api/ai/lab-results/interpret
 * Upload lab result file, extract text, analyze with AI, and return interpretation
 */
router.post('/lab-results/interpret', upload.single('labFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Please upload a lab result file.' });
    }

    // Identify doctor from auth context or fallback values
    const doctorId = String(
      req.user?.doctorId || req.user?.id || req.user?._id || req.body?.doctorId || 'unknown-doctor'
    );

    const patientName = String(req.body?.patientName || '').trim();
    const patientPhone = String(req.body?.patientPhone || '').trim();
    const testType = String(req.body?.testType || '').trim();

    // Create initial record in pending state
    const record = await LabResult.create({
      doctorId,
      patientName,
      patientPhone,
      testType,
      fileName: file.originalname,
      fileType: file.mimetype.includes('pdf')
        ? 'pdf'
        : file.mimetype.startsWith('image/')
          ? 'image'
          : 'text',
      status: 'pending',
    });

    // Track processing stage for better debugging
    let processingStage = 'created_record';

    // 1) Extract text/data from uploaded file
    processingStage = 'extract_text';
    const rawText = await extractTextFromFile(file);
    if (!rawText || rawText.length < 10) {
      await LabResult.updateOne(
        { _id: record._id },
        {
          $set: {
            status: 'failed',
            rawText,
            errorMessage: 'Could not extract enough data from the uploaded file.',
          },
        }
      );

      return res.status(422).json({
        error: 'Insufficient extracted text. Please upload a clearer PDF/text lab report.',
      });
    }

    await LabResult.updateOne(
      { _id: record._id },
      {
        $set: {
          rawText,
          status: 'extracted',
        },
      }
    );

    // 2) Analyze extracted values with AI
    processingStage = 'ai_call';
    let aiResponse = '';
    try {
      aiResponse = await generateInterpretation({ rawText, testType });
    } catch (aiErr) {
      console.error('[Lab Interpretation] AI call failed at stage:', processingStage, aiErr);
      await LabResult.updateOne({ _id: record._id }, { $set: { status: 'failed', errorMessage: `AI error: ${aiErr?.message || aiErr}` } });
      return res.status(500).json({ error: 'AI interpretation failed.', details: aiErr?.message || String(aiErr), stage: processingStage });
    }

    // 3) Transform AI explanation into display-ready structure
    const interpretation = parseInterpretationResponse(aiResponse);

    // 4) Persist completed interpretation
    await LabResult.updateOne(
      { _id: record._id },
      {
        $set: {
          interpretation,
          status: 'completed',
          aiModel: openRouterLLMModel,
        },
      }
    );

    const updated = await LabResult.findById(record._id).lean();

    return res.status(200).json({
      message: 'Lab result interpreted successfully.',
      result: updated,
      aiResponse,
    });
  } catch (error) {
    console.error('[Lab Interpretation] Failed at stage:', error?.processingStage || 'unknown', error);
    // Attempt to attach failure status to record if possible
    try {
      if (error && error.recordId) {
        await LabResult.updateOne({ _id: error.recordId }, { $set: { status: 'failed', errorMessage: error.message } });
      }
    } catch (dbErr) {
      console.error('[Lab Interpretation] Failed to update failure state on record:', dbErr);
    }

    return res.status(500).json({
      error: 'Failed to interpret lab result.',
      details: error?.message || String(error),
    });
  }
});

/**
 * GET /api/ai/lab-results
 * List doctor's uploaded lab interpretation history
 */
router.get('/lab-results', async (req, res) => {
  try {
    const doctorId = String(req.user?.doctorId || req.user?.id || req.user?._id || 'unknown-doctor');

    const results = await LabResult.find({ doctorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ results });
  } catch (error) {
    console.error('[Lab Interpretation] Failed to fetch history:', error);
    return res.status(500).json({
      error: 'Failed to load lab interpretation history.',
      details: error.message,
    });
  }
});

/**
 * GET /api/ai/lab-results/:id
 * Fetch a single lab interpretation result for the current doctor
 */
router.get('/lab-results/:id', async (req, res) => {
  try {
    const resultId = String(req.params.id || '').trim();
    if (!resultId || !mongoose.Types.ObjectId.isValid(resultId)) {
      return res.status(400).json({ error: 'Invalid lab result id.' });
    }

    const doctorId = String(req.user?.doctorId || req.user?.id || req.user?._id || 'unknown-doctor');
    const result = await LabResult.findById(resultId).lean();

    if (!result) {
      return res.status(404).json({ error: 'Lab result not found.' });
    }

    if (doctorId !== 'unknown-doctor' && String(result.doctorId) !== doctorId) {
      return res.status(403).json({ error: 'You are not allowed to access this lab result.' });
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error('[Lab Interpretation] Failed to fetch single result:', error);
    return res.status(500).json({
      error: 'Failed to load lab result.',
      details: error.message,
    });
  }
});

module.exports = router;
