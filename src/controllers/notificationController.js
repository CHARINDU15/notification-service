const { StatusCodes } = require('http-status-codes');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const pushNotificationService = require('../services/pushNotificationService');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const resolveConsignmentId = async (shipmentId) => {
  if (!shipmentId) return null;
  const consignment = await db('consignments')
    .where('consignment_id', shipmentId)
    .first();
  return consignment?.id || null;
};

// Validation schema
const shipmentArrivalSchema = Joi.object({
  consignmentId: Joi.string().min(3).max(50).required(),
  type: Joi.string().valid('SHIPMENT_ARRIVAL').required(),
  recipientEmail: Joi.string().email().required(),
  recipientPhone: Joi.string().min(10).max(20).required(),
  recipientName: Joi.string().min(2).max(100).required(),
  shipmentDetails: Joi.object({
    shipmentId: Joi.string().required(),
    deliveryDate: Joi.string().isoDate().required(),
    deliveryCity: Joi.string().required(),
    deliveryState: Joi.string().required(),
    deliveryCountry: Joi.string().required(),
    postalCode: Joi.string().required(),
    packageCount: Joi.number().min(1).max(100).required()
  }).required(),
  metadata: Joi.object().optional()
});

const accessLinkSchema = Joi.object({
  type: Joi.string().valid('ACCESS_LINK').required(),
  recipientEmail: Joi.string().email().required(),
  recipientName: Joi.string().min(2).max(100).required(),
  shipmentId: Joi.string().min(3).max(50).required(),
  accessUrl: Joi.string().uri().required(),
  expiresAt: Joi.string().isoDate().required(),
  deliveryDate: Joi.string().isoDate().allow(null).optional()
});

const otpSchema = Joi.object({
  type: Joi.string().valid('OTP').required(),
  recipientEmail: Joi.string().email().allow(null),
  recipientPhone: Joi.string().min(10).max(20).allow(null),
  recipientName: Joi.string().min(2).max(100).required(),
  shipmentId: Joi.string().min(3).max(50).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  expiresAt: Joi.string().isoDate().required(),
  channel: Joi.string().valid('EMAIL', 'SMS').required()
}).or('recipientEmail', 'recipientPhone');

const otpAlertSchema = Joi.object({
  shipmentId: Joi.string().min(3).max(50).required(),
  type: Joi.string().valid('OTP_WARNING', 'OTP_LOCK').required(),
  attempts: Joi.number().integer().min(1).required(),
  ipAddress: Joi.string().max(64).required(),
  timestamp: Joi.string().isoDate().required(),
  link: Joi.string().required(),
  lockDuration: Joi.string().optional()
});

const deliveryOptionSchema = Joi.object({
  type: Joi.string().valid('DELIVERY_OPTION_CHANGE').required(),
  shipmentId: Joi.string().min(3).max(50).required(),
  recipientEmail: Joi.string().email().required(),
  recipientName: Joi.string().min(2).max(100).required(),
  previousOption: Joi.string().allow(null, ''),
  currentOption: Joi.string().required(),
  consignment: Joi.object({
    shipmentId: Joi.string().required(),
    deliveryDate: Joi.string().isoDate().allow(null),
    receiverName: Joi.string().allow(null, ''),
    receiverAddress: Joi.object({
      address1: Joi.string().allow(null, ''),
      address2: Joi.string().allow(null, ''),
      suburb: Joi.string().allow(null, ''),
      city: Joi.string().allow(null, ''),
      state: Joi.string().allow(null, ''),
      country: Joi.string().allow(null, ''),
      postcode: Joi.string().allow(null, '')
    }).required()
  }).required(),
  optionDetails: Joi.object().optional()
});

const cutoffReminderSchema = Joi.object({
  type: Joi.string().valid('CUTOFF_REMINDER').required(),
  shipmentId: Joi.string().min(3).max(50).required(),
  recipientEmail: Joi.string().email().required(),
  recipientName: Joi.string().min(2).max(100).required(),
  cutoffTime: Joi.string().isoDate().required(),
  deliveryDetails: Joi.object({
    deliveryDate: Joi.string().isoDate().allow(null),
    option: Joi.string().allow(null, ''),
    address: Joi.object({
      address1: Joi.string().allow(null, ''),
      address2: Joi.string().allow(null, ''),
      suburb: Joi.string().allow(null, ''),
      city: Joi.string().allow(null, ''),
      state: Joi.string().allow(null, ''),
      country: Joi.string().allow(null, ''),
      postcode: Joi.string().allow(null, ''),
      parcelPointName: Joi.string().allow(null, ''),
      parcelPointId: Joi.string().allow(null, '')
    }).required()
  }).required()
});

