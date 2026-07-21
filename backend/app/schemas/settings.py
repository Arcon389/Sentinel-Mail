from pydantic import BaseModel


class AppSettingsOut(BaseModel):
    maintenance_mode: bool

    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    maintenance_mode: bool
