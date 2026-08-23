"""Notification providers - console, email, SMS adapters."""
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class NotificationProvider:
    """Base notification provider."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        raise NotImplementedError


class ConsoleProvider(NotificationProvider):
    """Development provider - prints to stdout."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        logger.info(f"[NOTIFICATION] Channel={channel} Template={template} Payload={json.dumps(payload)}")
        print(f"📬 [NOTIFICATION] Channel={channel} Template={template} Payload={json.dumps(payload)}")
        return True


class EmailProvider(NotificationProvider):
    """Email provider stub - replace with actual SMTP/SendGrid/etc."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        # In production: send actual email
        logger.info(f"[EMAIL] Template={template} Payload={json.dumps(payload)}")
        print(f"📧 [EMAIL] Template={template} To=customer Payload={json.dumps(payload)}")
        return True


class SMSProvider(NotificationProvider):
    """SMS provider stub - replace with Twilio/etc."""
    def send(self, channel: str, template: str, payload: Optional[dict]) -> bool:
        # In production: send actual SMS
        logger.info(f"[SMS] Template={template} Payload={json.dumps(payload)}")
        print(f"📱 [SMS] Template={template} Payload={json.dumps(payload)}")
        return True


def get_provider(channel: str) -> NotificationProvider:
    """Get the appropriate provider for a channel."""
    providers = {
        "EMAIL": ConsoleProvider(),  # Use ConsoleProvider for dev
        "SMS": ConsoleProvider(),    # Use ConsoleProvider for dev
    }
    return providers.get(channel, ConsoleProvider())
