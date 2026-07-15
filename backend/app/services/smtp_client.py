import smtplib
from email.mime.text import MIMEText

from app.config import get_settings


class SmtpNotConfiguredError(Exception):
    pass


class SmtpSendError(Exception):
    pass


def send_email(from_address: str, to_address: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise SmtpNotConfiguredError("SMTP_HOST is not configured")

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = from_address
    message["To"] = to_address

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(from_address, [to_address], message.as_string())
    except (smtplib.SMTPException, OSError) as exc:
        raise SmtpSendError(str(exc)) from exc
