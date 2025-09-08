import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiUserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

interface GeminiChatMessage {
  role: 'user' | 'ai';
  content: string;
}

// --- Fallback generic responses ---
const GENERIC_RESPONSES: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['reset password', 'forgot password', 'change password', 'password reset', 'lost password', 'recover password'],
    answer: "To reset your password, click on 'Forgot Password' on the login page and follow the instructions. If you need further help, contact support.",
  },
  {
    keywords: ['contact support', 'help', 'reach support', 'get help', 'customer service', 'support team'],
    answer: "You can contact support by emailing support@example.com or using the contact form on our website.",
  },
  {
    keywords: ['cannot log in', "can't log in", 'login issue', 'sign in problem', 'unable to login', 'login failed', 'login error', 'sign in error'],
    answer: "Please check your credentials and ensure your account is active. If the problem persists, try resetting your password or contact support.",
  },
  {
    keywords: ['account locked', 'locked out', 'account disabled', 'account suspended'],
    answer: "If your account is locked or disabled, please contact support to have it reviewed and reactivated.",
  },
  {
    keywords: ['ticket status', 'check ticket', 'my ticket', 'status of ticket', 'update on ticket', 'progress of ticket'],
    answer: "To check your ticket status, please log in and visit the 'My Tickets' section. You can also contact support for updates.",
  },
  {
    keywords: ['open ticket', 'new ticket', 'submit ticket', 'create ticket', 'raise ticket', 'log ticket'],
    answer: "To open a new ticket, click on 'Submit Ticket' and fill out the required information. Our team will get back to you soon.",
  },
  {
    keywords: ['system down', 'site down', 'website down', 'outage', 'not working', 'service unavailable', 'server down'],
    answer: "We are sorry for the inconvenience. Our team is aware of the issue and working to resolve it as quickly as possible. Please check our status page or contact support for updates.",
  },
  {
    keywords: ['email not working', 'cannot send email', 'cannot receive email', 'email issue', 'email problem', 'email error'],
    answer: "If you are experiencing email issues, please check your internet connection and email settings. If the problem continues, contact support with details of the error.",
  },
  {
    keywords: ['printer not working', 'cannot print', 'printer issue', 'printer problem', 'printer error'],
    answer: "Please check that the printer is powered on and connected. Try restarting the printer and your computer. If the issue persists, contact support.",
  },
  {
    keywords: ['vpn not working', 'cannot connect vpn', 'vpn issue', 'vpn problem', 'vpn error'],
    answer: "Ensure you are using the correct VPN credentials and that your internet connection is stable. If you still cannot connect, contact support for assistance.",
  },
  {
    keywords: ['wifi not working', 'cannot connect wifi', 'wifi issue', 'wifi problem', 'wifi error', 'no internet', 'internet down'],
    answer: "Please check your WiFi connection and restart your router if necessary. If the problem continues, contact your network administrator or support.",
  },
  {
    keywords: ['install software', 'install application', 'install program', 'software installation', 'application installation'],
    answer: "To request a software installation, please submit a ticket with the name and version of the software you need. Our IT team will assist you.",
  },
  {
    keywords: ['computer slow', 'pc slow', 'laptop slow', 'slow performance', 'system slow'],
    answer: "Try restarting your computer and closing unused programs. If your computer is still slow, contact support for further troubleshooting.",
  },
  {
    keywords: ['error message', 'getting error', 'see error', 'shows error', 'error code'],
    answer: "Please provide the exact error message or code you are seeing. This will help our support team diagnose and resolve the issue more quickly.",
  },
  {
    keywords: ['update information', 'change email', 'change phone', 'update profile', 'edit profile'],
    answer: "To update your profile information, log in and go to your account settings. Make the necessary changes and save your updates.",
  },
  {
    keywords: ['forgot username', 'lost username', 'recover username'],
    answer: "If you have forgotten your username, use the 'Forgot Username' option on the login page or contact support for help.",
  },
  {
    keywords: ['two factor', '2fa', 'two-factor', 'authentication code', 'cannot get code', '2-step verification'],
    answer: "If you are having trouble with two-factor authentication, ensure your device is set up correctly. If you cannot receive codes, contact support to reset your 2FA.",
  },
  {
    keywords: ['browser not supported', 'unsupported browser', 'browser issue'],
    answer: "Please use a supported browser such as Chrome, Firefox, Edge, or Safari. If you continue to have issues, clear your browser cache or try another browser.",
  },
  {
    keywords: ['file upload', 'cannot upload', 'upload issue', 'upload error'],
    answer: "Ensure your file meets the size and format requirements. If you still cannot upload, try a different browser or contact support.",
  },
  {
    keywords: ['password requirements', 'password rules', 'password policy'],
    answer: "Passwords must be at least 8 characters long and include a mix of letters, numbers, and symbols. Avoid using common words or personal information.",
  },
  {
    keywords: ['account registration', 'sign up', 'create account', 'register account'],
    answer: "To register a new account, click on 'Sign Up' or 'Register' on the login page and fill in the required details.",
  },
  {
    keywords: ['delete account', 'remove account', 'close account', 'deactivate account'],
    answer: "To delete or deactivate your account, please contact support. We will assist you with the process.",
  },
  {
    keywords: ['change language', 'language settings', 'switch language'],
    answer: "To change your language preferences, go to your account settings and select your preferred language.",
  },
  {
    keywords: ['mobile app', 'app not working', 'app issue', 'app problem'],
    answer: "If you are having trouble with the mobile app, try restarting the app or reinstalling it. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot access', 'access denied', 'permission denied', 'no access'],
    answer: "If you are denied access to a resource, please ensure you have the correct permissions. Contact support if you believe this is an error.",
  },
  {
    keywords: ['data breach', 'security incident', 'hacked', 'compromised'],
    answer: "If you suspect a security incident or data breach, contact support immediately. We take security very seriously and will investigate promptly.",
  },
  {
    keywords: ['how to', 'instructions', 'guide', 'manual', 'tutorial'],
    answer: "Please specify what you need help with, and we will provide instructions or a guide.",
  },
  {
    keywords: ['cannot save', 'save error', 'save failed'],
    answer: "If you are unable to save your changes, check your internet connection and try again. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot download', 'download error', 'download failed'],
    answer: "If you are unable to download a file, try a different browser or check your internet connection. Contact support if the problem persists.",
  },
  {
    keywords: ['calendar not syncing', 'calendar issue', 'calendar problem'],
    answer: "If your calendar is not syncing, check your account settings and internet connection. If the issue continues, contact support.",
  },
  {
    keywords: ['meeting not working', 'meeting issue', 'video call problem', 'cannot join meeting'],
    answer: "If you are having trouble joining a meeting, check your internet connection and meeting link. If the problem persists, contact support.",
  },
  {
    keywords: ['out of office', 'set out of office', 'vacation responder'],
    answer: "To set an out-of-office or vacation responder, go to your email settings and enable the out-of-office option.",
  },
  {
    keywords: ['change notification', 'notification settings', 'turn off notifications'],
    answer: "To change your notification settings, go to your account or app settings and adjust your preferences.",
  },
  {
    keywords: ['cannot attach', 'attachment error', 'attach file problem'],
    answer: "Ensure your attachment meets the size and format requirements. If you still cannot attach a file, try a different browser or contact support.",
  },
  {
    keywords: ['cannot reset', 'reset error', 'reset failed'],
    answer: "If you are unable to reset your password or settings, contact support for assistance.",
  },
  {
    keywords: ['cannot update', 'update error', 'update failed'],
    answer: "If you are unable to update your information or software, try restarting your device. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot sync', 'sync error', 'sync failed'],
    answer: "If you are unable to sync your data, check your internet connection and account settings. Contact support if the problem continues.",
  },
  {
    keywords: ['cannot connect', 'connection error', 'connection failed'],
    answer: "If you are unable to connect to a service, check your internet connection and credentials. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot open', 'open error', 'open failed'],
    answer: "If you are unable to open a file or application, try restarting your device. If the problem continues, contact support.",
  },
  {
    keywords: ['cannot start', 'start error', 'start failed'],
    answer: "If you are unable to start a service or application, try restarting your device. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot shutdown', 'shutdown error', 'shutdown failed'],
    answer: "If you are unable to shut down your device, try closing all applications and try again. If the problem continues, contact support.",
  },
  {
    keywords: ['cannot print', 'print error', 'print failed'],
    answer: "If you are unable to print, check your printer connection and try restarting the printer. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot scan', 'scan error', 'scan failed'],
    answer: "If you are unable to scan, check your scanner connection and try restarting the device. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot copy', 'copy error', 'copy failed'],
    answer: "If you are unable to copy files or data, check your permissions and try again. If the problem persists, contact support.",
  },
  {
    keywords: ['cannot paste', 'paste error', 'paste failed'],
    answer: "If you are unable to paste, try copying the data again. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot move', 'move error', 'move failed'],
    answer: "If you are unable to move files or data, check your permissions and try again. If the problem persists, contact support.",
  },
  {
    keywords: ['cannot delete', 'delete error', 'delete failed'],
    answer: "If you are unable to delete files or data, check your permissions and try again. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot upload', 'upload error', 'upload failed'],
    answer: "If you are unable to upload files, check your internet connection and file size. If the problem persists, contact support.",
  },
  {
    keywords: ['cannot download', 'download error', 'download failed'],
    answer: "If you are unable to download files, check your internet connection and browser settings. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot access website', 'website error', 'website failed'],
    answer: "If you are unable to access the website, check your internet connection and try again. If the problem continues, contact support.",
  },
  {
    keywords: ['cannot access email', 'email access error', 'email access failed'],
    answer: "If you are unable to access your email, check your credentials and internet connection. If the issue persists, contact support.",
  },
  {
    keywords: ['cannot access account', 'account access error', 'account access failed'],
    answer: "If you are unable to access your account, try resetting your password or contact support for assistance.",
  },
  {
    keywords: ['cannot access file', 'file access error', 'file access failed'],
    answer: "If you are unable to access a file, check your permissions and try again. If the issue continues, contact support.",
  },
  {
    keywords: ['cannot access system', 'system access error', 'system access failed'],
    answer: "If you are unable to access the system, check your credentials and internet connection. If the problem persists, contact support.",
  },
];

