"""Notification providers - console, email, SMS adapters."""
import json
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class NotificationProvider:
    """Base notification provider."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        raise NotImplementedError


class ConsoleProvider(NotificationProvider):
    """Development provider - prints to stdout/logs."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        recipient = payload.get("email") if channel == "EMAIL" else payload.get("phone") if payload else None
        logger.info(f"[NOTIFICATION CONSOLE] Channel={channel} To={recipient} Template={template} Payload={json.dumps(payload)}")
        print(f"📬 [NOTIFICATION CONSOLE] Channel={channel} To={recipient} Template={template} Payload={json.dumps(payload)}")
        return True


class SmtpEmailProvider(NotificationProvider):
    """SMTP Email Provider using Python standard library smtplib."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        to_email = payload.get("email") if payload else None
        if not to_email or not str(to_email).strip():
            raise ValueError("Recipient email address is missing")

        if not settings.SMTP_HOST:
            logger.warning("[SMTP] SMTP_HOST not configured, falling back to console.")
            return ConsoleProvider().send(channel, template, payload)
        try:
            import smtplib
            from email.mime.text import MIMEText

            body = f"Notification Template: {template}\n\nPayload Details:\n{json.dumps(payload, indent=2)}"

            msg = MIMEText(body)
            msg["Subject"] = f"Delivery Update: {template}"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"[SMTP EMAIL] Sent email to {to_email}")
            print(f"📧 [SMTP EMAIL] Sent email to {to_email} Template={template}")
            return True
        except Exception as e:
            logger.error(f"[SMTP EMAIL] Failed to send email: {e}")
            raise


class TwilioSmsProvider(NotificationProvider):
    """SMS Provider using Twilio REST API via stdlib urllib.request."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        to_phone = payload.get("phone") if payload else None
        if not to_phone or not str(to_phone).strip():
            raise ValueError("Recipient phone number is missing")

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.warning("[TWILIO SMS] Credentials not configured, falling back to console.")
            return ConsoleProvider().send(channel, template, payload)
        try:
            import urllib.request
            import urllib.parse
            import base64

            body = f"Delivery Update [{template}]: {json.dumps(payload)}"

            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            data = urllib.parse.urlencode({
                "From": settings.TWILIO_FROM_NUMBER,
                "To": to_phone,
                "Body": body,
            }).encode("utf-8")

            auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
            auth_b64 = base64.b64encode(auth_str.encode("ascii")).decode("ascii")

            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Authorization": f"Basic {auth_b64}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201):
                    logger.info(f"[TWILIO SMS] Sent SMS to {to_phone}")
                    print(f"📱 [TWILIO SMS] Sent SMS to {to_phone} Template={template}")
                    return True
                else:
                    raise Exception(f"Twilio API status {resp.status}")
        except Exception as e:
            logger.error(f"[TWILIO SMS] Failed to send SMS: {e}")
            raise


def get_provider(channel: str) -> NotificationProvider:
    """Get the appropriate provider for a channel based on settings."""
    if channel == "EMAIL":
        if settings.EMAIL_PROVIDER.lower() == "smtp":
            return SmtpEmailProvider()
        return ConsoleProvider()
    elif channel == "SMS":
        if settings.SMS_PROVIDER.lower() == "twilio":
            return TwilioSmsProvider()
        return ConsoleProvider()

    return ConsoleProvider()
