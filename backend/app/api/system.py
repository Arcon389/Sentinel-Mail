from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.config import get_settings
from app.models.user import User
from app.services.smtp_client import SmtpNotConfiguredError, SmtpSendError, send_email

router = APIRouter(prefix="/api/system", tags=["system"], dependencies=[Depends(get_current_user)])


@router.get("/smtp-status")
def smtp_status() -> dict:
    settings = get_settings()
    return {"configured": bool(settings.smtp_host), "host": settings.smtp_host}


@router.post("/smtp-test")
def smtp_test(user: User = Depends(get_current_user)) -> dict:
    settings = get_settings()
    from_address = settings.smtp_username or user.email
    try:
        send_email(
            from_address,
            user.email,
            "Sentinel Mail — Testmail",
            "Diese Testmail bestätigt, dass der SMTP-Versand funktioniert.",
        )
    except SmtpNotConfiguredError:
        return {"success": False, "message": "SMTP ist nicht konfiguriert (SMTP_HOST fehlt)."}
    except SmtpSendError as exc:
        return {"success": False, "message": f"Versand fehlgeschlagen: {exc}"}
    return {"success": True, "message": f"Testmail an {user.email} gesendet."}