const invoiceSchema = Joi.object({
  type: Joi.string().valid('INVOICE_READY').required(),
  shipmentId: Joi.string().min(3).max(50).required(),
  recipientEmail: Joi.string().email().required(),
  recipientName: Joi.string().min(2).max(100).required(),
  invoice: Joi.object({
    consignmentId: Joi.string().required(),
    subtotal: Joi.number().required(),
    tax: Joi.number().required(),
    total: Joi.number().required(),
    currency: Joi.string().required(),
    breakdown: Joi.object().required()
  }).required(),
  deliveryDetails: Joi.object().optional()
});

/**
 * Send shipment arrival notification
 * Handles email, SMS, and push notifications
 */
exports.sendShipmentArrival = async (req, res, next) => {
  try {
    const { error, value } = shipmentArrivalSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    const consignmentId = await resolveConsignmentId(payload.consignmentId);
    if (!consignmentId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    logger.info(
      { consignmentId: payload.consignmentId, notificationId },
      'Processing shipment arrival notification'
    );

    // Send all notifications in parallel (non-blocking)
    const results = await Promise.allSettled([
      emailService.sendShipmentArrivalEmail(payload),
      smsService.sendShipmentArrivalSms(payload),
      pushNotificationService.sendShipmentArrivalNotification(payload)
    ]);

    // Log notification results
    const notificationLog = {
      notification_id: notificationId,
      consignment_id: payload.consignmentId,
      type: payload.type,
      recipient_email: payload.recipientEmail,
      recipient_phone: payload.recipientPhone,
      email_status: results[0].status === 'fulfilled' ? (results[0].value.success ? 'SENT' : 'FAILED') : 'ERROR',
      sms_status: results[1].status === 'fulfilled' ? (results[1].value.success ? 'SENT' : 'FAILED') : 'ERROR',
      push_status: results[2].status === 'fulfilled' ? (results[2].value.success ? 'SENT' : 'FAILED') : 'ERROR',
      email_message_id: results[0].status === 'fulfilled' ? results[0].value.messageId : null,
      sms_message_id: results[1].status === 'fulfilled' ? results[1].value.messageSid : null,
      push_message_id: results[2].status === 'fulfilled' ? results[2].value.notificationId : null,
      metadata: JSON.stringify(payload.metadata || {}),
      created_at: new Date()
    };

    // Store notification log in database
    await db('notifications').insert({
      consignment_id: consignmentId,
      channel: 'MULTI',
      from_address: process.env.SMTP_FROM,
      to_address: payload.recipientEmail,
      type: payload.type,
      status: 'QUEUED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: notificationLog.metadata,
      created_by: 'notification-service'
    });

    logger.info(
      {
        consignmentId: payload.consignmentId,
        notificationId,
        results: {
          email: results[0].status === 'fulfilled' ? results[0].value.success : false,
          sms: results[1].status === 'fulfilled' ? results[1].value.success : false,
          push: results[2].status === 'fulfilled' ? results[2].value.success : false
        }
      },
      'Shipment arrival notification processed'
    );

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        consignmentId: payload.consignmentId,
        status: 'QUEUED',
        channels: {
          email: results[0].status === 'fulfilled' ? results[0].value.success : false,
          sms: results[1].status === 'fulfilled' ? results[1].value.success : false,
          push: results[2].status === 'fulfilled' ? results[2].value.success : false
        }
      },
      message: 'Notification queued for delivery'
    });
  } catch (error) {
    logger.error(error, 'Error processing shipment arrival notification');
    return next(error);
  }
};

/**
 * Get notification status
 */
exports.getNotificationStatus = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await db('notifications')
      .where('reference_id', notificationId)
      .first();

    if (!notification) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Notification not found'
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        notificationId,
        consignmentId: notification.consignment_id,
        type: notification.type,
        status: notification.status,
        createdAt: notification.created_date,
        updatedAt: notification.updated_date
      }
    });
  } catch (error) {
    logger.error(error, 'Error fetching notification status');
    return next(error);
  }
};

/**
 * Send access link notification (email only)
 */
exports.sendAccessLink = async (req, res, next) => {
  try {
    const { error, value } = accessLinkSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    const consignmentId = await resolveConsignmentId(payload.shipmentId);
    if (!consignmentId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    const result = await emailService.sendAccessLinkEmail(payload);

    await db('notifications').insert({
      consignment_id: consignmentId,
      channel: 'EMAIL',
      from_address: process.env.SMTP_FROM,
      to_address: payload.recipientEmail,
      type: payload.type,
      status: result.success ? 'SENT' : 'FAILED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({ accessUrl: payload.accessUrl, expiresAt: payload.expiresAt }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        status: result.success ? 'SENT' : 'FAILED'
      },
      message: 'Access link email processed'
    });
  } catch (error) {
    logger.error(error, 'Error processing access link notification');
    return next(error);
  }
};

