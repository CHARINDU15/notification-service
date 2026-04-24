const nodemailer = require('nodemailer');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Email Service - SMTP Configuration
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Verify connection on init
    this.transporter.verify((error, success) => {
      if (error) {
        logger.warn(error, 'SMTP connection verification failed');
      } else {
        logger.info('✅ SMTP connected successfully');
      }
    });
  }

  /**
   * Send shipment arrival email
   */
  async sendShipmentArrivalEmail(consignmentData) {
    try {
      const { recipientEmail, recipientName, shipmentDetails } = consignmentData;
      const { shipmentId, deliveryDate, deliveryCity, deliveryState, packageCount } = shipmentDetails;

      const htmlContent = this.generateShipmentArrivalHtml(consignmentData);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Your Shipment ${shipmentId} Has Arrived - Ready for Delivery`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId,
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'Shipment arrival email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: consignmentData.shipmentDetails.shipmentId },
        'Failed to send shipment arrival email'
      );
      throw error;
    }
  }

  /**
   * Send access link email
   */
  async sendAccessLinkEmail(payload) {
    try {
      const { recipientEmail, recipientName, shipmentId, accessUrl, expiresAt } = payload;

      const htmlContent = this.generateAccessLinkHtml(payload);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Secure Access Link for Shipment ${shipmentId}`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId,
          'X-Access-Link-Expiry': expiresAt
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'Access link email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: payload.shipmentId },
        'Failed to send access link email'
      );
      throw error;
    }
  }

  /**
   * Send delivery option change email
   */
  async sendDeliveryOptionChangeEmail(payload) {
    try {
      const { recipientEmail, shipmentId } = payload;

      const htmlContent = this.generateDeliveryOptionChangeHtml(payload);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Delivery Option Updated for Shipment ${shipmentId}`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'Delivery option change email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: payload.shipmentId },
        'Failed to send delivery option change email'
      );
      throw error;
    }
  }

  /**
   * Send cutoff reminder email
   */
  async sendCutoffReminderEmail(payload) {
    try {
      const { recipientEmail, shipmentId } = payload;

      const htmlContent = this.generateCutoffReminderHtml(payload);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Delivery Cutoff Reminder for Shipment ${shipmentId}`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId,
          'X-Cutoff-Time': payload.cutoffTime
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'Cutoff reminder email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: payload.shipmentId },
        'Failed to send cutoff reminder email'
      );
      throw error;
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(payload) {
    try {
      const { recipientEmail, shipmentId } = payload;

      const htmlContent = this.generateInvoiceHtml(payload);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Invoice Ready for Shipment ${shipmentId}`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'Invoice email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: payload.shipmentId },
        'Failed to send invoice email'
      );
      throw error;
    }
  }

  /**
   * Send OTP email
   */
  async sendOtpEmail(payload) {
    try {
      const { recipientEmail, recipientName, shipmentId, otp, expiresAt } = payload;

      const htmlContent = this.generateOtpHtml(payload);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `Your OTP Code for Shipment ${shipmentId}`,
        html: htmlContent,
        headers: {
          'X-Shipment-ID': shipmentId,
          'X-OTP-Expiry': expiresAt
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(
        { shipmentId, recipientEmail, messageId: result.messageId },
        'OTP email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(
        { error: error.message, shipmentId: payload.shipmentId },
        'Failed to send OTP email'
      );
      throw error;
    }
  }

  /**
   * Generate HTML email for shipment arrival
   */
  generateShipmentArrivalHtml(consignmentData) {
    const { recipientName, shipmentDetails } = consignmentData;
    const { shipmentId, deliveryDate, deliveryCity, deliveryState, deliveryCountry, postalCode, packageCount } = shipmentDetails;

    const formattedDate = new Date(deliveryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
          .header h1 { font-size: 28px; margin-bottom: 10px; }
          .header p { font-size: 14px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 16px; margin-bottom: 20px; }
          .highlight-box { background-color: #f0f7ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .shipment-id { font-size: 20px; font-weight: bold; color: #667eea; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .detail-item { background-color: #f9f9f9; padding: 15px; border-radius: 4px; }
          .detail-label { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 5px; }
          .detail-value { font-size: 16px; font-weight: 600; color: #333; }
          .options { margin: 30px 0; }
          .options h3 { font-size: 16px; margin-bottom: 15px; color: #333; }
          .option-list { list-style: none; }
          .option-list li { padding: 10px 0; padding-left: 25px; position: relative; }
          .option-list li:before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; }
          .cta-button { display: block; background-color: #667eea; color: white; text-decoration: none; padding: 15px; text-align: center; border-radius: 4px; font-weight: 600; margin: 30px 0; transition: background-color 0.3s; }
          .cta-button:hover { background-color: #764ba2; }
          .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Shipment Arrived!</h1>
            <p>Ready for delivery to ${deliveryCity}</p>
          </div>

          <div class="content">
            <p class="greeting">Hello ${recipientName},</p>
            <p>Great news! Your shipment has successfully arrived at our facility and is ready for delivery.</p>

            <div class="highlight-box">
              <p style="font-size: 12px; color: #999; margin-bottom: 10px;">SHIPMENT ID</p>
              <p class="shipment-id">${shipmentId}</p>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-label">📦 Packages</div>
                <div class="detail-value">${packageCount} Package${packageCount > 1 ? 's' : ''}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">📅 Delivery Date</div>
                <div class="detail-value">${formattedDate}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">📍 Location</div>
                <div class="detail-value">${deliveryCity}, ${deliveryState}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">🌍 Country</div>
                <div class="detail-value">${deliveryCountry}</div>
              </div>
            </div>

            <div class="options">
              <h3>Choose Your Delivery Preference:</h3>
              <ul class="option-list">
                <li>Collect from ParcelPoint Location</li>
                <li>Leave in a Safe Place</li>
                <li>Leave with a Trusted Person</li>
                <li>Deliver to Alternate Address</li>
                <li>Hold for Collection</li>
                <li>Change Delivery Date</li>
              </ul>
            </div>

            <a href="https://parcelpoint.com/track/${shipmentId}" class="cta-button">View Shipment & Select Delivery Option</a>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              If you have any questions or need assistance, please contact our support team at <strong>support@parcelpoint.com</strong> or call <strong>+94 11 234 5678</strong>.
            </p>
          </div>

          <div class="footer">
            <p>&copy; 2026 ParcelPoint - All rights reserved</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for OTP
   */
  generateOtpHtml(payload) {
    const { recipientName, shipmentId, otp, expiresAt } = payload;
    const formattedExpiry = new Date(expiresAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #1f2937; color: white; padding: 24px; text-align: center; }
          .content { padding: 24px; }
          .otp-box { background-color: #f3f4f6; border: 1px dashed #9ca3af; padding: 16px; text-align: center; font-size: 28px; letter-spacing: 6px; font-weight: bold; margin: 20px 0; }
          .meta { font-size: 14px; color: #6b7280; margin-top: 10px; }
          .footer { background-color: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your One-Time Passcode</h1>
          </div>
          <div class="content">
            <p>Hello ${recipientName},</p>
            <p>Use the following code to access shipment ${shipmentId}:</p>
            <div class="otp-box">${otp}</div>
            <p class="meta">This code expires at ${formattedExpiry}.</p>
            <p class="meta">If you did not request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            ParcelPoint Notification Service
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for access link
   */
  generateAccessLinkHtml(payload) {
    const { recipientName, shipmentId, accessUrl, expiresAt, deliveryDate } = payload;

    const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedDelivery = deliveryDate
      ? new Date(deliveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : 'N/A';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: white; padding: 36px 20px; text-align: center; }
          .header h1 { font-size: 24px; margin-bottom: 8px; }
          .content { padding: 32px 28px; }
          .highlight-box { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 18px 0; border-radius: 4px; }
          .cta-button { display: block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px; text-align: center; border-radius: 6px; font-weight: 600; margin: 22px 0; }
          .detail-item { font-size: 14px; color: #555; margin-top: 6px; }
          .footer { background-color: #f5f5f5; padding: 18px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Secure Access Link</h1>
            <p>Shipment ${shipmentId}</p>
          </div>

          <div class="content">
            <p>Hello ${recipientName},</p>
            <p>Your secure access link is ready. Use it to manage your shipment delivery preferences.</p>

            <div class="highlight-box">
              <div class="detail-item"><strong>Shipment ID:</strong> ${shipmentId}</div>
              <div class="detail-item"><strong>Delivery Date:</strong> ${formattedDelivery}</div>
              <div class="detail-item"><strong>Link Expires:</strong> ${formattedExpiry}</div>
            </div>

            <a href="${accessUrl}" class="cta-button">Open Secure Link</a>

            <p style="font-size: 13px; color: #666;">If you did not request this link, please ignore this email.</p>
          </div>

          <div class="footer">
            <p>&copy; 2026 ParcelPoint - All rights reserved</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for delivery option change
   */
  generateDeliveryOptionChangeHtml(payload) {
    const {
      recipientName,
      shipmentId,
      previousOption,
      currentOption,
      consignment,
      optionDetails
    } = payload;

    const optionLabels = {
      CHANGE_DELIVERY_DATE: 'Change Delivery Date',
      COLLECT_FROM_PARCELPOINT: 'Collect from ParcelPoint',
      LEAVE_IN_SAFE_PLACE: 'Leave in Safe Place',
      LEAVE_WITH_TRUSTED_PERSON: 'Leave with Trusted Person',
      ALTERNATE_ADDRESS: 'Alternate Address',
      HOLD_FOR_COLLECTION: 'Hold for Collection'
    };

    const deliveryDate = consignment?.deliveryDate
      ? new Date(consignment.deliveryDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : 'Not set';

    const address = consignment?.receiverAddress || {};
    const addressLines = [
      address.address1,
      address.address2,
      address.suburb,
      address.city,
      address.state,
      address.country,
      address.postcode
    ].filter(Boolean).join(', ');

    const previousText = optionLabels[previousOption] || previousOption || 'None';
    const currentText = optionLabels[currentOption] || currentOption || 'Not set';

    const detailItems = [];
    if (optionDetails?.delivery_date) {
      detailItems.push({ label: 'New Delivery Date', value: new Date(optionDetails.delivery_date).toLocaleString('en-US') });
    }
    if (optionDetails?.pp_location_name) {
      detailItems.push({ label: 'ParcelPoint Location', value: optionDetails.pp_location_name });
    }
    if (optionDetails?.safe_location) {
      detailItems.push({ label: 'Safe Place', value: optionDetails.safe_location });
    }
    if (optionDetails?.trusted_person_name) {
      detailItems.push({ label: 'Trusted Person', value: optionDetails.trusted_person_name });
    }
    if (optionDetails?.trusted_person_mobile) {
      detailItems.push({ label: 'Trusted Person Phone', value: optionDetails.trusted_person_mobile });
    }
    if (optionDetails?.address_1) {
      const altAddress = [
        optionDetails.address_1,
        optionDetails.address_2,
        optionDetails.suburb,
        optionDetails.city,
        optionDetails.state,
        optionDetails.country,
        optionDetails.postcode
      ].filter(Boolean).join(', ');
      detailItems.push({ label: 'Alternate Address', value: altAddress });
    }
    if (optionDetails?.additional_info) {
      detailItems.push({ label: 'Additional Info', value: optionDetails.additional_info });
    }

    const detailHtml = detailItems.length
      ? detailItems.map(item => `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #444;">${item.label}</td>
            <td style="padding: 6px 0; color: #222;">${item.value}</td>
          </tr>
        `).join('')
      : '<tr><td style="padding: 6px 0; color: #666;">No additional details provided.</td></tr>';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8; color: #222; }
          .container { max-width: 640px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
          .header { background: #1f4b99; color: #fff; padding: 28px 24px; text-align: left; }
          .header h1 { font-size: 22px; margin-bottom: 6px; }
          .header p { opacity: 0.9; font-size: 14px; }
          .content { padding: 24px; }
          .section { margin-bottom: 20px; }
          .badge { display: inline-block; padding: 6px 12px; background: #e9f0ff; color: #1f4b99; border-radius: 999px; font-size: 12px; font-weight: 600; }
          .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
          .summary-card { background: #f8f9fb; padding: 12px; border-radius: 8px; }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 6px; }
          .summary-value { font-size: 14px; font-weight: 600; color: #222; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .footer { background: #f4f6f8; padding: 18px; text-align: center; font-size: 12px; color: #666; }
          @media (max-width: 600px) {
            .summary { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Delivery Option Updated</h1>
            <p>Shipment ${shipmentId}</p>
          </div>
          <div class="content">
            <p style="margin-bottom: 12px;">Hello ${recipientName},</p>
            <p style="margin-bottom: 16px;">Your delivery preference has been updated. Details are below.</p>

            <div class="section">
              <span class="badge">Change Summary</span>
              <div class="summary">
                <div class="summary-card">
                  <div class="summary-label">Previous Option</div>
                  <div class="summary-value">${previousText}</div>
                </div>
                <div class="summary-card">
                  <div class="summary-label">Current Option</div>
                  <div class="summary-value">${currentText}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <span class="badge">Shipment Details</span>
              <table>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #444;">Estimated Delivery</td>
                  <td style="padding: 6px 0; color: #222;">${deliveryDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #444;">Delivery Address</td>
                  <td style="padding: 6px 0; color: #222;">${addressLines || 'Not available'}</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <span class="badge">Option Details</span>
              <table>
                ${detailHtml}
              </table>
            </div>
          </div>
          <div class="footer">
            <p>If you did not make this change, please contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for cutoff reminder
   */
  generateCutoffReminderHtml(payload) {
    const { recipientName, shipmentId, cutoffTime, deliveryDetails } = payload;
    const deliveryDate = deliveryDetails?.deliveryDate
      ? new Date(deliveryDetails.deliveryDate).toLocaleString('en-US')
      : 'Not set';
    const cutoff = new Date(cutoffTime).toLocaleString('en-US');
    const address = deliveryDetails?.address || {};
    const addressLines = [
      address.address1,
      address.address2,
      address.suburb,
      address.city,
      address.state,
      address.country,
      address.postcode
    ].filter(Boolean).join(', ');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f7f7; color: #222; }
          .container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: #0f172a; color: #fff; padding: 24px; }
          .content { padding: 24px; }
          .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; margin: 16px 0; }
          .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; }
          .value { font-size: 16px; font-weight: 600; }
          .footer { background: #f7f7f7; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Delivery Cutoff Reminder</h1>
            <p>Shipment ${shipmentId}</p>
          </div>
          <div class="content">
            <p>Hello ${recipientName},</p>
            <p>Your delivery preference cutoff is in 48 hours. Please review your details before the cutoff time.</p>

            <div class="highlight">
              <div class="label">Cutoff Time</div>
              <div class="value">${cutoff}</div>
            </div>

            <div class="label">Scheduled Delivery</div>
            <div class="value">${deliveryDate}</div>

            <div class="label" style="margin-top: 12px;">Delivery Address</div>
            <div class="value">${addressLines || 'Not available'}</div>
          </div>
          <div class="footer">
            <p>If you need to update your delivery preference, please do so before the cutoff time.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for invoice
   */
  generateInvoiceHtml(payload) {
    const { recipientName, shipmentId, invoice } = payload;
    const breakdown = invoice.breakdown || {};

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; color: #222; }
          .container { max-width: 640px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: #065f46; color: #fff; padding: 24px; }
          .content { padding: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-size: 13px; color: #6b7280; }
          .value { font-size: 14px; font-weight: 600; color: #111827; text-align: right; }
          .total { font-size: 18px; font-weight: 700; color: #065f46; }
          .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice Ready</h1>
            <p>Shipment ${shipmentId}</p>
          </div>
          <div class="content">
            <p>Hello ${recipientName},</p>
            <p>Your updated invoice is ready. Please review the summary below.</p>

            <table>
              <tr>
                <td class="label">Base Rate</td>
                <td class="value">${breakdown.base || 0}</td>
              </tr>
              <tr>
                <td class="label">Weight Cost</td>
                <td class="value">${breakdown.weightCost || 0}</td>
              </tr>
              <tr>
                <td class="label">Accessorial Fees</td>
                <td class="value">${breakdown.accessorial?.total || 0}</td>
              </tr>
              <tr>
                <td class="label">Location Surcharge</td>
                <td class="value">${breakdown.location || 0}</td>
              </tr>
              <tr>
                <td class="label">Time Surcharge</td>
                <td class="value">${breakdown.timeSurcharge || 0}</td>
              </tr>
              <tr>
                <td class="label">Discount</td>
                <td class="value">-${breakdown.discount?.amount || 0}</td>
              </tr>
              <tr>
                <td class="label">Tax</td>
                <td class="value">${invoice.tax}</td>
              </tr>
              <tr>
                <td class="label">Total (${invoice.currency})</td>
                <td class="value total">${invoice.total}</td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>Thank you for choosing ParcelPoint.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
