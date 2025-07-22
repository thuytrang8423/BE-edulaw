const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // Professional legal-themed email template
  getEmailTemplate(title, content, buttonText, buttonUrl, type = "primary") {
    const themes = {    
      primary: { color: "#1e40af", light: "#dbeafe" },
      success: { color: "#059669", light: "#d1fae5" },
      warning: { color: "#dc2626", light: "#fee2e2" },
      info: { color: "#0891b2", light: "#cffafe" }
    };

    const theme = themes[type] || themes.primary;

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; margin: 0 !important; }
            .content { padding: 24px 16px !important; }
            .header-content { padding: 32px 16px !important; }
            .button { padding: 14px 20px !important; font-size: 14px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 16px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background-color: #f8fafc; line-height: 1.6; color: #334155;">
        <div class="container" style="max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: ${theme.color}; position: relative;">
            <div class="header-content" style="padding: 40px 32px; text-align: center; position: relative;">
              <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">⚖️</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.025em;">
                AI Legal Assistant
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">
                Trợ lý pháp lý thông minh
              </p>
            </div>
            <div style="position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: rgba(255,255,255,0.05); border-radius: 50%; transform: translate(40px, -40px);"></div>
          </div>

          <!-- Content -->
          <div class="content" style="padding: 40px 32px;">
            
            <!-- Title Section -->
            <div style="border-left: 4px solid ${theme.color}; background: ${theme.light}; padding: 20px 24px; margin-bottom: 32px; border-radius: 0 8px 8px 0;">
              <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0; line-height: 1.3;">
                ${title}
              </h2>
            </div>

            <!-- Main Content -->
            <div style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
              ${content}
            </div>

            <!-- CTA Button -->
            ${buttonText && buttonUrl ? `
            <div style="text-align: center; margin: 40px 0;">
              <a href="${buttonUrl}" class="button"
                 style="display: inline-block; 
                        background: ${theme.color}; 
                        color: #ffffff; 
                        padding: 16px 32px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px;
                        letter-spacing: 0.025em;
                        box-shadow: 0 4px 14px -2px ${theme.color}40;
                        transition: all 0.2s ease;">
                ${buttonText}
              </a>
            </div>
            ` : ''}

            <!-- Security Notice -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 32px 0;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="color: #64748b; font-size: 18px; flex-shrink: 0; margin-top: 2px;">🛡️</div>
                <div>
                  <h4 style="color: #475569; margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
                    Cam kết bảo mật
                  </h4>
                  <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">
                    Thông tin của bạn được bảo vệ theo tiêu chuẩn bảo mật cao nhất và các quy định về bảo vệ dữ liệu cá nhân.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 32px; text-align: center;">
            
            <!-- Company Info -->
            <div style="margin-bottom: 24px;">
              <h3 style="color: #334155; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">
                AI Legal Assistant
              </h3>
              <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.4;">
                Giải pháp tư vấn pháp lý giáo dục chuyên nghiệp
              </p>
            </div>
            
            <!-- Divider -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                © 2024 AI Legal Assistant. Bảo lưu mọi quyền.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.4;">
                📧 Email này được gửi tự động từ hệ thống. Vui lòng không trả lời trực tiếp.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Spacer -->
        <div style="height: 16px;"></div>
      </body>
      </html>
    `;
  }

  // Send verification email with 6-digit code (dùng chung cho verify, reset password, v.v.)
  async sendCodeEmail(user, code, type = 'verify') {
    let title = '';
    let subject = '';
    let notice = '';
    if (type === 'verify') {
      title = 'Xác thực tài khoản của bạn';
      subject = 'Xác thực tài khoản - AI Legal Assistant';
      notice = 'Mã xác thực có hiệu lực trong <strong>10 phút</strong> kể từ thời điểm gửi email này.';
    } else if (type === 'reset') {
      title = 'Đặt lại mật khẩu';
      subject = 'Đặt lại mật khẩu - AI Legal Assistant';
      notice = 'Mã đặt lại mật khẩu có hiệu lực trong <strong>10 phút</strong> kể từ thời điểm gửi email này.';
    } else {
      title = 'Mã xác thực';
      subject = 'Mã xác thực - AI Legal Assistant';
      notice = 'Mã xác thực có hiệu lực trong <strong>10 phút</strong>.';
    }

    const content = `
      <p style="margin-bottom: 20px;">
        Xin chào <strong style="color: #1e293b;">${user.name}</strong>,
      </p>
      <p style="margin-bottom: 24px;">
        ${type === 'verify' ? 'Cảm ơn bạn đã đăng ký tài khoản AI Legal Assistant. Để hoàn tất quá trình đăng ký và bảo đảm tính bảo mật, vui lòng nhập mã xác thực bên dưới vào ứng dụng:' :
        type === 'reset' ? 'Bạn vừa yêu cầu đặt lại mật khẩu. Vui lòng nhập mã xác thực bên dưới vào ứng dụng để tiếp tục:' :
        'Vui lòng sử dụng mã xác thực bên dưới.'}
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #f1f5f9; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px 32px;">
          <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Mã xác thực
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            ${code}
          </div>
        </div>
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
          ⏰ ${notice}
        </p>
      </div>
      <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và liên hệ với chúng tôi nếu cần hỗ trợ.
      </p>
    `;

    const mailOptions = {
      from: `"AI Legal Assistant" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject,
      html: this.getEmailTemplate(title, content, null, null, "primary"),
    };
    await this.transporter.sendMail(mailOptions);
  }

  // Gửi email xác thực tài khoản (gọi hàm chung)
  async sendVerificationEmail(user, code) {
    await this.sendCodeEmail(user, code, 'verify');
  }

  // Gửi email đặt lại mật khẩu (gửi code, không gửi link)
  async sendPasswordResetEmail(user, code) {
    await this.sendCodeEmail(user, code, 'reset');
  }

  // Send welcome email after verification
  async sendWelcomeEmail(user) {
    const content = `
      <p style="margin-bottom: 20px;">
        Chúc mừng <strong style="color: #059669;">${user.name}</strong>! 
      </p>
      
      <p style="margin-bottom: 24px;">
        Tài khoản của bạn đã được kích hoạt thành công. Bây giờ bạn có thể sử dụng đầy đủ 
        các tính năng của AI Legal Assistant để hỗ trợ công việc tư vấn pháp lý giáo dục.
      </p>

      <!-- Features List -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h4 style="color: #166534; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          Tính năng chính của hệ thống:
        </h4>
        <div style="color: #15803d; font-size: 14px; line-height: 1.6;">
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px;">
            <span style="color: #22c55e; font-weight: bold;">•</span>
            <span>Tư vấn pháp lý giáo dục chính xác và cập nhật</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px;">
            <span style="color: #22c55e; font-weight: bold;">•</span>
            <span>Quản lý và lưu trữ lịch sử trao đổi</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px;">
            <span style="color: #22c55e; font-weight: bold;">•</span>
            <span>Xuất báo cáo và tài liệu tham khảo</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px;">
            <span style="color: #22c55e; font-weight: bold;">•</span>
            <span>Thông báo cập nhật chính sách và quy định mới</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span style="color: #22c55e; font-weight: bold;">•</span>
            <span>Hỗ trợ 24/7 qua hệ thống AI thông minh</span>
          </div>
        </div>
      </div>

      <p style="margin-bottom: 0; color: #475569; font-size: 15px;">
        Chúng tôi cam kết đồng hành cùng bạn trong công tác tư vấn pháp lý giáo dục. 
        Hãy bắt đầu khám phá hệ thống ngay hôm nay!
      </p>
    `;

    const mailOptions = {
      from: `"AI Legal Assistant" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject: "Chào mừng đến với AI Legal Assistant",
      html: this.getEmailTemplate(
        "Chào mừng bạn gia nhập!",
        content,
        "Bắt đầu sử dụng",
        `${process.env.CLIENT_URL}/dashboard`,
        "success"
      ),
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send notification email for important updates
  async sendNotificationEmail(user, title, message, actionText = null, actionUrl = null) {
    const content = `
      <p style="margin-bottom: 20px;">
        Xin chào <strong style="color: #1e293b;">${user.name}</strong>,
      </p>
      
      <div style="color: #475569; font-size: 16px; line-height: 1.6;">
        ${message}
      </div>
    `;

    const mailOptions = {
      from: `"AI Legal Assistant" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject: `${title} - AI Legal Assistant`,
      html: this.getEmailTemplate(
        title,
        content,
        actionText,
        actionUrl,
        "info"
      ),
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send legal update notification
  async sendLegalUpdateEmail(user, updateTitle, updateContent, documentUrl = null) {
    const content = `
      <p style="margin-bottom: 20px;">
        Xin chào <strong style="color: #1e293b;">${user.name}</strong>,
      </p>
      
      <p style="margin-bottom: 24px; color: #475569;">
        Chúng tôi xin thông báo về cập nhật quan trọng trong lĩnh vực pháp lý giáo dục:
      </p>

      <!-- Update Content -->
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px 24px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #92400e; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
          ${updateTitle}
        </h4>
        <div style="color: #a16207; font-size: 14px; line-height: 1.6;">
          ${updateContent}
        </div>
      </div>

      <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
        Để biết thêm chi tiết, vui lòng đăng nhập vào hệ thống hoặc liên hệ với bộ phận hỗ trợ của chúng tôi.
      </p>
    `;

    const mailOptions = {
      from: `"AI Legal Assistant" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject: `📋 Cập nhật pháp lý: ${updateTitle}`,
      html: this.getEmailTemplate(
        "Thông báo cập nhật pháp lý",
        content,
        documentUrl ? "Xem chi tiết" : "Vào hệ thống",
        documentUrl || `${process.env.CLIENT_URL}/dashboard`,
        "info"
      ),
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
