"""
Registro de drivers.

Adicionar um equipamento novo = criar o arquivo do driver e registrá-lo
aqui. Nenhuma outra camada do Agent precisa saber que ele existe.
"""

from __future__ import annotations

from typing import Callable, Dict

from .base import BaseDroneDriver, DriverError, DriverInfo, DriverStatus
from .flow_ufo import FlowUfoDriver
from .local_sources import (
    SyntheticDriver,
    UsbCameraDriver,
    VideoFileDriver,
)
from .rtsp_generic import RtspGenericDriver

REGISTRY: Dict[str, Callable[..., BaseDroneDriver]] = {
    "flow-ufo": FlowUfoDriver,
    "rtsp": RtspGenericDriver,
    "usb": UsbCameraDriver,
    "file": VideoFileDriver,
    "synthetic": SyntheticDriver,
}


def build_driver(kind: str, **kwargs: object) -> BaseDroneDriver:
    """Cria um driver pelo nome. Levanta ValueError se não existir."""
    try:
        fabrica = REGISTRY[kind]
    except KeyError:
        disponiveis = ", ".join(sorted(REGISTRY))
        raise ValueError(f"driver desconhecido: {kind!r}. Disponíveis: {disponiveis}") from None
    return fabrica(**kwargs)  # type: ignore[arg-type]


__all__ = [
    "BaseDroneDriver", "DriverError", "DriverInfo", "DriverStatus",
    "FlowUfoDriver", "RtspGenericDriver",
    "UsbCameraDriver", "VideoFileDriver", "SyntheticDriver",
    "REGISTRY", "build_driver",
]
