import logging
import os
from typing import Any, Dict, List, Optional

import requests

from config.whatsapp import WhatsAppConfig, get_whatsapp_config

logger = logging.getLogger(__name__)
WHATSAPP_DEFAULT_COUNTRY_CODE = os.environ.get('WHATSAPP_DEFAULT_COUNTRY_CODE', '+91')

# Meta requires business-initiated WhatsApp messages to use a pre-approved template (outside the
# 24-hour customer-service reply window, plain "text" messages are rejected). Template names below
# are placeholders to be created/approved in Meta WhatsApp Manager once WhatsApp is activated for
# this account - until then, sends are a soft-fail no-op (see WhatsAppConfig.is_valid).
DEFAULT_TEMPLATE_LANGUAGE_CODE = 'en'

# Expected body-parameter count for each template, used only to log/flag mismatches before
# sending - it never changes what gets sent. Update when a template's approved body variables
# change.
WHATSAPP_TEMPLATE_PARAM_COUNTS: Dict[str, int] = {
    'order_placed': 3,
    'order_confirmed': 2,
    'order_processing': 2,
    'order_packed': 2,
    'order_dispatched': 2,
    'order_delivered': 2,
    'order_cancelled': 3,
    'bulk_inquiry_update': 2,
    'credit_payment_reminder': 3,
}


def build_whatsapp_number(mobile: str, default_country_code: str) -> str:
    raw = mobile or ''
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ''

    # Remove leading zeros that may be present in local formatting
    digits = digits.lstrip('0')
    if len(digits) == 10:
        digits = default_country_code.lstrip('+') + digits
    if len(digits) < 10 or len(digits) > 15:
        return ''
    return digits


def send_whatsapp_message(
    config: WhatsAppConfig,
    to_number: str,
    message_type: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    if not config.is_valid:
        raise ValueError('WhatsApp configuration is incomplete')

    normalized_number = ''.join(ch for ch in to_number if ch.isdigit())
    if len(normalized_number) == 10:
        normalized_number = config.default_country_code.lstrip('+') + normalized_number
    if not normalized_number or len(normalized_number) < 10 or len(normalized_number) > 15:
        logger.warning('Invalid WhatsApp phone number after normalization: %s; message not sent', normalized_number)
        return {}

    to_number = normalized_number
    headers = {
        'Authorization': f'Bearer {config.access_token}',
        'Content-Type': 'application/json',
    }
    data = {
        'messaging_product': 'whatsapp',
        'to': to_number,
        'type': message_type,
        **payload,
    }
    logger.info('Sending WhatsApp message to %s via %s', to_number, config.api_url)

    try:
        resp = requests.post(config.api_url, headers=headers, json=data, timeout=15)
    except requests.RequestException:
        logger.exception('WhatsApp API request failed for %s', to_number)
        raise

    logger.info('HTTP status code: %s', resp.status_code)

    try:
        resp.raise_for_status()
    except requests.RequestException:
        logger.exception('WhatsApp API request failed for %s; response: %s', to_number, resp.text)
        raise

    return resp.json()


def send_text_message(config: WhatsAppConfig, to_number: str, text: str) -> Dict[str, Any]:
    """Free-form text message. Only valid inside Meta's 24-hour customer-service window (e.g.
    an admin replying to a customer who messaged first). Order lifecycle notifications should
    use send_template_message() instead, which is required for business-initiated messages."""
    return send_whatsapp_message(config, to_number, 'text', {'text': {'body': text}})


def _build_template_components(
    body_parameters: Optional[List[Any]] = None,
    header_document: Optional[Dict[str, str]] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Builds the `components` array of a WhatsApp template payload.

    - header_document, if given, becomes a `header` component with a document parameter.
    - body_parameters, if given, becomes a `body` component with one text parameter per value,
      in the same order as the template's {{1}}, {{2}}, ... placeholders.
    """
    components: List[Dict[str, Any]] = []
    if header_document:
        components.append({
            'type': 'header',
            'parameters': [{
                'type': 'document',
                'document': {
                    'link': header_document['link'],
                    'filename': header_document.get('filename', 'document.pdf'),
                },
            }],
        })
    if body_parameters:
        components.append({
            'type': 'body',
            'parameters': [{'type': 'text', 'text': str(value)} for value in body_parameters],
        })
    return components or None


def send_template_message(
    phone: str,
    template_name: str,
    body_parameters: Optional[List[Any]] = None,
    header_document: Optional[Dict[str, str]] = None,
    config: Optional[WhatsAppConfig] = None,
    language_code: str = DEFAULT_TEMPLATE_LANGUAGE_CODE,
) -> Optional[Dict[str, Any]]:
    """Reusable helper for sending an approved Meta WhatsApp Utility Template message - the
    single place that builds the Cloud API "template" payload, so every order lifecycle
    notification calls this instead of building its own payload.

    Returns the parsed Graph API JSON response, or None if the send was skipped (WhatsApp not
    configured) or failed - a notification failure never raises into the caller's order/business
    logic.
    """
    config = config or get_whatsapp_config()
    if not config.is_valid:
        logger.info('WhatsApp Cloud API not configured; template "%s" not sent to %s', template_name, phone)
        return None

    actual_param_count = len(body_parameters) if body_parameters else 0
    expected_param_count = WHATSAPP_TEMPLATE_PARAM_COUNTS.get(template_name)
    if expected_param_count is not None and actual_param_count != expected_param_count:
        logger.warning(
            'WhatsApp template "%s" parameter count mismatch: expected %s, got %s (values=%s)',
            template_name, expected_param_count, actual_param_count, body_parameters,
        )

    payload: Dict[str, Any] = {
        'template': {
            'name': template_name,
            'language': {'code': language_code},
        }
    }
    components = _build_template_components(body_parameters, header_document)
    if components:
        payload['template']['components'] = components

    try:
        return send_whatsapp_message(config, phone, 'template', payload)
    except Exception:
        logger.exception('Failed to send WhatsApp template "%s" to %s', template_name, phone)
        return None