/**
 * Send OTP notification
 */
exports.sendOtp = async (req, res, next) => {
  try {
    const { error, value } = otpSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    const consignmentId = await resolveConsignmentId(payload.shipmentId);
    if (!consignmentId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    if (payload.channel === 'EMAIL' && !payload.recipientEmail) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'recipientEmail is required for EMAIL channel'
      });
    }

    if (payload.channel === 'SMS' && !payload.recipientPhone) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'recipientPhone is required for SMS channel'
      });
    }

    let result = { success: false };
    if (payload.channel === 'EMAIL') {
      result = await emailService.sendOtpEmail(payload);
    } else if (payload.channel === 'SMS') {
      result = await smsService.sendOtpSms(payload);
    }

    await db('notifications').insert({
      consignment_id: consignmentId,
      channel: payload.channel,
      from_address: payload.channel === 'EMAIL' ? process.env.SMTP_FROM : process.env.TWILIO_PHONE_NUMBER,
      to_address: payload.channel === 'EMAIL' ? payload.recipientEmail : payload.recipientPhone,
      type: payload.type,
      status: result.success ? 'SENT' : 'FAILED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({ expiresAt: payload.expiresAt, channel: payload.channel }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        status: result.success ? 'SENT' : 'FAILED'
      },
      message: 'OTP notification processed'
    });
  } catch (error) {
    logger.error(error, 'Error processing OTP notification');
    return next(error);
  }
};

/**
 * Send delivery option change email
 */
exports.sendDeliveryOptionChange = async (req, res, next) => {
  try {
    const { error, value } = deliveryOptionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    const consignmentId = await resolveConsignmentId(payload.shipmentId);
    if (!consignmentId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    const result = await emailService.sendDeliveryOptionChangeEmail(payload);

    await db('notifications').insert({
      consignment_id: consignmentId,
      channel: 'EMAIL',
      from_address: process.env.SMTP_FROM,
      to_address: payload.recipientEmail,
      type: payload.type,
      status: result.success ? 'SENT' : 'FAILED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({
        previousOption: payload.previousOption,
        currentOption: payload.currentOption
      }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        status: result.success ? 'SENT' : 'FAILED'
      },
      message: 'Delivery option change email processed'
    });
  } catch (error) {
    logger.error(error, 'Error processing delivery option change notification');
    return next(error);
  }
};

/**
 * Send cutoff reminder email
 */
exports.sendCutoffReminder = async (req, res, next) => {
  try {
    const { error, value } = cutoffReminderSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    await emailService.sendCutoffReminderEmail(payload);

    await db('notifications').insert({
      consignment_id: payload.shipmentId,
      channel: 'EMAIL',
      from_address: process.env.SMTP_FROM,
      to_address: payload.recipientEmail,
      type: payload.type,
      status: 'QUEUED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({ cutoffTime: payload.cutoffTime }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        shipmentId: payload.shipmentId,
        status: 'QUEUED'
      }
    });
  } catch (error) {
    logger.error(error, 'Error processing cutoff reminder');
    return next(error);
  }
};

/**
 * Send invoice notification email
 */
exports.sendInvoiceReady = async (req, res, next) => {
  try {
    const { error, value } = invoiceSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    await emailService.sendInvoiceEmail(payload);

    await db('notifications').insert({
      consignment_id: payload.shipmentId,
      channel: 'EMAIL',
      from_address: process.env.SMTP_FROM,
      to_address: payload.recipientEmail,
      type: payload.type,
      status: 'QUEUED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({ total: payload.invoice.total, currency: payload.invoice.currency }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        shipmentId: payload.shipmentId,
        status: 'QUEUED'
      }
    });
  } catch (error) {
    logger.error(error, 'Error processing invoice notification');
    return next(error);
  }
};

/**
 * Send OTP alert notification
 */
exports.sendOtpAlert = async (req, res, next) => {
  try {
    const { error, value } = otpAlertSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const payload = value;
    const notificationId = uuidv4();

    const consignmentId = await resolveConsignmentId(payload.shipmentId);
    if (!consignmentId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    await db('notifications').insert({
      consignment_id: consignmentId,
      channel: 'SYSTEM',
      from_address: 'system',
      to_address: null,
      type: payload.type,
      status: 'QUEUED',
      reference_id: notificationId,
      message: JSON.stringify(payload),
      metadata: JSON.stringify({ attempts: payload.attempts, ipAddress: payload.ipAddress }),
      created_by: 'notification-service'
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        notificationId,
        status: 'QUEUED'
      },
      message: 'OTP alert queued'
    });
  } catch (error) {
    logger.error(error, 'Error processing OTP alert notification');
    return next(error);
  }
};
