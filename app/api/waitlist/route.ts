import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = 'stagelinkcreator@gmail.com';

function waitlistEmailHtml(roleLabel: string) {
  return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F7F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E0E0E0">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:28px 40px">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">CONJUNCTURE</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#717171;text-transform:uppercase;letter-spacing:1px">ลงทะเบียนแล้ว</p>
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111111;line-height:1.3">รับสิทธิ์แล้ว ✓</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#717171;line-height:1.7">
              ขอบคุณที่ลงทะเบียนในฐานะ <strong style="color:#111111">${roleLabel}</strong> เรากำลังสร้างแพลตฟอร์มจัดซื้อจัดจ้างที่โปร่งใสที่สุดในไทย คุณจะเป็นคนแรกๆ ที่ได้ใช้งาน
            </p>

            <!-- What to expect -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7;border-radius:10px;border:1px solid #E0E0E0;margin-bottom:28px">
              <tr><td style="padding:20px 24px">
                <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#111111;text-transform:uppercase;letter-spacing:0.8px">ขั้นตอนต่อไป</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;vertical-align:top">
                      <span style="display:inline-block;width:20px;height:20px;background:#111111;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:12px">1</span>
                    </td>
                    <td style="padding:6px 0"><p style="margin:0;font-size:14px;color:#717171;line-height:1.6">เราจะส่งอีเมลแจ้งทันทีที่เปิด Early Access</p></td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;vertical-align:top">
                      <span style="display:inline-block;width:20px;height:20px;background:#111111;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:12px">2</span>
                    </td>
                    <td style="padding:6px 0"><p style="margin:0;font-size:14px;color:#717171;line-height:1.6">สมาชิกแรกๆ ได้สิทธิ์เข้าก่อนและราคา Founding Member</p></td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;vertical-align:top">
                      <span style="display:inline-block;width:20px;height:20px;background:#111111;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:12px">3</span>
                    </td>
                    <td style="padding:6px 0"><p style="margin:0;font-size:14px;color:#717171;line-height:1.6">บอกต่อเพื่อน — ยิ่งแนะนำ ยิ่งขึ้นคิวเร็ว</p></td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#717171;line-height:1.6">มีคำถาม? ตอบกลับอีเมลนี้ได้เลย</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #E0E0E0;background:#F7F7F7">
            <p style="margin:0;font-size:12px;color:#717171">© 2025 Conjuncture Co., Ltd. · Bangkok, Thailand</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const roleLabel = role === 'vendor' ? 'ผู้ขาย / ซัพพลายเออร์' : 'ผู้ซื้อ / หน่วยงาน';

  try {
    const result = await resend.emails.send({
      from: 'Conjuncture <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: 'รับสิทธิ์ Conjuncture แล้ว ✓',
      html: waitlistEmailHtml(roleLabel),
    });

    console.log('[waitlist email] sent:', result);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist email] error:', err);
    return NextResponse.json({ error: 'Email failed' }, { status: 500 });
  }
}
