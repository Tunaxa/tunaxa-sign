export function contractInvitationEmail(data: {
  senderName: string;
  contractTitle: string;
  signingUrl: string;
  expiresAt?: Date;
}): { subject: string; html: string } {
  const expiryText = data.expiresAt
    ? `<p style="color:#666;font-size:13px;">This invitation expires on ${data.expiresAt.toLocaleDateString()}.</p>`
    : "";

  return {
    subject: `${data.senderName} sent you a document to sign: ${data.contractTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:40px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;">
    <div style="text-align:center;margin-bottom:30px;">
      <h1 style="color:#1a1a2e;font-size:22px;">AXA SIGN</h1>
      <p style="color:#999;font-size:12px;">by Tunaxa</p>
    </div>
    <h2 style="color:#333;font-size:18px;">You've been asked to sign a document</h2>
    <p style="color:#555;line-height:1.6;">
      <strong>${data.senderName}</strong> has sent you <strong>"${data.contractTitle}"</strong> for your signature.
    </p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.signingUrl}" style="background:#1a1a2e;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
        Review & Sign Document
      </a>
    </div>
    ${expiryText}
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
    <p style="color:#999;font-size:12px;text-align:center;">
      This is a secure document signing request from AXA Sign (Tunaxa). Do not share this email.
    </p>
  </div>
</body>
</html>`,
  };
}

export function contractCompletedEmail(data: {
  recipientName: string;
  contractTitle: string;
}): { subject: string; html: string } {
  return {
    subject: `Document signed: ${data.contractTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:40px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;">
    <h1 style="color:#1a1a2e;font-size:22px;text-align:center;">AXA SIGN</h1>
    <h2 style="color:#333;font-size:18px;">Document fully signed</h2>
    <p style="color:#555;line-height:1.6;">
      Hi ${data.recipientName},<br><br>
      <strong>"${data.contractTitle}"</strong> has been fully signed by all parties.
    </p>
    <p style="color:#555;">You can download the signed document from your dashboard.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
    <p style="color:#999;font-size:12px;text-align:center;">
      AXA Sign by Tunaxa
    </p>
  </div>
</body>
</html>`,
  };
}

export function contractReminderEmail(data: {
  recipientName: string;
  contractTitle: string;
  signingUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Reminder: Please sign "${data.contractTitle}"`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:40px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;">
    <h1 style="color:#1a1a2e;font-size:22px;text-align:center;">AXA SIGN</h1>
    <h2 style="color:#333;font-size:18px;">Reminder: Signature needed</h2>
    <p style="color:#555;line-height:1.6;">
      Hi ${data.recipientName},<br><br>
      This is a friendly reminder that you still need to sign <strong>"${data.contractTitle}"</strong>.
    </p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.signingUrl}" style="background:#1a1a2e;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
        Sign Now
      </a>
    </div>
  </div>
</body>
</html>`,
  };
}
