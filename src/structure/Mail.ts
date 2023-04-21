import nodemailer from "nodemailer";

export class Mail {
  host = {
    service: process.env.MAIL_SERVICE,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  }

  transporter = nodemailer.createTransport({
    service: this.host.service,
    auth: {
      user: this.host.user,
      pass: this.host.pass,
    }
  });

  sendMail(options: { to: string, subject: string, text: string, html: string }) {
    const mailOptions = { 
      from: this.host.user, 
      ...options,
    };

    return new Promise<void>((resolve, reject) => {
      this.transporter.sendMail(mailOptions, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    })
  }
}
