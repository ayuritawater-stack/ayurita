import logging
import os
from typing import Any, Dict, List, Optional

import requests

from config.whatsapp import WhatsAppConfig, get_whatsapp_config

logger = logging.getLogger(__name__)
WHATSAPP_DEFAULT_COUNTRY_CODE = os.environ.get('WHATSAPP_DEFAULT_COUNTRY_CODE', '+91')

# Meta requires business-initiated WhatsApp messages to use a pre-approved template (outside the
# 24-hour customer-service reply window, plain "text" messages are rejected). All templates are
# approved in English ('en'), which is send_template_message()'s default language_code.
DEFAULT_TEMPLATE_LANGUAGE_CODE = 'en'

# Expected body-parameter count for each approved template, exactly as defined in Meta WhatsApp
# Manager. Used only to log/flag mismatches before sending (Meta's Cloud API rejects a send with
# error #132000 if the count sent doesn't match the approved template) - it never changes what
# gets sent. Update this when a template's approved body variables change.
#
# Names and parameter orders below are identical to Kiran Traders' approved templates, so the same
# set can be approved once and used by both:
#   order_pending:          [customer_name, order_id, total_amount]
#   order_confirmation:     [customer_name, order_id, total_amount]
#   order_packed:           [customer_name, order_id]
#   order_out_for_dilivery: [customer_name, order_id]   <- misspelling is intentional; it is the
#                                                          exact approved name in WhatsApp Manager
#   order_delivered:        [customer_name, order_id]
#   order_cancelled:        [customer_name, order_id, total_amount]
#   password_reset:         [otp]  (Authentication category, not Utility - Meta's fixed
#                                   body/security-disclaimer/expiry, no customer name)
#
# The last two have no Kiran Traders counterpart: they belong to features only this app has
# (bulk inquiries, wholesale credit accounts), so they still need approving separately.
#   bulk_inquiry_update:     [contact_person, status]
#   credit_payment_reminder: [customer_name, amount_due, due_date]
WHATSAPP_TEMPLATE_PARAM_COUNTS: Dict[str, int] = {
    'order_pending': 3,
    'order_confirmation': 3,
    'order_packed': 2,
    'order_out_for_dilivery': 2,
    'order_delivered': 2,
    'order_cancelled': 3,
    'password_reset': 1,
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
    button_parameter: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Builds the `components` array of a WhatsApp template payload.

    - header_document, if given, becomes a `header` component with a document parameter.
    - body_parameters, if given, becomes a `body` component with one text parameter per value,
      in the same order as the template's {{1}}, {{2}}, ... placeholders.
    - button_parameter, if given, becomes a `button` component at index 0 with sub_type "url".
      Meta's Authentication-category templates implement their "Copy Code" button as a url-type
      button under the hood (an autofill deep link), so it still requires its own text parameter -
      the OTP - even though the body already carries the same value. Omitting this on a template
      that has such a button fails with #131008 "Button at index 0 of type Url requires a
      parameter".
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
    if button_parameter is not None:
        components.append({
            'type': 'button',
            'sub_type': 'url',
            'index': '0',
            'parameters': [{'type': 'text', 'text': str(button_parameter)}],
        })
    return components or None


def send_template_message(
    phone: str,
    template_name: str,
    body_parameters: Optional[List[Any]] = None,
    header_document: Optional[Dict[str, str]] = None,
    config: Optional[WhatsAppConfig] = None,
    language_code: str = DEFAULT_TEMPLATE_LANGUAGE_CODE,
    button_parameter: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Reusable helper for sending an approved Meta WhatsApp Utility Template message - the
    single place that builds the Cloud API "template" payload, so every order lifecycle
    notification calls this instead of building its own payload.

    button_parameter is the OTP for templates with a Copy-Code button (currently only
    password_reset) - see _build_template_components for why it is needed alongside
    body_parameters.

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
    logger.info(
        'WhatsApp template debug - Template Name: %s | Expected Parameters: %s | Actual Parameters: %s | Parameter Values: %s',
        template_name,
        expected_param_count if expected_param_count is not None else 'unknown',
        actual_param_count,
        body_parameters,
    )
    if expected_param_count is not None and actual_param_count != expected_param_count:
        logger.warning(
            'WhatsApp template "%s" parameter count mismatch: expected %s, got %s (values=%s) - Meta will reject this send with #132000',
            template_name, expected_param_count, actual_param_count, body_parameters,
        )

    payload: Dict[str, Any] = {
        'template': {
            'name': template_name,
            'language': {'code': language_code},
        }
    }
    components = _build_template_components(body_parameters, header_document, button_parameter)
    if components:
        payload['template']['components'] = components

    try:
        return send_whatsapp_message(config, phone, 'template', payload)
    except Exception:
        logger.exception('Failed to send WhatsApp template "%s" to %s', template_name, phone)
        return None