function getGenericResponse(question: string): string | null {
  const lower = question.toLowerCase();
  for (const entry of GENERIC_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.answer;
    }
  }
  return null;
}
// ----------------------------------

// Helper to add timeout to fetch
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userInfo, messages }: { userInfo: GeminiUserInfo; messages: GeminiChatMessage[] } = await req.json();
    if (!userInfo || !messages) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Gemini API key is not set.' }, { status: 500 });
    }
    // Prepare Gemini API request
    const geminiMessages = messages.map((m: GeminiChatMessage) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body = {
      contents: geminiMessages,
    };
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:streamGenerateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      15000 // 15 seconds
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Detect expired/invalid API key and surface a clearer message
      try {
        const parsed = JSON.parse(text);
        const error = parsed?.error;
        const status = error?.status;
        const message = error?.message || '';
        const details = Array.isArray(error?.details) ? error.details : [];
        const hasInvalidKeyReason = details.some((d: any) => d?.reason === 'API_KEY_INVALID');
        if (status === 'INVALID_ARGUMENT' && (hasInvalidKeyReason || /api key .*expired|invalid/i.test(message))) {
          return NextResponse.json(
            {
              success: false,
              error: 'Gemini API key is invalid or expired. Update GEMINI_API_KEY and redeploy.',
              code: 'GEMINI_API_KEY_INVALID',
              fallback: true,
            },
            { status: 401 }
          );
        }
      } catch {}
      // Fallback to generic response
      const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
      const generic = getGenericResponse(lastUserMsg);
      if (generic) {
        return NextResponse.json({ success: true, answer: generic, fallback: true });
      } else {
        return NextResponse.json({ success: false, error: `Gemini API error: Status ${res.status}. Body: ${text}`, fallback: true }, { status: res.status });
      }
    }
    if (!res.body) {
      const text = await res.text().catch(() => '');
      // Fallback to generic response
      const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
      const generic = getGenericResponse(lastUserMsg);
      if (generic) {
        return NextResponse.json({ success: true, answer: generic, fallback: true });
      } else {
        return NextResponse.json({ success: false, error: `No response body from Gemini. Status: ${res.status}. Body: ${text}`, fallback: true }, { status: 500 });
      }
    }
    // Stream the response to the client
    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('Gemini API error:', err); // Log the full error object
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
    // Fallback to generic response
    try {
      const body = await req.json();
      const lastUserMsg = body?.messages?.filter((m: GeminiChatMessage) => m.role === 'user').slice(-1)[0]?.content || '';
      const generic = getGenericResponse(lastUserMsg);
      if (generic) {
        return NextResponse.json({ success: true, answer: generic, fallback: true });
      }
    } catch {}
    return NextResponse.json({ success: false, error: 'Gemini API error: ' + message, fallback: true }, { status: 500 });
  }
} 