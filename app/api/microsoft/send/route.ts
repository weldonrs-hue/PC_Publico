import { NextRequest, NextResponse } from 'next/server';
import { decryptToken, refreshAccessToken } from '@/lib/server/microsoft-oauth';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { uid, recipient, subject, content, attachments } = await req.json();

    if (!uid || !recipient || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get user's Microsoft connection from Firestore
    const db = getAdminDb();
    const connDoc = await db.collection('microsoft_connections').doc(uid).get();

    if (!connDoc.exists) {
      return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 404 });
    }

    const connData = connDoc.data()!;
    const encryptedRefreshToken = connData.refreshToken;

    if (!encryptedRefreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
    }

    // 2. Decrypt refresh token and get a fresh access token
    const refreshToken = decryptToken(encryptedRefreshToken);
    const tokenData = await refreshAccessToken(refreshToken);
    const accessToken = tokenData.access_token;

    // 3. Prepare the email message for Microsoft Graph
    // Attachments must be in Base64 without the data:mime;base64, prefix
    const formattedAttachments = (attachments || []).map((att: any) => {
      let base64Data = att.data;
      if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
      }
      
      return {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.type || 'application/octet-stream',
        contentBytes: base64Data
      };
    });

    const emailMessage = {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: content.replace(/\n/g, '<br/>')
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipient
          }
        }
      ],
      attachments: formattedAttachments
    };

    // 4. Create a draft via Microsoft Graph
    const draftResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailMessage)
    });

    if (!draftResponse.ok) {
      const errorData = await draftResponse.json();
      console.error('[Microsoft Draft] Graph API error:', errorData);
      return NextResponse.json({ 
        error: errorData.error?.message || 'Failed to create draft via Microsoft Graph' 
      }, { status: draftResponse.status });
    }

    const draftData = await draftResponse.json();
    return NextResponse.json({ 
      success: true, 
      webLink: draftData.webLink 
    });
  } catch (err: any) {
    console.error('[Microsoft Send] Internal error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
